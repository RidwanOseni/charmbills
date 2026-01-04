import React from 'react';
import { Package, Ticket, HardDrive } from 'lucide-react';

interface AssetCardProps {
  asset: {
    utxoId: string;
    amount: number;
    charms: Record<string, any>;
    spell: {
      apps: Record<string, string>;
    };
  };
}

export default function AssetCard({ asset }: AssetCardProps) {
  // PROFESSIONAL FIX: Convert Map to Array for React rendering
  const charmsArray = asset.charms instanceof Map 
    ? Array.from(asset.charms.entries()) 
    : Object.entries(asset.charms);

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4 hover:border-accent/50 transition-all shadow-sm">
      {charmsArray.map(([appIndex, content]: [any, any]) => {
        // FIX: Search both the root and the .tx property for the apps definition
        console.log("🛠️ App Index:", appIndex, "Full Spell Object:", asset.spell);
        const apps = asset.spell.tx?.apps || asset.spell.apps;
        const appSpec = apps ? apps[appIndex] : null;
        console.log("📝 Found App Spec:", appSpec);
        
        if (!appSpec) return null;

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
                    {content.serviceName || content.name || "SaaS Plan"}
                  </h3>
                  <div className="flex justify-between items-end mt-2">
                    <span className="text-accent font-mono text-sm">{content.ticker}</span>
                    <span className="text-muted-foreground text-xs">
                      Remaining: {content.remaining?.toLocaleString() || "0"}
                    </span>
                  </div>
                </div>
                {/* Visualization of CHIP-420 metadata fields */}
                {content.iconUrl && (
                   <div className="mt-2 rounded-md overflow-hidden bg-muted aspect-video flex items-center justify-center">
                     <img 
                        src={content.iconUrl} 
                        alt={content.ticker} 
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