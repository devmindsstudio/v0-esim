'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/dashboard/app-sidebar'
import { TopBar } from '@/components/dashboard/top-bar'
import { getCurrentUser, dashboardPathForRole } from '@/lib/supabase/auth'

const PUBLIC_PATHS = ['/login']
// Signed-out informational pages: render standalone (their own header/footer),
// with no auth check and no redirect — viewable whether or not you're logged in.
const PUBLIC_INFO_PATHS = ['/about', '/how-it-works', '/faqs']

export function AdminLayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [checked, setChecked] = useState(false)

  const isDistributorRoute = pathname === '/distributor' || pathname.startsWith('/distributor/')
  const isInfoPage = PUBLIC_INFO_PATHS.includes(pathname)
  const isPublic = PUBLIC_PATHS.includes(pathname)

  useEffect(() => {
    // Distributor routes are guarded by their own layout; info pages are fully
    // public — neither needs an auth check here.
    if (isDistributorRoute || isInfoPage) {
      setChecked(true)
      return
    }

    let active = true
    getCurrentUser().then((user) => {
      if (!active) return

      if (isPublic) {
        // On the login page: if already logged in, bounce to the right dashboard
        if (user) router.replace(dashboardPathForRole(user.role))
        else setChecked(true)
        return
      }

      // Protected admin area
      if (!user) {
        router.replace('/login')
      } else if (user.role !== 'admin') {
        // Logged in, but not an admin — send them to their own portal
        router.replace(dashboardPathForRole(user.role))
      } else {
        setChecked(true)
      }
    })

    return () => {
      active = false
    }
  }, [pathname, isDistributorRoute, isInfoPage, isPublic, router])

  // Distributor routes are handled by their own layout
  if (isDistributorRoute) return <>{children}</>

  // Public info pages carry their own chrome — render standalone
  if (isInfoPage) return <>{children}</>

  // Admin login page — render without the shell
  if (isPublic) return <>{children}</>

  // Waiting for the auth check — show nothing to avoid a flash of the dashboard
  if (!checked) return null

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="min-w-0">
        <TopBar />
        <main className="bg-app min-w-0 flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
