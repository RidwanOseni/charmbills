"use client"
import type { Subscription } from "@/lib/types"
import Link from "next/link"
import { Copy, Trash2 } from "lucide-react"
import { useState } from "react"

interface SubscriptionTableProps {
  subscriptions: Subscription[]
  onDelete: (id: string) => void
}

export default function SubscriptionTable({ subscriptions, onDelete }: SubscriptionTableProps) {
  const [copied, setCopied] = useState<string | null>(null)

  const handleCopyEmbed = (id: string) => {
    const embedCode = `<iframe src="${window.location.origin}/subscribe?id=${id}" width="400" height="300" frameborder="0"></iframe>`
    navigator.clipboard.writeText(embedCode)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-4 px-4 font-semibold text-foreground">Service Name</th>
            <th className="text-left py-4 px-4 font-semibold text-foreground">Price</th>
            <th className="text-left py-4 px-4 font-semibold text-foreground">Cycle</th>
            <th className="text-left py-4 px-4 font-semibold text-foreground">Address</th>
            <th className="text-left py-4 px-4 font-semibold text-foreground">Actions</th>
          </tr>
        </thead>
        <tbody>
          {subscriptions.map((sub) => (
            <tr key={sub.id} className="border-b border-border hover:bg-muted/10 transition-colors">
              <td className="py-4 px-4 text-foreground font-medium">{sub.serviceName}</td>
              <td className="py-4 px-4 text-accent font-mono">{sub.priceBTC} BTC</td>
              <td className="py-4 px-4 text-muted-foreground">{sub.billingCycle}</td>
              <td className="py-4 px-4 text-muted-foreground font-mono text-sm">
                {sub.bitcoinAddress.substring(0, 10)}...
              </td>
              <td className="py-4 px-4 space-x-2">
                <button
                  onClick={() => handleCopyEmbed(sub.id)}
                  className="inline-flex items-center gap-2 text-accent hover:text-accent/80 transition-colors text-sm"
                  title="Copy embed code"
                >
                  <Copy size={16} />
                  {copied === sub.id ? "Copied!" : "Embed"}
                </button>
                <Link
                  href={`/subscribe?id=${sub.id}`}
                  className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm"
                  target="_blank"
                >
                  Preview
                </Link>
                <button
                  onClick={() => onDelete(sub.id)}
                  className="inline-flex items-center gap-2 text-destructive hover:text-destructive/80 transition-colors text-sm"
                >
                  <Trash2 size={16} />
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
