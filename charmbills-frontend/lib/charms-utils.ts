import * as wasm from "./wasm/charms_lib";
import axios from 'axios';

const MEMPOOL_API = "https://mempool.space/testnet4/api";

// UTXO tracking system to prevent double-spending
const USED_UTXO_KEY = 'charm_used_utxos';

/**
 * Marks a UTXO as used in localStorage to prevent double-spending
 */
function markUtxoAsUsed(utxoId: string): void {
  const used = JSON.parse(localStorage.getItem(USED_UTXO_KEY) || '[]');
  if (!used.includes(utxoId)) {
    used.push(utxoId);
    localStorage.setItem(USED_UTXO_KEY, JSON.stringify(used));
    console.log(`📝 Marked ${utxoId} as used`);
  }
}

/**
 * Checks if a UTXO has been marked as used
 */
function isUtxoUsed(utxoId: string): boolean {
  const used = JSON.parse(localStorage.getItem(USED_UTXO_KEY) || '[]');
  return used.includes(utxoId);
}

/**
 * Clears all tracked UTXOs (use for debugging only - not automatically called)
 */
export function clearUsedUtxos(): void {
  localStorage.removeItem(USED_UTXO_KEY);
  console.log('🧹 Cleared UTXO tracking');
}

/**
 * Fetches UTXOs and identifies a suitable one for funding or App ID derivation.
 * Uses "Smallest Sufficient" strategy to preserve larger UTXOs for more expensive transactions.
 * WITH ROBUST DOUBLE-SPEND PROTECTION AND USER GUIDANCE
 */
export async function getFundingUtxo(address: string, minAmount: number = 10000) {
  const response = await axios.get(`${MEMPOOL_API}/address/${address}/utxo`);
  const utxos = response.data;

  console.log('🔍 Available UTXOs:', utxos.length);
  
  // Get locally tracked used UTXOs
  const usedUtxos = JSON.parse(localStorage.getItem(USED_UTXO_KEY) || '[]');
  console.log('📋 Locally tracked used UTXOs:', usedUtxos.length);

  // Filter out UTXOs that we've already marked as used
  const freshUtxos = utxos.filter((u: any) => {
    const utxoId = `${u.txid}:${u.vout}`;
    return !usedUtxos.includes(utxoId);
  });

  console.log('✅ Fresh UTXOs (not used locally):', freshUtxos.length);

  // PROFESSIONAL ERROR HANDLING: NO AUTO-CLEARING
  if (freshUtxos.length === 0) {
    // Get some additional info for the error message
    const pendingCount = utxos.filter((u: any) => !u.status?.confirmed).length;
    const totalBalance = utxos.reduce((sum: number, u: any) => sum + u.value, 0);
    
    throw new Error(
      `No fresh UTXOs available for spending.\n\n` +
      `Possible reasons:\n` +
      `• All UTXOs have been used in pending transactions\n` +
      `• Waiting for confirmations (${pendingCount} unconfirmed)\n` +
      `• Wallet needs more funds\n\n` +
      `Available options:\n` +
      `1. Wait for pending transactions to confirm\n` +
      `2. Top up wallet with more Testnet BTC (current balance: ${totalBalance} sats)\n` +
      `3. If tracking is incorrect, use clearUsedUtxos() in console\n\n` +
      `Debug info:\n` +
      `• Total UTXOs: ${utxos.length}\n` +
      `• Used (tracked): ${usedUtxos.length}\n` +
      `• Fresh available: 0`
    );
  }

  // PRODUCTION GRADE: Sort FRESH UTXOs by value (ascending)
  // This allows us to find the SMALLEST FRESH UTXO that is still larger than our requirement
  const sortedFreshUtxos = freshUtxos.sort((a: any, b: any) => a.value - b.value);

  // Find the first FRESH UTXO in the sorted list that meets the requirement
  const fundingUtxo = sortedFreshUtxos.find((u: any) => u.value >= minAmount);

  if (!fundingUtxo) {
    const largestFresh = sortedFreshUtxos[sortedFreshUtxos.length - 1]?.value || 0;
    const smallestFresh = sortedFreshUtxos[0]?.value || 0;
    
    throw new Error(
      `No fresh UTXO with ≥ ${minAmount} sats.\n\n` +
      `Available fresh UTXO range: ${smallestFresh} - ${largestFresh} sats\n` +
      `Please send more Testnet Bitcoin (at least ${minAmount} sats) to ${address}\n\n` +
      `To manually clear tracking, run in console:\n` +
      `import('./charm-utils').then(m => m.clearUsedUtxos())`
    );
  }

  // Fetch the raw transaction hex for this UTXO
  const txHexResponse = await axios.get(`${MEMPOOL_API}/tx/${fundingUtxo.txid}/hex`);
  
  const result = {
    utxoId: `${fundingUtxo.txid}:${fundingUtxo.vout}`,
    value: fundingUtxo.value,
    hex: txHexResponse.data
  };

  console.log('🎯 Selected fresh funding UTXO:', {
    utxoId: result.utxoId,
    value: result.value,
    confirmed: fundingUtxo.status?.confirmed || false,
    confirmations: fundingUtxo.status?.confirmations || 0,
    previouslyUsed: isUtxoUsed(result.utxoId)
  });

  // CRITICAL: Mark as used IMMEDIATELY to prevent another process from selecting it
  markUtxoAsUsed(result.utxoId);
  
  return result;
}

