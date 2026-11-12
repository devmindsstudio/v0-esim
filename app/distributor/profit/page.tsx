'use client'

import { useEffect, useState } from 'react'
import { DistributorDetailView } from '@/components/distributors/distributor-detail-view'
import { getCurrentDistributor } from '@/lib/supabase/auth'
import { getDistributorDetail, type DistributorDetail } from '@/lib/distributor-detail'

/**
 * "My Profit" — the distributor's own profit detail, rendered with the SAME
 * component the admin sees for this distributor: Top-up profit + Selling profit,
 * every top-up received, and every sale (their own and their sub-distributors')
 * with its margin. Sale prices are read-only here — they're set when the order
 * is placed; only an admin can correct a recorded sale price afterwards.
 */
export default function MyProfitPage() {
  const [detail, setDetail] = useState<DistributorDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    getCurrentDistributor().then(async (me) => {
      if (!me) {
        if (active) {
          setDetail(null)
          setLoading(false)
        }
        return
      }
      const d = await getDistributorDetail(me.id)
      if (!active) return
      setDetail(d)
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [])

  return (
    <DistributorDetailView
      detail={detail}
      loading={loading}
      backHref="/distributor/dashboard"
      backLabel="Back to dashboard"
      notFoundText="We couldn't load your profit details."
    />
  )
}
