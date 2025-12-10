"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import type { Subscription } from "@/lib/types"

interface SubscriptionFormProps {
  onSuccess: (subscription: Subscription) => void
  onCancel: () => void
}

export default function SubscriptionForm({ onSuccess, onCancel }: SubscriptionFormProps) {
  const [formData, setFormData] = useState({
    serviceName: "",
    priceBTC: "",
    billingCycle: "Monthly",
    bitcoinAddress: "",
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const subscription: Subscription = {
      id: Math.random().toString(36).substring(7),
      serviceName: formData.serviceName,
      priceBTC: Number.parseFloat(formData.priceBTC),
      billingCycle: formData.billingCycle as "Weekly" | "Monthly" | "Yearly",
      bitcoinAddress: formData.bitcoinAddress,
      createdAt: new Date().toISOString(),
    }

    onSuccess(subscription)
    setFormData({
      serviceName: "",
      priceBTC: "",
      billingCycle: "Monthly",
      bitcoinAddress: "",
    })
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  return (
    <form onSubmit={handleSubmit} className="bg-card border border-border rounded-lg p-8 space-y-6">
      <h2 className="text-2xl font-bold text-foreground">Create New Subscription</h2>

      <div className="space-y-4">
        {/* Service Name */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Service Name</label>
          <input
            type="text"
            name="serviceName"
            value={formData.serviceName}
            onChange={handleChange}
            required
            placeholder="e.g., Premium Hosting"
            className="w-full bg-input border border-border text-foreground placeholder-muted-foreground rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        {/* Price in BTC */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Price in BTC</label>
          <input
            type="number"
            name="priceBTC"
            value={formData.priceBTC}
            onChange={handleChange}
            required
            step="0.001"
            min="0"
            placeholder="0.01"
            className="w-full bg-input border border-border text-foreground placeholder-muted-foreground rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        {/* Billing Cycle */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Billing Cycle</label>
          <select
            name="billingCycle"
            value={formData.billingCycle}
            onChange={handleChange}
            className="w-full bg-input border border-border text-foreground rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <option>Weekly</option>
            <option>Monthly</option>
            <option>Yearly</option>
          </select>
        </div>

        {/* Bitcoin Address */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Bitcoin Address</label>
          <input
            type="text"
            name="bitcoinAddress"
            value={formData.bitcoinAddress}
            onChange={handleChange}
            required
            placeholder="1A1z7agoat..."
            className="w-full bg-input border border-border text-foreground placeholder-muted-foreground rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-accent font-mono text-sm"
          />
        </div>
      </div>

      {/* Buttons */}
      <div className="flex gap-4">
        <Button
          type="submit"
          className="flex-1 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold py-2 rounded-lg transition-colors"
        >
          Create Subscription
        </Button>
        <Button type="button" onClick={onCancel} variant="outline" className="flex-1 bg-transparent">
          Cancel
        </Button>
      </div>
    </form>
  )
}
