export interface WalletTransaction {
  id: string
  type: 'credit_out' | 'credit_in'
  distributor: string
  company: string
  description: string
  amount: number
  date: string
}

export interface WalletState {
  masterCreditPool: number
  allocatedCredit: number
  availableCredit: number
  transactions: WalletTransaction[]
}

const STORAGE_KEY = 'esim_admin_wallet'

const seedState: WalletState = {
  masterCreditPool: 250000,
  allocatedCredit: 187450,
  availableCredit: 62550,
  transactions: [
    {
      id: 't1', type: 'credit_out',
      distributor: 'Ahmed Al-Rashid', company: 'Gulf Mobile Services',
      description: 'Credit allocation', amount: 10000, date: '2026-06-07T09:00:00Z',
    },
    {
      id: 't2', type: 'credit_out',
      distributor: 'Badar Shahzad', company: 'TravelTech Solutions',
      description: 'Credit top-up', amount: 5000, date: '2026-06-05T10:30:00Z',
    },
    {
      id: 't3', type: 'credit_in',
      distributor: 'Omar Syed', company: 'Egypt Mobile Plus',
      description: 'Credit reclaimed — account suspended', amount: 450, date: '2026-06-03T14:00:00Z',
    },
    {
      id: 't4', type: 'credit_out',
      distributor: 'Noor Al-Qatari', company: 'Doha Mobile',
      description: 'Credit allocation', amount: 15000, date: '2026-06-01T08:00:00Z',
    },
    {
      id: 't5', type: 'credit_out',
      distributor: 'Sara Al-Kuwaiti', company: 'Kuwait SIM Center',
      description: 'Credit top-up', amount: 8000, date: '2026-05-28T16:00:00Z',
    },
  ],
}

function load(): WalletState {
  if (typeof window === 'undefined') return seedState
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return seedState
    return JSON.parse(raw)
  } catch {
    return seedState
  }
}

function save(state: WalletState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function getWalletState(): WalletState {
  const data = load()
  if (!localStorage.getItem(STORAGE_KEY)) save(seedState)
  return data
}

export function allocateCredit(
  distributorId: string,
  distributorName: string,
  company: string,
  amount: number
): { success: boolean; error?: string; state?: WalletState } {
  const state = load()
  if (amount <= 0) return { success: false, error: 'Amount must be greater than 0' }
  if (amount > state.availableCredit) {
    return { success: false, error: `Insufficient credits. Available: $${state.availableCredit.toLocaleString()}` }
  }

  // Enforce distributor credit limit
  try {
    const raw = localStorage.getItem(DIST_STORAGE_KEY)
    if (raw) {
      const distributors: Array<{ id: string; creditLimit: number; walletBalance: number }> = JSON.parse(raw)
      const dist = distributors.find((d) => d.id === distributorId)
      if (dist) {
        const currentBalance = dist.walletBalance ?? 0
        const remaining = (dist.creditLimit ?? 0) - currentBalance
        if (amount > remaining) {
          return {
            success: false,
            error: `Exceeds distributor's credit limit. Remaining capacity: $${remaining.toLocaleString()}`,
          }
        }
      }
    }
  } catch { /* ignore */ }

  const newTx: WalletTransaction = {
    id: `tx-${Date.now()}`,
    type: 'credit_out',
    distributor: distributorName,
    company,
    description: 'Credit allocation via Quick Allocate',
    amount,
    date: new Date().toISOString(),
  }

  const newState: WalletState = {
    ...state,
    allocatedCredit: state.allocatedCredit + amount,
    availableCredit: state.availableCredit - amount,
    transactions: [newTx, ...state.transactions],
  }
  save(newState)

  // Update walletBalance in the distributors store
  updateDistributorWalletBalance(distributorId, amount)

  // If the distributor is currently logged in, refresh their session too
  refreshSessionIfActive(distributorId, amount)

  return { success: true, state: newState }
}

const DIST_STORAGE_KEY = 'esim_distributors'
const SESSION_KEY = 'esim_distributor_session'

function updateDistributorWalletBalance(distributorId: string, amount: number) {
  try {
    const raw = localStorage.getItem(DIST_STORAGE_KEY)
    if (!raw) return
    const distributors: Array<{ id: string; walletBalance: number }> = JSON.parse(raw)
    const updated = distributors.map((d) =>
      d.id === distributorId ? { ...d, walletBalance: (d.walletBalance ?? 0) + amount } : d
    )
    localStorage.setItem(DIST_STORAGE_KEY, JSON.stringify(updated))
  } catch { /* ignore */ }
}

function refreshSessionIfActive(distributorId: string, amount: number) {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return
    const session: { id: string; walletBalance: number } = JSON.parse(raw)
    if (session.id !== distributorId) return
    session.walletBalance = (session.walletBalance ?? 0) + amount
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } catch { /* ignore */ }
}
