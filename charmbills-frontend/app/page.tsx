import Link from "next/link"
import { Button } from "@/components/ui/button"
import Navigation from "@/components/navigation"

export default function HomePage() {
  return (
    <>
      <Navigation />
      <main className="min-h-screen bg-gradient-to-b from-background to-card">
        {/* Hero Section */}
        <section className="px-4 py-20 md:py-32 max-w-6xl mx-auto">
          <div className="text-center space-y-6">
            <h1 className="text-5xl md:text-6xl font-bold text-foreground text-balance leading-tight">
              Recurring Payments on Bitcoin
            </h1>
            <p className="text-xl text-muted-foreground text-balance max-w-2xl mx-auto">
              Accept monthly subscriptions in BTC. No intermediaries, no chargebacks.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-8">
              <Button
                asChild
                size="lg"
                className="bg-accent hover:bg-accent/90 text-accent-foreground font-semibold rounded-full px-8"
              >
                <Link href="/subscribe">Try Demo</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-accent text-accent hover:bg-accent/10 font-semibold rounded-full px-8 bg-transparent"
              >
                <Link href="/dashboard">Create Subscription</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="px-4 py-20 max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-16 text-foreground">Why CharmBills</h2>
          <div className="grid md:grid-cols-2 gap-8">
            {[
              {
                icon: "⏱️",
                title: "Time-based Automatic Payments",
                description: "Subscriptions renew automatically at your defined intervals",
              },
              {
                icon: "✓",
                title: "Proof of Service Required",
                description: "Merchant must prove delivery before claiming payment, not customer confirms",
              },
              {
                icon: "💰",
                title: "1% Flat Fee",
                description: "vs Stripe's 3%. Keep more of your revenue.",
              },
              {
                icon: "🌍",
                title: "Global, Censorship-Resistant",
                description: "Bitcoin transactions that can't be reversed or blocked",
              },
            ].map((feature, i) => (
              <div
                key={i}
                className="bg-card border border-border rounded-lg p-6 space-y-3 hover:border-accent/50 transition-colors"
              >
                <div className="text-3xl">{feature.icon}</div>
                <h3 className="text-lg font-semibold text-foreground">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How It Works */}
        <section className="px-4 py-20 bg-card/50">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-16 text-foreground">How It Works</h2>
            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  num: "1",
                  title: "Create Plan",
                  description: "Set up your subscription with amount and billing cycle",
                },
                {
                  num: "2",
                  title: "Get Embed Code",
                  description: "Copy and paste the payment button into your website",
                },
                {
                  num: "3",
                  title: "Start Collecting",
                  description:
                    "Customers subscribe and you receive Bitcoin directly...automatically each billing period",
                },
              ].map((step, i) => (
                <div key={i} className="text-center space-y-4">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-accent text-accent-foreground font-bold text-lg">
                    {step.num}
                  </div>
                  <h3 className="text-xl font-semibold text-foreground">{step.title}</h3>
                  <p className="text-muted-foreground">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="px-4 py-20 max-w-4xl mx-auto text-center space-y-6">
          <h2 className="text-4xl font-bold text-foreground">Ready to accept Bitcoin subscriptions?</h2>
          <p className="text-lg text-muted-foreground">
            Join merchants already using CharmBills for faster, cheaper payments.
          </p>
          <Button
            asChild
            size="lg"
            className="bg-accent hover:bg-accent/90 text-accent-foreground font-semibold rounded-full px-8"
          >
            <Link href="/dashboard">Create Subscription Now</Link>
          </Button>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-card border-t border-border px-4 py-12">
        <div className="max-w-6xl mx-auto text-center text-muted-foreground text-sm">
          <p>&copy; 2025 CharmBills. Bitcoin payments without intermediaries.</p>
        </div>
      </footer>
    </>
  )
}
