use charms_sdk::data::{
    charm_values, sum_token_amount, App, Data, Transaction, UtxoId, B32, NFT, TOKEN,
};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

// Define the NFT content structure with flexible field naming
#[derive(Debug, Clone, Deserialize)]
pub struct NftContent {
    pub ticker: String,
    pub remaining: u64,
    
    // Accept both camelCase and snake_case for service name
    #[serde(alias = "serviceName")]
    #[serde(alias = "service_name")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub service_name: Option<String>,
    
    // Accept both camelCase and snake_case for icon URL
    #[serde(alias = "iconUrl")]
    #[serde(alias = "icon_url")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub icon_url: Option<String>,
}

// Manual Serialize implementation to output camelCase
impl Serialize for NftContent {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        use serde::ser::SerializeMap;
        
        let mut map = serializer.serialize_map(None)?;
        map.serialize_entry("ticker", &self.ticker)?;
        map.serialize_entry("remaining", &self.remaining)?;
        
        if let Some(ref service_name) = self.service_name {
            map.serialize_entry("serviceName", service_name)?;
        }
        
        if let Some(ref icon_url) = self.icon_url {
            map.serialize_entry("iconUrl", icon_url)?;
        }
        
        map.end()
    }
}

impl Default for NftContent {
    fn default() -> Self {
        Self {
            ticker: String::new(),
            remaining: 0,
            service_name: None,
            icon_url: None,
        }
    }
}

pub fn app_contract(app: &App, tx: &Transaction, _x: &Data, w: &Data) -> bool {
    eprintln!("\n=== app_contract ENTER ===");
    eprintln!("App: tag={}, identity={}", app.tag, app.identity);
    eprintln!("Transaction inputs: {}", tx.ins.len());
    eprintln!("Transaction outputs: {}", tx.outs.len());
    
    // Debug: Print all app references in the transaction
    eprintln!("\n=== ALL APP REFERENCES IN TRANSACTION ===");
    eprintln!("Inputs:");
    for (i, (utxo_id, charms)) in tx.ins.iter().enumerate() {
        eprintln!("  Input {} (UTXO: {}):", i, utxo_id);
        for (app_ref, data) in charms {
            let app_ref_str = app_ref.to_string();
            eprintln!("    App ref: {}", app_ref_str);
            match data.value::<serde_json::Value>() {
                Ok(val) => eprintln!("      Data: {}", serde_json::to_string(&val).unwrap_or_default()),
                Err(_) => eprintln!("      Data: [binary or unparsable]"),
            }
        }
    }
    
    eprintln!("\nOutputs (using charm_values):");
    for (i, _) in tx.outs.iter().enumerate() {
        eprintln!("  Output {}:", i);
        // Use charm_values to see what's in outputs for this app
        let output_charms: Vec<&Data> = charm_values(app, tx.outs.iter()).collect();
        eprintln!("    Found {} charms for app", output_charms.len());
        for (j, data) in output_charms.iter().enumerate() {
            eprintln!("    Charm {}:", j);
            match data.value::<serde_json::Value>() {
                Ok(val) => eprintln!("      Data: {}", serde_json::to_string(&val).unwrap_or_default()),
                Err(_) => eprintln!("      Data: [binary or unparsable]"),
            }
        }
    }
    
    let result = match app.tag {
        NFT => {
            eprintln!("\nCalling nft_contract_satisfied");
            nft_contract_satisfied(app, tx, w)
        }
        TOKEN => {
            eprintln!("\nCalling token_contract_satisfied");
            token_contract_satisfied(app, tx)
        }
        _ => {
            eprintln!("ERROR: Unknown app tag: {}", app.tag);
            false
        }
    };
    
    eprintln!("=== app_contract EXIT: {} ===", if result { "SUCCESS" } else { "FAILURE" });
    result
}

