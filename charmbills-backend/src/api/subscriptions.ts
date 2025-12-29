import { Request, Response } from 'express';
import { generateUnsignedTransactions } from '../charms/proverClient';
import { SpellRequest, ProverResult } from '../../../shared/types';
import * as constants from '../../../shared/constants';

/**
 * Endpoint to generate the Subscription Token transactions.
 * Triggered by the Subscribe Page when a user clicks "Subscribe Now".
 */
export async function mintSubscriptionToken(req: Request, res: Response) {
  try {
    const { authorityUtxo, fundingUtxo, fundingValue, prevTxHex, subscriberAddress, merchantAddress } = req.body;

    // 1. Construct the SpellRequest for Token Minting [14]
    const request: SpellRequest = {
      type: 'mint-token',
      authorityUtxo: authorityUtxo, // The Plan NFT UTXO serving as authority
      fundingUtxo: fundingUtxo,     // Subscriber's dynamic funding UTXO
      fundingUtxoValue: fundingValue,
      changeAddress: merchantAddress,
      feeRate: constants.DEFAULT_FEE_RATE,
      outputs: [
        {
          address: subscriberAddress,
          tokenAmount: 1 // 1 Token = 1 Billing Cycle [16]
        },
        {
          address: merchantAddress // Authority returned to merchant [14]
        }
      ]
    };

    // 2. Generate unsigned transactions using dynamic hexes from frontend [12, 15]
    const { commitTxHex, spellTxHex } = await generateUnsignedTransactions(request, [prevTxHex]);

    const result: ProverResult = {
      commitTxHex,
      spellTxHex
    };

    return res.status(200).json(result);

  } catch (error: any) {
    console.error("Subscription Token Generation Failed:", error.message);
    return res.status(500).json({ error: error.message });
  }
}