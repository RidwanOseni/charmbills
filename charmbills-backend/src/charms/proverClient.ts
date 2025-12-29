import axios from 'axios';
import * as dotenv from 'dotenv';
import { SpellRequest, ProverResult } from '../../../shared/types';
import * as constants from '../../../shared/constants';
import { buildMintNFT } from './buildMintNFT';
import { buildMintToken } from './buildMintToken';

dotenv.config();

export async function generateUnsignedTransactions(
  request: SpellRequest,
  prevTxHexes: string[] // Changed from string to string[]
): Promise<ProverResult> {
  // ========== IMMEDIATE DEBUGGING AT FUNCTION ENTRY ==========
  console.log('\n[DEBUG] ===== START generateUnsignedTransactions =====');
  console.log('[DEBUG] Function called with parameters:');
  console.log('[DEBUG] Request type:', request.type);
  console.log('[DEBUG] Request fundingUtxo:', request.fundingUtxo);
  console.log('[DEBUG] prevTxHexes parameter:', prevTxHexes);
  console.log('[DEBUG] prevTxHexes typeof:', typeof prevTxHexes);
  console.log('[DEBUG] prevTxHexes isArray:', Array.isArray(prevTxHexes));
  console.log('[DEBUG] prevTxHexes === null:', prevTxHexes === null);
  console.log('[DEBUG] prevTxHexes === undefined:', prevTxHexes === undefined);
  
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
  
  // Detailed element analysis
  console.log('[DEBUG] === Element-by-element analysis ===');
  for (let i = 0; i < prevTxHexes.length; i++) {
    const element = prevTxHexes[i];
    console.log(`  [${i}]:`);
    console.log(`    Type: ${typeof element}`);
    console.log(`    Value: ${element}`);
    console.log(`    Is null: ${element === null}`);
    console.log(`    Is undefined: ${element === undefined}`);
    console.log(`    Is string: ${typeof element === 'string'}`);
    console.log(`    Length: ${typeof element === 'string' ? element.length : 'N/A'}`);
    console.log(`    First 30 chars: ${typeof element === 'string' ? element.substring(0, 30) + '...' : 'N/A'}`);
  }

  const PROVER_URL = process.env.PROVER_API_URL || constants.PROVER_API_URL;
  const APP_VK = process.env.HARDCODED_APP_VK || constants.HARDCODED_APP_VK;
  const APP_BINARY = process.env.APP_BINARY_BASE64;

  if (!PROVER_URL) throw new Error("PROVER_API_URL not configured.");
  if (!APP_BINARY) throw new Error("APP_BINARY_BASE64 missing from .env.");

  let spellJson: any;
  if (request.type === 'mint-nft') {
    // This now uses the anchorValue we added to the shared types 
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
    console.log(`[DEBUG] Processing element ${index}:`, {
      value: hex,
      type: typeof hex,
      isString: typeof hex === 'string',
      isNull: hex === null,
      isUndefined: hex === undefined
    });
    
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
    console.log(`[DEBUG] Element ${index} cleaned: ${cleanedHex.length} chars, first 30: ${cleanedHex.substring(0, 30)}...`);
    
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
  console.log('[DEBUG] requestBody.prev_txs:', JSON.stringify(requestBody.prev_txs.map(tx => ({
    bitcoin: `${tx.bitcoin.substring(0, 30)}... (${tx.bitcoin.length} chars)`
  })), null, 2));
  console.log('[DEBUG] requestBody.funding_utxo:', requestBody.funding_utxo);
  console.log('[DEBUG] requestBody.funding_utxo_value:', requestBody.funding_utxo_value);
  console.log('[DEBUG] requestBody.change_address:', requestBody.change_address);
  console.log('[DEBUG] requestBody.fee_rate:', requestBody.fee_rate);

  try {
    console.log('[DEBUG] === Sending request to Prover API ===');
    console.log('[DEBUG] Prover URL:', PROVER_URL);
    console.log('[DEBUG] Request body size:', JSON.stringify(requestBody).length, 'bytes');
    
    const response = await axios.post(PROVER_URL, requestBody, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 300000 // 5-minute timeout for ZK proof generation 
    });

    console.log('[DEBUG] === Received response from Prover API ===');
    console.log('[DEBUG] Response status:', response.status);
    console.log('[DEBUG] Response data type:', typeof response.data);
    console.log('[DEBUG] Response is array:', Array.isArray(response.data));
    
    if (Array.isArray(response.data)) {
      const [commitTxHex, spellTxHex] = response.data;
      console.log('[DEBUG] commitTxHex length:', commitTxHex?.length);
      console.log('[DEBUG] spellTxHex length:', spellTxHex?.length);
      console.log('[DEBUG] ===== END generateUnsignedTransactions (SUCCESS) =====\n');
      return { commitTxHex, spellTxHex };
    } else {
      console.error('[ERROR] Prover API returned non-array response:', response.data);
      throw new Error('Prover API returned invalid response format');
    }
  } catch (error: any) {
    console.error('\n[DEBUG] ===== PROVER API ERROR =====');
    console.error('[ERROR] Axios error:', error.message);
    console.error('[ERROR] Error code:', error.code);
    console.error('[ERROR] Error config:', error.config?.url);
    
    if (error.response) {
      console.error('[ERROR] Response status:', error.response.status);
      console.error('[ERROR] Response headers:', error.response.headers);
      console.error('[ERROR] Response data:', error.response.data);
    } else if (error.request) {
      console.error('[ERROR] No response received. Request:', error.request);
    }
    
    console.error('[DEBUG] ===== END generateUnsignedTransactions (ERROR) =====\n');
    
    // Create a more informative error message
    const errorMessage = error.response?.data 
      ? `Prover API failed: ${JSON.stringify(error.response.data)}`
      : `Prover API failed: ${error.message}`;
    
    throw new Error(errorMessage);
  }
}