/**
 * Manual verification of UTXO status using mempool.space API
 * Useful for debugging
 */
export async function verifyUtxoStatus(utxoId: string): Promise<{ spent: boolean, details: any }> {
  const [txid, vout] = utxoId.split(':');
  try {
    // Try the outspend endpoint first (most accurate)
    const outspendResponse = await axios.get(`${MEMPOOL_API}/tx/${txid}/outspend/${vout}`);
    const spentStatus = outspendResponse.data;
    
    // Also get the full transaction to see confirmations
    const txResponse = await axios.get(`${MEMPOOL_API}/tx/${txid}`);
    const txDetails = txResponse.data;
    
    const isUsed = isUtxoUsed(utxoId);
    const locallyTrackedButNotSpent = isUsed && !spentStatus.spent;
    
    console.log(`🔍 UTXO ${utxoId} verification:`, {
      spent: spentStatus.spent,
      spentBy: spentStatus.txid || 'Not spent yet',
      confirmed: txDetails.status?.confirmed || false,
      blockHeight: txDetails.status?.block_height,
      confirmations: txDetails.status?.confirmations || 0,
      locallyTracked: isUsed,
      locallyTrackedButNotSpent: locallyTrackedButNotSpent
    });
    
    return {
      spent: spentStatus.spent,
      details: { ...spentStatus, txDetails }
    };
  } catch (error) {
    console.error(`Failed to verify UTXO ${utxoId}:`, error);
    return { spent: true, details: { error: 'Verification failed' } };
  }
}

/**
 * Helper function to provide user-friendly wallet status
 */
export async function getWalletStatus(address: string): Promise<{
  totalBalance: number;
  confirmedBalance: number;
  unconfirmedBalance: number;
  totalUtxos: number;
  freshUtxos: number;
  usedUtxos: number;
  unconfirmedUtxos: number;
}> {
  try {
    const response = await axios.get(`${MEMPOOL_API}/address/${address}/utxo`);
    const utxos = response.data;
    
    const usedUtxos = JSON.parse(localStorage.getItem(USED_UTXO_KEY) || '[]');
    const freshUtxos = utxos.filter((u: any) => !usedUtxos.includes(`${u.txid}:${u.vout}`));
    
    return {
      totalBalance: utxos.reduce((sum: number, u: any) => sum + u.value, 0),
      confirmedBalance: utxos.filter((u: any) => u.status?.confirmed).reduce((sum: number, u: any) => sum + u.value, 0),
      unconfirmedBalance: utxos.filter((u: any) => !u.status?.confirmed).reduce((sum: number, u: any) => sum + u.value, 0),
      totalUtxos: utxos.length,
      freshUtxos: freshUtxos.length,
      usedUtxos: usedUtxos.length,
      unconfirmedUtxos: utxos.filter((u: any) => !u.status?.confirmed).length
    };
  } catch (error: any) {
    console.error('Failed to get wallet status:', error);
    throw new Error(`Unable to fetch wallet status: ${error.message}`);
  }
}

