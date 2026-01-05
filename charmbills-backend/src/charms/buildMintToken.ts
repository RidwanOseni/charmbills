import { SpellRequest } from '../../../shared/types';
import * as constants from '../../../shared/constants';
import * as crypto from 'crypto';

function deriveAppId(utxoId: string): string {
  return crypto.createHash('sha256').update(utxoId).digest('hex');
}

export function buildMintToken(request: SpellRequest): any {
  console.log('[BUILDER] Building mint-token spell:', {
    type: request.type,
    authorityUtxo: request.authorityUtxo,
    outputsCount: request.outputs.length
  });

  // Validate request
  if (request.type !== 'mint-token') {
    throw new Error(`Invalid request type: ${request.type}. Expected 'mint-token'.`);
  }

  if (!request.authorityUtxo) {
    throw new Error("Authority UTXO is required for mint-token.");
  }

  if (!request.outputs || request.outputs.length < 2) {
    throw new Error("Mint-token requires at least 2 outputs: token output and NFT return.");
  }

  // Find token output (should have tokenAmount)
  const tokenOutput = request.outputs.find(out => out.tokenAmount !== undefined);
  if (!tokenOutput) {
    throw new Error("No token output found. One output must have tokenAmount.");
  }

  if (!tokenOutput.tokenAmount || tokenOutput.tokenAmount <= 0) {
    throw new Error(`Invalid token amount: ${tokenOutput.tokenAmount}. Must be positive.`);
  }

  // Find NFT return output (should have nftMetadata or be the other output)
  const nftReturnOutput = request.outputs.find(out => 
    out !== tokenOutput && (out.nftMetadata !== undefined || out.tokenAmount === undefined)
  );
  
  if (!nftReturnOutput) {
    throw new Error("No NFT return output found. Need an output to return the authority NFT.");
  }

  // Extract remaining supply from NFT metadata if available
  const remainingSupply = nftReturnOutput.nftMetadata?.remaining || 100000;
  const newRemaining = remainingSupply - (tokenOutput.tokenAmount || 1);

  if (newRemaining < 0) {
    throw new Error(`Insufficient remaining supply: ${remainingSupply}. Cannot mint ${tokenOutput.tokenAmount} tokens.`);
  }

  // Derive AppId from the authority UTXO
  // The authority UTXO should be the NFT UTXO that controls token minting
  const appId = deriveAppId(request.authorityUtxo);
  
  console.log('[BUILDER] Token minting details:', {
    appId,
    tokenAmount: tokenOutput.tokenAmount,
    oldRemaining: remainingSupply,
    newRemaining,
    tokenAddress: tokenOutput.address,
    nftReturnAddress: nftReturnOutput.address
  });

  return {
    version: 8,
    apps: {
      "$00": `n/${appId}/${constants.HARDCODED_APP_VK}`, // NFT Authority
      "$01": `t/${appId}/${constants.HARDCODED_APP_VK}`  // Fungible Token
    },
    ins: [{
      "utxo_id": request.authorityUtxo,
      "charms": {
        "$00": { 
          "ticker": nftReturnOutput.nftMetadata?.ticker || constants.HARDCODED_NFT_TICKER, 
          "remaining": remainingSupply,
          "serviceName": nftReturnOutput.nftMetadata?.serviceName || "Subscription Plan",
          "iconUrl": nftReturnOutput.nftMetadata?.iconUrl || 'https://charmbills.dev/pro.svg'
        }
      }
    }],
    outs: [
      {
        "address": tokenOutput.address,
        "charms": { 
          "$01": tokenOutput.tokenAmount // Token amount (e.g., 1 token = 1 month access)
        },
        "sats": constants.MIN_OUTPUT_SATS
      },
      {
        "address": nftReturnOutput.address,
        "charms": {
          "$00": { 
            "ticker": nftReturnOutput.nftMetadata?.ticker || constants.HARDCODED_NFT_TICKER, 
            "remaining": newRemaining,
            "serviceName": nftReturnOutput.nftMetadata?.serviceName || "Subscription Plan",
            "iconUrl": nftReturnOutput.nftMetadata?.iconUrl || 'https://charmbills.dev/pro.svg'
          }
        },
        "sats": constants.MIN_OUTPUT_SATS
      }
    ]
  };
}