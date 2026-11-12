'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import { DistributorSidebar } from '@/components/distributor/distributor-sidebar'
import { getCurrentUser, signOut, portalAccessError } from '@/lib/supabase/auth'

export default function DistributorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [checked, setChecked] = useState(false)
  const [role, setRole] = useState<string | null>(null)

  const isLoginPage = pathname === '/distributor/login'

  useEffect(() => {
    if (isLoginPage) {
      setChecked(true)
      return
    }

    let active = true
    getCurrentUser().then((user) => {
      if (!active) return
      if (!user) {
        // Not logged in → go to the unified login page
        router.replace('/login')
      } else if (user.role === 'admin') {
        // An admin landed on the distributor portal → send them to admin dashboard
        router.replace('/dashboard')
      } else if (portalAccessError(user.status)) {
        // Not active (pending/suspended/dormant) mid-session → sign out and
        // bounce to login, where the reason is shown.
        signOut().then(() => router.replace('/login'))
      } else {
        // distributor or sub_distributor → allowed
        setRole(user.role)
        setChecked(true)
      }
    })

    return () => {
      active = false
    }
  }, [pathname, isLoginPage, router])

  // The global <Toaster/> lives in the root layout (app/layout.tsx) — we don't
  // render another one here, or the two instances fight over Sonner's shared
  // store and React throws "Cannot update a component while rendering …".
  if (isLoginPage) {
    return <>{children}</>
  }

  if (!checked) return null

  return (
    <SidebarProvider>
      <DistributorSidebar />
      <SidebarInset className="min-w-0">
        {/* Mobile header — the sidebar is an offcanvas drawer on phones, so it
            needs a trigger to open it. Hidden on md+ where the sidebar is fixed. */}
        <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-3 border-b bg-card px-4 md:hidden">
          <SidebarTrigger />
          <span className="text-sm font-semibold">
            {role === 'sub_distributor' ? 'Sub-Distributor Portal' : 'Distributor Portal'}
          </span>
        </header>
        <main className="bg-app min-w-0 flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
