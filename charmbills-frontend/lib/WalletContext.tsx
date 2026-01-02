"use client"
import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { ProverResult } from '../../shared/types';
import * as btc from '@scure/btc-signer';
import { hexToBytes, bytesToHex } from '@noble/hashes/utils';

interface WalletContextType {
  address: string | null;
  walletConnected: boolean;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  signAndBroadcastPackage: (result: ProverResult, dualUtxoContext: any) => Promise<string[] | null>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

const TESTNET = { bech32: 'tb', pubKeyHash: 0x6f, scriptHash: 0xc4, wif: 0xef };

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [walletConnected, setWalletConnected] = useState(false);
  const [taprootPublicKey, setTaprootPublicKey] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("charm_wallet_address");
    const savedPubKey = localStorage.getItem("charm_taproot_pubkey");
    if (saved) { setAddress(saved); setWalletConnected(true); }
    if (savedPubKey) setTaprootPublicKey(savedPubKey);
  }, []);

  const connectWallet = async () => {
    if (typeof window !== 'undefined' && (window as any).LeatherProvider) {
      const response = await (window as any).LeatherProvider.request("getAddresses");
      const p2tr = response.result.addresses.find((a: any) => a.type === 'p2tr');
      if (p2tr) {
        setAddress(p2tr.address);
        setWalletConnected(true);
        setTaprootPublicKey(p2tr.publicKey);
        localStorage.setItem("charm_wallet_address", p2tr.address);
        localStorage.setItem("charm_taproot_pubkey", p2tr.publicKey);
      }
    }
  };

  const disconnectWallet = () => {
    setAddress(null); setWalletConnected(false); setTaprootPublicKey(null);
    localStorage.removeItem("charm_wallet_address");
    localStorage.removeItem("charm_taproot_pubkey");
  };

  /**
   * Helper: Creates Taproot payment object
   */
  function getTaprootPayment(pubKeyHex: string) {
    const schnorrKey = hexToBytes(pubKeyHex).slice(1);
    return btc.p2tr(schnorrKey, undefined, TESTNET);
  }

  /**
   * Builds a Taproot PSBT with dual UTXO context support
   */
  const buildTaprootPsbt = (
    rawHex: string,
    targetTxid: string,     // The parent ID we are trying to spend
    targetVout: number,
    targetValue: number,
    targetScript: Uint8Array,
    dualUtxoContext: any,   // Full context for Anchor and Fee
    pubKeyHex: string
): string => {
    try {
        console.group(`🔍 [PSBT DIAGNOSTIC] Searching for Parent: ${targetTxid}:${targetVout}`);
        
        const payment = getTaprootPayment(pubKeyHex);
        const psbtTx = new btc.Transaction();
        const decoded = btc.RawTx.decode(hexToBytes(rawHex));

        // 1. Decode the actual anchor provenance (FIX IMPLEMENTED)
        const anchorTx = btc.RawTx.decode(hexToBytes(dualUtxoContext.anchor.hex));
        const [_, anchorVoutStr] = dualUtxoContext.anchor.utxoId.split(':');
        const anchorVout = parseInt(anchorVoutStr);
        const actualAnchorScript = anchorTx.outputs[anchorVout].script;
        
        console.log(`✅ Decoded anchor transaction: ${dualUtxoContext.anchor.utxoId}`);
        console.log(`✅ Extracted actual anchor script: ${bytesToHex(actualAnchorScript)}`);

        decoded.outputs.forEach((out: any) => psbtTx.addOutput({ amount: out.amount, script: out.script }));

        decoded.inputs.forEach((input: any, index: number) => {
            // 1. Generate both ID formats to handle byte-order (endianness) differences [3, 6]
            const rawTxid = bytesToHex(Uint8Array.from(input.hash || input.txid));
            const reversedTxid = bytesToHex(Uint8Array.from(input.hash || input.txid).reverse());
            
            console.log(`[Input ${index}] Comparing against Target:`);
            console.log(`   - Raw TxID:      ${rawTxid}`);
            console.log(`   - Reversed TxID: ${reversedTxid}`);
            console.log(`   - Input Vout:    ${input.index}`);

            // 2. Precise Identity Matching with case-insensitivity [7, 8]
            const isSignableInput = (
                rawTxid.toLowerCase() === targetTxid.toLowerCase() || 
                reversedTxid.toLowerCase() === targetTxid.toLowerCase()
            ) && input.index === targetVout;

            const [anchorTxid, anchorVoutStr] = dualUtxoContext.anchor.utxoId.split(':');
            const [feeTxid, feeVoutStr] = dualUtxoContext.fee.utxoId.split(':');
            
            const isAnchor = (rawTxid.toLowerCase() === anchorTxid.toLowerCase() || 
                              reversedTxid.toLowerCase() === anchorTxid.toLowerCase()) && 
                             input.index === parseInt(anchorVoutStr);

            if (isSignableInput) {
                console.log(`   ✅ MATCH FOUND: Input ${index} is the Signable Parent.`);
                psbtTx.addInput({
                    txid: targetTxid, // Use the ID format the wallet expects
                    index: targetVout,
                    witnessUtxo: { amount: BigInt(targetValue), script: targetScript },
                    tapInternalKey: payment.tapInternalKey,
                    sequence: input.sequence
                });
            } else {
                // 3. Metadata Assignment for preserved inputs (Fee or Anchor) [9, 10]
                const context = isAnchor ? dualUtxoContext.anchor : dualUtxoContext.fee;
                console.log(`   📦 PRESERVING: Input ${index} assigned to ${isAnchor ? 'ANCHOR' : 'FEE'} context (Value: ${context.value} sats)`);

                const preservedInput: any = {
                  txid: isAnchor ? anchorTxid : rawTxid,
                    index: input.index,
                    witnessUtxo: {
                        amount: BigInt(context.value),
                        // FIX: Use the actual script from the provenance hex, not your wallet script
                        script: isAnchor ? actualAnchorScript : payment.script 
                    },
                    sequence: input.sequence
                };

                // 4. WITNESS GUARD: Prevent "empty finalScriptWitness" crash [11, 12]
                const inputWitness = decoded.witnesses ? decoded.witnesses[index] : undefined;
                if (inputWitness && Array.isArray(inputWitness) && inputWitness.length > 0) {
                    console.log(`   🔗 ATTACHING: Witness data preserved for Input ${index}`);
                    preservedInput.finalScriptWitness = inputWitness;
                }

                psbtTx.addInput(preservedInput);
            }
        });

        console.groupEnd();
        return bytesToHex(psbtTx.toPSBT());
    } catch (error) {
        console.error('❌ PSBT construction failed:', error);
        console.groupEnd();
        throw error;
    }
};

  const signAndBroadcastPackage = async (result: ProverResult, dualUtxoContext: any) => {
    if (!(window as any).LeatherProvider || !address || !taprootPublicKey) {
      console.error('Missing required data for signing');
      return null;
    }

    try {
      console.group('[Wallet Context] Sequential Signing with Dual UTXO Context');
      console.log('Dual UTXO Context:', dualUtxoContext);

      // 1. Extract raw hexes
      const commitRaw = typeof result.commitTxHex === 'object' 
        ? (result.commitTxHex as any).bitcoin 
        : result.commitTxHex;
      const spellRaw = typeof result.spellTxHex === 'object' 
        ? (result.spellTxHex as any).bitcoin 
        : result.spellTxHex;

      // Parse UTXOs from context
      const [feeTxid, feeVoutStr] = dualUtxoContext.fee.utxoId.split(':');
      const feeVout = parseInt(feeVoutStr);
      
      console.log('📦 Transaction Details:');
      console.log('- Anchor UTXO:', dualUtxoContext.anchor.utxoId);
      console.log('- Anchor value:', dualUtxoContext.anchor.value);
      console.log('- Fee UTXO:', dualUtxoContext.fee.utxoId);
      console.log('- Fee value:', dualUtxoContext.fee.value);

      // 2. Get Taproot payment for wallet address
      const payment = getTaprootPayment(taprootPublicKey);

      // 3. SIGN COMMIT TRANSACTION (Spends Fee UTXO)
      console.log('🔐 Step 1: Signing Commit Transaction...');
      const commitPsbt = buildTaprootPsbt(
        commitRaw,
        feeTxid, feeVout, dualUtxoContext.fee.value, payment.script, // Target (Fee UTXO)
        dualUtxoContext,  // Pass dual context
        taprootPublicKey
      );

      const commitRes = await (window as any).LeatherProvider.request("signPsbt", { 
        hex: commitPsbt, 
        network: "testnet", 
        broadcast: false 
      });

      console.log('✅ Commit PSBT signed by wallet');

      // Finalize commit transaction
      const finalizedCommit = btc.Transaction.fromPSBT(hexToBytes(commitRes.result.hex));
      finalizedCommit.finalize();
      const signedCommitHex = bytesToHex(finalizedCommit.extract());
      
      // Get commit transaction ID and first output
      const commitTxId = finalizedCommit.id;
      const commitOutput = finalizedCommit.getOutput(0);
      
      if (!commitOutput || !commitOutput.amount || !commitOutput.script) {
        console.error('❌ Commit transaction output is invalid:', commitOutput);
        throw new Error('Commit transaction has invalid or missing output');
      }

      // Convert Bytes to Uint8Array
      const commitOutputScript = commitOutput.script instanceof Uint8Array 
        ? commitOutput.script 
        : new Uint8Array(commitOutput.script);

      console.log('📊 Commit Transaction Info:');
      console.log('- Commit TXID:', commitTxId);
      console.log('- Commit output amount:', commitOutput.amount.toString());
      console.log('- Commit output script length:', commitOutputScript.length);

      // 4. SIGN SPELL TRANSACTION (Spends Commit Output 0)
      console.log('🔐 Step 2: Signing Spell Transaction...');
      const spellPsbt = buildTaprootPsbt(
        spellRaw,
        commitTxId, 0, Number(commitOutput.amount), commitOutputScript, // Target (Commit Output)
        dualUtxoContext,  // Pass dual context (provides anchor UTXO data for preserved input)
        taprootPublicKey
      );

      const spellRes = await (window as any).LeatherProvider.request("signPsbt", {
        hex: spellPsbt,
        network: "testnet",
        broadcast: false,
        signAtIndex: 1
      });

      console.log('✅ Spell PSBT signed by wallet');

      // Finalize spell transaction
      const finalizedSpell = btc.Transaction.fromPSBT(hexToBytes(spellRes.result.hex));
      finalizedSpell.finalize();
      const signedSpellHex = bytesToHex(finalizedSpell.extract());

      console.log('📦 Ready for broadcast:');
      console.log('- Signed commit hex length:', signedCommitHex.length);
      console.log('- Signed spell hex length:', signedSpellHex.length);

      // 5. BROADCAST AS PACKAGE
      console.log('📤 Broadcasting transaction package...');
      const broadcastResponse = await axios.post('http://localhost:3002/api/broadcast-package', {
        transactions: [signedCommitHex, signedSpellHex]
      });

      // Validate package status
      const data = broadcastResponse.data.txids;
      
      if (data.package_msg === 'transaction failed') {
        const errorDetail = Object.values(data['tx-results'])
          .map((r: any) => r.error)
          .find(err => err !== null);
        
        throw new Error(errorDetail || 'Transaction package rejected by network');
      }

      // Extract txid strings
      const txidStrings = Object.values(data['tx-results'])
        .map((res: any) => res.txid);

      console.log('🎉 Broadcast successful! TXIDs:', txidStrings);
      console.groupEnd();
      
      return txidStrings;

    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message;
      console.error('❌ Signing/Broadcasting failed:', errorMessage);
      console.groupEnd();
      throw new Error(errorMessage);
    }
  };

  return (
    <WalletContext.Provider value={{ 
      address, 
      walletConnected, 
      connectWallet, 
      disconnectWallet, 
      signAndBroadcastPackage 
    }}>
      {children}
    </WalletContext.Provider>
  );
}

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) throw new Error("useWallet missing");
  return context;
};