import { Request, Response } from 'express';
import { generateUnsignedTransactions } from '../charms/proverClient';
import { SpellRequest, ProverResult } from '../../../shared/types';
import * as constants from '../../../shared/constants';

/**
 * Endpoint to mint a subscription token from a Plan NFT
 */
export async function mintSubscriptionToken(req: Request, res: Response) {
  console.log('\n[DEBUG] ===== START mintSubscriptionToken API =====');
  console.log('[DEBUG] Request received at /api/subscriptions/mint');
  
  try {
    // 1. Destructure and validate request body
    const { 
      authorityUtxo, 
      authorityTxHex,
      fundingUtxo, 
      fundingValue, 
      prevTxHex,
      subscriberAddress, 
      merchantAddress,
      tokenAmount = 1, // Default to 1 token
      nftMetadata // Optional: full NFT metadata from frontend
    } = req.body;

    console.log('[DEBUG] Request parameters:', {
      authorityUtxo,
      fundingUtxo,
      fundingValue,
      subscriberAddress,
      merchantAddress,
      tokenAmount,
      hasNftMetadata: !!nftMetadata
    });

    // 2. Validate required fields
    const requiredFields = [
      { key: 'authorityUtxo', value: authorityUtxo },
      { key: 'authorityTxHex', value: authorityTxHex },
      { key: 'fundingUtxo', value: fundingUtxo },
      { key: 'fundingValue', value: fundingValue },
      { key: 'prevTxHex', value: prevTxHex },
      { key: 'subscriberAddress', value: subscriberAddress },
      { key: 'merchantAddress', value: merchantAddress }
    ];

    const missingFields = requiredFields
      .filter(field => !field.value)
      .map(field => field.key);

    if (missingFields.length > 0) {
      console.error('[ERROR] Missing required fields:', missingFields);
      return res.status(400).json({ 
        error: `Missing required fields: ${missingFields.join(', ')}` 
      });
    }

    // 3. Validate token amount
    if (typeof tokenAmount !== 'number' || tokenAmount <= 0) {
      console.error('[ERROR] Invalid token amount:', tokenAmount);
      return res.status(400).json({ 
        error: `Invalid token amount: ${tokenAmount}. Must be a positive number.` 
      });
    }

    // 4. Calculate remaining supply (if NFT metadata provided)
    const currentRemaining = nftMetadata?.remaining || 100000; // Default or from metadata
    const newRemaining = currentRemaining - tokenAmount;

    if (newRemaining < 0) {
      console.error('[ERROR] Insufficient remaining supply:', {
        currentRemaining,
        tokenAmount,
        newRemaining
      });
      return res.status(400).json({ 
        error: `Insufficient remaining supply: ${currentRemaining}. Cannot mint ${tokenAmount} tokens.` 
      });
    }

    // 5. Construct the SpellRequest
    const request: SpellRequest = {
      type: 'mint-token',
      authorityUtxo,
      fundingUtxo,
      fundingUtxoValue: fundingValue,
      changeAddress: merchantAddress,
      feeRate: constants.DEFAULT_FEE_RATE,
      outputs: [
        { 
          address: subscriberAddress, 
          tokenAmount: tokenAmount 
        },
        { 
          address: merchantAddress,
          nftMetadata: {
            ticker: nftMetadata?.ticker || constants.HARDCODED_NFT_TICKER,
            serviceName: nftMetadata?.serviceName || "Subscription Plan",
            remaining: newRemaining,
            iconUrl: nftMetadata?.iconUrl || 'https://charmbills.dev/pro.svg'
          }
        }
      ]
    };

    console.log('[DEBUG] SpellRequest constructed:', {
      type: request.type,
      authorityUtxo: request.authorityUtxo,
      fundingUtxo: request.fundingUtxo,
      tokenAmount,
      currentRemaining,
      newRemaining
    });

    // 6. Call prover with previous transaction hex
    // Note: For mint-token, we need the authority UTXO transaction hex
    console.log('[DEBUG] Calling generateUnsignedTransactions with prevTxHex');
    const result = await generateUnsignedTransactions(request, [prevTxHex]);

    console.log('[DEBUG] Prover returned successfully:', {
      commitTxLength: result.commitTxHex?.length,
      spellTxLength: result.spellTxHex?.length
    });

    console.log('[DEBUG] ===== END mintSubscriptionToken API (SUCCESS) =====\n');
    
    return res.status(200).json(result);

  } catch (error: any) {
    console.error('\n[DEBUG] ===== mintSubscriptionToken API ERROR =====');
    console.error('Subscription Token Minting Failed:', error.message);
    console.error('Error stack:', error.stack);
    console.error('[DEBUG] ===== END mintSubscriptionToken API (ERROR) =====\n');
    
    // Determine appropriate status code
    let statusCode = 500;
    if (error.message.includes('Missing required') || 
        error.message.includes('Invalid token amount') ||
        error.message.includes('Insufficient remaining')) {
      statusCode = 400; // Bad Request
    }
    
    return res.status(statusCode).json({ 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined 
    });
  }
}