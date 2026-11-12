'use client'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { MoreHorizontal, CheckCircle, Ban, Trash2, Wallet, Clock } from 'lucide-react'
import { DistributorStatusBadge } from '@/components/distributors/distributor-status-badge'
import { type Distributor, type DistributorStatus } from '@/lib/distributors-store'

interface DistributorTableProps {
  distributors: Distributor[]
  onStatusChange: (id: string, status: DistributorStatus) => void
  onDelete: (id: string) => void
  /** When provided, adds an "Allocate credit" action to each row. */
  onAllocate?: (id: string) => void
  /** When provided, clicking a row opens that distributor (e.g. their detail page). */
  onView?: (id: string) => void
  /**
   * True when a search/status filter is active. Drives the empty state: a
   * filtered-but-empty list shows "no matches" (NOT the "add your first" prompt,
   * which only makes sense when there are genuinely none yet).
   */
  isFiltered?: boolean
  /** Singular noun for the empty-state copy (e.g. "sub-distributor"). */
  noun?: string
}

function formatCurrency(value: number): string {
  return `$${value.toLocaleString()}`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function DistributorTable({
  distributors,
  onStatusChange,
  onDelete,
  onAllocate,
  onView,
  isFiltered = false,
  noun = 'distributor',
}: DistributorTableProps) {
  if (distributors.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-muted-foreground text-sm">
          {isFiltered ? `No ${noun}s match your search.` : `No ${noun}s found.`}
        </p>
        {!isFiltered && (
          <p className="text-muted-foreground text-xs mt-1">
            Add your first {noun} using the button above.
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Distributor</TableHead>
            <TableHead>Country</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead className="text-right">Wallet Balance</TableHead>
            <TableHead className="text-right">eSIMs (30d)</TableHead>
            <TableHead className="text-right">Revenue (30d)</TableHead>
            <TableHead>Joined</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {distributors.map((distributor) => (
            <TableRow
              key={distributor.id}
              className={onView ? 'group cursor-pointer hover:bg-muted/50' : undefined}
              onClick={onView ? () => onView(distributor.id) : undefined}
            >
              <TableCell>
                <div>
                  <p className="font-medium text-sm group-hover:text-primary group-hover:underline">
                    {distributor.name}
                  </p>
                  <p className="text-xs text-muted-foreground">{distributor.company}</p>
                </div>
              </TableCell>
              <TableCell className="text-sm">{distributor.country}</TableCell>
              <TableCell>
                <DistributorStatusBadge status={distributor.status} />
              </TableCell>
              <TableCell>
                <div>
                  <p className="text-xs">{distributor.email}</p>
                  <p className="text-xs text-muted-foreground">{distributor.whatsapp}</p>
                </div>
              </TableCell>
              <TableCell className="text-right text-sm">
                {formatCurrency(distributor.walletBalance)}
              </TableCell>
              <TableCell className="text-right text-sm">{distributor.esimsSold30d}</TableCell>
              <TableCell className="text-right text-sm">
                {formatCurrency(distributor.revenue30d)}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatDate(distributor.createdAt)}
              </TableCell>
              <TableCell onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-end gap-1">
                  {onAllocate && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1.5"
                      disabled={distributor.status === 'suspended'}
                      title={
                        distributor.status === 'suspended'
                          ? 'Reactivate this distributor to top up'
                          : undefined
                      }
                      onClick={() => onAllocate(distributor.id)}
                    >
                      <Wallet className="size-3.5 text-primary" />
                      Top-up
                    </Button>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="size-4" />
                        <span className="sr-only">Open menu</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {onAllocate && (
                        <DropdownMenuItem
                          disabled={distributor.status === 'suspended'}
                          onClick={() => onAllocate(distributor.id)}
                        >
                          <Wallet className="size-4 mr-2 text-primary" />
                          Top-up
                        </DropdownMenuItem>
                      )}
                      {distributor.status !== 'active' && (
                        <DropdownMenuItem
                          onClick={() => onStatusChange(distributor.id, 'active')}
                        >
                          <CheckCircle className="size-4 mr-2 text-green-600" />
                          Activate
                        </DropdownMenuItem>
                      )}
                      {distributor.status !== 'pending' && (
                        <DropdownMenuItem
                          onClick={() => onStatusChange(distributor.id, 'pending')}
                        >
                          <Clock className="size-4 mr-2 text-yellow-600" />
                          Mark as pending
                        </DropdownMenuItem>
                      )}
                      {distributor.status !== 'suspended' && (
                        <DropdownMenuItem
                          onClick={() => onStatusChange(distributor.id, 'suspended')}
                        >
                          <Ban className="size-4 mr-2 text-red-600" />
                          Suspend
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => onDelete(distributor.id)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="size-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
