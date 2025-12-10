export interface Subscription {
  id: string
  serviceName: string
  priceBTC: number
  billingCycle: "Weekly" | "Monthly" | "Yearly"
  bitcoinAddress: string
  createdAt: string
}
