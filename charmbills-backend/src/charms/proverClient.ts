import axios from 'axios';
import * as dotenv from 'dotenv';
import path from 'path';
import { SpellRequest } from '@/shared/types';
import * as constants from '@/shared/constants';
import { fetchPrevTxHex as fetchNftMintHex, buildMintNFT } from './buildMintNFT';
import { fetchPrevTxHex as fetchTokenMintHex, buildMintToken } from './buildMintToken';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../../backend/.env') });

const PROVER_API_URL = process.env.PROVER_API_URL || constants.PROVER_API_URL;
const APP_BINARY_BASE64 = process.env.APP_BINARY_BASE64;

interface ProveResponse {
  commitTxHex: string;
  spellTxHex: string;
}

export async function generateUnsignedTransactions(
  request: SpellRequest
): Promise<ProveResponse> {
  if (!PROVER_API_URL) {
    throw new Error("PROVER_API_URL is not set in environment variables.");
  }

  let spellJson: any;
  const prevTxs: Array<{ bitcoin: string }> = [];

  if (request.type === 'mint-nft') {
    const { spell } = buildMintNFT(request);
    spellJson = spell;
    
    const rawHex = fetchNftMintHex("NFT_AUTHORITY_UTXO_HEX");
    const sanitizedHex = rawHex.replace(/[^0-9a-fA-F]/g, '');
    prevTxs.push({ bitcoin: sanitizedHex });
    
    console.log(`NFT minting: Using NFT_AUTHORITY_UTXO_HEX (length: ${sanitizedHex.length})`);
    
  } else if (request.type === 'mint-token') {
    const spell = buildMintToken(request);
    spellJson = spell;
    
    const rawHex = fetchTokenMintHex("TOKEN_AUTHORITY_UTXO_HEX");
    const sanitizedHex = rawHex.replace(/[^0-9a-fA-F]/g, '');
    prevTxs.push({ bitcoin: sanitizedHex });
    
    console.log(`Token minting: Using TOKEN_AUTHORITY_UTXO_HEX (length: ${sanitizedHex.length})`);
    console.log(`Spell JSON for token minting:`, JSON.stringify(spellJson, null, 2));
    
  } else {
    throw new Error(`Unsupported spell type: ${request.type}`);
  }

  // Ensure version is 8
  spellJson.version = 8;

  const binaries: Record<string, string> = {};
  if (APP_BINARY_BASE64) {
    binaries[constants.HARDCODED_APP_VK] = APP_BINARY_BASE64;
  }

  const requestBody = {
    spell: spellJson,
    binaries,
    prev_txs: prevTxs,
    chain: "bitcoin",
    funding_utxo: request.fundingUtxo,
    funding_utxo_value: request.fundingUtxoValue,
    change_address: request.changeAddress,
    fee_rate: request.feeRate
  };

  // Create truncated version for logging
  const logBody = JSON.parse(JSON.stringify(requestBody));
  if (logBody.binaries && Object.keys(logBody.binaries).length > 0) {
    const firstKey = Object.keys(logBody.binaries)[0];
    const binary = logBody.binaries[firstKey];
    if (binary.length > 50) {
      logBody.binaries[firstKey] = `${binary.substring(0, 50)}... [${binary.length} chars total]`;
    }
  }

  console.log("--- FINAL Prover Request Payload (truncated binary) ---");
  console.log(JSON.stringify(logBody, null, 2));
  console.log("\n--- Sending to Prover API ---");
  console.log(`URL: ${PROVER_API_URL}`);

  try {
    const response = await axios.post(PROVER_API_URL, requestBody, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 300000 // 5 minutes timeout for proving
    });

    console.log("\n=== DEBUG: Prover API Response ===");
    console.log("Response status:", response.status);
    console.log("Response data type:", typeof response.data);
    
    let commitTxHex: string;
    let spellTxHex: string;
    
    if (Array.isArray(response.data)) {
      console.log("Response array length:", response.data.length);
      console.log("Response data sample:", JSON.stringify(response.data).substring(0, 200));
      
      if (response.data.length >= 2) {
        const firstElem = response.data[0];
        const secondElem = response.data[1];
        
        // Extract hex based on actual structure received
        if (typeof firstElem === 'object' && firstElem !== null && 'bitcoin' in firstElem) {
          commitTxHex = firstElem.bitcoin;
          spellTxHex = secondElem.bitcoin;
          console.log("Extracted hex from object format");
        } else if (typeof firstElem === 'string') {
          commitTxHex = firstElem;
          spellTxHex = secondElem;
          console.log("Extracted hex from string format");
        } else {
          console.error("Unknown array element type:", typeof firstElem);
          console.error("First element:", firstElem);
          throw new Error("Unknown response format in array");
        }
      } else {
        console.error("Response array too short:", response.data);
        throw new Error(`Prover API returned array with only ${response.data.length} elements, expected 2`);
      }
    } else if (typeof response.data === 'object' && response.data !== null) {
      console.log("Response object:", response.data);
      console.log("Response object keys:", Object.keys(response.data));
      throw new Error("Unexpected object response format");
    } else {
      console.error("Unexpected response type:", typeof response.data);
      console.error("Response data:", response.data);
      throw new Error(`Prover API returned unexpected format: ${typeof response.data}`);
    }
    
    // Validate extracted hex values
    if (typeof commitTxHex !== 'string' || typeof spellTxHex !== 'string') {
      console.error("Invalid hex types:", { 
        commitTxHex, 
        spellTxHex,
        commitTxType: typeof commitTxHex,
        spellTxType: typeof spellTxHex
      });
      throw new Error("Prover API returned non-string transaction hexes.");
    }
    
    console.log("commitTxHex length:", commitTxHex.length);
    console.log("spellTxHex length:", spellTxHex.length);
    console.log("commitTxHex first 50 chars:", commitTxHex.substring(0, 50));
    console.log("spellTxHex first 50 chars:", spellTxHex.substring(0, 50));
    
    return { commitTxHex, spellTxHex };

  } catch (error: unknown) {
    console.error("\n❌ ERROR in generateUnsignedTransactions:");
    
    if (axios.isAxiosError(error)) {
      console.error("Axios error:", error.message);
      
      if (error.response) {
        console.error("Response status:", error.response.status);
        console.error("Response headers:", error.response.headers);
        console.error("Response data:", error.response.data);
        
        if (typeof error.response.data === 'string') {
          console.error("Response data (raw):", error.response.data);
        } else if (error.response.data && typeof error.response.data === 'object') {
          console.error("Response data (JSON):", JSON.stringify(error.response.data, null, 2));
        }
        
        throw new Error(`Prover API failed with status ${error.response.status}: ${JSON.stringify(error.response.data)}`);
      } else if (error.request) {
        console.error("No response received:", error.request);
        throw new Error(`Prover API request failed: ${error.message}`);
      }
    }
    
    if (error instanceof Error) {
      console.error("Error stack:", error.stack);
      throw new Error(`Transaction proving failed: ${error.message}`);
    }
    
    console.error("Unknown error type:", error);
    throw new Error("Transaction proving failed: Unknown error");
  }
}