'use client'

import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { CheckCircle2, Copy, Mail, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { WhatsAppDeliveryButton } from '@/components/orders/whatsapp-delivery-button'
import { createClient } from '@/lib/supabase/client'

export interface IssuedEsim {
  esimNumber: string
  iccid: string
  qrPayload: string
  activationCode: string
}

interface EsimResultDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  packageTitle: string
  customerName: string
  esim: IssuedEsim | null
  orderId: string
  customerEmail: string
}

export function EsimResultDialog({
  open,
  onOpenChange,
  packageTitle,
  customerName,
  esim,
  orderId,
  customerEmail,
}: EsimResultDialogProps) {
  const [emailing, setEmailing] = useState(false)
  const [emailed, setEmailed] = useState(false)

  // Reset the email state whenever a new eSIM is shown.
  useEffect(() => {
    setEmailed(false)
    setEmailing(false)
  }, [orderId])

  if (!esim) return null

  function copy(label: string, value: string) {
    navigator.clipboard?.writeText(value)
    toast.success(`${label} copied`)
  }

  async function emailToCustomer() {
    if (!orderId) return
    setEmailing(true)
    const supabase = createClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    const res = await fetch('/api/esim/send-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token ?? ''}`,
      },
      body: JSON.stringify({ orderId }),
    })
    const json = await res.json().catch(() => ({}))
    setEmailing(false)

    if (!res.ok) {
      toast.error('Could not email eSIM', { description: json.error ?? 'Please try again.' })
      return
    }
    setEmailed(true)
    toast.success('eSIM emailed', { description: `Sent to ${json.to ?? 'the customer'}.` })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="size-5 text-green-600" />
            eSIM Issued
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{packageTitle}</span> for{' '}
            <span className="font-medium text-foreground">{customerName}</span>. Have the traveler
            scan this QR to install their eSIM.
          </p>

          {/* QR */}
          <div className="flex justify-center">
            <div className="rounded-xl border bg-white p-4">
              <QRCodeSVG value={esim.qrPayload} size={176} level="M" />
            </div>
          </div>

          {/* Details */}
          <div className="rounded-lg border divide-y text-sm">
            <button
              type="button"
              onClick={() => copy('eSIM number', esim.esimNumber)}
              className="flex w-full items-center justify-between px-3 py-2 hover:bg-muted/50 text-left"
            >
              <span className="text-muted-foreground">eSIM number</span>
              <span className="flex items-center gap-1.5 font-mono font-medium">
                {esim.esimNumber} <Copy className="size-3 text-muted-foreground" />
              </span>
            </button>
            <button
              type="button"
              onClick={() => copy('ICCID', esim.iccid)}
              className="flex w-full items-center justify-between px-3 py-2 hover:bg-muted/50 text-left"
            >
              <span className="text-muted-foreground">ICCID</span>
              <span className="flex items-center gap-1.5 font-mono font-medium">
                {esim.iccid} <Copy className="size-3 text-muted-foreground" />
              </span>
            </button>
            <button
              type="button"
              onClick={() => copy('Activation code', esim.activationCode)}
              className="flex w-full items-center justify-between px-3 py-2 hover:bg-muted/50 text-left"
            >
              <span className="text-muted-foreground">Activation code</span>
              <span className="flex items-center gap-1.5 font-mono font-medium">
                {esim.activationCode} <Copy className="size-3 text-muted-foreground" />
              </span>
            </button>
          </div>

          {/* Delivery target hint */}
          <p className="text-xs text-muted-foreground">
            {customerEmail
              ? <>Email will be sent to <span className="font-medium text-foreground">{customerEmail}</span>.</>
              : 'No email on file for this customer — add one on the Customers page to email the eSIM.'}
          </p>

          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={() => window.print()}>
              Print
            </Button>
            <Button
              variant="outline"
              onClick={emailToCustomer}
              disabled={!customerEmail || !orderId || emailing || emailed}
            >
              {emailing ? (
                <><Loader2 className="size-4 mr-1.5 animate-spin" /> Sending…</>
              ) : emailed ? (
                <><CheckCircle2 className="size-4 mr-1.5 text-green-600" /> Emailed</>
              ) : (
                <><Mail className="size-4 mr-1.5" /> Email to customer</>
              )}
            </Button>
            <WhatsAppDeliveryButton />
            <Button onClick={() => onOpenChange(false)}>Done</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
