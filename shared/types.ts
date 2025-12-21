// --- 1. Plan (Subscription Product Definition) ---
export interface Plan {
    id: string; // Internal UUID
    serviceName: string; // e.g., "AI API Access"
    priceBtc: number; // e.g., 0.001
    billingCycle: 'weekly' | 'monthly' | 'yearly';
    merchantAddress: string; // Bitcoin address receiving payment
    nftUtxoId: string; // txid:vout (Plan NFT authority)
    appId: string; // Charms app ID
    appVk: string; // Verification key
    createdAt: Date;
  }
  
  // --- 2. CharmPlanNFT (Authority Object Metadata) ---
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
  
  // --- 3. SpellRequest (Protocol Interaction Intent) ---
  export interface SpellRequest {
    type: 'mint-nft' | 'mint-token' | 'send';
    authorityUtxo?: string; // The UTXO holding the NFT/Token authority
    fundingUtxo: string; // Plain BTC UTXO for fees
    fundingUtxoValue: number; // Value in satoshis
    changeAddress: string; // Address for BTC change
    feeRate: number; // Sats per vB
    outputs: Array<{
      address: string;
      tokenAmount?: number; // Used for subscription tokens
      nftMetadata?: CharmPlanNFT['metadata']; // Used for the Plan NFT
    }>;
  }
  
  // --- 4. TransactionRecord (Backend Operational Tracking) ---
  export interface TransactionRecord {
    id: string;
    subscriptionId?: string;
    planId?: string;
    commitTxHex: string;
    spellTxHex: string;
    commitTxId?: string;
    spellTxId?: string;
    status: 'pending' | 'confirmed' | 'failed';
    createdAt: Date;
  }
  
  // --- 5. ProverResult (Frontend Receipt for Wallet Signing) ---
  export interface ProverResult {
    commitTxHex: string; // Hex-encoded or PSBT-wrapped commit tx
    spellTxHex: string; // Hex-encoded or PSBT-wrapped spell tx
    commitOutput?: {
      scriptPubKey: string; // Required for signing the spell tx
      value: number; // Required for signing the spell tx
    };
  }
  
  // --- 6. Shared Type Aliases ---
  export type BillingCycle = 'weekly' | 'monthly' | 'yearly';