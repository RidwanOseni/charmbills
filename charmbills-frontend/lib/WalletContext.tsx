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
                // 3. Metadata Assignment for preserved inputs
                const isAnchor = (rawTxid.toLowerCase() === anchorTxid.toLowerCase() || 
                                  reversedTxid.toLowerCase() === anchorTxid.toLowerCase()) && 
                                 input.index === parseInt(anchorVoutStr);

                let amount: bigint;
                let script: Uint8Array;

                if (isAnchor) {
                    amount = BigInt(dualUtxoContext.anchor.value);
                    script = actualAnchorScript;
                } else if (targetTxid !== feeTxid) { 
                    // If we are in Step 2 (Spell), the non-target input is the COMMIT spend
                    // Use the values we got from the finalized Step 1 transaction
                    amount = BigInt(dualUtxoContext.commit.value); 
                    script = dualUtxoContext.commit.script;
                } else {
                    amount = BigInt(dualUtxoContext.fee.value);
                    script = payment.script;
                }

                const preservedInput: any = {
                    txid: rawTxid,
                    index: input.index,
                    witnessUtxo: { amount, script },
                    tapInternalKey: payment.tapInternalKey, // CRITICAL: Fixes "unknown input"
                    sequence: input.sequence
                };

                // FIXED: Properly check for inputWitness existence and length
                const inputWitness = decoded.witnesses ? decoded.witnesses[index] : undefined;
                if (inputWitness && inputWitness.length > 0) {
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

        console.log('🔍 Debugging raw spell transaction:');
        console.log('Spell raw hex length:', spellRaw.length);
        console.log('Spell hex first 100 chars:', spellRaw.substring(0, 100) + '...');

        try {
          const debugSpellTx = btc.RawTx.decode(hexToBytes(spellRaw));
          console.log('Inputs count:', debugSpellTx.inputs.length);
          
          debugSpellTx.inputs.forEach((input: any, i: number) => {
            // FIX: Handle the input hash properly - use type assertion to access the hash property
            const inputHash = (input as any).hash || (input as any).txid;
            const txid = inputHash ? bytesToHex(Uint8Array.from(inputHash)) : 'unknown';
            
            // FIXED: Properly handle optional witnesses with explicit checks
            const witnessEntry = debugSpellTx.witnesses && debugSpellTx.witnesses[i];
            const hasWitness = !!witnessEntry && witnessEntry.length > 0;
            const witnessLength = witnessEntry ? witnessEntry.length : 0;
            
            console.log(`Input ${i}:`, {
              txid: txid,
              vout: input.index,
              hasWitness: hasWitness,
              witnessLength: witnessLength
            });
          });
          
          console.log('Outputs count:', debugSpellTx.outputs.length);
          debugSpellTx.outputs.forEach((output, i) => {
            console.log(`Output ${i}:`, {
              amount: output.amount,
              scriptLength: output.script.length
            });
          });
        } catch (debugError) {
          console.error('Failed to decode spell transaction:', debugError);
        }
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

      // ========== CRITICAL FIX: Add commit output to dualUtxoContext ==========
      // This is needed for the spell transaction buildTaprootPsbt
      dualUtxoContext.commit = {
        txid: commitTxId,
        vout: 0,
        value: Number(commitOutput.amount),
        script: commitOutputScript
      };

      // 4. SIGN SPELL TRANSACTION (Spends Commit Output 0)
      console.log('🔐 Step 2: Signing Spell Transaction...');
      
      // ========== FRIEND'S FIX START ==========
      // 1. Get the actual anchor script from the hex we already have
      const anchorTx = btc.RawTx.decode(hexToBytes(dualUtxoContext.anchor.hex));
      const [anchorTxid, anchorVoutStr] = dualUtxoContext.anchor.utxoId.split(':');
      const anchorVout = parseInt(anchorVoutStr);
      const actualAnchorScript = anchorTx.outputs[anchorVout].script;

      // 2. Build the PSBT targeting the Anchor UTXO (Friend's key fix)
      const spellPsbt = buildTaprootPsbt(
        spellRaw,
        anchorTxid, // TARGET: Anchor TxID (not commit output)
        anchorVout, // TARGET: Anchor Vout
        dualUtxoContext.anchor.value, // Anchor value
        actualAnchorScript, // Using the decoded on-chain script
        dualUtxoContext, 
        taprootPublicKey
      );

      // 3. Request signature for Input 0 (the Anchor)
      const spellRes = await (window as any).LeatherProvider.request("signPsbt", {
        hex: spellPsbt,
        network: "testnet",
        broadcast: false,
        signAtIndex: 0 
      });

      console.log('✅ Spell PSBT signed by wallet');

// ========== COMPLETE MANUAL FINALIZATION FIX ==========
// 1. Create the transaction object from the PSBT returned by the wallet
// 1. Create the transaction object from the PSBT returned by Leather
const spellTransaction = btc.Transaction.fromPSBT(hexToBytes(spellRes.result.hex));

// 2. RE-ATTACH Input 1's witness (Charms Proof) - FIXED INDEX [1] not [8]
const originalSpellTx = btc.RawTx.decode(hexToBytes(spellRaw));
if (originalSpellTx.witnesses && originalSpellTx.witnesses[1]) {
    spellTransaction.updateInput(1, { 
        finalScriptWitness: originalSpellTx.witnesses[1] 
    });
    console.log('✅ Applied Input 1 witness via updateInput');
} else {
    console.error('❌ Could not find original witness for Input 1');
    console.log('Available witnesses:', originalSpellTx.witnesses?.length || 0);
    throw new Error('Missing Charms proof witness for Input 1');
}

// 3. MANUAL FINALIZATION for Input 0 (Wallet's Signature)
const walletInputCopy = spellTransaction.getInput(0);
let walletWitness: Uint8Array[] | undefined;

if (walletInputCopy.tapKeySig) {
    walletWitness = [walletInputCopy.tapKeySig];
    console.log('✅ Using tapKeySig for Input 0');
} else if (walletInputCopy.partialSig && walletInputCopy.partialSig.length > 0) {
    // Schnorr signatures are usually at index 4, fallback to first
    // FIX: Handle the tuple type [Bytes, Bytes] properly
    const schnorrSigTuple = walletInputCopy.partialSig[4] || walletInputCopy.partialSig[0];
    if (schnorrSigTuple && Array.isArray(schnorrSigTuple) && schnorrSigTuple.length > 0) {
        // For Schnorr signatures, we need just the signature (usually the second element)
        // or we can use the first element if it's the signature
        const schnorrSig = schnorrSigTuple[1] || schnorrSigTuple[0];
        if (schnorrSig) {
            walletWitness = [schnorrSig];
            console.log('✅ Using partialSig for Input 0');
        }
    }
}

if (walletWitness) {
    spellTransaction.updateInput(0, { 
        finalScriptWitness: walletWitness 
    });
    console.log('✅ Applied Input 0 witness via updateInput');
} else {
    console.error('❌ No signature found for Input 0');
    console.log('Input 0 debug:', {
        hasTapKeySig: !!walletInputCopy.tapKeySig,
        partialSigLength: walletInputCopy.partialSig?.length || 0,
        partialSigKeys: walletInputCopy.partialSig ? Object.keys(walletInputCopy.partialSig) : []
    });
    throw new Error('Wallet did not provide signature for Input 0');
}

// 4. DEBUG: Verify updates were applied
console.log('🔍 Post-update verification:', {
    input0HasWitness: !!spellTransaction.getInput(0).finalScriptWitness,
    input1HasWitness: !!spellTransaction.getInput(1).finalScriptWitness
});

// 5. Extract final hex
const signedSpellHex = bytesToHex(spellTransaction.extract());
console.log('✅ Transaction extracted successfully, hex length:', signedSpellHex.length);
      // ========== END MANUAL FINALIZATION FIX ==========

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