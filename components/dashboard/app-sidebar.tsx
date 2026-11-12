'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Receipt,
  Settings,
  Wifi,
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

const navigationItems = [
  {
    title: 'Dashboard',
    url: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    title: 'Distributors',
    url: '/distributors',
    icon: Users,
  },
  {
    title: 'Credit & Wallet',
    url: '/wallet',
    icon: CreditCard,
  },
  {
    title: 'Ledger',
    url: '/ledger',
    icon: Receipt,
  },
  {
    title: 'eSIM Packages',
    url: '/dashboard/packages',
    icon: Wifi,
  },
  {
    title: 'Account Settings',
    url: '/settings',
    icon: Settings,
  },
]

export function AppSidebar() {
  const pathname = usePathname()

  return (
    <Sidebar className="border-r-0">
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-brand-gradient text-white text-sm font-bold tracking-tight shadow-(--shadow-brand)">
            PEB
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[11px] uppercase tracking-wider text-sidebar-foreground/60">
              Master Portal
            </span>
            <span className="font-semibold text-sm truncate font-display">Premier Euro Brands</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => (
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

      <SidebarFooter className="border-t border-sidebar-border p-3">
        <PartnerLockup size="sm" />
      </SidebarFooter>
    </Sidebar>
  )
}
