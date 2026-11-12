'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  CreditCard,
  UserPlus,
  ShoppingCart,
  RotateCcw,
  AlertTriangle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getActivityFeed, type ActivityItem } from '@/lib/admin-dashboard'

function formatTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 60) {
    return `${diffMins}m ago`
  } else if (diffHours < 24) {
    return `${diffHours}h ago`
  } else {
    return `${diffDays}d ago`
  }
}

function getEventIcon(type: ActivityItem['type']) {
  switch (type) {
    case 'credit_allocation':
      return <CreditCard className="size-4" />
    case 'new_child':
      return <UserPlus className="size-4" />
    case 'large_sale':
      return <ShoppingCart className="size-4" />
    case 'refund':
      return <RotateCcw className="size-4" />
    case 'ticket_escalation':
      return <AlertTriangle className="size-4" />
    default:
      return null
  }
}

function getEventColor(type: ActivityItem['type']) {
  switch (type) {
    case 'credit_allocation':
      return 'bg-primary/10 text-primary'
    case 'new_child':
      return 'bg-chart-2/10 text-chart-2'
    case 'large_sale':
      return 'bg-chart-3/10 text-chart-3'
    case 'refund':
      return 'bg-destructive/10 text-destructive'
    case 'ticket_escalation':
      return 'bg-accent text-accent-foreground'
    default:
      return 'bg-muted text-muted-foreground'
  }
}

function formatCurrency(amount: number): string {
  const prefix = amount < 0 ? '-' : '+'
  return `${prefix}$${Math.abs(amount).toLocaleString()}`
}

export function ActivityFeed() {
  const [items, setItems] = useState<ActivityItem[]>([])

  useEffect(() => {
    getActivityFeed().then(setItems)
  }, [])

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        <ScrollArea className="h-[360px] px-6">
          <div className="space-y-4">
            {items.map((event) => (
              <div
                key={event.id}
                className="flex items-start gap-3 pb-4 border-b border-border last:border-0 last:pb-0"
              >
                <div
                  className={cn(
                    'flex items-center justify-center size-8 rounded-full shrink-0',
                    getEventColor(event.type)
                  )}
                >
                  {getEventIcon(event.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{event.description}</p>
                  {event.distributorName && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {event.distributorName}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  {event.amount !== undefined && (
                    <span
                      className={cn(
                        'text-sm font-semibold',
                        event.amount >= 0 ? 'text-chart-2' : 'text-destructive'
                      )}
                    >
                      {formatCurrency(event.amount)}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {formatTime(event.timestamp)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
