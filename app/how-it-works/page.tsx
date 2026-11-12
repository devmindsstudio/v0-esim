import type { Metadata } from 'next'
import { Smartphone, Store, Wifi } from 'lucide-react'
import { PublicShell, StepCard, CtaBand } from '@/components/marketing/public-shell'

export const metadata: Metadata = {
  title: 'How eTijwaal Works | Instant eSIM Activation',
  description:
    'How an eTijwaal eSIM works — from choosing a plan to going online — and how distributors resell it through the portal.',
}

const travellerSteps = [
  {
    title: 'Choose a plan',
    body: 'Pick your destination and the data package that fits your trip.',
  },
  {
    title: 'Get your QR code',
    body: 'Your eSIM and its QR code are emailed to you the moment your order is placed.',
  },
  {
    title: 'Scan to install',
    body: "Open your phone's settings, scan the QR code, and the eSIM installs in seconds.",
  },
  {
    title: 'Activate & connect',
    body: "Switch on the eSIM when you arrive and you're online — no physical SIM, no roaming bills.",
  },
]

const distributorSteps = [
  {
    title: 'Get credit in your wallet',
    body: "Your admin tops up your distributor wallet, including any bonus credit you've earned.",
  },
  {
    title: 'Browse the catalogue',
    body: 'Explore eSIM packages for 200+ destinations at your wholesale cost.',
  },
  {
    title: 'Set your selling price',
    body: 'Add your margin — you decide the price your customer pays. Selling below cost is blocked.',
  },
  {
    title: 'Issue the eSIM',
    body: 'Place the order and the QR code is delivered to your customer by email, automatically.',
  },
  {
    title: 'Track your profit',
    body: 'Follow your top-up profit and selling profit for any date range from your dashboard.',
  },
]

export default function HowItWorksPage() {
  return (
    <PublicShell
      title="How It Works"
      subtitle="From choosing a plan to going online in minutes — and how distributors resell eTijwaal eSIMs through the portal."
    >
      {/* What is an eSIM */}
      <section className="mx-auto flex max-w-3xl items-start gap-4 rounded-2xl border border-primary/15 bg-primary/5 p-6">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <Wifi className="size-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">What is an eSIM?</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            An eSIM is a digital SIM built into your phone. Instead of a physical card, you install
            a data plan by scanning a QR code — so you can get online the moment you land, with no
            roaming bills and no shop visits.
          </p>
        </div>
      </section>

      {/* For travellers */}
      <section className="mt-16">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Smartphone className="size-5 text-primary" />
          </div>
          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight">
              For travellers — how your eSIM works
            </h2>
            <p className="text-sm text-muted-foreground">Four steps from purchase to connection.</p>
          </div>
        </div>
        <div className="mt-10 grid grid-cols-1 gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
          {travellerSteps.map((s, i) => (
            <StepCard key={s.title} step={i + 1} title={s.title}>
              {s.body}
            </StepCard>
          ))}
        </div>
      </section>

      {/* For distributors */}
      <section className="mt-16">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/10">
            <Store className="size-5 text-success" />
          </div>
          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight">
              For distributors — how the platform works
            </h2>
            <p className="text-sm text-muted-foreground">
              Turn wallet credit into eSIM sales, and track every bit of profit.
            </p>
          </div>
        </div>
        <div className="mt-10 grid grid-cols-1 gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {distributorSteps.map((s, i) => (
            <StepCard key={s.title} step={i + 1} title={s.title}>
              {s.body}
            </StepCard>
          ))}
        </div>
      </section>

      <CtaBand
        heading="See it in action"
        body="Sign in to the distributor portal to browse the catalogue and issue your first eSIM."
      />
    </PublicShell>
  )
}
