"use client"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import Navigation from "@/components/navigation"
import { Button } from "@/components/ui/button"
import type { Subscription } from "@/lib/types"
import { useWallet } from "@/lib/WalletContext"

function SubscribeContent() {
  const searchParams = useSearchParams()
  const subscriptionId = searchParams.get("id")
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [accessKey, setAccessKey] = useState("")

  // Use global wallet context
  const { walletConnected, connectWallet } = useWallet()

  useEffect(() => {
    const saved = localStorage.getItem("charm_subscriptions")
    if (saved && subscriptionId) {
      const subs = JSON.parse(saved) as Subscription[]
      const found = subs.find((s) => s.id === subscriptionId)
      setSubscription(found || null)
    }
  }, [subscriptionId])

  const handleSubscribe = () => {
    if (!walletConnected) {
      alert("Please connect your wallet first.")
      return
    }
    setIsProcessing(true)
    setTimeout(() => {
      const key = Math.random().toString(36).substring(2, 15).toUpperCase()
      setAccessKey(key)
      setIsSuccess(true)
      setIsProcessing(false)
    }, 2000)
  }

  if (!subscription) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <Navigation />
        <main className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-2">Subscription not found</h1>
            <p className="text-muted-foreground">Please check the subscription link</p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Navigation />

      <main className="flex-1 flex items-center justify-center p-4 py-12">
        <div className="max-w-md w-full bg-card border border-border rounded-2xl p-8 shadow-xl">
          {!isSuccess ? (
            <div className="space-y-8">
              <div className="flex items-center justify-between gap-4">
                <h1 className="text-2xl font-bold tracking-tight">Subscribe to: {subscription.serviceName}</h1>
                <Button
                  onClick={connectWallet}
                  size="sm"
                  className={
                    walletConnected
                      ? "bg-accent/20 text-accent border border-accent"
                      : "bg-accent hover:bg-accent/90 text-accent-foreground"
                  }
                  variant={walletConnected ? "outline" : "default"}
                >
                  {walletConnected ? "✓ Wallet Connected" : "Connect Wallet"}
                </Button>
              </div>

              <div className="bg-muted/50 rounded-xl p-6 space-y-4">
                <div className="flex justify-between items-end">
                  <span className="text-muted-foreground">Price per {subscription.billingCycle.toLowerCase()}:</span>
                  <span className="text-3xl font-bold text-accent">{subscription.priceBTC} BTC</span>
                </div>
                <div className="pt-4 border-t border-border/50 text-sm text-muted-foreground text-center">
                  Payments will renew automatically every {subscription.billingCycle.toLowerCase()}
                </div>
              </div>

              <Button
                onClick={handleSubscribe}
                disabled={isProcessing}
                size="lg"
                className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-semibold py-6 text-lg rounded-lg transition-colors"
              >
                {isProcessing ? "Processing Payment..." : "Subscribe with Bitcoin"}
              </Button>
            </div>
          ) : (
            <div className="text-center space-y-6 animate-in fade-in zoom-in duration-300">
              <div className="w-20 h-20 bg-accent/20 text-accent rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-4xl">✓</span>
              </div>
              <div>
                <h1 className="text-3xl font-bold mb-2">Payment Successful!</h1>
                <p className="text-muted-foreground">Your subscription is now active</p>
              </div>

              <div className="bg-muted p-4 rounded-lg font-mono break-all">
                <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider font-sans">Your Access Key:</p>
                <p className="text-lg font-bold text-foreground tracking-widest">{accessKey}</p>
              </div>

              <p className="text-sm text-muted-foreground italic">Save this key for your records</p>

              <Button onClick={() => (window.location.href = "/dashboard")} variant="outline" size="lg" className="w-full">
                Return to Dashboard
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default function SubscribePage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SubscribeContent />
    </Suspense>
  )
}