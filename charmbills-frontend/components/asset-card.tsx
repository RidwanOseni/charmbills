import React from 'react';
import { Package, Ticket, HardDrive } from 'lucide-react';

interface AssetCardProps {
  asset: {
    utxoId: string;
    amount: number;
    charms: Record<string, any>;
    spell: {
      apps: Record<string, string>;
      app_public_inputs?: any; // Add this line to fix the TypeScript error
      tx?: {
        apps?: Record<string, string>;
      };
    };
  };
}

export default function AssetCard({ asset }: AssetCardProps) {
  // Add this log to see the structure of the data from the WASM module
  console.log("🔍 WASM SPELL DATA:", JSON.stringify(asset.spell, (key, value) => 
    value instanceof Map ? Array.from(value.entries()) : value, 2
  ));
  
  // 1. Determine the charms array correctly based on the log structure
  // In error_1.txt, asset.charms is already an array of [index, content] pairs
  const charmsArray = Array.isArray(asset.charms) 
    ? asset.charms 
    : asset.charms instanceof Map 
      ? Array.from(asset.charms.entries()) 
      : Object.entries(asset.charms);

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4 hover:border-accent/50 transition-all shadow-sm">
      {charmsArray.map(([appIndex, contentEntries]: [any, any]) => {
        // BEGINNER DEBUG LOGS
        console.log("--- DEBUGGING CHARM ---");
        console.log("App Index from Charm:", appIndex);
        console.log("Full Apps Object:", asset.spell.apps);
        console.log("Is Apps a Map?:", asset.spell.apps instanceof Map);
        console.log("RAW CONTENT ENTRIES:", JSON.stringify(contentEntries, null, 2)); // PROFESSIONAL LOGGING
        
        // This is what was working for you - keep it exactly as is
        const publicInputs = asset.spell.app_public_inputs; // This line is fine now
        let appSpec: string | undefined;

        if (publicInputs instanceof Map) {
          // FIX: The spec string is the KEY of the Map, not the value.
          // We need to get the "Nth" key based on the appIndex.
          const keys = Array.from(publicInputs.keys());
          appSpec = keys[appIndex]; 
        } else if (Array.isArray(publicInputs)) {
          // If it's an array of entries [ [spec, value], ... ]
          const entry = publicInputs[appIndex];
          appSpec = Array.isArray(entry) ? entry[0] : entry;
        }

        // Fallback to spell.apps if not found in public_inputs
        if (!appSpec) {
          const appsTable = asset.spell.apps || asset.spell.tx?.apps;
          if (appsTable instanceof Map) {
            const keys = Array.from(appsTable.keys());
            appSpec = appsTable.get(appIndex) || keys[appIndex] || appsTable.get(`$${appIndex.toString().padStart(2, '0')}`);
          }
        }

        if (!appSpec) return null; // This stops the render if the spec isn't found

        // 1. Correct the Nesting Logic (Look for length 1 based on your log)
        let actualMetadata = contentEntries;
        if (Array.isArray(contentEntries) && contentEntries.length === 1) {
          // If contentEntries is [[pairs]], extract the inner [pairs]
          actualMetadata = contentEntries[0]; 
        }

        // 2. Convert Map or Array of pairs to a standard Object
        const content = (actualMetadata instanceof Map)
          ? Object.fromEntries(actualMetadata)
          : Array.isArray(actualMetadata)
            ? Object.fromEntries(actualMetadata)
            : actualMetadata;

        console.log("✅ Final parsed object:", content);

        // 2. Implement Case-Insensitive Field Mapping
        // Professional property access with fallbacks
        const serviceName = content.serviceName || content.service_name || content.name || "SaaS Plan";
        const ticker = content.ticker || content.ticker_symbol || "PLAN";
        const iconUrl = content.iconUrl || content.icon_url;
        const remaining = content.remaining !== undefined ? content.remaining : 0;

        const isNFT = appSpec.startsWith('n/'); // 'n' tag for NFTs
        const isToken = appSpec.startsWith('t/'); // 't' tag for tokens
        
        // PROFESSIONAL FIX: appId is the middle part of "tag/id/vk" (Index 1)
        const specParts = appSpec.split('/');
        const appId = specParts[1]; 

        return (
          <div key={appId} className="space-y-3">
            {isNFT && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-accent">
                  <Package size={18} />
                  <span className="text-xs font-bold uppercase tracking-wider">Plan NFT Authority</span>
                </div>
                <div className="bg-accent/5 rounded-lg p-3 border border-accent/10">
                  <h3 className="font-semibold text-lg text-foreground">
                    {serviceName}
                  </h3>
                  <div className="flex justify-between items-end mt-2">
                    <span className="text-accent font-mono text-sm">{ticker}</span>
                    <span className="text-muted-foreground text-xs">
                      Remaining: {remaining?.toLocaleString() || "0"}
                    </span>
                  </div>
                </div>
                {/* Visualization of CHIP-420 metadata fields */}
                {iconUrl && (
                   <div className="mt-2 rounded-md overflow-hidden bg-muted aspect-video flex items-center justify-center">
                     <img 
                        src={iconUrl} 
                        alt={ticker} 
                        className="max-h-full max-w-full object-contain"
                        onError={(e) => (e.currentTarget.style.display = 'none')}
                     />
                   </div>
                )}
              </div>
            )}

            {isToken && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-primary">
                  <Ticket size={18} />
                  <span className="text-xs font-bold uppercase tracking-wider">Subscription Token</span>
                </div>
                <div className="bg-primary/5 rounded-lg p-3 border border-primary/10">
                  <div className="flex justify-between items-center">
                    <span className="text-foreground font-medium">Quantity</span>
                    <span className="text-primary font-bold text-xl">
                      {typeof content === 'number' ? content.toLocaleString() : content} Units
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-2 font-mono break-all">
                    App ID: {appId}
                  </p>
                </div>
              </div>
            )}
          </div>
        );
      })}

      <div className="pt-2 border-t border-border flex items-center justify-between text-[10px] text-muted-foreground font-mono">
        <div className="flex items-center gap-1">
          <HardDrive size={10} />
          <span>{asset.utxoId.substring(0, 15)}...</span>
        </div>
        <span>{asset.amount} sats</span>
      </div>
    </div>
  );
}