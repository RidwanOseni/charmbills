import { SpellRequest, CharmPlanNFT } from '@/shared/types';
import * as dotenv from 'dotenv';
import path from 'path';
import * as constants from '@/shared/constants';
import * as crypto from 'crypto';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../../backend/.env') });

const NFT_MINT_UTXO_ID_FOR_APP_ID = process.env.NFT_MINT_UTXO_ID_FOR_APP_ID;
const MERCHANT_CHANGE_ADDRESS = process.env.MERCHANT_CHANGE_ADDRESS;
const NFT_TICKER = constants.HARDCODED_NFT_TICKER; // Fixed: TIKER -> NFT_TICKER
const APP_VK = constants.HARDCODED_APP_VK;

/**
 * Derives the App ID (identity) from the UTXO ID used for minting, via SHA256.
 */
function deriveAppId(utxoId: string): string {
    return crypto.createHash('sha256').update(utxoId).digest('hex');
}

/**
 * Builds the Spell JSON for minting the initial Plan NFT (authority object).
 */
export function buildMintNFT(
    request: SpellRequest
): { spell: any; appId: string } {
    if (
        request.type !== 'mint-nft' ||
        request.outputs.length !== 1 ||
        !NFT_MINT_UTXO_ID_FOR_APP_ID
    ) {
        throw new Error("Invalid request for NFT minting spell construction.");
    }

    const nftOutput = request.outputs[0];

    if (!nftOutput.nftMetadata) {
        throw new Error("NFT metadata must be provided for mint-nft spell.");
    }

    const inputUtxoId = NFT_MINT_UTXO_ID_FOR_APP_ID;
    const appId = deriveAppId(inputUtxoId);

    const spell = {
        version: 8,
        apps: {
            "$00": `n/${appId}/${APP_VK}` // Tag 'n' for NFT
        },
        private_inputs: {
            "$00": inputUtxoId // Required for app contract verification
        },
        ins: [
            {
                utxo_id: inputUtxoId, // UTXO used for app ID derivation
                charms: {} // No charms in input for minting a new NFT
            }
        ],
        outs: [
            {
                address: nftOutput.address,
                charms: {
                    "$00": { // Charm data for the newly minted NFT
                        ticker: nftOutput.nftMetadata.ticker || NFT_TICKER,
                        remaining: nftOutput.nftMetadata.remaining,
                        serviceName: nftOutput.nftMetadata.serviceName,
                        iconUrl: nftOutput.nftMetadata.iconUrl
                    }
                },
                sats: constants.MIN_OUTPUT_SATS
            }
        ]
    };

    return { spell, appId };
}

/**
 * Create NFT SpellRequest helper (for runMintFlow.ts)
 */
export function createMintNftSpellRequest(): SpellRequest {
    const fundingUtxo = process.env.NFT_MINT_FUNDING_UTXO!;
    const fundingUtxoValue = Number(process.env.NFT_MINT_FUNDING_VALUE);
    const changeAddress = MERCHANT_CHANGE_ADDRESS!;
    const NFT_TICKER = constants.HARDCODED_NFT_TICKER; // Fixed naming

    if (!fundingUtxo || isNaN(fundingUtxoValue) || !changeAddress) {
        throw new Error("Missing or invalid environment variables for NFT Mint SpellRequest.");
    }

    const nftMetadata: CharmPlanNFT['metadata'] = {
        serviceName: "Pro AI Access Plan",
        ticker: NFT_TICKER, // Use consistent variable name
        remaining: Number(process.env.NFT_REMAINING_SUPPLY_IN),
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

/**
 * Fetches the previous raw transaction hex required by the Prover API.
 */
export function fetchPrevTxHex(envVarName: string): string {
    const prevTxHex = process.env[envVarName];

    if (!prevTxHex) {
        throw new Error(
            `Previous transaction hex not set in environment variables: ${envVarName}`
        );
    }

    // Log raw hex
    console.log(`[DEBUG] Raw hex from ${envVarName} (Length: ${prevTxHex.length})`);

    // Remove any non-hex characters
    const sanitizedHex = prevTxHex.replace(/[^0-9a-fA-F]/g, '');

    console.log(`[DEBUG] Sanitized hex length: ${sanitizedHex.length}`);
    console.log(`[DEBUG] Sanitized hex (first 100 chars): ${sanitizedHex.slice(0, 100)}...`);
    console.log(`[DEBUG] Sanitized hex (last 100 chars): ${sanitizedHex.slice(-100)}...`);

    return sanitizedHex;
}