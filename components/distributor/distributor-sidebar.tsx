'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Wallet,
  Receipt,
  Package,
  Boxes,
  ShoppingBag,
  LogOut,
  Wifi,
  Users,
  Network,
  TrendingUp,
} from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { PartnerLockup } from '@/components/branding/partner-lockup'
import { getCurrentDistributor, signOut, type CurrentDistributor } from '@/lib/supabase/auth'

export function DistributorSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [session, setSession] = useState<CurrentDistributor | null>(null)

  // Re-fetch on navigation so the wallet balance stays current after an order
  // or a credit allocation (the sidebar persists across page changes).
  useEffect(() => {
    getCurrentDistributor().then(setSession)
  }, [pathname])

  // "My Sub-Distributors" is only for MAIN distributors — a sub-distributor
  // cannot create further sub-distributors, so we hide the link for them.
  const navItems = [
    { title: 'Dashboard', url: '/distributor/dashboard', icon: LayoutDashboard },
    { title: 'My Wallet', url: '/distributor/wallet', icon: Wallet },
    { title: 'Transactions', url: '/distributor/transactions', icon: Receipt },
    { title: 'My Profit', url: '/distributor/profit', icon: TrendingUp },
    { title: 'Browse Catalogue', url: '/distributor/catalogue', icon: Package },
    { title: 'Bulk Order', url: '/distributor/bulk', icon: Boxes },
    { title: 'My Orders', url: '/distributor/orders', icon: ShoppingBag },
    { title: 'My Customers', url: '/distributor/customers', icon: Users },
    ...(session?.role === 'distributor'
      ? [{ title: 'My Sub-Distributors', url: '/distributor/sub-distributors', icon: Network }]
      : []),
  ]

  async function handleLogout() {
    await signOut()
    router.replace('/login')
  }

  const initials = session
    ? session.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : 'DX'

  return (
    <Sidebar className="border-r-0">
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-brand-gradient shadow-(--shadow-brand)">
            <Wifi className="size-5 text-white" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[11px] uppercase tracking-wider text-sidebar-foreground/60 truncate">
              {session?.role === 'sub_distributor' ? 'Sub-Distributor Portal' : 'Distributor Portal'}
            </span>
            <span className="font-semibold text-sm truncate font-display">
              {session?.company ?? 'My Company'}
            </span>
          </div>
        </div>

        {/* Wallet balance chip */}
        {session && (
          <div className="mt-3 rounded-xl border border-sidebar-border bg-card px-3 py-2.5 shadow-sm">
            <p className="text-[11px] uppercase tracking-wider text-sidebar-foreground/60">
              Wallet Balance
            </p>
            <p className="mt-0.5 text-xl font-bold font-display text-sidebar-primary">
              ${session.walletBalance.toLocaleString()}
            </p>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={pathname === item.url}>
                    <Link href={item.url}>
                      <item.icon className="size-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-2 space-y-2">
        {/* User info */}
        {session && (
          <div className="flex items-center gap-2 px-2 py-1">
            <div className="flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-semibold shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium truncate">{session.name}</p>
              <p className="text-xs text-sidebar-foreground/60 truncate">{session.email}</p>
            </div>
          </div>
        )}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={handleLogout}
              className="w-full bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              <LogOut className="size-4" />
              <span>Logout</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <PartnerLockup size="sm" className="py-1" />
      </SidebarFooter>
    </Sidebar>
  )
}
