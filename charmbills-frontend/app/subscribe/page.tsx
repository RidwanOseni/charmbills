"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import Navigation from "@/components/navigation"
import { Button } from "@/components/ui/button"
import type { Subscription } from "@/lib/types"

export default function SubscribePage() {
  const searchParams = useSearchParams()
  const subscriptionId = searchParams.get("id")

  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [accessKey, setAccessKey] = useState("")
  const [walletConnected, setWalletConnected] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem("charm_subscriptions")
    if (saved && subscriptionId) {
      const subs = JSON.parse(saved) as Subscription[]
      const found = subs.find((s) => s.id === subscriptionId)
      setSubscription(found || null)
    }
  }, [subscriptionId])

  const handleSubscribe = () => {
    setIsProcessing(true)
    // Simulate Bitcoin payment processing
    setTimeout(() => {
      const key = Math.random().toString(36).substring(2, 15).toUpperCase()
      setAccessKey(key)
      setIsSuccess(true)
      setIsProcessing(false)
    }, 2000)
  }

  const handleWalletConnect = () => {
    setWalletConnected(!walletConnected)
  }

  if (!subscription) {
    return (
      <>
        <Navigation />
        <main className="min-h-screen bg-gradient-to-b from-background to-card flex items-center justify-center">
          <div className="text-center space-y-4">
            <h1 className="text-2xl font-bold text-foreground">Subscription not found</h1>
            <p className="text-muted-foreground">Please check the subscription link</p>
          </div>
        </main>
      </>
    )
  }

  return (
    <>
      <Navigation />
      <main className="min-h-screen bg-gradient-to-b from-background to-card">
        <div className="max-w-2xl mx-auto px-4 py-20">
          <div className="bg-card border border-border rounded-lg p-8 space-y-8">
            {!isSuccess ? (
              <>
                <div className="flex items-center justify-between gap-4">
                  <h1 className="text-3xl font-bold text-foreground">Subscribe to: {subscription.serviceName}</h1>
                  <Button
                    onClick={handleWalletConnect}
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

                {/* Subscription Details */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-muted-foreground">Price per {subscription.billingCycle.toLowerCase()}:</p>
                    <p className="text-4xl font-bold text-accent">{subscription.priceBTC} BTC</p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Payments will renew automatically every {subscription.billingCycle.toLowerCase()}
                  </p>
                </div>

                {/* Subscribe Button */}
                <Button
                  onClick={handleSubscribe}
                  disabled={isProcessing}
                  size="lg"
                  className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-semibold py-6 text-lg rounded-lg transition-colors"
                >
                  {isProcessing ? "Processing Payment..." : "Subscribe with Bitcoin"}
                </Button>
              </>
            ) : (
              <>
                {/* Success Message */}
                <div className="space-y-4 text-center py-8">
                  <div className="text-5xl">✓</div>
                  <h2 className="text-3xl font-bold text-foreground">Payment Successful!</h2>
                  <p className="text-muted-foreground">Your subscription is now active</p>
                </div>

                {/* Access Key */}
                <div className="bg-muted/20 border border-border rounded-lg p-6 space-y-2">
                  <p className="text-sm text-muted-foreground">Your Access Key:</p>
                  <p className="text-2xl font-mono font-bold text-accent text-center break-all">{accessKey}</p>
                  <p className="text-xs text-muted-foreground text-center">Save this key for your records</p>
                </div>

                {/* Return Button */}
                <Button
                  onClick={() => (window.location.href = "/dashboard")}
                  variant="outline"
                  size="lg"
                  className="w-full"
                >
                  Return to Dashboard
                </Button>
              </>
            )}
          </div>
        </div>
      </main>
    </>
  )
}
