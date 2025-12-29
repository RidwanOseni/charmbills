// --- 1. Plan (Subscription Product Definition) ---
// This represents the core SaaS product created by the merchant [1].
export interface Plan {
  id: string; // Internal UUID
  serviceName: string; // e.g., "AI API Access"
  priceBtc: number; // e.g., 0.001
  billingCycle: 'weekly' | 'monthly' | 'yearly' | 'demo'; // Added 'demo' for 3-minute testing
  merchantAddress: string; // Bitcoin address receiving payment
  nftUtxoId: string; // txid:vout (Plan NFT authority)
  appId: string; // Charms app ID
  appVk: string; // Verification key
  createdAt: string; // ISO string for safe serialization
}

// --- 2. Subscription (Legacy UI Compatibility) ---
// Used by existing frontend components like subscription-table.tsx [2].
export interface Subscription {
  id: string;
  serviceName: string;
  priceBTC: number;
  billingCycle: "weekly" | "monthly" | "yearly" | "demo";
  bitcoinAddress: string;
  nftUtxoId?: string;
  createdAt: string;
}

// --- 3. CharmPlanNFT (Authority Object Metadata) ---
// The on-chain controller that defines who can mint tokens [2, 4].
export interface CharmPlanNFT {
  utxoId: string; // txid:vout
  ownerAddress: string;
  metadata: {
    serviceName: string;
    ticker: string;
    iconUrl?: string;
    description?: string;
    remaining?: number; // Tracks remaining supply for minting tokens
  };
}

// --- 4. SpellRequest (Protocol Interaction Intent) ---
// Encapsulates the intent to perform a Charms action [4].
export interface SpellRequest {
  type: 'mint-nft' | 'mint-token' | 'send';
  authorityUtxo?: string; 
  anchorUtxo?: string; // Dedicated anchor UTXO for app identity (used for appId and ins array)
  anchorValue?: number; // NEW: Value of anchor UTXO in satoshis (required for mint-nft to calculate change)
  fundingUtxo: string; // UTXO used by Prover for transaction fees
  fundingUtxoValue: number; 
  changeAddress: string; 
  feeRate: number; 
  outputs: Array<{
    address: string;
    tokenAmount?: number; 
    nftMetadata?: CharmPlanNFT['metadata']; 
  }>;
}

// --- 5. TransactionRecord (Operational Tracking) ---
export interface TransactionRecord {
  id: string;
  subscriptionId?: string;
  planId?: string;
  commitTxHex: string;
  spellTxHex: string;
  commitTxId?: string;
  spellTxId?: string;
  status: 'pending' | 'confirmed' | 'failed';
  createdAt: string;
}

// --- 6. ProverResult (Frontend Receipt for Wallet Signing) ---
export interface ProverResult {
  commitTxHex: string;
  spellTxHex: string;
  commitOutput?: {
    scriptPubKey: string;
    value: number;
  };
}

// --- 7. Shared Type Aliases ---
export type BillingCycle = 'weekly' | 'monthly' | 'yearly' | 'demo'; 