import { AdminDefaultCommission } from '@/components/settings/admin-default-commission'
import { ChangePasswordCard } from '@/components/settings/change-password-card'
import { Separator } from '@/components/ui/separator'

export default function SettingsPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Account Settings</h1>
        <p className="text-muted-foreground">
          Manage your portal preferences and account configuration.
        </p>
      </div>

      <AdminDefaultCommission />

      <Separator />

      <ChangePasswordCard />
    </div>
  )
}
