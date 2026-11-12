'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { UserPlus, Users, CheckCircle, Clock, Ban } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DistributorTable } from '@/components/distributors/distributor-table'
import { AddDistributorForm } from '@/components/distributors/add-distributor-form'
import { AllocateCreditDialog } from '@/components/wallet/allocate-credit-dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { createClient } from '@/lib/supabase/client'
import { getGlobalDefaultCommission } from '@/lib/settings'
import {
  type Distributor,
  type DistributorStatus,
  type NewDistributorInput,
} from '@/lib/distributors-store'

interface StatCardProps {
  label: string
  value: number
  icon: React.ReactNode
}

function StatCard({ label, value, icon }: StatCardProps) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-muted">
          {icon}
        </div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  )
}

export default function DistributorsPage() {
  const router = useRouter()
  const [distributors, setDistributors] = useState<Distributor[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<DistributorStatus | 'all'>('all')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [allocateTarget, setAllocateTarget] = useState<Distributor | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Distributor | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [defaultCommission, setDefaultCommission] = useState(0)

  // Load the MAIN distributors from Supabase, with their real wallet balances.
  const reload = useCallback(async () => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('distributors')
      .select('id, name, company, email, whatsapp, country, country_code, status, created_at')
      .eq('role', 'distributor')
      .order('created_at', { ascending: false })

    if (error) {
      toast.error('Could not load distributors', { description: error.message })
      return
    }

    const rows = data ?? []

    // Fetch the wallet balances for these distributors in one query.
    const ids = rows.map((r) => r.id)
    const balances = new Map<string, number>()
    if (ids.length > 0) {
      const { data: wallets } = await supabase
        .from('wallets')
        .select('distributor_id, balance')
        .in('distributor_id', ids)
      for (const w of wallets ?? []) {
        balances.set(w.distributor_id, Number(w.balance ?? 0))
      }
    }

    // Map DB rows → the shape the table expects.
    // Sales metrics are still 0 until we build orders (Step 5).
    const mapped: Distributor[] = rows.map((r) => ({
      id: r.id,
      name: r.name,
      company: r.company ?? '',
      email: r.email,
      whatsapp: r.whatsapp ?? '',
      country: r.country ?? '',
      countryCode: r.country_code ?? '',
      status: r.status as DistributorStatus,
      password: '',
      walletBalance: balances.get(r.id) ?? 0,
      esimsSold30d: 0,
      revenue30d: 0,
      margin30d: 0,
      lastActivity: r.created_at,
      createdAt: r.created_at,
    }))
    setDistributors(mapped)
  }, [])

  useEffect(() => {
    reload()
    getGlobalDefaultCommission().then(setDefaultCommission)
  }, [reload])

  // Create a distributor through the SECURE server route (it creates the login too).
  // Returns true on success so the form knows whether to close.
  async function handleAdd(input: NewDistributorInput): Promise<boolean> {
    const supabase = createClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    const res = await fetch('/api/distributors', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token ?? ''}`,
      },
      body: JSON.stringify(input),
    })
    const json = await res.json()

    if (!res.ok) {
      toast.error('Could not add distributor', { description: json.error })
      return false
    }

    toast.success('Distributor added', {
      description: `${input.name} from ${input.company} can now log in to the portal.`,
    })
    await reload()
    return true
  }

  async function handleStatusChange(id: string, status: DistributorStatus) {
    const dist = distributors.find((d) => d.id === id)
    const supabase = createClient()
    const { error } = await supabase.from('distributors').update({ status }).eq('id', id)
    if (error) {
      toast.error('Could not update status', { description: error.message })
      return
    }
    await reload()
    if (status === 'active') {
      toast.success('Distributor activated', {
        description: `${dist?.name ?? 'Distributor'} can now log in to the portal.`,
      })
    } else if (status === 'suspended') {
      toast.warning('Distributor suspended', {
        description: `${dist?.name ?? 'Distributor'} has been suspended and cannot log in.`,
      })
    } else {
      toast.info('Status updated', {
        description: `${dist?.name ?? 'Distributor'} status changed to ${status}.`,
      })
    }
  }

  // Deleting a distributor permanently removes their account, wallet and login
  // via the secure server route. Confirmed first (see the AlertDialog below).
  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    const supabase = createClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    const res = await fetch(`/api/distributors/${deleteTarget.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
    })
    const json = await res.json().catch(() => ({}))
    setDeleting(false)

    if (!res.ok) {
      toast.error('Could not delete distributor', { description: json.error ?? 'Please try again.' })
      return
    }
    toast.success('Distributor deleted', {
      description: `${deleteTarget.name} and their login have been removed.`,
    })
    setDeleteTarget(null)
    await reload()
  }

  // Allocate wallet credit to a distributor via the secure server route.
  // `cashPaid` is the cash received; `commissionPercent` is the bonus % chosen
  // for THIS top-up. The server turns it into credit = cash × (1 + %), drawing
  // it down from the Ibara credit pool.
  async function handleAllocate(cashPaid: number, commissionPercent: number, note: string): Promise<boolean> {
    if (!allocateTarget) return false
    const supabase = createClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    const res = await fetch('/api/wallet/allocate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token ?? ''}`,
      },
      body: JSON.stringify({ toDistributorId: allocateTarget.id, cashPaid, commissionPercent, note }),
    })
    const json = await res.json()

    if (!res.ok) {
      toast.error('Could not allocate credit', { description: json.error })
      return false
    }

    const credit = Number(json.credit ?? cashPaid)
    toast.success('Top-up complete', {
      description: `$${credit.toLocaleString()} credit added to ${allocateTarget.name}'s wallet (paid $${cashPaid.toLocaleString()}).`,
    })
    await reload()
    return true
  }

  // Trim first so a whitespace-only query (e.g. a stray space) counts as "no
  // search" instead of matching every name that happens to contain a space.
  const query = search.trim().toLowerCase()
  const filtered = distributors.filter((d) => {
    const matchesSearch =
      query === '' ||
      d.name.toLowerCase().includes(query) ||
      d.company.toLowerCase().includes(query) ||
      d.email.toLowerCase().includes(query)
    const matchesStatus = statusFilter === 'all' || d.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const stats = {
    total: distributors.length,
    active: distributors.filter((d) => d.status === 'active').length,
    pending: distributors.filter((d) => d.status === 'pending').length,
    suspended: distributors.filter((d) => d.status === 'suspended').length,
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Distributors</h1>
          <p className="text-muted-foreground">
            Manage your distributor network and onboard new partners.
          </p>
        </div>
        <Button onClick={() => setIsFormOpen(true)}>
          <UserPlus className="size-4 mr-2" />
          Add Distributor
        </Button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Distributors"
          value={stats.total}
          icon={<Users className="size-5 text-muted-foreground" />}
        />
        <StatCard
          label="Active"
          value={stats.active}
          icon={<CheckCircle className="size-5 text-green-600" />}
        />
        <StatCard
          label="Pending Approval"
          value={stats.pending}
          icon={<Clock className="size-5 text-yellow-600" />}
        />
        <StatCard
          label="Suspended"
          value={stats.suspended}
          icon={<Ban className="size-5 text-red-600" />}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          placeholder="Search by name, company or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-xs"
        />
        <Select
          value={statusFilter}
          onValueChange={(val) => setStatusFilter(val as DistributorStatus | 'all')}
        >
          <SelectTrigger className="sm:w-44">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
            <SelectItem value="dormant">Dormant</SelectItem>
          </SelectContent>
        </Select>
        {(search || statusFilter !== 'all') && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch('')
              setStatusFilter('all')
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      {/* Table */}
      <DistributorTable
        distributors={filtered}
        isFiltered={query !== '' || statusFilter !== 'all'}
        onStatusChange={handleStatusChange}
        onDelete={(id) => setDeleteTarget(distributors.find((d) => d.id === id) ?? null)}
        onAllocate={(id) => setAllocateTarget(distributors.find((d) => d.id === id) ?? null)}
        onView={(id) => router.push(`/distributors/${id}`)}
      />

      {/* Add Distributor Sheet */}
      <AddDistributorForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSubmit={handleAdd}
      />

      {/* Allocate Credit dialog (admin has no wallet cap of their own) */}
      <AllocateCreditDialog
        open={!!allocateTarget}
        onOpenChange={(o) => { if (!o) setAllocateTarget(null) }}
        recipientName={allocateTarget?.name ?? ''}
        defaultCommissionPercent={defaultCommission}
        onSubmit={handleAllocate}
      />

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => { if (!o && !deleting) setDeleteTarget(null) }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes {deleteTarget?.name}
              {deleteTarget?.company ? ` (${deleteTarget.company})` : ''}, their wallet and their
              login. Order and ledger history is kept. This can&apos;t be undone — to keep the record
              but block access, suspend them instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); confirmDelete() }}
              disabled={deleting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
