"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useWallet } from "@/lib/WalletContext"
import { Button } from "./ui/button"
import { LogOut, Wallet } from "lucide-react"

export default function Navigation() {
  const pathname = usePathname()
  const { walletConnected, address, disconnectWallet, connectWallet } = useWallet()

  const links = [
    { href: "/", label: "Home" },
    { href: "/dashboard", label: "Dashboard" },
    { href: "/subscribe", label: "Subscribe" },
  ]

  return (
    <nav className="border-b border-border bg-card/50 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between h-16 items-center">
        <div className="flex items-center gap-8">
          <Link href="/" className="text-xl font-bold text-accent flex items-center gap-2">
            <span className="text-2xl">₿</span> CharmBills
          </Link>
          <div className="hidden md:flex gap-6">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm font-medium transition-colors ${
                  pathname === link.href ? "text-accent" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4">
          {walletConnected ? (
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex flex-col items-end text-[10px] leading-tight">
                <span className="text-muted-foreground uppercase font-bold tracking-tighter">Taproot Active</span>
                <span className="text-foreground font-mono">{address?.substring(0, 6)}...{address?.substring(address.length - 4)}</span>
              </div>
              <Button 
                variant="ghost" 
                size="icon-sm" 
                onClick={disconnectWallet} 
                className="text-muted-foreground hover:text-destructive transition-colors"
                title="Disconnect Wallet"
              >
                <LogOut size={16} />
              </Button>
            </div>
          ) : (
            <Button size="sm" onClick={connectWallet} className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90">
              <Wallet size={16} /> Connect
            </Button>
          )}
        </div>
      </div>
    </nav>
  )
}