// NFT contract logic
fn nft_contract_satisfied(app: &App, tx: &Transaction, w: &Data) -> bool {
    eprintln!("\n=== nft_contract_satisfied ENTER ===");
    
    let w_str: Option<String> = w.value().ok();
    eprintln!("Private input w: {:?}", w_str);
    
    if w_str.is_none() {
        eprintln!("ERROR: Private input w is missing or malformed");
        return false;
    }
    
    let w_str = w_str.unwrap();
    eprintln!("w string: {}", w_str);
    
    // Verify hash(w) == app.identity
    let hash_w = hash(&w_str);
    eprintln!("Hash of w: {}", hash_w);
    eprintln!("App identity: {}", app.identity);
    
    if hash_w != app.identity {
        eprintln!("ERROR: Hash of w does not match app identity");
        return false;
    }
    
    // Parse UTXO ID from w
    let w_utxo_id = match UtxoId::from_str(&w_str) {
        Ok(id) => id,
        Err(e) => {
            eprintln!("ERROR: Failed to parse UTXO ID from w: {}", e);
            return false;
        }
    };
    eprintln!("Parsed UTXO ID from w: {}", w_utxo_id);
    
    // Check if this is NFT minting (w_utxo_id is in inputs) or token minting
    let is_nft_minting = tx.ins.iter().any(|(utxo_id, _)| utxo_id == &w_utxo_id);
    eprintln!("Is NFT minting transaction: {}", is_nft_minting);
    
    if is_nft_minting {
        // NFT MINTING: Original UTXO should be in inputs
        let has_input_utxo = tx.ins.iter().any(|(utxo_id, _)| utxo_id == &w_utxo_id);
        eprintln!("NFT minting - checking if input contains UTXO {}: {}", w_utxo_id, has_input_utxo);
        
        if !has_input_utxo {
            eprintln!("ERROR: NFT minting requires original UTXO {} in inputs", w_utxo_id);
            return false;
        }
        
        // For NFT minting, we expect exactly 1 NFT output
        let nft_charms: Vec<&Data> = charm_values(app, tx.outs.iter()).collect();
        eprintln!("Found {} NFT charms in outputs", nft_charms.len());
        
        if nft_charms.len() != 1 {
            eprintln!("ERROR: NFT minting requires exactly 1 NFT charm in outputs, found {}", nft_charms.len());
            return false;
        }
    } else {
        // TOKEN MINTING or NFT TRANSFER: Original UTXO is NOT in inputs (it was already spent)
        eprintln!("Token minting/NFT transfer - original UTXO {} was already spent", w_utxo_id);
        eprintln!("Proceeding with NFT validation...");
        
        // For token minting, we need at least 1 NFT output (could be returning NFT to merchant)
        let nft_charms: Vec<&Data> = charm_values(app, tx.outs.iter()).collect();
        eprintln!("Found {} NFT charms in outputs", nft_charms.len());
        
        if nft_charms.is_empty() {
            eprintln!("ERROR: Need at least 1 NFT charm in outputs for token minting");
            return false;
        }
    }
    
    // Verify NFT structure in outputs
    let nft_charms: Vec<&Data> = charm_values(app, tx.outs.iter()).collect();
    for (i, data) in nft_charms.iter().enumerate() {
        eprintln!("Verifying NFT charm {}:", i);
        match data.value::<NftContent>() {
            Ok(content) => {
                eprintln!("✅ NFT content valid: ticker={}, remaining={}", 
                         content.ticker, content.remaining);
                if content.service_name.is_some() {
                    eprintln!("   service_name: {:?}", content.service_name);
                }
                if content.icon_url.is_some() {
                    eprintln!("   icon_url: {:?}", content.icon_url);
                }
            }
            Err(e) => {
                eprintln!("❌ ERROR: Failed to parse NFT content: {:?}", e);
                if let Ok(json_val) = data.value::<serde_json::Value>() {
                    eprintln!("   Raw JSON data: {}", serde_json::to_string_pretty(&json_val).unwrap_or_default());
                }
                return false;
            }
        }
    }
    
    eprintln!("=== nft_contract_satisfied EXIT: SUCCESS ===");
    true
}

pub(crate) fn hash(data: &str) -> B32 {
    let hash = Sha256::digest(data);
    B32(hash.into())
}

// Token contract logic
fn token_contract_satisfied(token_app: &App, tx: &Transaction) -> bool {
    eprintln!("\n=== token_contract_satisfied ENTER ===");
    eprintln!("Token app identity: {}", token_app.identity);
    
    let result = can_mint_token(token_app, tx);
    eprintln!("=== token_contract_satisfied EXIT: {} ===", if result { "SUCCESS" } else { "FAILURE" });
    result
}

