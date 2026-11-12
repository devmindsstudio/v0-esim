import type { Metadata } from 'next'
import {
  Heart,
  Globe,
  ShieldCheck,
  Target,
  HeartHandshake,
  Sparkles,
  Lock,
} from 'lucide-react'
import { PublicShell, CtaBand } from '@/components/marketing/public-shell'

export const metadata: Metadata = {
  title: 'About eTijwaal | Global eSIM Provider',
  description:
    'eTijwaal delivers instant, affordable eSIM connectivity to travellers across 200+ countries. Powered by ibara.',
}

const highlights = [
  {
    icon: Heart,
    title: 'We Enjoy What We Do',
    body: "Our passion for travel and technology drives us to create the best connectivity solutions. Every day, we're excited to help travellers stay connected.",
  },
  {
    icon: Globe,
    title: 'We Help You Stay Connected',
    body: 'No more hunting for SIM cards or dealing with roaming charges. Instant activation, affordable rates, and global coverage at your fingertips.',
  },
  {
    icon: ShieldCheck,
    title: 'Peace of Mind Guaranteed',
    body: "24/7 customer support, secure connections, and reliable service. Travel with confidence knowing we've got you covered.",
  },
]

const values = [
  {
    icon: Target,
    title: 'Our Mission',
    body: "Make global connectivity simple, affordable, and accessible for every traveller. We're committed to breaking down barriers and connecting the world seamlessly.",
  },
  {
    icon: HeartHandshake,
    title: 'Customer First',
    body: 'Your seamless travel experience is our top priority. We listen, adapt, and innovate based on real traveller feedback to exceed expectations.',
  },
  {
    icon: Sparkles,
    title: 'Innovation',
    body: "Continuously bringing you the latest eSIM technology and connectivity solutions. We stay ahead of the curve so you don't have to.",
  },
  {
    icon: Lock,
    title: 'Trust & Security',
    body: "Enterprise-grade encryption keeps your data safe and private. We're committed to transparency and building lasting trust with our community.",
  },
]

const stats = [
  { value: '500,000+', label: 'Travellers served' },
  { value: '200+', label: 'Countries covered' },
  { value: '24/7', label: 'Customer support' },
]

export default function AboutPage() {
  return (
    <PublicShell
      title="Connectivity Without Borders, Serving the World"
      subtitle="eTijwaal, powered by ibara — instant, affordable eSIM connectivity for over 500,000 travellers across 200+ countries."
    >
      {/* Our story */}
      <section className="mx-auto max-w-3xl space-y-5 text-center">
        <span className="text-gradient-brand text-sm font-semibold uppercase tracking-[0.2em]">
          Our Story
        </span>
        <p className="text-lg leading-relaxed text-foreground/90">
          eTijwaal was born from a simple frustration: the hassle of staying connected while
          travelling. As frequent travellers ourselves, we experienced the pain of expensive
          roaming charges and hunting for local SIM cards at airports.
        </p>
        <p className="text-lg leading-relaxed text-foreground/90">
          So we set out to revolutionise how travellers stay connected. Our solution? The power
          of eSIM technology — instant, affordable, and incredibly simple.
        </p>
        <p className="text-lg leading-relaxed text-foreground/90">
          Today, we serve over 500,000 travellers across 200+ countries, partnering with major
          telecom providers to deliver seamless connectivity wherever your journey takes you.
        </p>
      </section>

      {/* Stats */}
      <section className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <div
            key={s.label}
            className="card-hover rounded-2xl border bg-card p-6 text-center"
          >
            <p className="text-gradient-brand font-display text-3xl font-bold md:text-4xl">
              {s.value}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </section>

      {/* Highlights */}
      <section className="mt-14 grid grid-cols-1 gap-5 md:grid-cols-3">
        {highlights.map(({ icon: Icon, title, body }) => (
          <div key={title} className="card-hover rounded-2xl border bg-card p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <Icon className="size-6 text-primary" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
          </div>
        ))}
      </section>

      {/* Values */}
      <section className="mt-16">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-2xl font-bold tracking-tight md:text-3xl">
            What We Stand For
          </h2>
          <p className="mt-3 text-muted-foreground">
            Our values guide every decision we make and every service we provide.
          </p>
        </div>
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2">
          {values.map(({ icon: Icon, title, body }) => (
            <div key={title} className="card-hover flex gap-4 rounded-2xl border bg-card p-6">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-gradient text-white">
                <Icon className="size-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <CtaBand
        heading="Ready to stay connected?"
        body="Sign in to the distributor portal to browse plans for 200+ destinations and start reselling."
      />
    </PublicShell>
  )
}
