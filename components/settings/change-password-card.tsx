'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'

/** New-password policy shown in the placeholder: ≥8 chars, 1 uppercase, 1 number. */
function passwordProblem(pw: string): string | null {
  if (pw.length < 8) return 'New password must be at least 8 characters.'
  if (!/[A-Z]/.test(pw)) return 'New password must include an uppercase letter.'
  if (!/[0-9]/.test(pw)) return 'New password must include a number.'
  return null
}

export function ChangePasswordCard() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)

  async function update() {
    if (!current) {
      toast.error('Enter your current password.')
      return
    }
    const problem = passwordProblem(next)
    if (problem) {
      toast.error(problem)
      return
    }
    if (next !== confirm) {
      toast.error('New passwords do not match.')
      return
    }
    if (next === current) {
      toast.error('New password must be different from the current one.')
      return
    }

    setSaving(true)
    const supabase = createClient()

    // Verify the current password by re-authenticating the signed-in user first.
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user?.email) {
      setSaving(false)
      toast.error('Your session has expired. Please sign in again.')
      return
    }
    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: current,
    })
    if (reauthError) {
      setSaving(false)
      toast.error('Current password is incorrect.')
      return
    }

    // Current password verified — set the new one.
    const { error: updateError } = await supabase.auth.updateUser({ password: next })
    setSaving(false)
    if (updateError) {
      toast.error('Could not update password', { description: updateError.message })
      return
    }

    setCurrent('')
    setNext('')
    setConfirm('')
    toast.success('Password updated', { description: 'Use your new password next time you sign in.' })
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Lock className="size-4 text-muted-foreground" />
          <CardTitle className="text-base">Change Password</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label>Current Password</Label>
          <Input
            type="password"
            placeholder="••••••••"
            value={current}
            autoComplete="current-password"
            onChange={(e) => setCurrent(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>New Password</Label>
            <Input
              type="password"
              placeholder="Min. 8 chars, 1 uppercase, 1 number"
              value={next}
              autoComplete="new-password"
              onChange={(e) => setNext(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Confirm New Password</Label>
            <Input
              type="password"
              placeholder="Repeat new password"
              value={confirm}
              autoComplete="new-password"
              onChange={(e) => setConfirm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') update()
              }}
            />
          </div>
        </div>
        <div className="flex justify-end">
          <Button size="sm" variant="outline" onClick={update} disabled={saving}>
            {saving ? 'Updating…' : 'Update Password'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
