"use client"

import { useState, useEffect } from "react"
import Navigation from "@/components/navigation"
import SubscriptionForm from "@/components/subscription-form"
import SubscriptionTable from "@/components/subscription-table"
import AssetCard from "@/components/asset-card"
import { Button } from "@/components/ui/button"
import { useWallet } from "@/lib/WalletContext"
import { scanAddressForCharms } from "@/lib/charms-utils"
import { Loader2, RefreshCw, Plus } from "lucide-react"
import type { Subscription } from "@/lib/types"

// Define Asset type based on scanAddressForCharms return value
interface Asset {
  utxoId: string;
  amount: any;
  spell: any;
  charms: any;
}

export default function DashboardPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [onChainAssets, setOnChainAssets] = useState<Asset[]>([])
  const [showForm, setShowForm] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const { address, walletConnected, connectWallet } = useWallet()

  // Scanning function to fetch on-chain truth [10, 21]
  const refreshAssets = async () => {
    if (walletConnected && address) {
      setIsScanning(true);
      try {
        const assets = await scanAddressForCharms(address);
        setOnChainAssets(assets);
      } catch (err) {
        console.error("Scan failed", err);
      } finally {
        setIsScanning(false);
      }
    }
  }

  useEffect(() => {
    refreshAssets();
    const saved = localStorage.getItem("charm_subscriptions")
    if (saved) setSubscriptions(JSON.parse(saved))
  }, [walletConnected, address]);

  const handleAddSubscription = (subscription: Subscription) => {
    const updated = [...subscriptions, subscription]
    setSubscriptions(updated)
    localStorage.setItem("charm_subscriptions", JSON.stringify(updated))
    setShowForm(false)
  }

  const handleDelete = (id: string) => {
    const updated = subscriptions.filter((s) => s.id !== id)
    setSubscriptions(updated)
    localStorage.setItem("charm_subscriptions", JSON.stringify(updated))
  }

  return (
    <main className="min-h-screen bg-background">
      <Navigation />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-10">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Merchant Dashboard</h1>
            <p className="text-muted-foreground mt-1">Manage your Bitcoin subscription plans and track on-chain assets.</p>
          </div>
          
          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={refreshAssets} 
              disabled={isScanning || !walletConnected}
              className="gap-2"
            >
              {isScanning ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              Sync Assets
            </Button>
            
            {!walletConnected ? (
              <Button onClick={connectWallet} className="bg-accent hover:bg-accent/90 text-accent-foreground font-semibold px-6">
                Connect Leather Wallet
              </Button>
            ) : (
              <div className="flex items-center gap-2 px-4 py-2 bg-accent/10 border border-accent/20 rounded-lg text-accent text-sm font-medium">
                <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                {address?.substring(0, 6)}...{address?.substring(address.length - 4)}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <section className="bg-card border border-border rounded-xl p-6 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-foreground">Subscription Button Generator</h2>
                {!showForm && (
                  <Button onClick={() => setShowForm(true)} size="sm" className="gap-2">
                    <Plus size={16} /> New Plan
                  </Button>
                )}
              </div>

              {showForm ? (
                <div className="bg-muted/30 p-6 rounded-lg border border-dashed border-border mb-6">
                  <SubscriptionForm 
                    onSuccess={handleAddSubscription} 
                    onCancel={() => setShowForm(false)} 
                  />
                </div>
              ) : subscriptions.length > 0 ? (
                <SubscriptionTable subscriptions={subscriptions} onDelete={handleDelete} />
              ) : (
                <div className="text-center py-12 bg-muted/20 rounded-lg border border-border">
                  <p className="text-muted-foreground">You haven't created any subscription plans yet.</p>
                  <Button variant="link" onClick={() => setShowForm(true)} className="text-accent mt-2">
                    Create your first plan to get started
                  </Button>
                </div>
              )}
            </section>
          </div>

          <div className="space-y-6">
            <section>
              <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
                On-Chain Assets
                {isScanning && <Loader2 size={16} className="animate-spin text-accent" />}
              </h2>
              
              {!walletConnected ? (
                <div className="bg-muted/20 border border-border rounded-xl p-8 text-center">
                  <p className="text-sm text-muted-foreground mb-4">Connect your wallet to view your Plan NFTs and Subscription Tokens.</p>
                  <Button onClick={connectWallet} variant="outline" className="w-full">Connect Wallet</Button>
                </div>
              ) : onChainAssets.length > 0 ? (
                <div className="grid grid-cols-1 gap-4">
                  {onChainAssets.map((asset, index) => (
                    <AssetCard key={index} asset={asset} />
                  ))}
                </div>
              ) : (
                <div className="bg-muted/20 border border-border rounded-xl p-8 text-center italic text-sm text-muted-foreground">
                  {isScanning ? "Scanning Bitcoin Network..." : "No Charms assets found at this address."}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </main>
  )
}