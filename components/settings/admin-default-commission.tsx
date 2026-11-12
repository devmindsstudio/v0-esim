'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Percent, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { getGlobalDefaultCommission } from '@/lib/settings'

/**
 * Admin card to set the GLOBAL default commission % that pre-fills every
 * admin → distributor top-up. Reads/writes app_settings via the settings route.
 */
export function AdminDefaultCommission() {
  const [value, setValue] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getGlobalDefaultCommission().then((v) => {
      setValue(String(v))
      setLoading(false)
    })
  }, [])

  async function save() {
    const pct = Number(value)
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      toast.error('Enter a commission % between 0 and 100.')
      return
    }
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
    toast.success('Default commission saved', { description: `Distributor top-ups will pre-fill ${pct}%.` })
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Percent className="size-4 text-muted-foreground" />
          <CardTitle className="text-base">Default Commission</CardTitle>
        </div>
        <CardDescription>
          Pre-filled on every top-up to a distributor. It can still be changed for any single top-up.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5 sm:max-w-xs">
          <Label>Default commission %</Label>
          <div className="relative">
            <Input
              type="number" min={0} max={100} step="0.1"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="pr-7"
              disabled={loading}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
          </div>
        </div>
        <div className="flex justify-end">
          <Button size="sm" onClick={save} disabled={saving || loading}>
            <Save className="size-3.5 mr-1.5" />
            {saving ? 'Saving…' : 'Save Changes'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
