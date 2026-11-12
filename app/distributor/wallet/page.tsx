'use client'

import { useEffect, useState } from 'react'
import { Wallet, ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from '@/components/ui/table'
import { getCurrentDistributor, type CurrentDistributor } from '@/lib/supabase/auth'
import { getWalletTransactions, isCredit, type WalletTx } from '@/lib/wallet'

const TYPE_LABEL: Record<WalletTx['type'], string> = {
  allocation: 'Allocation',
  topup: 'Top-up',
  refund: 'Refund',
  debit: 'Purchase',
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export default function DistributorWalletPage() {
  const [session, setSession] = useState<CurrentDistributor | null>(null)
  const [txs, setTxs] = useState<WalletTx[]>([])

  useEffect(() => {
    getCurrentDistributor().then((d) => {
      setSession(d)
      if (d) getWalletTransactions(d.id).then(setTxs)
    })
  }, [])

  if (!session) return null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Wallet</h1>
        <p className="text-muted-foreground">Your credit balance and transaction history.</p>
      </div>

      {/* Summary Card */}
      <div className="sm:max-w-xs">
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-muted">
              <Wallet className="size-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">${session.walletBalance.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Current Credits</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transaction History */}
      <div>
        <h2 className="text-base font-semibold mb-3">Transaction History</h2>
        <div className="rounded-md border">
          {txs.length === 0 ? (
            <div className="text-center text-muted-foreground py-10 text-sm">
              No transactions yet. Credit allocated to your wallet will appear here.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Balance After</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {txs.map((tx) => {
                  const credit = isCredit(tx.type)
                  return (
                    <TableRow key={tx.id}>
                      <TableCell className="text-sm">
                        {tx.note || TYPE_LABEL[tx.type]}
                      </TableCell>
                      <TableCell>
                        {credit ? (
                          <div className="flex items-center gap-1 text-green-600 text-xs font-medium">
                            <ArrowDownLeft className="size-3" /> {TYPE_LABEL[tx.type]}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-orange-600 text-xs font-medium">
                            <ArrowUpRight className="size-3" /> {TYPE_LABEL[tx.type]}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-sm">
                        {credit ? (
                          <span className="text-green-600">+${tx.amount.toLocaleString()}</span>
                        ) : (
                          <span>-${tx.amount.toLocaleString()}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        ${tx.balanceAfter.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(tx.createdAt)}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </div>
  )
}
