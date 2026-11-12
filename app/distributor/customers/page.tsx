'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  UserPlus, Users, ShoppingBag, DollarSign, ChevronDown, ChevronRight, Wifi,
  Package as PackageIcon, ChevronsUpDown, Check,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command'
import { cn } from '@/lib/utils'
import { COUNTRIES } from '@/lib/countries'
import {
  DistributorCustomer,
  getCustomers,
  addCustomer,
} from '@/lib/distributor-customers-store'
import { getDistributorOrders, type DistributorOrder } from '@/lib/orders'
import { getCurrentDistributor, type CurrentDistributor } from '@/lib/supabase/auth'
import {
  AllocatePackageDialog,
  type AllocateResult,
} from '@/components/customers/allocate-package-dialog'
import { EsimResultDialog, type IssuedEsim } from '@/components/orders/esim-result-dialog'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function DistributorCustomersPage() {
  const [me, setMe] = useState<CurrentDistributor | null>(null)
  const [customers, setCustomers] = useState<DistributorCustomer[]>([])
  const [orders, setOrders] = useState<DistributorOrder[]>([])
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', email: '', phone: '', country: '' })
  const [saving, setSaving] = useState(false)
  const [countryOpen, setCountryOpen] = useState(false)

  // Allocate-package flow
  const [allocateFor, setAllocateFor] = useState<DistributorCustomer | null>(null)
  const [result, setResult] = useState<{
    esim: IssuedEsim
    title: string
    customer: string
    orderId: string
    customerEmail: string
  } | null>(null)
  const [resultOpen, setResultOpen] = useState(false)

  function handleIssued(r: AllocateResult) {
    setResult({
      esim: r.esim,
      title: r.title,
      customer: r.customerName,
      orderId: r.orderId,
      customerEmail: r.customerEmail,
    })
    setResultOpen(true)
    // Refresh counts, revenue, and wallet balance after issuing.
    getCurrentDistributor().then((d) => {
      setMe(d)
      if (d) {
        getCustomers(d.id).then(setCustomers)
        getDistributorOrders(d.id).then(setOrders)
      }
    })
  }

  useEffect(() => {
    getCurrentDistributor().then(async (d) => {
      setMe(d)
      if (d) {
        setCustomers(await getCustomers(d.id))
        setOrders(await getDistributorOrders(d.id))
      }
    })
  }, [])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!me) return
    if (!form.country) {
      toast.error('Please select a country')
      return
    }
    setSaving(true)
    const c = await addCustomer(me.id, me.tenantId, form)
    setSaving(false)
    if (!c) {
      toast.error('Could not add customer', {
        description: 'Something went wrong saving the customer. Please try again.',
      })
      return
    }
    setCustomers((prev) => [c, ...prev])
    setForm({ name: '', email: '', phone: '', country: '' })
    setOpen(false)
    toast.success('Customer added', {
      description: `${c.name} has been added to your customer list.`,
    })
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => (prev === id ? null : id))
  }

  // Group real orders by customer.
  const ordersByCustomer = new Map<string, DistributorOrder[]>()
  for (const o of orders) {
    if (!o.customerId) continue
    const list = ordersByCustomer.get(o.customerId) ?? []
    list.push(o)
    ordersByCustomer.set(o.customerId, list)
  }

  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase()) ||
      c.country.toLowerCase().includes(search.toLowerCase())
  )

  const totalSpent = orders.reduce((s, o) => s + o.total, 0)
  const totalOrders = orders.length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Customers</h1>
          <p className="text-muted-foreground">Manage your customer list and their issued eSIMs.</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <UserPlus className="size-4 mr-2" />
          Add Customer
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-muted">
              <Users className="size-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{customers.length}</p>
              <p className="text-xs text-muted-foreground">Total Customers</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-muted">
              <ShoppingBag className="size-5 text-orange-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalOrders}</p>
              <p className="text-xs text-muted-foreground">eSIMs Sold</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-muted">
              <DollarSign className="size-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">${totalSpent.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Revenue from Customers</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Input
        placeholder="Search by name, email or country…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="sm:max-w-xs"
      />

      {/* Customer list with expandable order history */}
      <div className="rounded-md border divide-y">
        {filtered.length === 0 ? (
          <div className="text-center text-muted-foreground py-10 text-sm">
            No customers found.
          </div>
        ) : (
          filtered.map((c) => {
            const custOrders = ordersByCustomer.get(c.id) ?? []
            const spent = custOrders.reduce((s, o) => s + o.total, 0)
            return (
              <div key={c.id}>
                {/* Customer row */}
                <div className="w-full flex items-center justify-between gap-4 px-4 py-3 hover:bg-muted/40 transition-colors">
                  <button
                    type="button"
                    onClick={() => toggleExpand(c.id)}
                    className="flex items-center gap-3 min-w-0 flex-1 text-left"
                  >
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary text-xs font-semibold shrink-0">
                      {c.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{c.email} · {c.phone}</p>
                    </div>
                  </button>
                  <div className="flex items-center gap-3 sm:gap-4 shrink-0">
                    <Badge variant="outline" className="text-xs hidden sm:flex">{c.country}</Badge>
                    <div className="text-right hidden md:block">
                      <p className="text-xs text-muted-foreground">eSIMs</p>
                      <p className="text-sm font-semibold">{custOrders.length}</p>
                    </div>
                    <div className="text-right hidden md:block">
                      <p className="text-xs text-muted-foreground">Spent</p>
                      <p className="text-sm font-semibold">${spent.toLocaleString()}</p>
                    </div>
                    <Button
                      size="sm"
                      className="gap-1.5"
                      onClick={() => setAllocateFor(c)}
                    >
                      <PackageIcon className="size-3.5" />
                      <span className="hidden sm:inline">Allocate package</span>
                    </Button>
                    <button
                      type="button"
                      onClick={() => toggleExpand(c.id)}
                      className="text-muted-foreground"
                      aria-label={expanded === c.id ? 'Collapse' : 'Expand'}
                    >
                      {expanded === c.id
                        ? <ChevronDown className="size-4" />
                        : <ChevronRight className="size-4" />
                      }
                    </button>
                  </div>
                </div>

                {/* Order history */}
                {expanded === c.id && (
                  <div className="bg-muted/30 px-4 pb-4 pt-2 space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                      Issued eSIMs
                    </p>
                    {custOrders.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No eSIMs yet. Go to Browse Catalogue to place an order for this customer.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                        {custOrders.map((o) => (
                          <div key={o.id} className="rounded-lg border bg-background p-3 space-y-2">
                            <div className="flex items-start gap-2">
                              <div className="flex items-center justify-center w-7 h-7 rounded-md bg-muted shrink-0 mt-0.5">
                                <Wifi className="size-3.5 text-muted-foreground" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-semibold leading-tight">{o.packageTitle}</p>
                                <p className="text-xs text-muted-foreground font-mono">{o.esimNumber ?? '—'}</p>
                              </div>
                            </div>
                            <div className="flex items-center justify-between text-xs border-t pt-2">
                              <span className="text-muted-foreground">{formatDate(o.createdAt)}</span>
                              <span className="font-bold text-primary">${o.total.toFixed(2)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Add Customer Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Customer</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAdd} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Full Name</Label>
              <Input
                placeholder="e.g. Ahmed Al-Rashid"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Email Address</Label>
              <Input
                type="email"
                placeholder="customer@example.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input
                  placeholder="+971 50 123 4567"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Country</Label>
                <Popover open={countryOpen} onOpenChange={setCountryOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      className={cn(
                        'w-full justify-between font-normal',
                        !form.country && 'text-muted-foreground',
                      )}
                    >
                      {form.country || 'Select country'}
                      <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[240px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search country…" />
                      <CommandList>
                        <CommandEmpty>No country found.</CommandEmpty>
                        <CommandGroup>
                          {COUNTRIES.map((name) => (
                            <CommandItem
                              key={name}
                              value={name}
                              onSelect={() => {
                                setForm({ ...form, country: name })
                                setCountryOpen(false)
                              }}
                            >
                              <Check
                                className={cn(
                                  'mr-2 size-4',
                                  form.country === name ? 'opacity-100' : 'opacity-0',
                                )}
                              />
                              {name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Adding…' : 'Add Customer'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Allocate a package to a specific customer */}
      <AllocatePackageDialog
        open={!!allocateFor}
        onOpenChange={(o) => { if (!o) setAllocateFor(null) }}
        customer={allocateFor}
        walletBalance={me?.walletBalance ?? 0}
        onIssued={handleIssued}
      />

      {/* Issued eSIM (QR + email) */}
      <EsimResultDialog
        open={resultOpen}
        onOpenChange={setResultOpen}
        packageTitle={result?.title ?? ''}
        customerName={result?.customer ?? ''}
        esim={result?.esim ?? null}
        orderId={result?.orderId ?? ''}
        customerEmail={result?.customerEmail ?? ''}
      />
    </div>
  )
}
