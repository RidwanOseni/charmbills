import { generateUnsignedTransactions } from './charms/proverClient';
import { createMintTokenSpellRequest } from './charms/buildMintToken';
import { createMintNftSpellRequest } from './charms/buildMintNFT';
import { TransactionRecord, SpellRequest } from '@/shared/types';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../../backend/.env') });

async function mockSignAndBroadcast(requestType: string, commitTxHex: unknown, spellTxHex: unknown): Promise<TransactionRecord> {
    console.log(`\n=== DEBUG: mockSignAndBroadcast called ===`);
    console.log(`requestType: ${requestType}`);
    console.log(`commitTxHex type: ${typeof commitTxHex}, value:`, commitTxHex);
    console.log(`spellTxHex type: ${typeof spellTxHex}, value:`, spellTxHex);
    
    // Convert to strings safely
    const commitHex = String(commitTxHex || '');
    const spellHex = String(spellTxHex || '');
    
    console.log(`\n--- TRANSACTION GENERATION COMPLETE: ${requestType.toUpperCase()} ---`);
    
    if (commitHex && spellHex) {
        console.log(`Commit Tx Hex (Unsigned, first 100 chars): ${commitHex.substring(0, 100)}...`);
        console.log(`Spell Tx Hex (Unsigned, first 100 chars): ${spellHex.substring(0, 100)}...`);
        
        console.log("\n--- MANUAL SIGNING REQUIRED ---");
        console.log("The Charms Prover returned transactions. You must now use your Bitcoin wallet tooling to sign them.");
        
        console.log("\n1. Save the hexes:");
        console.log(`COMMIT_TX_HEX="${commitHex}"`);
        console.log(`SPELL_TX_HEX="${spellHex}"`);
        
        console.log("\n2. Sign the Commit Transaction (spending the funding UTXO):");
        console.log(`b signrawtransactionwithwallet "$COMMIT_TX_HEX"`);
        
        console.log("\n3. Sign the Spell Transaction (spending the commit output):");
        console.log("This requires providing commit transaction output details (txid, vout=0, scriptPubKey, amount):");
        console.log(`b signrawtransactionwithwallet "$SPELL_TX_HEX" 'COMMIT_TX_OUT_CONTEXT_JSON'`);
        
        console.log("\n4. Broadcast the transactions AS A PACKAGE:");
        console.log("Ensure both are submitted simultaneously to satisfy the dependency:");
        console.log(`b submitpackage '["$SIGNED_COMMIT_TX_HEX", "$SIGNED_SPELL_TX_HEX"]'`);
    } else {
        console.error("ERROR: Missing transaction hexes!");
        console.error(`commitHex empty: ${!commitHex}`);
        console.error(`spellHex empty: ${!spellHex}`);
    }
    
    return {
        id: Math.random().toString(36).substring(7),
        commitTxHex: commitHex,
        spellTxHex: spellHex,
        status: 'pending', 
        createdAt: new Date().toISOString(),
    };
}

async function runFlow(request: SpellRequest) {
    console.log(`\n================ STARTING ${request.type.toUpperCase()} FLOW ================`);
    try {
        // 1. Generate Transactions
        console.log("Calling generateUnsignedTransactions...");
        
        // FIX: Added the required second argument
        const mockPrevTxHex = "02000000000101..."; // Placeholder for compilation
        const { commitTxHex, spellTxHex } = await generateUnsignedTransactions(request, [mockPrevTxHex]);
        
        console.log(`\n=== DEBUG: Received from generateUnsignedTransactions ===`);
        console.log(`commitTxHex type: ${typeof commitTxHex}, length: ${commitTxHex?.length}`);
        console.log(`spellTxHex type: ${typeof spellTxHex}, length: ${spellTxHex?.length}`);
        
        // 2. Simulate Signing and Broadcasting
        const record = await mockSignAndBroadcast(request.type, commitTxHex, spellTxHex);

        console.log(`\n✅ SUCCESS: ${request.type.toUpperCase()} Transaction Generated.`);
        console.log(`Monitor the transaction status after manual signing and broadcasting.`);
        
        return record;
    } catch (error) {
        console.error(`\n❌ CRITICAL ERROR during ${request.type.toUpperCase()} Flow:`);
        
        if (error instanceof Error) {
            console.error("Error message:", error.message);
            console.error("Error stack:", error.stack);
        } else {
            console.error("Unknown error:", error);
        }
        
        throw error;
    }
}

async function main() {
    console.log("=== CharmBills Subscription Engine MVP (TOKEN MINTING ONLY) ===");
    
    try {
        /*
        // --- Phase 1: Merchant creates the Plan NFT Authority ---
        console.log("\n📦 Phase 1: Creating Plan NFT Authority...");
        const nftRequest = createMintNftSpellRequest();
        console.log("NFT Request created:", {
            type: nftRequest.type,
            fundingUtxo: nftRequest.fundingUtxo,
            changeAddress: nftRequest.changeAddress?.substring(0, 20) + '...'
        });
        
        await runFlow(nftRequest);
        
        console.log("\n📝 NOTE ON NFT MINTING OUTPUT ---");
        console.log("The output of the successful NFT Minting transaction (v_out 0) must be used as the PLAN_NFT_UTXO in the next step.");
        console.log(`Manually update the .env file with the confirmed NFT UTXO ID (TXID:0) before proceeding to Phase 2.`);
        
        console.log("\n⏳ WAITING FOR MANUAL INTERVENTION (NFT CONFIRMATION) ================");
        console.log("1. Sign the transactions using the commands above");
        console.log("2. Wait for confirmation on testnet");
        console.log("3. Update .env with PLAN_NFT_UTXO and PLAN_NFT_APP_ID");
        */
        
        // --- Phase 2: Customer Subscribes (Minting Subscription Tokens) ---
        console.log("\n🔐 Phase 2: Customer Subscribes (Minting Subscription Tokens)...");
        const tokenRequest = createMintTokenSpellRequest();
        console.log("Token Request created:", {
            type: tokenRequest.type,
            authorityUtxo: tokenRequest.authorityUtxo,
            subscriberAddress: tokenRequest.outputs[0]?.address?.substring(0, 20) + '...'
        });
        
        await runFlow(tokenRequest);
        
        console.log("\n🎉 TOKEN MINTING COMPLETE ================");
        console.log("\nNext steps:");
        console.log("1. Sign and broadcast the token minting transactions");
        console.log("2. Verify subscription tokens were minted to subscriber");
        console.log("3. The NFT authority should be returned to merchant with updated remaining supply");
        
    } catch (error) {
        console.error("\n💥 FATAL ERROR in main flow:");
        console.error(error);
        process.exit(1);
    }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (error) => {
    console.error('Unhandled Rejection:', error);
    process.exit(1);
});

main();