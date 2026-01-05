import axios from 'axios';
import * as dotenv from 'dotenv';
import { SpellRequest, ProverResult } from '../../../shared/types';
import * as constants from '../../../shared/constants';
import { buildMintNFT } from './buildMintNFT';
import { buildMintToken } from './buildMintToken';
import fs from 'fs';
import path from 'path';

dotenv.config();

/**
 * Implements exponential backoff with jitter for retries
 */
async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function exponentialBackoffDelay(retryCount: number, baseDelay = 1000, maxDelay = 60000): number {
  const exponentialDelay = baseDelay * Math.pow(2, retryCount);
  const jitter = Math.random() * 1000; // Add up to 1 second jitter
  return Math.min(exponentialDelay + jitter, maxDelay);
}

/**
 * Generates unsigned transactions with robust retry logic as per Charms documentation
 */
export async function generateUnsignedTransactions(
  request: SpellRequest,
  prevTxHexes: string[] // Changed from string to string[]
): Promise<ProverResult> {
  console.log('\n[DEBUG] ===== START generateUnsignedTransactions =====');
  
  // Validate prevTxHexes parameter
  if (prevTxHexes === undefined || prevTxHexes === null) {
    console.error('[ERROR] prevTxHexes is null or undefined!');
    throw new Error('prevTxHexes parameter is required');
  }
  
  if (!Array.isArray(prevTxHexes)) {
    console.error('[ERROR] prevTxHexes is not an array! Type:', typeof prevTxHexes);
    throw new Error('prevTxHexes must be an array');
  }
  
  console.log('[DEBUG] prevTxHexes length:', prevTxHexes.length);

  const PROVER_URL = process.env.PROVER_API_URL || constants.PROVER_API_URL;
  const APP_VK = process.env.HARDCODED_APP_VK || constants.HARDCODED_APP_VK;
  
  // ========== MODIFIED: Read app binary from file ==========
  const binaryPath = path.resolve(process.cwd(), 'src/app-binary.b64');
  console.log('[DEBUG] Reading app binary from:', binaryPath);
  
  let APP_BINARY: string;
  try {
    APP_BINARY = fs.readFileSync(binaryPath, 'utf-8').trim();
    console.log('[DEBUG] App binary loaded successfully, length:', APP_BINARY.length);
  } catch (error) {
    console.error('[ERROR] Failed to read app binary file:', error);
    throw new Error(`APP_BINARY_BASE64 missing: Could not read file at ${binaryPath}`);
  }

  if (!PROVER_URL) throw new Error("PROVER_API_URL not configured.");
  if (!APP_BINARY) throw new Error("APP_BINARY_BASE64 missing from .env.");

  let spellJson: any;
  if (request.type === 'mint-nft') {
    const result = buildMintNFT(request);
    spellJson = result.spell;
  } else if (request.type === 'mint-token') {
    spellJson = buildMintToken(request);
  } else {
    throw new Error(`Unsupported spell type: ${request.type}`);
  }

  // ========== SAFE PREPARATION OF prev_txs ==========
  console.log('[DEBUG] === Preparing prev_txs array ===');
  
  // Create a safe version with validation
  const safePrevTxs = prevTxHexes.map((hex, index) => {
    // Validate each element before processing
    if (hex === null || hex === undefined) {
      console.error(`[ERROR] Element ${index} is null or undefined:`, hex);
      throw new Error(`Element ${index} in prevTxHexes is null or undefined`);
    }
    
    if (typeof hex !== 'string') {
      console.error(`[ERROR] Element ${index} is not a string. Type:`, typeof hex);
      throw new Error(`Element ${index} in prevTxHexes must be a string, got ${typeof hex}`);
    }
    
    if (hex.trim().length === 0) {
      console.error(`[ERROR] Element ${index} is an empty string`);
      throw new Error(`Element ${index} in prevTxHexes is an empty string`);
    }
    
    // Clean the hex string
    const cleanedHex = hex.replace(/[^0-9a-fA-F]/g, '');
    
    return { bitcoin: cleanedHex };
  });
  
  console.log('[DEBUG] Successfully created safePrevTxs with', safePrevTxs.length, 'elements');

  const requestBody = {
    spell: spellJson,
    binaries: { [APP_VK]: APP_BINARY },
    prev_txs: safePrevTxs, // Use the safe, validated array
    chain: "bitcoin", 
    funding_utxo: request.fundingUtxo,
    funding_utxo_value: request.fundingUtxoValue,
    change_address: request.changeAddress,
    fee_rate: request.feeRate || constants.DEFAULT_FEE_RATE
  };

  // Debug the full request body (excluding large binary data)
  console.log('[DEBUG] === Constructed requestBody ===');
  console.log('[DEBUG] requestBody.prev_txs length:', requestBody.prev_txs.length);
  console.log('[DEBUG] requestBody.funding_utxo:', requestBody.funding_utxo);
  console.log('[DEBUG] requestBody.funding_utxo_value:', requestBody.funding_utxo_value);
  console.log('[DEBUG] requestBody.change_address:', requestBody.change_address);
  console.log('[DEBUG] requestBody.fee_rate:', requestBody.fee_rate);

  // ========== RETRY LOGIC AS PER CHARMS DOCUMENTATION ==========
  const MAX_RETRIES = 3;
  const BASE_DELAY_MS = 2000; // Start with 2 seconds
  const MAX_DELAY_MS = 30000; // Max 30 seconds delay
  
  let lastError: any = null;
  
  for (let retryCount = 0; retryCount <= MAX_RETRIES; retryCount++) {
    try {
      console.log(`\n[DEBUG] === Attempt ${retryCount + 1}/${MAX_RETRIES + 1} to Prover API ===`);
      console.log('[DEBUG] Prover URL:', PROVER_URL);
      console.log('[DEBUG] Request body size:', JSON.stringify(requestBody).length, 'bytes');
      
      // Calculate timeout based on retry count (increase with each retry)
      const timeoutMs = Math.min(600000 * (retryCount + 1), 1800000); // Up to 30 minutes
      
      const response = await axios.post(PROVER_URL, requestBody, {
        headers: { 'Content-Type': 'application/json' },
        timeout: timeoutMs
      });

      console.log('[DEBUG] === Received response from Prover API ===');
      console.log('[DEBUG] Response status:', response.status);
      
      if (Array.isArray(response.data)) {
        let commitTxHex = response.data[0];
        let spellTxHex = response.data[1];
        
        console.log('[DEBUG] Raw response types:', {
          commitType: typeof commitTxHex,
          commitHasBitcoin: commitTxHex && typeof commitTxHex === 'object' && 'bitcoin' in commitTxHex,
          spellType: typeof spellTxHex,
          spellHasBitcoin: spellTxHex && typeof spellTxHex === 'object' && 'bitcoin' in spellTxHex
        });
        
        // ========== CRITICAL FIX: Extract hex from objects ==========
        if (commitTxHex && typeof commitTxHex === 'object' && commitTxHex.bitcoin) {
          console.log('[DEBUG] Extracting hex from commitTxHex object');
          commitTxHex = commitTxHex.bitcoin;
        }
        
        if (spellTxHex && typeof spellTxHex === 'object' && spellTxHex.bitcoin) {
          console.log('[DEBUG] Extracting hex from spellTxHex object');
          spellTxHex = spellTxHex.bitcoin;
        }
        
        // Validate they are now strings
        if (typeof commitTxHex !== 'string' || typeof spellTxHex !== 'string') {
          console.error('[ERROR] Invalid hex format after extraction:', {
            commitType: typeof commitTxHex,
            spellType: typeof spellTxHex
          });
          throw new Error('Prover API returned invalid hex format after extraction');
        }
        
        console.log('[DEBUG] Extracted hex lengths:', {
          commitTxHex: commitTxHex?.length,
          spellTxHex: spellTxHex?.length
        });
        
        // Validate response
        if (!commitTxHex || !spellTxHex) {
          throw new Error('Prover API returned empty transaction hexes');
        }
        
        console.log('[DEBUG] ===== END generateUnsignedTransactions (SUCCESS) =====\n');
        
        // Store for secure signing as per Charms documentation
        const result: ProverResult = { commitTxHex, spellTxHex };
        
        return result;
      } else {
        console.error('[ERROR] Prover API returned non-array response:', response.data);
        throw new Error('Prover API returned invalid response format');
      }
      
    } catch (error: any) {
      lastError = error;
      
      console.error(`\n[DEBUG] ===== ATTEMPT ${retryCount + 1} FAILED =====`);
      console.error('[ERROR] Error:', error.message);
      
      if (error.response) {
        // HTTP error response (4xx, 5xx)
        console.error('[ERROR] Response status:', error.response.status);
        console.error('[ERROR] Response data:', error.response.data);
        
        // Don't retry on client errors (4xx)
        if (error.response.status >= 400 && error.response.status < 500) {
          console.error('[ERROR] Client error, not retrying');
          break;
        }
        
        // Retry on server errors (5xx) and timeouts
        console.error('[ERROR] Server error or timeout, will retry if attempts remain');
      } else if (error.request) {
        // No response received (network error, timeout)
        console.error('[ERROR] No response received (network/timeout)');
      } else {
        // Setup error
        console.error('[ERROR] Request setup error:', error.message);
        // Don't retry on setup errors
        break;
      }
      
      // Check if we should retry
      if (retryCount < MAX_RETRIES) {
        const delayMs = exponentialBackoffDelay(retryCount, BASE_DELAY_MS, MAX_DELAY_MS);
        console.log(`[RETRY] Waiting ${delayMs}ms before retry ${retryCount + 2}/${MAX_RETRIES + 1}`);
        await sleep(delayMs);
      }
    }
  }
  
  // All retries failed
  console.error('\n[DEBUG] ===== ALL RETRY ATTEMPTS FAILED =====');
  
  // Create informative error message
  let errorMessage = 'Prover API failed after all retry attempts. ';
  
  if (lastError.response) {
    errorMessage += `HTTP ${lastError.response.status}: ${JSON.stringify(lastError.response.data)}`;
  } else if (lastError.code === 'ETIMEDOUT') {
    errorMessage += 'Request timed out. The Charms prover may be under heavy load. ';
    errorMessage += 'Consider running a local prover with `charms server` or increasing timeout.';
  } else if (lastError.request) {
    errorMessage += 'Network error: No response received from server.';
  } else {
    errorMessage += lastError.message;
  }
  
  console.error('[DEBUG] Final error:', errorMessage);
  console.error('[DEBUG] ===== END generateUnsignedTransactions (ERROR) =====\n');
  
  throw new Error(errorMessage);
}