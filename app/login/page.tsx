'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Eye, EyeOff, User } from 'lucide-react'
import { PartnerLockup } from '@/components/branding/partner-lockup'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser, signOut, dashboardPathForRole, portalAccessError } from '@/lib/supabase/auth'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // If already logged in, skip the login page and go to the right dashboard.
  // A suspended account is signed out instead (it can't use the portal).
  useEffect(() => {
    getCurrentUser().then((user) => {
      if (!user) return
      // Only active accounts may use the portal; sign the rest back out.
      if (portalAccessError(user.status)) {
        signOut()
        return
      }
      router.replace(dashboardPathForRole(user.role))
    })
  }, [router])

  async function handleLogin() {
    setError('')
    setLoading(true)

    // 1. Ask Supabase Auth to verify the email + password
    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })

    if (signInError) {
      setError('Invalid email or password.')
      setLoading(false)
      return
    }

    // 2. Signed in — find their role so we send them to the correct portal
    const user = await getCurrentUser()
    if (!user) {
      // Login exists in Supabase Auth, but no admin/distributor profile is linked to it
      await signOut()
      setError('This account is not set up for portal access. Please contact the administrator.')
      setLoading(false)
      return
    }

    // Only active accounts can access the portal — pending, suspended and
    // dormant are all blocked with an explanatory message.
    const denied = portalAccessError(user.status)
    if (denied) {
      await signOut()
      setError(denied)
      setLoading(false)
      return
    }

    router.replace(dashboardPathForRole(user.role))
  }

  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row bg-white">
      {/* LEFT PANEL — illustration */}
      <div className="relative hidden md:flex md:w-1/2 lg:w-[55%] bg-[#0a0a0a] items-center justify-center overflow-hidden">
        <Image
          src="/images/esim-hero.png"
          alt="eTijwaal eSIM travel illustration"
          fill
          priority
          className="object-contain"
          sizes="(min-width: 768px) 50vw, 100vw"
        />
      </div>

      {/* RIGHT PANEL — form */}
      <div className="relative flex flex-1 flex-col items-center justify-center px-6 py-12 bg-[#f4f6f8]">
        <div className="w-full max-w-md">

          {/* Co-branded partner lockup — eTijwaal + ibara shown at equal size */}
          <div className="flex justify-center mb-8">
            <PartnerLockup size="lg" />
          </div>

          <p className="text-center text-lg font-semibold text-[#c53d3d] mb-8">
            Please Login to Continue
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleLogin()
            }}
            className="space-y-5"
          >
            {/* Username / Email */}
            <div className="relative border-l-4 border-[#3f6b73] bg-white rounded-r-md shadow-sm">
              <User className="absolute right-4 top-1/2 -translate-y-1/2 size-5 text-[#9aa5a8]" />
              <input
                id="email"
                type="email"
                placeholder="Username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full bg-transparent rounded-r-md py-4 pl-5 pr-12 text-base text-[#333] placeholder:text-[#9aa5a8] focus:outline-none focus:ring-2 focus:ring-[#3f6b73]/30"
              />
            </div>

            {/* Password */}
            <div className="relative border-l-4 border-[#3f6b73] bg-white rounded-r-md shadow-sm">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full bg-transparent rounded-r-md py-4 pl-5 pr-12 text-base text-[#333] placeholder:text-[#9aa5a8] focus:outline-none focus:ring-2 focus:ring-[#3f6b73]/30"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#9aa5a8] hover:text-[#3f6b73] transition-colors"
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
              </button>
            </div>

            {error && (
              <p className="text-sm text-[#c53d3d] bg-[#c53d3d]/10 rounded-md px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-[#4d7d84] hover:bg-[#436e75] disabled:opacity-60 text-white text-base font-medium py-4 shadow-sm transition-colors"
            >
              {loading ? 'Signing in…' : 'Login'}
            </button>
          </form>

          {/* New to eTijwaal — informational pages */}
          <div className="mt-10 border-t border-[#dfe6e8] pt-5">
            <p className="text-center text-xs text-[#9aa5a8]">New to eTijwaal?</p>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-sm">
              <Link href="/about" className="text-[#4d7d84] transition-colors hover:text-[#2f5157]">
                About
              </Link>
              <Link href="/how-it-works" className="text-[#4d7d84] transition-colors hover:text-[#2f5157]">
                How It Works
              </Link>
              <Link href="/faqs" className="text-[#4d7d84] transition-colors hover:text-[#2f5157]">
                FAQ
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
