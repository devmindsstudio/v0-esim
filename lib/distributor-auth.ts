'use client'

import { getDistributors, type Distributor } from '@/lib/distributors-store'

const SESSION_KEY = 'esim_distributor_session'

export interface DistributorSession {
  id: string
  name: string
  company: string
  email: string
  countryCode: string
  country: string
  walletBalance: number
}

export function loginDistributor(
  email: string,
  password: string
): DistributorSession | null {
  const distributors = getDistributors()
  const match = distributors.find(
    (d: Distributor) =>
      d.email.toLowerCase() === email.toLowerCase() &&
      d.password === password &&
      d.status === 'active'
  )
  if (!match) return null

  const session: DistributorSession = {
    id: match.id,
    name: match.name,
    company: match.company,
    email: match.email,
    countryCode: match.countryCode,
    country: match.country,
    walletBalance: match.walletBalance,
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  return session
}

export function getDistributorSession(): DistributorSession | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as DistributorSession) : null
  } catch {
    return null
  }
}

export function logoutDistributor(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(SESSION_KEY)
  }
}
