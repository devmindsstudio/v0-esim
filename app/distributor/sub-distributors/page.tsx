'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { UserPlus, Users, CheckCircle, Ban, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
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
import { SubNetworkOverview } from '@/components/distributor/sub-network-overview'
import { DefaultCommissionCard } from '@/components/distributor/default-commission-card'
import { createClient } from '@/lib/supabase/client'
import { getCurrentDistributor, type CurrentDistributor } from '@/lib/supabase/auth'
import {
  type Distributor,
  type DistributorStatus,
  type NewDistributorInput,
} from '@/lib/distributors-store'

export default function SubDistributorsPage() {
  const router = useRouter()
  const [me, setMe] = useState<CurrentDistributor | null>(null)
  const [loading, setLoading] = useState(true)
  const [subs, setSubs] = useState<Distributor[]>([])
  const [search, setSearch] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [allocateTarget, setAllocateTarget] = useState<Distributor | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Distributor | null>(null)
  const [deleting, setDeleting] = useState(false)
  // Bumped after actions that change sub metrics (allocation, status) so the
  // performance/activity overview re-fetches.
  const [refreshKey, setRefreshKey] = useState(0)

  // Load MY sub-distributors — only the ones whose parent_id is me — with balances.
  const reload = useCallback(async (parentId: string) => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('distributors')
      .select('id, name, company, email, whatsapp, country, country_code, status, created_at')
      .eq('parent_id', parentId)
      .eq('role', 'sub_distributor')
      .order('created_at', { ascending: false })

    if (error) {
      toast.error('Could not load sub-distributors', { description: error.message })
      return
    }

    const rows = data ?? []

    // Fetch the sub-distributors' wallet balances in one query.
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

    // Map DB rows → the shape the shared table expects. Sales metrics are still
    // 0 until we build orders (Step 5).
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
    setSubs(mapped)
  }, [])

  useEffect(() => {
    getCurrentDistributor().then(async (d) => {
      setMe(d)
      if (d && d.role === 'distributor') {
        await reload(d.id)
      }
      setLoading(false)
    })
  }, [reload])

  // Create a sub-distributor through the SECURE server route (it creates the login too).
  async function handleAdd(input: NewDistributorInput): Promise<boolean> {
    const supabase = createClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    const res = await fetch('/api/sub-distributors', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token ?? ''}`,
      },
      body: JSON.stringify(input),
    })
    const json = await res.json()

    if (!res.ok) {
      toast.error('Could not add sub-distributor', { description: json.error })
      return false
    }

    toast.success('Sub-distributor added', {
      description: `${input.name} from ${input.company} can now log in to the portal.`,
    })
    if (me) await reload(me.id)
    setRefreshKey((k) => k + 1)
    return true
  }

  async function handleStatusChange(id: string, status: DistributorStatus) {
    const sub = subs.find((d) => d.id === id)
    const supabase = createClient()
    const { error } = await supabase.from('distributors').update({ status }).eq('id', id)
    if (error) {
      toast.error('Could not update status', { description: error.message })
      return
    }
    if (me) await reload(me.id)
    setRefreshKey((k) => k + 1)
    if (status === 'active') {
      toast.success('Sub-distributor activated', {
        description: `${sub?.name ?? 'Sub-distributor'} can now log in to the portal.`,
      })
    } else if (status === 'suspended') {
      toast.warning('Sub-distributor suspended', {
        description: `${sub?.name ?? 'Sub-distributor'} has been suspended and cannot log in.`,
      })
    } else {
      toast.info('Status updated', {
        description: `${sub?.name ?? 'Sub-distributor'} status changed to ${status}.`,
      })
    }
  }

  // Delete one of my sub-distributors (account + wallet + login) via the secure
  // server route. Confirmed first (see the AlertDialog below).
  async function confirmDelete() {
    if (!deleteTarget || !me) return
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
      toast.error('Could not delete sub-distributor', {
        description: json.error ?? 'Please try again.',
      })
      return
    }
    toast.success('Sub-distributor deleted', {
      description: `${deleteTarget.name} and their login have been removed.`,
    })
    setDeleteTarget(null)
    await reload(me.id)
    setRefreshKey((k) => k + 1)
  }

  // Transfer credit from MY wallet to one of my sub-distributors. `cashPaid` is
  // the cash the sub gave me; `commissionPercent` is the bonus % I chose for THIS
  // top-up. The server credits them cash × (1 + %), debiting that from my wallet.
  async function handleAllocate(cashPaid: number, commissionPercent: number, note: string): Promise<boolean> {
    if (!allocateTarget || !me) return false
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
      description: `$${credit.toLocaleString()} credit moved to ${allocateTarget.name}'s wallet (they paid $${cashPaid.toLocaleString()}).`,
    })
    // Refresh my own balance (it went down) and the sub balances (one went up).
    const refreshed = await getCurrentDistributor()
    setMe(refreshed)
    await reload(me.id)
    setRefreshKey((k) => k + 1)
    return true
  }

  // A sub-distributor cannot manage sub-distributors — show a friendly note
  // if someone reaches this page directly.
  if (!loading && me && me.role !== 'distributor') {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Users className="size-8 text-muted-foreground mb-3" />
        <p className="font-semibold">Sub-distributors aren&apos;t available for your account.</p>
        <p className="text-sm text-muted-foreground mt-1">
          Only main distributors can create and manage sub-distributors.
        </p>
      </div>
    )
  }

  // Trim first so a whitespace-only query (e.g. a stray space) counts as "no
  // search" instead of matching every name that happens to contain a space.
  const query = search.trim().toLowerCase()
  const filtered = subs.filter(
    (d) =>
      query === '' ||
      d.name.toLowerCase().includes(query) ||
      d.company.toLowerCase().includes(query) ||
      d.email.toLowerCase().includes(query),
  )

  const stats = {
    total: subs.length,
    active: subs.filter((d) => d.status === 'active').length,
    suspended: subs.filter((d) => d.status === 'suspended').length,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Sub-Distributors</h1>
          <p className="text-muted-foreground">
            Onboard resellers under your network and manage their access.
          </p>
        </div>
        <Button onClick={() => setIsFormOpen(true)}>
          <UserPlus className="size-4 mr-2" />
          Add Sub-Distributor
        </Button>
      </div>

      {/* My available balance — this is what I can allocate to my sub-distributors */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex items-center gap-4 p-5">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
            <Wallet className="size-5 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold">${(me?.walletBalance ?? 0).toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">
              Your wallet balance — allocate from this to your sub-distributors
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Default commission % that pre-fills sub top-ups */}
      {me && (
        <DefaultCommissionCard
          initialValue={me.defaultCommissionPercent}
          onSaved={(v) => setMe((m) => (m ? { ...m, defaultCommissionPercent: v } : m))}
        />
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-muted">
              <Users className="size-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total Sub-Distributors</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-muted">
              <CheckCircle className="size-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.active}</p>
              <p className="text-xs text-muted-foreground">Active</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-muted">
              <Ban className="size-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.suspended}</p>
              <p className="text-xs text-muted-foreground">Suspended</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sub-distributor performance + activity (read-only) */}
      {me && me.role === 'distributor' && (
        <SubNetworkOverview parentId={me.id} refreshKey={refreshKey} />
      )}

      {/* Manage sub-distributors */}
      <h2 className="text-lg font-semibold pt-2">Manage Sub-Distributors</h2>

      {/* Search */}
      <Input
        placeholder="Search by name, company or email…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="sm:max-w-xs"
      />

      {/* Table (shared with the admin distributors page) */}
      <DistributorTable
        distributors={filtered}
        isFiltered={query !== ''}
        noun="sub-distributor"
        onStatusChange={handleStatusChange}
        onDelete={(id) => setDeleteTarget(subs.find((d) => d.id === id) ?? null)}
        onAllocate={(id) => {
          setAllocateTarget(subs.find((d) => d.id === id) ?? null)
          // Refresh my balance so the dialog's "available" figure is current.
          getCurrentDistributor().then((d) => { if (d) setMe(d) })
        }}
        onView={(id) => router.push(`/distributor/sub-distributors/${id}`)}
      />

      {/* Add Sub-Distributor form (shared component, sub-distributor wording) */}
      <AddDistributorForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSubmit={handleAdd}
        title="Add New Sub-Distributor"
        description="Fill in the details below. The sub-distributor will be created as Active and can log in to the portal right away."
        submitLabel="Add Sub-Distributor"
      />

      {/* Allocate Credit dialog — capped at MY available balance. A commission
          greater than 0 is required so a sub top-up always earns the distributor. */}
      <AllocateCreditDialog
        open={!!allocateTarget}
        onOpenChange={(o) => { if (!o) setAllocateTarget(null) }}
        recipientName={allocateTarget?.name ?? ''}
        availableBalance={me?.walletBalance ?? 0}
        defaultCommissionPercent={me?.defaultCommissionPercent ?? 0}
        requireCommission
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
              login. This can&apos;t be undone — to keep the record but block access, suspend them
              instead.
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
