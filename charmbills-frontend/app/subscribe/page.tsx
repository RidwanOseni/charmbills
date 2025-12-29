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

  // 1. Load available plans from the Coordination Layer (localStorage) [1, 2]
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
   * 2. REFINED VISUALIZATION LOGIC
   * Scans the user's wallet for a Subscription Token matching the Plan's App ID [2, 3].
   */
  useEffect(() => {
    const checkSubscription = async () => {
      if (walletConnected && address && selectedPlan) {
        try {
          const assets = await scanAddressForCharms(address)
          
          // A user is subscribed if they own a token where the App ID 
          // matches the Plan's Authority NFT App ID [4, 5]
          const hasToken = assets.some((asset: any) => 
            Object.values(asset.spell.apps).some((appSpec: any) => 
              // Check if any app spec (e.g., "t/app_id/vk") contains the plan's nftUtxoId
              // (Note: In a full DB setup, you would match against a stored appId) [6]
              appSpec.includes(selectedPlan.nftUtxoId?.split(':'))
            )
          )
          
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
      // Step 1: Discovery Phase - Get dynamic funding from subscriber wallet [7, 8]
      const funding = await getFundingUtxo(address)

      // Step 2: Request Unsigned Transactions from Backend (Port 3001) [9, 10]
      const response = await axios.post('http://localhost:3001/api/subscriptions/mint', {
        authorityUtxo: selectedPlan.nftUtxoId, 
        fundingUtxo: funding.utxoId,
        fundingValue: funding.value,
        prevTxHex: funding.hex,
        subscriberAddress: address,
        merchantAddress: selectedPlan.bitcoinAddress
      })

      // Step 3: Sign and Broadcast via Leather [7, 11]
      // signAndBroadcastPackage returns the txids array from broadcast-package.ts [12]
      const txids = await signAndBroadcastPackage(response.data)

      if (txids) {
        setIsSubscribed(true)
        
        /**
         * REFINED BROADCASTING RESPONSE
         * Handles txids as an array [commitTxId, spellTxId] [13, 14].
         */
        const txMsg = Array.isArray(txids) ? txids.join(', ') : txids
        alert(`Subscription Successful! Access Granted.\nTxIDs: ${txMsg}`)
      }

    } catch (err: any) {
      console.error("Subscription failed:", err)
      alert("Transaction failed: " + (err.response?.data?.error || err.message))
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
                disabled={isProcessing}
                className="w-full h-12 text-lg bg-accent hover:bg-accent/90 text-accent-foreground font-bold rounded-xl"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Proving Spell...
                  </>
                ) : (
                  "Subscribe Now"
                )}
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {plans.map((plan) => (
              <div key={plan.id} className="bg-card border border-border rounded-xl p-6 hover:border-accent/50 transition-colors">
                <h3 className="text-xl font-bold mb-2">{plan.serviceName}</h3>
                <p className="text-2xl font-mono text-accent mb-4">{plan.priceBTC} BTC</p>
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
    <Suspense fallback={<div className="flex items-center justify-center min-screen"><Loader2 className="animate-spin" /></div>}>
      <SubscribeContent />
    </Suspense>
  )
}