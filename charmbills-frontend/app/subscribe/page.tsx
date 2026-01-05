"use client"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import Navigation from "@/components/navigation"
import { Button } from "@/components/ui/button"
import { useWallet } from "@/lib/WalletContext"
import { getFundingUtxo, scanAddressForCharms } from "@/lib/charms-utils"
import { CheckCircle2, Loader2, Zap, ShieldCheck } from "lucide-react"
import type { Subscription, ProverResult } from "../../../shared/types"
import axios from "axios"

function SubscribeContent() {
  const searchParams = useSearchParams()
  const planId = searchParams.get("id")
  const [plans, setPlans] = useState<Subscription[]>([])
  const [selectedPlan, setSelectedPlan] = useState<Subscription | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)
  
  const { address, walletConnected, connectWallet, signAndBroadcastPackage } = useWallet()

  // 1. Load available plans from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("charm_subscriptions")
    if (saved) {
      const allPlans: Subscription[] = JSON.parse(saved)
      setPlans(allPlans)
      
      if (planId) {
        const found = allPlans.find(p => p.id === planId)
        if (found) setSelectedPlan(found)
      }
    }
  }, [planId])

  /**
   * 2. Check if user already has a subscription token
   */
  useEffect(() => {
    const checkSubscription = async () => {
      if (walletConnected && address && selectedPlan) {
        try {
          const assets = await scanAddressForCharms(address)
          
          // Simple check: Look for any fungible tokens in the wallet
          const hasToken = assets.some((asset: any) => {
            // Check if asset has any fungible token charms (app type 't')
            const appEntries = Object.entries(asset.spell?.apps || {});
            return appEntries.some(([key, appSpec]) => 
              typeof appSpec === 'string' && appSpec.startsWith('t/')
            );
          })
          
          setIsSubscribed(hasToken)
        } catch (err) {
          console.error("Subscription check failed:", err)
        }
      }
    }

    checkSubscription()
  }, [address, walletConnected, selectedPlan])

  const handleSubscribe = async () => {
    if (!walletConnected) {
      await connectWallet()
      return
    }

    if (!selectedPlan || !address) return
    setIsProcessing(true)

    try {
      // Step 1: Get dynamic funding from subscriber's wallet
      const funding = await getFundingUtxo(address, 50000) // Need enough for fees
      
      console.log('🎯 Funding UTXO acquired:', {
        utxoId: funding.utxoId,
        value: funding.value,
        hexLength: funding.hex?.length
      })

      // Step 2: We need the authority NFT transaction hex for the prover
      // Since we don't have this in localStorage, we need to fetch it
      // For MVP, we'll assume the backend has access to this or we need to fetch it
      const authorityTxHex = funding.hex // Using funding hex as placeholder
      
      // Step 3: Request unsigned transactions from backend
      console.log('📡 Requesting unsigned transactions from backend...')
      const response = await axios.post('http://localhost:3002/api/subscriptions/mint', {
        authorityUtxo: selectedPlan.nftUtxoId, 
        authorityTxHex: authorityTxHex, // Need to provide this
        fundingUtxo: funding.utxoId,
        fundingValue: funding.value,
        prevTxHex: authorityTxHex, // The authority transaction hex
        subscriberAddress: address,
        merchantAddress: selectedPlan.bitcoinAddress,
        tokenAmount: 1, // Default to 1 subscription token
        nftMetadata: {
          ticker: "PLAN",
          serviceName: selectedPlan.serviceName,
          remaining: 99999, // Assuming we start from 100000
          iconUrl: 'https://charmbills.dev/pro.svg'
        }
      })

      const proverResult: ProverResult = response.data
      console.log('✅ Backend response received:', {
        commitTxLength: proverResult.commitTxHex?.length,
        spellTxLength: proverResult.spellTxHex?.length
      })

      // Step 4: Create dual UTXO context for wallet signing
      // Since we don't have the authority NFT hex, we'll create a simplified context
      const dualUtxoContext = {
        anchor: {
          utxoId: selectedPlan.nftUtxoId || "unknown:0", // We don't have actual anchor UTXO for subscription
          value: 1000, // NFT outputs are typically 1000 sats
          hex: authorityTxHex
        },
        fee: {
          utxoId: funding.utxoId,
          value: funding.value,
          hex: funding.hex
        }
      }

      // Step 5: Sign and broadcast via wallet
      console.log('🔐 Starting wallet signing process...')
      const txids = await signAndBroadcastPackage(proverResult, dualUtxoContext)

      if (txids) {
        setIsSubscribed(true)
        
        // Handle transaction IDs
        const txMsg = Array.isArray(txids) ? txids.join(', ') : txids
        alert(`✅ Subscription Successful! Access Granted.\nTransaction IDs: ${txMsg}`)
      }

    } catch (err: any) {
      console.error("❌ Subscription failed:", err)
      
      // Enhanced error display
      let errorMessage = "Transaction failed: "
      if (err.response?.data?.error) {
        errorMessage += err.response.data.error
      } else if (err.message) {
        errorMessage += err.message
      } else {
        errorMessage += "Unknown error occurred"
      }
      
      alert(errorMessage)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Navigation />
      
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Subscription Portal</h1>
          <p className="text-muted-foreground">Secure your access using Bitcoin Charms. No intermediaries.</p>
        </div>

        {selectedPlan ? (
          <div className="bg-card border border-border rounded-2xl p-8 shadow-sm max-w-md mx-auto">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-accent/20 rounded-full flex items-center justify-center">
                <Zap className="text-accent" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">{selectedPlan.serviceName}</h2>
                <p className="text-sm text-muted-foreground uppercase tracking-wider">{selectedPlan.billingCycle} Plan</p>
              </div>
            </div>

            <div className="mb-8">
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold">{selectedPlan.priceBTC}</span>
                <span className="text-muted-foreground font-medium">BTC / cycle</span>
              </div>
            </div>

            <div className="space-y-4 mb-8">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="text-accent mt-0.5" size={18} />
                <p className="text-sm">On-chain verifiable access token</p>
              </div>
              <div className="flex items-start gap-3">
                <ShieldCheck className="text-accent mt-0.5" size={18} />
                <p className="text-sm">Cancel any time by spending token</p>
              </div>
            </div>

            {isSubscribed ? (
              <div className="w-full h-12 flex items-center justify-center gap-2 bg-secondary text-secondary-foreground font-bold rounded-xl border border-border">
                <CheckCircle2 size={20} />
                Already Subscribed
              </div>
            ) : (
              <Button 
                onClick={handleSubscribe} 
                disabled={isProcessing || !walletConnected}
                className="w-full h-12 text-lg bg-accent hover:bg-accent/90 text-accent-foreground font-bold rounded-xl"
              >
                {!walletConnected ? (
                  "Connect Wallet"
                ) : isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Proving Spell...
                  </>
                ) : (
                  "Subscribe Now"
                )}
              </Button>
            )}
            
            {!walletConnected && !isProcessing && (
              <p className="text-sm text-center text-muted-foreground mt-4">
                Connect your wallet to subscribe
              </p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {plans.map((plan) => (
              <div key={plan.id} className="bg-card border border-border rounded-xl p-6 hover:border-accent/50 transition-colors">
                <h3 className="text-xl font-bold mb-2">{plan.serviceName}</h3>
                <p className="text-2xl font-mono text-accent mb-4">{plan.priceBTC} BTC</p>
                <p className="text-sm text-muted-foreground mb-4 uppercase tracking-wider">{plan.billingCycle} billing</p>
                <Button variant="outline" className="w-full" onClick={() => setSelectedPlan(plan)}>
                  View Details
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}

export default function SubscribePage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin h-8 w-8 text-accent" />
      </div>
    }>
      <SubscribeContent />
    </Suspense>
  )
}