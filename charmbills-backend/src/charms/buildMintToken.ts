import { SpellRequest } from '../../../shared/types';
import * as dotenv from 'dotenv';
import path from 'path';
import * as constants from '../../../shared/constants';
import * as crypto from 'crypto';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../../backend/.env') });

const APP_VK = constants.HARDCODED_APP_VK;
const NFT_TICKER = constants.HARDCODED_NFT_TICKER;

/**
 * Derives the App ID (identity) from the UTXO ID via SHA256.
 * This must match the original ID used during the Plan NFT minting.
 */
function deriveAppId(utxoId: string): string {
  return crypto.createHash('sha256').update(utxoId).digest('hex');
}

/**
 * Builds the Spell JSON for minting Subscription Tokens using the Plan NFT authority.
 * REFINED: Uses dynamic authorityUtxo and searches the outputs array correctly.
 */
export function buildMintToken(request: SpellRequest): any {
  // 1. Validation
  if (request.type !== 'mint-token' || !request.authorityUtxo) {
    throw new Error("Invalid request for dynamic Token minting. Missing authorityUtxo.");
  }

  // 2. Locate outputs dynamically [3, 6]
  // The subscriber receives the tokens
  const tokenOutput = request.outputs.find(out => out.tokenAmount !== undefined);
  // The merchant receives the NFT authority back
  const nftReturnOutput = request.outputs.find(out => out.nftMetadata !== undefined || out.tokenAmount === undefined);

  if (!tokenOutput || !nftReturnOutput) {
    throw new Error("Token minting requires one token recipient and one NFT return address.");
  }

  // 3. Dynamic Identity derivation
  // In a professional flow, the authorityUtxo's origin defines the App ID [8].
  // If the authorityUtxo is the original mint, we derive it here.
  // Note: For multi-step chains, the frontend should pass the originalAppId.
  const appId = deriveAppId(request.authorityUtxo.split(':') + ':' + request.authorityUtxo.split(':')[13]);

  // 4. Construct Spell JSON [5, 14]
  const spell = {
    version: 8,
    apps: {
      "$00": `n/${appId}/${APP_VK}`, // NFT App (Authority)
      "$01": `t/${appId}/${APP_VK}`  // Token App (Subscription Units)
    },
    private_inputs: {
      // Identity anchor: must match the UTXO used to create the Plan NFT [6, 15]
      "$00": request.authorityUtxo 
    },
    ins: [
      {
        "utxo_id": request.authorityUtxo, // Spending the Merchant's Plan NFT
        "charms": {
          "$00": {
            "ticker": NFT_TICKER,
            "remaining": nftReturnOutput.nftMetadata?.remaining || 100000 
          }
        }
      }
    ],
    outs: [
      {
        "address": tokenOutput.address, // Subscriber address
        "charms": {
          "$01": tokenOutput.tokenAmount // 1 Token = 1 Month [16]
        },
        "sats": constants.MIN_OUTPUT_SATS
      },
      {
        "address": nftReturnOutput.address, // Merchant address
        "charms": {
          "$00": {
            "ticker": NFT_TICKER,
            // Decrement remaining supply for next subscriber
            "remaining": (nftReturnOutput.nftMetadata?.remaining || 100000) - (tokenOutput.tokenAmount || 1)
          }
        },
        "sats": constants.MIN_OUTPUT_SATS
      }
    ]
  };

  console.log(`[BUILDER] Generated Dynamic Token Spell for App ID: ${appId}`);
  return spell;
}

/**
 * Legacy helper for CLI testing
 */
export function createMintTokenSpellRequest(): SpellRequest {
  const subscriberAddress = process.env.SUBSCRIBER_ADDRESS!;
  const fundingUtxo = process.env.TOKEN_MINT_FUNDING_UTXO!;
  const fundingUtxoValue = Number(process.env.TOKEN_MINT_FUNDING_VALUE);
  const changeAddress = process.env.MERCHANT_CHANGE_ADDRESS!;
  const planNftUtxo = process.env.PLAN_NFT_UTXO!;

  return {
    type: 'mint-token',
    authorityUtxo: planNftUtxo,
    fundingUtxo,
    fundingUtxoValue,
    changeAddress,
    feeRate: constants.DEFAULT_FEE_RATE,
    outputs: [
      { address: subscriberAddress, tokenAmount: 1 },
      { address: changeAddress }
    ]
  };
}