export async function scanAddressForCharms(address: string) {
  try {
    // 1. PROFESSIONAL FIX: Initialize the WASM module
    // This populates the internal 'wasm' variable needed for extraction
    await wasm.default('/charms_lib_bg.wasm'); 

    const utxoResponse = await axios.get(`${MEMPOOL_API}/address/${address}/utxo`);
    const utxos = utxoResponse.data;
    const charmsAssets = [];

    for (const utxo of utxos) {
      try {
        const txHexResponse = await axios.get(`${MEMPOOL_API}/tx/${utxo.txid}/hex`);
        const txJson = { bitcoin: txHexResponse.data };

        // This call will now succeed because wasm.default() was called above
        const spellData = wasm.extractAndVerifySpell(txJson, false);

        if (spellData && spellData.tx) {
          const outputCharms = spellData.tx.outs[utxo.vout];

          // 2. PROFESSIONAL FIX: Use a more robust check for Maps
          // Check for the '.size' property instead of 'instanceof Map'
          const isMap = outputCharms && typeof outputCharms.size === 'number';
          const isObject = outputCharms && !isMap && Object.keys(outputCharms).length > 0;

          if (isMap || isObject) {
            charmsAssets.push({
              utxoId: `${utxo.txid}:${utxo.vout}`,
              amount: utxo.value,
              spell: spellData,
              charms: outputCharms
            });
          }
        }
      } catch (e: any) {
        // PRODUCTION FIX: Only log actual network or system errors.
        // Ignore "no control block" or "invalid" errors as they just mean the UTXO isn't a Charm.
        if (!e.message?.includes("no control block") && !e.message?.includes("invalid length")) {
          console.warn(`System error scanning UTXO ${utxo.txid}:`, e.message);
        }
        continue; 
      }
    }
    return charmsAssets;
  } catch (error) {
    console.error("Scan failed:", error);
    return [];
  }
}

/**
 * DEBUG: Check all UTXOs for an address with spent status
 */
export async function debugUtxos(address: string): Promise<any> {
  try {
    const response = await axios.get(`${MEMPOOL_API}/address/${address}/utxo`);
    const utxos = response.data;
    
    const detailedUtxos = await Promise.all(
      utxos.map(async (utxo: any) => {
        const utxoId = `${utxo.txid}:${utxo.vout}`;
        try {
          const outspend = await axios.get(`${MEMPOOL_API}/tx/${utxo.txid}/outspend/${utxo.vout}`);
          const isUsed = isUtxoUsed(utxoId);
          
          // Determine status based on conditions
          let status = '✅ OK';
          if (isUsed && !outspend.data.spent) {
            status = '⚠️ POTENTIAL ISSUE';
          } else if (!outspend.data.spent && isUsed) {
            status = '📝 Tracked but not spent';
          } else if (outspend.data.spent && !isUsed) {
            status = '🔴 Spent but not tracked';
          }
          
          return {
            ...utxo,
            utxoId,
            spent: outspend.data.spent,
            spentByTxid: outspend.data.txid,
            locallyTracked: isUsed,
            status: status
          };
        } catch (error) {
          return {
            ...utxo,
            utxoId,
            spent: 'unknown',
            locallyTracked: isUtxoUsed(utxoId),
            status: '❌ Verification failed'
          };
        }
      })
    );
    
    console.table(detailedUtxos.map((u: any) => ({
      'UTXO ID': u.utxoId,
      'Value (sats)': u.value,
      'Spent?': u.spent,
      'Spent By TXID': u.spentByTxid?.substring(0, 16) + '...' || 'N/A',
      'Locally Tracked': u.locallyTracked,
      'Status': u.status
    })));
    
    return detailedUtxos;
  } catch (error) {
    console.error('Debug UTXOs failed:', error);
    return [];
  }
}