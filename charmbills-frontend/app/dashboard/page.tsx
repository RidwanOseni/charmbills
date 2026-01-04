"use client"

import { useState, useEffect } from "react"
import Navigation from "@/components/navigation"
import SubscriptionForm from "@/components/subscription-form"
import SubscriptionTable from "@/components/subscription-table"
import AssetCard from "@/components/asset-card"
import { Button } from "@/components/ui/button"
import { useWallet } from "@/lib/WalletContext"
import { scanAddressForCharms, getFundingUtxo } from "@/lib/charms-utils"
import { Loader2, RefreshCw, Plus } from "lucide-react"
import type { Subscription, ProverResult } from "../../../shared/types"
import axios from "axios"

export default function DashboardPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [onChainAssets, setOnChainAssets] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [isMinting, setIsMinting] = useState(false)

  const { address, walletConnected, signAndBroadcastPackage } = useWallet()

  const refreshAssets = async () => {
    if (walletConnected && address) {
      setIsScanning(true);
      try {
        const assets = await scanAddressForCharms(address);
        console.log("🔍 SCANNED ASSETS:", assets);
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

  const handleAddSubscription = async (formData: any) => {
    if (!walletConnected || !address) {
      alert("Please connect your wallet first.");
      return;
    }
  
    setIsMinting(true);
    try {
      // 1. Fetch two distinct UTXOs to avoid double-spend conflict
      const anchorFunding = await getFundingUtxo(address, 1000); // Small UTXO for NFT identity
      const feeFunding = await getFundingUtxo(address, 50000);   // Larger UTXO for transaction fees
      
      if (!anchorFunding || !anchorFunding.utxoId || !anchorFunding.value) {
        throw new Error("Failed to get anchor funding UTXO. Please make sure your wallet has testnet BTC.");
      }
      
      if (!feeFunding || !feeFunding.utxoId || !feeFunding.value) {
        throw new Error("Failed to get fee funding UTXO. Please make sure your wallet has testnet BTC.");
      }
      
      // NEW GUARD: Verify the hexes exist
      if (!anchorFunding.hex || !feeFunding.hex) {
        throw new Error("Could not retrieve transaction provenance (hex). Please try again.");
      }
      
      // 🔍 DEBUG LOG: Log both funding UTXOs
      console.group("🎯 Discovery Phase - Dual UTXO Details");
      console.log("Anchor UTXO (identity):", anchorFunding);
      console.log("Fee UTXO (transaction fees):", feeFunding);
      console.log("Anchor UTXO ID:", anchorFunding.utxoId);
      console.log("Fee UTXO ID:", feeFunding.utxoId);
      console.log("Anchor Value (sats):", anchorFunding.value);
      console.log("Fee Value (sats):", feeFunding.value);
      console.log("Anchor Hex exists:", !!anchorFunding.hex);
      console.log("Fee Hex exists:", !!feeFunding.hex);
      console.groupEnd();
  
      // NEW: Create dual UTXO context with both anchor and fee data
      const dualUtxoContext = {
        anchor: {
          utxoId: anchorFunding.utxoId,
          value: anchorFunding.value,
          hex: anchorFunding.hex
        },
        fee: {
          utxoId: feeFunding.utxoId,
          value: feeFunding.value,
          hex: feeFunding.hex
        }
      };
  
      console.log("📦 Dual UTXO Context Created:", {
        anchorUtxo: dualUtxoContext.anchor.utxoId,
        anchorValue: dualUtxoContext.anchor.value,
        feeUtxo: dualUtxoContext.fee.utxoId,
        feeValue: dualUtxoContext.fee.value
      });
  
      // 2. Prepare payload with EXACT key names expected by backend
      const payload = {
        anchorUtxo: anchorFunding.utxoId,
        anchorTxHex: anchorFunding.hex,
        anchorValue: anchorFunding.value,
        fundingUtxo: feeFunding.utxoId,
        feeTxHex: feeFunding.hex,
        fundingValue: feeFunding.value,
        merchantAddress: address,
        metadata: { 
          serviceName: formData.serviceName, 
          ticker: "PLAN", 
          remaining: 100000 
        }
      };
  
      // DEBUG: Verify payload structure matches backend expectations
      console.group("[DEBUG] Payload Verification");
      console.log("Full payload:", payload);
      console.log("Payload keys:", Object.keys(payload));
      
      const backendExpectedKeys = [
        'anchorUtxo',
        'anchorTxHex',
        'anchorValue',
        'fundingUtxo',
        'feeTxHex',
        'fundingValue',
        'merchantAddress',
        'metadata'
      ];
      
      const missingKeys = backendExpectedKeys.filter(key => !(key in payload));
      const extraKeys = Object.keys(payload).filter(key => !backendExpectedKeys.includes(key));
      
      console.log("✅ Backend expected keys:", backendExpectedKeys);
      console.log("❌ Missing keys:", missingKeys);
      console.log("⚠️ Extra keys:", extraKeys);
      
      console.groupEnd();
  
      // 3. Pass both to your backend
      console.log("📡 Requesting unsigned transactions from backend...");
      const response = await axios.post('http://localhost:3002/api/plans/mint', payload);
  
      // DEBUG: Log full response for troubleshooting
      console.group("[DEBUG] Backend Response");
      console.log("Response status:", response.status);
      console.log("Response headers:", response.headers);
      console.log("Full response data:", response.data);
      console.groupEnd();
  
      const proverResult: ProverResult = response.data;
      console.log("✅ Backend response received:", {
        commitTxLength: typeof proverResult.commitTxHex === 'object' 
          ? (proverResult.commitTxHex as any).bitcoin?.length 
          : proverResult.commitTxHex?.length,
        spellTxLength: typeof proverResult.spellTxHex === 'object' 
          ? (proverResult.spellTxHex as any).bitcoin?.length 
          : proverResult.spellTxHex?.length
      });
  
      // 4. Trigger Leather Wallet Signing and Broadcast as Package
      // 🚨 UPDATED: Pass dualUtxoContext instead of just fundingData
      console.log("🔐 Starting wallet signing process...");
      const txids = await signAndBroadcastPackage(proverResult, dualUtxoContext);
  
      if (txids) {
        console.log("✅ Transaction successful! TXIDs:", txids);
        
        // PREPEND new plan to the list
        const newPlan = {
          ...formData,
          id: formData.id || Math.random().toString(36).substring(7),
          nftUtxoId: Array.isArray(txids) ? `${txids[0]}:0` : `${txids}:0`,
          createdAt: new Date().toISOString()
        };
        
        const updated = [newPlan, ...subscriptions];
        setSubscriptions(updated);
        localStorage.setItem("charm_subscriptions", JSON.stringify(updated));
        setShowForm(false);
        
        // Display success message
        if (Array.isArray(txids)) {
          alert(`✅ Plan NFT created successfully!\nTransaction IDs: ${txids.join(', ')}`);
        } else {
          alert(`✅ Plan NFT created successfully!\nTransaction ID: ${txids}`);
        }
        
        // Refresh assets to show the new NFT
        refreshAssets();
      } else {
        throw new Error("No transaction IDs returned from signing process");
      }
    } catch (err: any) {
      console.error("❌ On-chain action failed:", err);
      
      // DEBUG: Log full error details
      console.group("[DEBUG] Error Details");
      console.log("Error object:", err);
      console.log("Error response:", err.response);
      console.log("Error data:", err.response?.data);
      console.log("Error status:", err.response?.status);
      console.groupEnd();
      
      // User-friendly error messages
      let errorMessage = "Failed to create on-chain plan: ";
      
      if (err.response?.data?.error) {
        errorMessage += err.response.data.error;
      } else if (err.message) {
        errorMessage += err.message;
      } else if (err.error?.message) {
        errorMessage += err.error.message;
      } else {
        errorMessage += "Unknown error occurred";
      }
      
      alert(errorMessage);
    } finally {
      setIsMinting(false);
    }
  }

  const handleDelete = (id: string) => {
    const updated = subscriptions.filter((s) => s.id !== id)
    setSubscriptions(updated)
    localStorage.setItem("charm_subscriptions", JSON.stringify(updated))
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <Navigation />

      <main className="container mx-auto px-4 pt-24">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Merchant Dashboard</h1>
            <p className="text-muted-foreground">Manage your Bitcoin subscription plans and track on-chain assets.</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={refreshAssets}
            disabled={isScanning || !walletConnected}
            className="gap-2"
          >
            {isScanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Sync Assets
          </Button>
        </header>

        <section className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">Subscription Button Generator</h2>
            {!showForm && (
              <Button onClick={() => setShowForm(true)} size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                New Plan
              </Button>
            )}
          </div>

          {showForm ? (
            <div className="max-w-2xl mx-auto bg-card border border-border rounded-xl p-6 shadow-lg">
              <SubscriptionForm 
                onSuccess={handleAddSubscription} 
                onCancel={() => setShowForm(false)} 
              />
              {isMinting && (
                <div className="mt-4 p-4 bg-accent/10 border border-accent/20 rounded-lg flex items-center gap-3 text-accent text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <div>
                    <p className="font-medium">Proving Spell on-chain...</p>
                    <p className="text-xs mt-1">Please check your Leather wallet for signature requests.</p>
                    <p className="text-xs">This may take a minute to complete.</p>
                  </div>
                </div>
              )}
            </div>
          ) : subscriptions.length > 0 ? (
            <SubscriptionTable subscriptions={subscriptions} onDelete={handleDelete} />
          ) : (
            <div className="text-center py-12 bg-card border border-dashed border-border rounded-xl">
              <p className="text-muted-foreground">You haven't created any subscription plans yet.</p>
              <Button variant="link" onClick={() => setShowForm(true)} className="text-accent mt-2">
                Create your first plan to get started
              </Button>
            </div>
          )}
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-6">Your On-Chain Charms</h2>
          {isScanning && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-accent" />
            </div>
          )}
          
          {!walletConnected ? (
            <div className="bg-card border border-border rounded-xl p-8 text-center">
              <p className="text-muted-foreground">Connect your wallet in the navigation bar to see your assets.</p>
            </div>
          ) : onChainAssets.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {onChainAssets.map((asset, index) => (
                <AssetCard key={index} asset={asset} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-card border border-border rounded-xl">
              <p className="text-muted-foreground">
                {isScanning ? "Scanning Bitcoin Network..." : "No Charms assets found at this address."}
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}