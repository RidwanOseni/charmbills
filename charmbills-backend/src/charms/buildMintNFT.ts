// File: charmbills-backend/src/charms/buildMintNFT.ts
import { SpellRequest, CharmPlanNFT } from '../../../shared/types';
import * as dotenv from 'dotenv';
import path from 'path';
import * as constants from '../../../shared/constants';
import * as crypto from 'crypto';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../../backend/.env') });

const MERCHANT_CHANGE_ADDRESS = process.env.MERCHANT_CHANGE_ADDRESS;
const APP_VK = constants.HARDCODED_APP_VK;
const NFT_TICKER = constants.HARDCODED_NFT_TICKER;

/**
 * Derives the App ID (identity) from the UTXO ID used for minting, via SHA256.
 * Recommended: app_id is the SHA256 digest of the anchor UTXO [7, 9].
 */
function deriveAppId(utxoId: string): string {
  return crypto.createHash('sha256').update(utxoId).digest('hex');
}

/**
 * Builds the Spell JSON for minting the initial Plan NFT (authority object).
 * Uses anchorUtxo for appId and ins array, while fundingUtxo is used by Prover for fees.
 */
export function buildMintNFT(
  request: SpellRequest
): { spell: any; appId: string } {
  // Debug log to see what we're receiving
  console.log('[BUILDER] Received request with:', {
    type: request.type,
    anchorUtxo: request.anchorUtxo,
    anchorValue: request.anchorValue,
    changeAddress: request.changeAddress
  });

  // Validate request for NFT minting
  if (
    request.type !== 'mint-nft' ||
    request.outputs.length !== 1 || // Should be exactly 1 output for NFT minting
    !request.anchorUtxo ||
    !request.anchorValue  // NEW: We need anchorValue to calculate change
  ) {
    throw new Error("Invalid request for dynamic NFT minting spell construction. Both anchorUtxo and anchorValue are required.");
  }

  // FIXED: Access the first element of the array to get the address and metadata
  const nftOutput = request.outputs[0]; // Use [0] to get the first output object

  if (!nftOutput.nftMetadata) {
    throw new Error("NFT metadata must be provided for mint-nft spell.");
  }

  // Use dedicated anchor UTXO for app identity [7]
  const inputUtxoId = request.anchorUtxo;
  const appId = deriveAppId(inputUtxoId); // appId is SHA256 of anchor UTXO [9]

  // ========== IMPORTANT FIX: CALCULATE CHANGE ==========
  // The anchor UTXO has a certain amount of satoshis (e.g., 10,000)
  // We need to create a change output for the remaining satoshis after the NFT
  
  const anchorValue = request.anchorValue; // e.g., 10000 satoshis
  const nftSats = constants.MIN_OUTPUT_SATS; // NFT costs 1000 satoshis
  const changeSats = anchorValue - nftSats; // e.g., 10000 - 1000 = 9000
  
  console.log('[BUILDER] Calculating change:', {
    anchorValue,
    nftSats,
    changeSats
  });
  
  // Check if we have enough money
  if (changeSats < 0) {
    throw new Error(`Not enough money! Anchor UTXO has ${anchorValue} sats, but NFT needs ${nftSats} sats.`);
  }
  
  // Warning if change is very small
  if (changeSats < constants.MIN_OUTPUT_SATS) {
    console.warn(`[WARNING] Change output (${changeSats} sats) is below dust limit. Consider using a larger anchor UTXO.`);
  }

  const spell = {
    version: 8, // Current protocol version [4]
    apps: {
      "$00": `n/${appId}/${APP_VK}` // 'n' tag for NFT authority [5]
    },
    private_inputs: {
      // Establish app identity relative to the anchor UTXO [10]
      "$00": inputUtxoId 
    },
    ins: [
      {
        "utxo_id": inputUtxoId, // Anchor input [10]
        "charms": {} // Initial minting has no charms in input [6]
      }
    ],
    // ========== FIXED: ADD CHANGE OUTPUT ==========
    outs: [
      {
        "address": nftOutput.address, // The NFT goes here
        "charms": {
          "$00": { // Metadata for the Plan NFT [5]
            "ticker": nftOutput.nftMetadata.ticker || NFT_TICKER,
            "remaining": nftOutput.nftMetadata.remaining,
            "serviceName": nftOutput.nftMetadata.serviceName,
            "iconUrl": nftOutput.nftMetadata.iconUrl || 'https://charmbills.dev/pro.svg'
          }
        },
        "sats": nftSats // NFT costs 1000 satoshis
      },
      {
        "address": request.changeAddress, // CHANGE OUTPUT: Remaining money goes back to merchant
        "charms": {}, // No charms in change output
        "sats": changeSats // e.g., 9000 satoshis
      }
    ]
  };

  console.log(`[BUILDER] Generated Dynamic NFT Spell for App ID: ${appId}`);
  console.log(`[BUILDER] Transaction balanced: ${anchorValue} in = ${nftSats} (NFT) + ${changeSats} (change) sats`);
  
  return { spell, appId };
}

/**
 * Create NFT SpellRequest helper (legacy support for CLI testing)
 */
export function createMintNftSpellRequest(): SpellRequest {
  const fundingUtxo = process.env.NFT_MINT_FUNDING_UTXO!;
  const fundingUtxoValue = Number(process.env.NFT_MINT_FUNDING_VALUE);
  const changeAddress = MERCHANT_CHANGE_ADDRESS!;

  if (!fundingUtxo || isNaN(fundingUtxoValue) || !changeAddress) {
    throw new Error("Missing or invalid environment variables for NFT Mint SpellRequest.");
  }

  const nftMetadata: CharmPlanNFT['metadata'] = {
    serviceName: "Pro AI Access Plan",
    ticker: NFT_TICKER,
    remaining: Number(process.env.NFT_REMAINING_SUPPLY_IN) || 100000,
    iconUrl: 'https://charmbills.dev/pro.svg'
  };

  return {
    type: 'mint-nft',
    fundingUtxo,
    fundingUtxoValue,
    changeAddress,
    feeRate: constants.DEFAULT_FEE_RATE,
    outputs: [
      {
        address: changeAddress,
        nftMetadata
      }
    ]
  };
}