"use client"

import React, { createContext, useContext, useState } from 'react';
import * as btc from '@scure/btc-signer';
import { hexToBytes, bytesToHex } from '@scure/base';
import axios from 'axios';
import { ProverResult } from '@/shared/types';

interface WalletContextType {
  address: string | null;
  walletConnected: boolean;
  connectWallet: () => Promise<void>;
  signAndBroadcastPackage: (result: ProverResult) => Promise<string | null>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [walletConnected, setWalletConnected] = useState(false);

  const connectWallet = async () => {
    if (typeof window !== 'undefined' && window.LeatherProvider) {
      try {
        const response = await window.LeatherProvider.request("getAddresses");
        const p2trAddress = response.result.addresses.find(
          (addr: any) => addr.type === 'p2tr'
        );

        if (p2trAddress) {
          setAddress(p2trAddress.address);
          setWalletConnected(true);
        }
      } catch (error) {
        console.error("Connection failed", error);
      }
    }
  };

  const signAndBroadcastPackage = async (result: ProverResult) => {
    if (!window.LeatherProvider) return null;

    try {
      // 1. Request signature for the Commit Transaction via PSBT [1, 2]
      const commitResponse = await window.LeatherProvider.request("signPsbt", {
        hex: result.commitTxHex, // Prover should return a PSBT-wrapped hex
        broadcast: false
      });

      // 2. Request signature for the Spell Transaction [2, 3]
      // The Spell spends the Commit output, so the wallet signs the remaining inputs
      const spellResponse = await window.LeatherProvider.request("signPsbt", {
        hex: result.spellTxHex,
        broadcast: false
      });

      const signedCommit = commitResponse.result.hex;
      const signedSpell = spellResponse.result.hex;

      // 3. Package Broadcasting [4, 5]
      // We send the signed hexes to our backend to perform the 'submitpackage' RPC call
      const broadcastResponse = await axios.post('/api/broadcast-package', {
        transactions: [signedCommit, signedSpell]
      });

      return broadcastResponse.data.txids[6]; // Return the Spell TxID
    } catch (error) {
      console.error("Signing/Broadcasting failed", error);
      throw error;
    }
  };

  return (
    <WalletContext.Provider value={{ address, walletConnected, connectWallet, signAndBroadcastPackage }}>
      {children}
    </WalletContext.Provider>
  );
}

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) throw new Error("useWallet must be used within WalletProvider");
  return context;
};