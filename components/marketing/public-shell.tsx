'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { PartnerLockup } from '@/components/branding/partner-lockup'
import { cn } from '@/lib/utils'

const NAV = [
  { href: '/about', label: 'About' },
  { href: '/how-it-works', label: 'How It Works' },
  { href: '/faqs', label: 'FAQ' },
]

/**
 * Chrome for the public, signed-out informational pages (About / How It Works /
 * FAQ). A light co-brand header, a navy brand hero, and a footer — all links
 * stay inside the portal (no outbound redirects to the marketing site). These
 * pages sit outside the dashboard shell (see AdminLayoutShell's public-path
 * list) so they render standalone.
 */
export function PublicShell({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const year = new Date().getFullYear()

  return (
    <div className="bg-app flex min-h-screen flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-black/5 bg-white/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-4 px-4 py-3 md:px-6">
          <Link href="/login" aria-label="eTijwaal — powered by ibara" className="shrink-0">
            <PartnerLockup size="sm" className="mx-0" />
          </Link>

          <nav className="ml-auto hidden items-center gap-1 md:flex">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  pathname === item.href
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2 md:ml-4">
            <Button
              asChild
              size="sm"
              className="border-0 bg-brand-gradient text-white shadow-(--shadow-brand) hover:opacity-95"
            >
              <Link href="/login">Login</Link>
            </Button>
          </div>
        </div>

        {/* Mobile nav row */}
        <nav className="flex items-center gap-1 overflow-x-auto border-t border-black/5 px-4 py-2 md:hidden">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                pathname === item.href
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-brand-navy">
        <span
          aria-hidden
          className="pointer-events-none absolute -left-16 -top-24 h-72 w-72 rounded-full bg-brand-gradient opacity-40 blur-3xl"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-28 right-0 h-72 w-72 rounded-full bg-brand-gradient opacity-25 blur-3xl"
        />
        <div className="relative z-10 mx-auto w-full max-w-6xl px-4 py-16 text-center md:px-6 md:py-20">
          <h1 className="font-display text-3xl font-bold tracking-tight text-white text-balance md:text-4xl">
            {title}
          </h1>
          {subtitle && (
            <p className="mx-auto mt-4 max-w-2xl text-base text-white/70 text-pretty md:text-lg">
              {subtitle}
            </p>
          )}
        </div>
      </section>

      {/* Content */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-12 md:px-6 md:py-16">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-brand-navy">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-6 px-4 py-10 text-center md:flex-row md:items-center md:justify-between md:px-6 md:text-left">
          {/* Brand */}
          <div className="flex flex-col items-center gap-3 md:items-start">
            <PartnerLockup size="sm" className="mx-0" />
            <p className="max-w-sm text-sm text-white/55">
              Global eSIM connectivity for travellers — instant, affordable, and simple.
              eTijwaal, powered by ibara.
            </p>
          </div>
          {/* Nav */}
          <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
            <Link href="/about" className="text-white/70 transition-colors hover:text-white">About</Link>
            <Link href="/how-it-works" className="text-white/70 transition-colors hover:text-white">How It Works</Link>
            <Link href="/faqs" className="text-white/70 transition-colors hover:text-white">FAQ</Link>
            <Link href="/login" className="text-white/70 transition-colors hover:text-white">Login</Link>
          </nav>
        </div>
        <div className="border-t border-white/10">
          <p className="mx-auto w-full max-w-6xl px-4 py-4 text-center text-xs text-white/45 md:px-6">
            © {year} eTijwaal, powered by ibara. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}

/** Small numbered step card shared by the How It Works page. */
export function StepCard({
  step,
  title,
  children,
}: {
  step: number
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="card-hover relative rounded-2xl border bg-card p-6">
      <span className="bg-brand-gradient font-display absolute -top-4 left-6 flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold text-white shadow-(--shadow-brand)">
        {step}
      </span>
      <h3 className="mt-3 text-base font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{children}</p>
    </div>
  )
}

/** Bottom call-to-action band reused across the public pages. */
export function CtaBand({ heading, body }: { heading: string; body: string }) {
  return (
    <section className="relative mt-16 overflow-hidden rounded-3xl bg-brand-navy px-6 py-12 text-center md:px-10 md:py-14">
      <span
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-brand-gradient opacity-30 blur-3xl"
      />
      <div className="relative z-10">
        <h2 className="font-display text-2xl font-bold tracking-tight text-white md:text-3xl">
          {heading}
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm text-white/70 md:text-base">{body}</p>
        <div className="mt-7 flex justify-center">
          <Button
            asChild
            size="lg"
            className="border-0 bg-brand-gradient text-white shadow-(--shadow-brand) hover:opacity-95"
          >
            <Link href="/login">Login to the portal</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
