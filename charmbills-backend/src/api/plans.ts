import { Request, Response } from 'express';
import { generateUnsignedTransactions } from '../charms/proverClient';
import { SpellRequest, ProverResult } from '../../../shared/types';
import * as constants from '../../../shared/constants';

/**
 * Endpoint to generate the Plan NFT (Authority) transactions.
 * Triggered by the Merchant Dashboard when a new plan is created.
 */
export async function createPlanNFT(req: Request, res: Response) {
  console.log('\n[DEBUG] ===== START createPlanNFT API =====');
  console.log('[DEBUG] Request received at /api/plans/mint');
  console.log('[DEBUG] Request method:', req.method);
  console.log('[DEBUG] Request headers:', JSON.stringify(req.headers, null, 2));
  
  // Check if body exists
  console.log('[DEBUG] req.body exists:', !!req.body);
  console.log('[DEBUG] req.body type:', typeof req.body);
  
  if (!req.body) {
    console.error('[ERROR] Request body is empty or undefined');
    return res.status(400).json({ 
      error: 'Request body is required',
      receivedBody: req.body 
    });
  }
  
  // Log the raw body
  console.log('[DEBUG] Raw request body (truncated):', 
    JSON.stringify(req.body).substring(0, 500) + '...');
  
  try {
    // 1. Destructure with safe defaults and validation
    console.log('[DEBUG] === Destructuring request body ===');
    
    const { 
      anchorUtxo,
      anchorValue, 
      fundingUtxo, 
      fundingValue, 
      anchorTxHex, 
      feeTxHex, 
      merchantAddress, 
      metadata 
    } = req.body;
    
    // Log each destructured value
    console.log('[DEBUG] Destructured values:');
    console.log('  anchorUtxo:', anchorUtxo);
    console.log('  anchorUtxo type:', typeof anchorUtxo);
    console.log('  fundingUtxo:', fundingUtxo);
    console.log('  fundingUtxo type:', typeof fundingUtxo);
    console.log('  fundingValue:', fundingValue);
    console.log('  fundingValue type:', typeof fundingValue);
    console.log('  anchorTxHex exists:', !!anchorTxHex);
    console.log('  anchorTxHex type:', typeof anchorTxHex);
    console.log('  anchorTxHex length:', anchorTxHex?.length || 'N/A');
    console.log('  anchorTxHex preview:', anchorTxHex ? `${anchorTxHex.substring(0, 50)}...` : 'undefined');
    console.log('  feeTxHex exists:', !!feeTxHex);
    console.log('  feeTxHex type:', typeof feeTxHex);
    console.log('  feeTxHex length:', feeTxHex?.length || 'N/A');
    console.log('  feeTxHex preview:', feeTxHex ? `${feeTxHex.substring(0, 50)}...` : 'undefined');
    console.log('  merchantAddress:', merchantAddress);
    console.log('  merchantAddress type:', typeof merchantAddress);
    console.log('  metadata:', metadata);
    console.log('  metadata type:', typeof metadata);

    console.log('  anchorValue:', anchorValue);
console.log('  anchorValue type:', typeof anchorValue);
if (typeof anchorValue !== 'number' || isNaN(anchorValue)) {
  console.error('[ERROR] anchorValue must be a valid number:', anchorValue);
  return res.status(400).json({ 
    error: 'anchorValue must be a valid number',
    receivedValue: anchorValue,
    receivedType: typeof anchorValue
  });
}
    
    // 2. Validate required fields
    console.log('[DEBUG] === Validating required fields ===');
    
    const requiredFields = [
      { key: 'anchorUtxo', value: anchorUtxo },
      { key: 'anchorValue', value: anchorValue },
      { key: 'fundingUtxo', value: fundingUtxo },
      { key: 'fundingValue', value: fundingValue },
      { key: 'anchorTxHex', value: anchorTxHex },
      { key: 'feeTxHex', value: feeTxHex },
      { key: 'merchantAddress', value: merchantAddress },
      { key: 'metadata', value: metadata }
    ];
    
    const missingFields = requiredFields.filter(field => {
      const isEmpty = field.value === undefined || field.value === null || 
                     (typeof field.value === 'string' && field.value.trim() === '');
      if (isEmpty) {
        console.error(`[ERROR] Missing or empty field: ${field.key}`);
      }
      return isEmpty;
    }).map(field => field.key);
    
    if (missingFields.length > 0) {
      console.error('[ERROR] Missing required fields:', missingFields);
      console.error('[ERROR] Full request body for debugging:', JSON.stringify(req.body, null, 2));
      
      return res.status(400).json({ 
        error: `Missing required fields: ${missingFields.join(', ')}`,
        missingFields: missingFields,
        receivedBody: req.body 
      });
    }
    
    // 3. Additional validation for hex values
    console.log('[DEBUG] === Validating hex values ===');
    
    if (typeof anchorTxHex !== 'string') {
      console.error('[ERROR] anchorTxHex is not a string:', typeof anchorTxHex);
      return res.status(400).json({ 
        error: 'anchorTxHex must be a string',
        receivedType: typeof anchorTxHex,
        receivedValue: anchorTxHex
      });
    }
    
    if (typeof feeTxHex !== 'string') {
      console.error('[ERROR] feeTxHex is not a string:', typeof feeTxHex);
      return res.status(400).json({ 
        error: 'feeTxHex must be a string',
        receivedType: typeof feeTxHex,
        receivedValue: feeTxHex
      });
    }
    
    // Clean hex values
    const cleanAnchorTxHex = anchorTxHex.replace(/[^0-9a-fA-F]/g, '');
    const cleanFeeTxHex = feeTxHex.replace(/[^0-9a-fA-F]/g, '');
    
    console.log('[DEBUG] Cleaned hex values:');
    console.log('  Clean anchorTxHex length:', cleanAnchorTxHex.length);
    console.log('  Clean feeTxHex length:', cleanFeeTxHex.length);
    
    if (cleanAnchorTxHex.length === 0) {
      console.error('[ERROR] anchorTxHex is empty after cleaning');
      return res.status(400).json({ 
        error: 'anchorTxHex contains no valid hex characters',
        originalLength: anchorTxHex.length
      });
    }
    
    if (cleanFeeTxHex.length === 0) {
      console.error('[ERROR] feeTxHex is empty after cleaning');
      return res.status(400).json({ 
        error: 'feeTxHex contains no valid hex characters',
        originalLength: feeTxHex.length
      });
    }
    
    // 4. Validate metadata structure
    console.log('[DEBUG] === Validating metadata ===');
    
    if (!metadata.serviceName || typeof metadata.serviceName !== 'string') {
      console.error('[ERROR] Invalid metadata.serviceName:', metadata.serviceName);
      return res.status(400).json({ 
        error: 'metadata.serviceName is required and must be a string',
        receivedMetadata: metadata
      });
    }
    
    // 5. Construct the SpellRequest
    console.log('[DEBUG] === Constructing SpellRequest ===');
    
    const request: SpellRequest = {
      type: 'mint-nft',
      anchorUtxo: anchorUtxo,
      anchorValue: anchorValue,
      fundingUtxo: fundingUtxo,
      fundingUtxoValue: fundingValue,
      changeAddress: merchantAddress,
      feeRate: constants.DEFAULT_FEE_RATE,
      outputs: [
        {
          address: merchantAddress,
          nftMetadata: {
            serviceName: metadata.serviceName,
            ticker: metadata.ticker || constants.HARDCODED_NFT_TICKER,
            remaining: metadata.remaining || 100000,
            iconUrl: metadata.iconUrl || 'https://charmbills.dev/pro.svg'
          }
        }
      ]
    };
    
    console.log('[DEBUG] SpellRequest constructed:');
    console.log('  Request type:', request.type);
    console.log('  anchorUtxo:', request.anchorUtxo);
    console.log('  anchorValue:', request.anchorValue);
    console.log('  fundingUtxo:', request.fundingUtxo);
    console.log('  fundingUtxoValue:', request.fundingUtxoValue);
    console.log('  changeAddress:', request.changeAddress);
    console.log('  outputs count:', request.outputs.length);
    
    // 6. Prepare hex array for prover client
    console.log('[DEBUG] === Preparing hex array for prover client ===');
    
    const hexArray = [anchorTxHex];
    console.log('[DEBUG] Hex array to pass:', {
      length: hexArray.length,
      elements: hexArray.map((hex, index) => ({
        index,
        type: typeof hex,
        length: hex.length,
        preview: hex.substring(0, 30) + '...'
      }))
    });
    
    // 7. Call the prover client
    console.log('[DEBUG] === Calling generateUnsignedTransactions ===');
    
    const { commitTxHex, spellTxHex } = await generateUnsignedTransactions(
      request, 
      hexArray
    );
    
    console.log('[DEBUG] === Prover client returned successfully ===');
    console.log('[DEBUG] Response from generateUnsignedTransactions:');
    console.log('  commitTxHex exists:', !!commitTxHex);
    console.log('  commitTxHex type:', typeof commitTxHex);
    console.log('  commitTxHex length:', commitTxHex?.length || 'N/A');
    console.log('  spellTxHex exists:', !!spellTxHex);
    console.log('  spellTxHex type:', typeof spellTxHex);
    console.log('  spellTxHex length:', spellTxHex?.length || 'N/A');
    
    // Validate prover response
    if (!commitTxHex || !spellTxHex) {
      console.error('[ERROR] Prover returned empty transactions');
      console.error('  commitTxHex:', commitTxHex);
      console.error('  spellTxHex:', spellTxHex);
      
      return res.status(500).json({ 
        error: 'Prover API returned empty transaction hexes',
        commitTxHex: !!commitTxHex,
        spellTxHex: !!spellTxHex
      });
    }
    
    const result: ProverResult = {
      commitTxHex,
      spellTxHex
    };
    
    console.log('[DEBUG] === Sending successful response ===');
    console.log('[DEBUG] Response payload size:', JSON.stringify(result).length, 'bytes');
    console.log('[DEBUG] ===== END createPlanNFT API (SUCCESS) =====\n');
    
    // 8. Return unsigned hexes to frontend for Leather wallet signing
    return res.status(200).json(result);

  } catch (error: any) {
    console.error('\n[DEBUG] ===== createPlanNFT API ERROR =====');
    console.error("Plan NFT Generation Failed:", error.message);
    console.error("Error stack:", error.stack);
    console.error("Error name:", error.name);
    console.error("Error code:", error.code);
    
    // Determine appropriate status code
    let statusCode = 500;
    let errorMessage = error.message;
    
    if (error.message.includes('Missing required') || 
        error.message.includes('must be a string') ||
        error.message.includes('contains no valid hex')) {
      statusCode = 400; // Bad Request
    } else if (error.message.includes('HARDCODED_APP_VK') || 
               error.message.includes('APP_BINARY_BASE64')) {
      statusCode = 500; // Server configuration error
    } else if (error.message.includes('Prover API failed')) {
      statusCode = 502; // Bad Gateway
    }
    
    console.error(`[DEBUG] Returning HTTP ${statusCode}: ${errorMessage}`);
    console.error('[DEBUG] ===== END createPlanNFT API (ERROR) =====\n');
    
    return res.status(statusCode).json({ 
      error: errorMessage,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined 
    });
  }
}