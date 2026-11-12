'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { DistributorDetailView } from '@/components/distributors/distributor-detail-view'
import { getCurrentDistributor } from '@/lib/supabase/auth'
import { getSubDistributorDetail, type DistributorDetail } from '@/lib/distributor-detail'

const EMPTY: DistributorDetail = {
  profile: null,
  subCount: 0,
  purchases: [],
  topUps: [],
  totalProfit: 0,
  realProfit: 0,
}

export default function SubDistributorDetailPage() {
  const params = useParams()
  const id = String(params.id)
  const [detail, setDetail] = useState<DistributorDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    getCurrentDistributor().then(async (me) => {
      const canView = me && me.role === 'distributor'
      const d = canView ? await getSubDistributorDetail(me.id, id) : EMPTY
      if (!active) return
      setDetail(d)
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [id])

  // Sale prices are read-only in the distributor portal — they're set when the
  // order is placed; only an admin can correct a recorded sale price afterwards.
  return (
    <DistributorDetailView
      detail={detail}
      loading={loading}
      backHref="/distributor/sub-distributors"
      backLabel="Back to sub-distributors"
      notFoundText="Sub-distributor not found in your network."
    />
  )
}
