import { SpellRequest } from '@/shared/types';
import * as dotenv from 'dotenv';
import path from 'path';
import * as constants from '@/shared/constants';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../../backend/.env') });

const PLAN_NFT_APP_ID = process.env.PLAN_NFT_APP_ID;
const NFT_TICKER = constants.HARDCODED_NFT_TICKER;
const APP_VK = constants.HARDCODED_APP_VK;
const NFT_REMAINING_IN = Number(process.env.NFT_REMAINING_SUPPLY_IN);
const NFT_REMAINING_OUT = Number(process.env.NFT_REMAINING_SUPPLY_OUT);
const NFT_MINT_UTXO_ID_FOR_APP_ID = process.env.NFT_MINT_UTXO_ID_FOR_APP_ID; // Added

/**
 * Builds the Spell JSON for minting Subscription Tokens using the Plan NFT authority.
 */
export function buildMintToken(request: SpellRequest): any {
    if (request.type !== 'mint-token' || !request.authorityUtxo || !PLAN_NFT_APP_ID || !NFT_MINT_UTXO_ID_FOR_APP_ID) {
        throw new Error("Invalid request for Token minting spell construction. Missing required parameters.");
    }

    const tokenOutput = request.outputs.find(out => out.tokenAmount);
    const nftReturnOutput = request.outputs.find(out => !out.tokenAmount);

    if (!tokenOutput || !nftReturnOutput) {
        throw new Error("Token minting requires exactly one token output and one NFT return output.");
    }

    // 1. Define App Identifiers
    const apps = {
        "$00": `n/${PLAN_NFT_APP_ID}/${APP_VK}`, // NFT app
        "$01": `t/${PLAN_NFT_APP_ID}/${APP_VK}`  // Token app
    };

    // 2. Define Private Inputs (required for NFT identity verification)
    const private_inputs = {
        "$00": NFT_MINT_UTXO_ID_FOR_APP_ID // Original UTXO used to derive app ID
    };

    // 3. Define Inputs (Spending the NFT UTXO - authority)
    const ins = [
        {
            "utxo_id": request.authorityUtxo, 
            "charms": {
                // The input must contain the NFT charm to prove authority
                "$00": {
                    "ticker": NFT_TICKER,
                    "remaining": NFT_REMAINING_IN,
                    "serviceName": "Pro AI Access Plan",
                    "iconUrl": "https://charmbills.dev/pro.svg"
                }
            }
        }
    ];

    // 4. Define Outputs (Minting Tokens & Preserving NFT)
    const outs = [
        // Output 1: Send the newly minted Subscription Tokens to the customer
        {
            "address": tokenOutput.address, 
            "charms": {
                // $01 represents the fungible token being minted
                "$01": tokenOutput.tokenAmount
            },
            "sats": constants.MIN_OUTPUT_SATS
        },
        // Output 2: Send the NFT Authority back to the Merchant
        {
            "address": nftReturnOutput.address,
            "charms": {
                // The NFT charm ($00) is preserved with updated remaining supply
                "$00": {
                    "ticker": NFT_TICKER,
                    "remaining": NFT_REMAINING_OUT,
                    "serviceName": "Pro AI Access Plan",
                    "iconUrl": "https://charmbills.dev/pro.svg"
                }
            },
            "sats": constants.MIN_OUTPUT_SATS
        }
    ];

    // 5. Construct the final Spell JSON
    const spell = {
        "version": 8,
        "apps": apps,
        "private_inputs": private_inputs, // Added: Required for NFT identity verification
        "ins": ins,
        "outs": outs
    };

    console.log(`[DEBUG] Token minting spell constructed:`);
    console.log(`- Input NFT UTXO: ${request.authorityUtxo}`);
    console.log(`- Private input (w): ${NFT_MINT_UTXO_ID_FOR_APP_ID}`);
    console.log(`- Token amount: ${tokenOutput.tokenAmount}`);
    console.log(`- NFT remaining in: ${NFT_REMAINING_IN} -> out: ${NFT_REMAINING_OUT}`);
    console.log(`- App ID: ${PLAN_NFT_APP_ID}`);
    console.log(`- App VK: ${APP_VK.substring(0, 16)}...`);
    console.log("Spell JSON for token minting:", JSON.stringify(spell, null, 2));
    
    return spell;
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
    
    // Remove any non-hex characters
    const sanitizedHex = prevTxHex.replace(/[^0-9a-fA-F]/g, '');
    console.log(`[DEBUG] Fetched ${envVarName}: length=${sanitizedHex.length}`);
    
    return sanitizedHex; 
}

/**
 * Mock function for compatibility
 */
export function fetchMockPrevTxHex(utxoId: string): string {
    console.warn(`[WARN] Using mock prev tx hex for UTXO: ${utxoId}`);
    return "MOCK_PREV_TX_HEX_MUST_BE_REPLACED";
}

/**
 * Create Mint Token SpellRequest helper (for runMintFlow.ts)
 */
export function createMintTokenSpellRequest(): SpellRequest {
    const subscriberAddress = process.env.SUBSCRIBER_ADDRESS!;
    const fundingUtxo = process.env.TOKEN_MINT_FUNDING_UTXO!;
    const fundingUtxoValue = Number(process.env.TOKEN_MINT_FUNDING_VALUE);
    const changeAddress = process.env.MERCHANT_CHANGE_ADDRESS!;
    const planNftUtxo = process.env.PLAN_NFT_UTXO!;
    
    const tokenAmount = 1; // Default to 1 subscription token

    if (!subscriberAddress || !fundingUtxo || isNaN(fundingUtxoValue) || !changeAddress || !planNftUtxo) {
        console.error("Missing environment variables:");
        console.error(`SUBSCRIBER_ADDRESS: ${!!subscriberAddress}`);
        console.error(`TOKEN_MINT_FUNDING_UTXO: ${!!fundingUtxo}`);
        console.error(`TOKEN_MINT_FUNDING_VALUE: ${fundingUtxoValue} (valid: ${!isNaN(fundingUtxoValue)})`);
        console.error(`MERCHANT_CHANGE_ADDRESS: ${!!changeAddress}`);
        console.error(`PLAN_NFT_UTXO: ${!!planNftUtxo}`);
        
        throw new Error("Missing or invalid environment variables for Token Mint SpellRequest.");
    }
    
    console.log(`[DEBUG] Creating token mint request:`);
    console.log(`- Subscriber: ${subscriberAddress.substring(0, 20)}...`);
    console.log(`- Funding UTXO: ${fundingUtxo}`);
    console.log(`- Funding value: ${fundingUtxoValue} sats`);
    console.log(`- NFT authority: ${planNftUtxo}`);
    console.log(`- Token amount: ${tokenAmount}`);
    
    return {
        type: 'mint-token',
        authorityUtxo: planNftUtxo,
        fundingUtxo,
        fundingUtxoValue,
        changeAddress,
        feeRate: constants.DEFAULT_FEE_RATE,
        outputs: [
            {
                address: subscriberAddress,
                tokenAmount: tokenAmount,
            },
            {
                address: changeAddress, 
            }
        ]
    };
}