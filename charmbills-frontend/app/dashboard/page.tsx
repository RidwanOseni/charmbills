"use client"

import { useState, useEffect } from "react"
import Navigation from "@/components/navigation"
import SubscriptionForm from "@/components/subscription-form"
import SubscriptionTable from "@/components/subscription-table"
import { Button } from "@/components/ui/button"
import type { Subscription } from "@/lib/types"

export default function DashboardPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [showForm, setShowForm] = useState(false)
  const [walletConnected, setWalletConnected] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem("charm_subscriptions")
    if (saved) {
      setSubscriptions(JSON.parse(saved))
    }
  }, [])

  const handleAddSubscription = (subscription: Subscription) => {
    const updated = [...subscriptions, subscription]
    setSubscriptions(updated)
    localStorage.setItem("charm_subscriptions", JSON.stringify(updated))
    setShowForm(false)
  }

  const handleDeleteSubscription = (id: string) => {
    const updated = subscriptions.filter((sub) => sub.id !== id)
    setSubscriptions(updated)
    localStorage.setItem("charm_subscriptions", JSON.stringify(updated))
  }

  const handleWalletConnect = () => {
    setWalletConnected(!walletConnected)
  }

  return (
    <>
      <Navigation />
      <main className="min-h-screen bg-gradient-to-b from-background to-card">
        <div className="max-w-6xl mx-auto px-4 py-12">
          <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-2">
                <h1 className="text-4xl font-bold text-foreground">Merchant Dashboard</h1>
                <p className="text-muted-foreground">Manage your Bitcoin subscription plans</p>
              </div>
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

            {/* Create Form */}
            {showForm ? (
              <SubscriptionForm onSuccess={handleAddSubscription} onCancel={() => setShowForm(false)} />
            ) : (
              <Button
                onClick={() => setShowForm(true)}
                className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                + Create New Subscription
              </Button>
            )}

            {/* Active Subscriptions */}
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-foreground">Active Subscriptions</h2>
              {subscriptions.length > 0 ? (
                <SubscriptionTable subscriptions={subscriptions} onDelete={handleDeleteSubscription} />
              ) : (
                <div className="bg-card border border-border rounded-lg p-12 text-center">
                  <p className="text-muted-foreground">No subscriptions yet. Create one to get started!</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