fn can_mint_token(token_app: &App, tx: &Transaction) -> bool {
    eprintln!("\n=== can_mint_token ENTER ===");
    
    // Create corresponding NFT app
    let nft_app = App {
        tag: NFT,
        identity: token_app.identity.clone(),
        vk: token_app.vk.clone(),
    };
    
    eprintln!("Corresponding NFT app identity: {}", nft_app.identity);
    
    // Helper to parse NFT content with robust error handling
    let parse_nft_content = |data: &Data| -> Option<NftContent> {
        match data.value::<NftContent>() {
            Ok(content) => {
                eprintln!("  ✅ Successfully parsed NFT:");
                eprintln!("     ticker={}", content.ticker);
                eprintln!("     remaining={}", content.remaining);
                if content.service_name.is_some() {
                    eprintln!("     service_name={:?}", content.service_name);
                }
                if content.icon_url.is_some() {
                    eprintln!("     icon_url={:?}", content.icon_url);
                }
                Some(content)
            }
            Err(e) => {
                eprintln!("  ❌ ERROR parsing NFT content: {:?}", e);
                match data.value::<serde_json::Value>() {
                    Ok(val) => {
                        eprintln!("  Raw JSON value type: {:?}", val);
                        eprintln!("  Raw JSON string: {}", serde_json::to_string(&val).unwrap_or_default());
                    }
                    Err(_) => eprintln!("  Could not extract raw data"),
                }
                None
            }
        }
    };
    
    // Find NFT content in INPUTS
    eprintln!("\nSearching for NFT charms in inputs...");
    let nft_inputs: Vec<NftContent> = charm_values(&nft_app, tx.ins.iter().map(|(_, v)| v))
        .filter_map(|data| parse_nft_content(data))
        .collect();
    
    eprintln!("Found {} NFT charms in inputs", nft_inputs.len());
    
    if nft_inputs.is_empty() {
        eprintln!("❌ ERROR: No NFT found in inputs for app {}", nft_app.identity);
        eprintln!("=== can_mint_token EXIT: FAILURE ===");
        return false;
    }
    
    if nft_inputs.len() > 1 {
        eprintln!("⚠️  WARNING: Found {} NFTs in inputs, using first one", nft_inputs.len());
    }
    
    let nft_content_in = &nft_inputs[0];
    let incoming_supply = nft_content_in.remaining;
    eprintln!("📊 Incoming NFT supply: {}", incoming_supply);
    
    // Find NFT content in OUTPUTS
    eprintln!("\nSearching for NFT charms in outputs...");
    let nft_outputs: Vec<NftContent> = charm_values(&nft_app, tx.outs.iter())
        .filter_map(|data| parse_nft_content(data))
        .collect();
    
    eprintln!("Found {} NFT charms in outputs", nft_outputs.len());
    
    if nft_outputs.is_empty() {
        eprintln!("❌ ERROR: No NFT found in outputs for app {}", nft_app.identity);
        eprintln!("=== can_mint_token EXIT: FAILURE ===");
        return false;
    }
    
    if nft_outputs.len() > 1 {
        eprintln!("⚠️  WARNING: Found {} NFTs in outputs, using first one", nft_outputs.len());
    }
    
    let nft_content_out = &nft_outputs[0];
    let outgoing_supply = nft_content_out.remaining;
    eprintln!("📊 Outgoing NFT supply: {}", outgoing_supply);
    
    // Validate supply doesn't increase
    if incoming_supply < outgoing_supply {
        eprintln!("❌ ERROR: Supply cannot increase ({} < {})", incoming_supply, outgoing_supply);
        eprintln!("=== can_mint_token EXIT: FAILURE ===");
        return false;
    }
    
    let tokens_minted = incoming_supply - outgoing_supply;
    eprintln!("🪙 Tokens to mint (supply reduction): {}", tokens_minted);
    
    // Calculate input token amount
    let input_token_amount = match sum_token_amount(token_app, tx.ins.iter().map(|(_, v)| v)) {
        Ok(amount) => {
            eprintln!("📥 Input token amount: {}", amount);
            amount
        }
        Err(e) => {
            eprintln!("💡 No tokens in inputs (or error): {:?}", e);
            0
        }
    };
    
    // Calculate output token amount
    let output_token_amount = match sum_token_amount(token_app, tx.outs.iter()) {
        Ok(amount) => {
            eprintln!("📤 Output token amount: {}", amount);
            amount
        }
        Err(e) => {
            eprintln!("❌ ERROR calculating output tokens: {:?}", e);
            eprintln!("=== can_mint_token EXIT: FAILURE ===");
            return false;
        }
    };
    
    let tokens_created = output_token_amount - input_token_amount;
    eprintln!("➕ Tokens created (output - input): {} - {} = {}", 
             output_token_amount, input_token_amount, tokens_created);
    
    // Validate tokens created equals supply reduction
    if tokens_created != tokens_minted {
        eprintln!("❌ ERROR: Tokens created ({}) must equal supply reduction ({})", 
                 tokens_created, tokens_minted);
        eprintln!("=== can_mint_token EXIT: FAILURE ===");
        return false;
    }
    
    eprintln!("✅ All checks passed!");
    eprintln!("=== can_mint_token EXIT: SUCCESS ===");
    true
}

