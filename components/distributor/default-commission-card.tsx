'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Percent, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'

interface Props {
  initialValue: number
  onSaved?: (value: number) => void
}

/**
 * Lets a main distributor set the default commission % that pre-fills their
 * sub-distributor top-ups. Saved via the role-aware settings route.
 */
export function DefaultCommissionCard({ initialValue, onSaved }: Props) {
  const [value, setValue] = useState(String(initialValue ?? 0))
  const [saving, setSaving] = useState(false)

  // A commission of 0 would mean sub top-ups earn the distributor nothing, so we
  // require a value greater than 0 (up to 100).
  const pctValue = Number(value)
  const valid = Number.isFinite(pctValue) && pctValue > 0 && pctValue <= 100

  async function save() {
    if (!valid) {
      toast.error('Enter a commission % greater than 0 (up to 100).')
      return
    }
    const pct = pctValue
    setSaving(true)
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/settings/default-commission', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token ?? ''}`,
      },
      body: JSON.stringify({ defaultCommissionPercent: pct }),
    })
    const json = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) {
      toast.error('Could not save', { description: json.error ?? 'Please try again.' })
      return
    }
    toast.success('Default commission saved', { description: `Sub top-ups will pre-fill ${pct}%.` })
    onSaved?.(pct)
  }

  return (
    <Card>
      <CardContent className="p-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Percent className="size-4 text-muted-foreground" />
            <Label>Default commission % for sub top-ups</Label>
          </div>
          <div className="relative w-40">
            <Input
              type="number" min={0} max={100} step="0.1"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="pr-7"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Pre-filled when you top up a sub-distributor. Must be greater than 0% so every top-up
            earns you a commission.
          </p>
        </div>
        <Button size="sm" onClick={save} disabled={saving || !valid}>
          <Save className="size-3.5 mr-1.5" />
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </CardContent>
    </Card>
  )
}
