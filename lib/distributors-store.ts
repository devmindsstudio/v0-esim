import { mockDistributors } from '@/lib/mock-data'

export type DistributorStatus = 'active' | 'pending' | 'suspended' | 'dormant'

export interface Distributor {
  id: string
  name: string
  company: string
  email: string
  whatsapp: string
  country: string
  countryCode: string
  status: DistributorStatus
  password: string
  walletBalance: number
  esimsSold30d: number
  revenue30d: number
  margin30d: number
  lastActivity: string
  createdAt: string
}

export interface NewDistributorInput {
  name: string
  company: string
  email: string
  password: string
  whatsapp: string
  country: string
  countryCode: string
}

const STORAGE_KEY = 'esim_distributors'

function generateId(): string {
  return `dist_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

function seedIfEmpty(): void {
  if (typeof window === 'undefined') return
  const existing = localStorage.getItem(STORAGE_KEY)
  if (!existing) {
    const seeded: Distributor[] = mockDistributors.map((d) => ({
      ...d,
      password: '',
    }))
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded))
  }
}

export function getDistributors(): Distributor[] {
  if (typeof window === 'undefined') return []
  seedIfEmpty()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Distributor[]) : []
  } catch {
    return []
  }
}

export function addDistributor(input: NewDistributorInput): Distributor {
  const distributors = getDistributors()
  const now = new Date().toISOString()
  const newDistributor: Distributor = {
    id: generateId(),
    name: input.name,
    company: input.company,
    email: input.email,
    password: input.password,
    whatsapp: input.whatsapp,
    country: input.country,
    countryCode: input.countryCode,
    status: 'pending',
    walletBalance: 0,
    esimsSold30d: 0,
    revenue30d: 0,
    margin30d: 0,
    lastActivity: now,
    createdAt: now,
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify([newDistributor, ...distributors]))
  return newDistributor
}

export function updateDistributorStatus(id: string, status: DistributorStatus): void {
  const distributors = getDistributors()
  const updated = distributors.map((d) =>
    d.id === id ? { ...d, status, lastActivity: new Date().toISOString() } : d
  )
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
}

export function deleteDistributor(id: string): void {
  const distributors = getDistributors()
  const filtered = distributors.filter((d) => d.id !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered))
}
