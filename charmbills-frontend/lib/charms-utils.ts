import * as wasm from "./wasm/charms_lib";
import axios from 'axios';

/**
 * Scans a Bitcoin address for UTXOs and extracts Charms data using the WASM module [4, 5].
 * This balances UI state with the external truth of the Bitcoin blockchain [6].
 */
export async function scanAddressForCharms(address: string) {
  try {
    // 1. Fetch current UTXOs for the Taproot address from testnet4 [2, 7]
    const utxoResponse = await axios.get(`https://mempool.space/testnet4/api/address/${address}/utxo`);
    const utxos = utxoResponse.data;

    const charmsAssets = [];

    for (const utxo of utxos) {
      try {
        // 2. Retrieve the raw transaction hex for the UTXO [2, 3]
        const txHexResponse = await axios.get(`https://mempool.space/testnet4/api/tx/${utxo.txid}/hex`);
        const rawTxHex = txHexResponse.data;

        // 3. Construct the JSON format expected by the WASM module [3, 8]
        const txJson = {
          bitcoin: rawTxHex
        };

        // 4. Call the WASM extractor to verify the spell proof [8, 9]
        // Passing 'false' ensures it verifies the actual ZK proof instead of mocking [8].
        const spellData = wasm.extractAndVerifySpell(txJson, false);

        if (spellData && spellData.tx) {
          // Find the specific output index (vout) that contains the charm [8, 10]
          const outputCharms = spellData.tx.outs[utxo.vout];

          if (outputCharms && Object.keys(outputCharms).length > 0) {
            charmsAssets.push({
              utxoId: `${utxo.txid}:${utxo.vout}`,
              amount: utxo.value,
              spell: spellData,
              charms: outputCharms // Mappings of App spec to Charm content [10, 11]
            });
          }
        }
      } catch (innerError) {
        // Skip UTXOs that do not contain valid Charms or inscriptions
        continue;
      }
    }

    return charmsAssets;

  } catch (error) {
    console.error("Failed to scan for Charms:", error);
    return [];
  }
}