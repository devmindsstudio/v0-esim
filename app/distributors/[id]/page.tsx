'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { DistributorDetailView } from '@/components/distributors/distributor-detail-view'
import { getDistributorDetail, type DistributorDetail } from '@/lib/distributor-detail'

export default function DistributorDetailPage() {
  const params = useParams()
  const id = String(params.id)
  const [detail, setDetail] = useState<DistributorDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    getDistributorDetail(id).then((d) => {
      if (!active) return
      setDetail(d)
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [id])

  // Sale prices are read-only: a fulfilled order is a completed sale and its
  // recorded price must not change after the fact.
  return (
    <DistributorDetailView
      detail={detail}
      loading={loading}
      backHref="/distributors"
      backLabel="Back to distributors"
    />
  )
}
