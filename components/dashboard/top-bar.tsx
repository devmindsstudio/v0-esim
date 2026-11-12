'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Bell, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SidebarTrigger } from '@/components/ui/sidebar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { AllocateCreditDialog } from '@/components/dashboard/allocate-credit-dialog'
import { EtijwaalMark } from '@/components/branding/etijwaal-mark'
import { signOut } from '@/lib/supabase/auth'
import { getCreditCirculation, type CreditCirculation } from '@/lib/wallet'

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

/**
 * Admin header — doubles as the "eTijwaal powered by ibara" co-brand banner.
 * A dark navy bar (so the ibara logo blends) carrying the live credit-in-
 * circulation indicator, the co-brand lockup, and the Quick Top-up /
 * notifications / profile controls. Subtle drifting glow + fade-in on mount.
 */
export function TopBar() {
  const router = useRouter()
  const [circ, setCirc] = useState<CreditCirculation | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    getCreditCirculation().then(setCirc)
  }, [])

  return (
    <header className="brand-banner-in sticky top-0 z-40 h-16 shrink-0 overflow-hidden border-b border-white/10 bg-brand-navy shadow-lg">
      {/* Drifting brand glows */}
      <span
        aria-hidden
        className="brand-banner-glow pointer-events-none absolute -left-16 -top-24 h-56 w-56 rounded-full bg-brand-gradient opacity-40 blur-3xl"
      />
      <span
        aria-hidden
        style={{ animationDelay: '-4s' }}
        className="brand-banner-glow pointer-events-none absolute -bottom-28 right-10 h-56 w-56 rounded-full bg-brand-gradient opacity-25 blur-3xl"
      />

      <div className="relative z-10 flex h-full items-center gap-4 px-4 md:px-6">
        <SidebarTrigger className="text-white hover:bg-white/10! hover:text-white! md:hidden" />

        {/* Credit-in-circulation indicator */}
        <div className="hidden items-center gap-2.5 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm sm:flex">
          <span className="relative flex size-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-teal opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-brand-teal" />
          </span>
          <span className="text-white/60">Credit in circulation:</span>
          <span className="font-display font-semibold text-white">
            {circ ? formatCurrency(circ.inCirculation) : '—'}
          </span>
          {circ && (
            <span className="border-l border-white/15 pl-2.5 text-white/45">
              {circ.distributorsHolding} funded
            </span>
          )}
        </div>

        {/* Mobile: circulation only */}
        <div className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-1.5 text-xs sm:hidden">
          <span className="text-white/60">In circ.:</span>
          <span className="font-semibold text-white">
            {circ ? formatCurrency(circ.inCirculation) : '—'}
          </span>
        </div>

        {/* Co-brand lockup — eTijwaal powered by ibara */}
        <div className="hidden flex-1 items-center justify-center gap-3 lg:flex">
          <EtijwaalMark imgClassName="h-7 w-auto" priority />
          <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-white/45">
            powered by
          </span>
          <Image
            src="/ibara.png"
            alt="ibara.ai"
            width={676}
            height={188}
            priority
            className="h-7 w-auto"
          />
        </div>

        {/* Controls */}
        <div className="ml-auto flex items-center gap-2">
          <Button
            size="sm"
            className="gap-2 border-0 bg-brand-gradient text-white shadow-(--shadow-brand) hover:opacity-95"
            onClick={() => setOpen(true)}
          >
            <Plus className="size-4" />
            <span className="hidden sm:inline">Quick Top-up</span>
          </Button>

          {/* Notifications */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-white/70 hover:bg-white/10! hover:text-white!"
              >
                <Bell className="size-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel>Notifications</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="flex flex-col items-start gap-1 py-3">
                <span className="text-sm text-muted-foreground">No new notifications.</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Profile Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full hover:bg-white/10!">
                <Avatar className="size-8">
                  <AvatarImage src="/avatar.png" />
                  <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                    PE
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Master Admin</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={async () => { await signOut(); router.replace('/login') }}
              >
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Shared allocate-credit flow */}
      <AllocateCreditDialog
        open={open}
        onOpenChange={setOpen}
        onAllocated={() => getCreditCirculation().then(setCirc)}
      />
    </header>
  )
}
