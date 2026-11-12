'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { CreditCard } from 'lucide-react'
import { AllocateCreditDialog } from '@/components/dashboard/allocate-credit-dialog'

export function QuickActions() {
  const [open, setOpen] = useState(false)

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button className="gap-2" onClick={() => setOpen(true)}>
        <CreditCard className="size-4" />
        Allocate Credit
      </Button>

      <AllocateCreditDialog open={open} onOpenChange={setOpen} />
    </div>
  )
}