#[cfg(test)]
mod tests {
    use super::*;
    use charms_sdk::data::UtxoId;

    #[test]
    fn test_hash() {
        let utxo_id =
            UtxoId::from_str("dc78b09d767c8565c4a58a95e7ad5ee22b28fc1685535056a395dc94929cdd5f:1")
                .unwrap();
        let data = utxo_id.to_string();
        let expected = "f54f6d40bd4ba808b188963ae5d72769ad5212dd1d29517ecc4063dd9f033faa";
        assert_eq!(&hash(&data).to_string(), expected);
    }
    
    #[test]
    fn test_nft_content_deserialize_camelcase() {
        let json_data = r#"{"ticker":"PROPLAN","remaining":100000,"serviceName":"Test","iconUrl":"http://example.com"}"#;
        let data = Data::from_json(json_data).unwrap();
        let content: NftContent = data.value().unwrap();
        assert_eq!(content.ticker, "PROPLAN");
        assert_eq!(content.remaining, 100000);
        assert_eq!(content.service_name, Some("Test".to_string()));
        assert_eq!(content.icon_url, Some("http://example.com".to_string()));
    }
    
    #[test]
    fn test_nft_content_deserialize_snakecase() {
        let json_data = r#"{"ticker":"PROPLAN","remaining":100000,"service_name":"Test","icon_url":"http://example.com"}"#;
        let data = Data::from_json(json_data).unwrap();
        let content: NftContent = data.value().unwrap();
        assert_eq!(content.ticker, "PROPLAN");
        assert_eq!(content.remaining, 100000);
        assert_eq!(content.service_name, Some("Test".to_string()));
        assert_eq!(content.icon_url, Some("http://example.com".to_string()));
    }
    
    #[test]
    fn test_nft_content_deserialize_mixed() {
        let json_data = r#"{"ticker":"PROPLAN","remaining":100000,"serviceName":"Test","icon_url":"http://example.com"}"#;
        let data = Data::from_json(json_data).unwrap();
        let content: NftContent = data.value().unwrap();
        assert_eq!(content.ticker, "PROPLAN");
        assert_eq!(content.remaining, 100000);
        assert_eq!(content.service_name, Some("Test".to_string()));
        assert_eq!(content.icon_url, Some("http://example.com".to_string()));
    }
    
    #[test]
    fn test_nft_content_deserialize_minimal() {
        let json_data = r#"{"ticker":"PROPLAN","remaining":100000}"#;
        let data = Data::from_json(json_data).unwrap();
        let content: NftContent = data.value().unwrap();
        assert_eq!(content.ticker, "PROPLAN");
        assert_eq!(content.remaining, 100000);
        assert!(content.service_name.is_none());
        assert!(content.icon_url.is_none());
    }
    
    #[test]
    fn test_nft_content_serialize_camelcase() {
        let content = NftContent {
            ticker: "PROPLAN".to_string(),
            remaining: 100000,
            service_name: Some("Test".to_string()),
            icon_url: Some("http://example.com".to_string()),
        };
        
        let json = serde_json::to_string(&content).unwrap();
        assert!(json.contains("\"serviceName\""));
        assert!(json.contains("\"iconUrl\""));
        assert!(json.contains("\"ticker\""));
        assert!(json.contains("\"remaining\""));
    }
}