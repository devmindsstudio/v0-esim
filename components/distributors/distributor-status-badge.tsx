import { Badge } from '@/components/ui/badge'
import { type DistributorStatus } from '@/lib/distributors-store'

interface DistributorStatusBadgeProps {
  status: DistributorStatus
}

const statusConfig: Record<DistributorStatus, { label: string; className: string }> = {
  active: {
    label: 'Active',
    className: 'bg-green-500/15 text-green-600 border-green-500/20 hover:bg-green-500/15',
  },
  pending: {
    label: 'Pending',
    className: 'bg-yellow-500/15 text-yellow-600 border-yellow-500/20 hover:bg-yellow-500/15',
  },
  suspended: {
    label: 'Suspended',
    className: 'bg-red-500/15 text-red-600 border-red-500/20 hover:bg-red-500/15',
  },
  dormant: {
    label: 'Dormant',
    className: 'bg-gray-500/15 text-gray-500 border-gray-500/20 hover:bg-gray-500/15',
  },
}

export function DistributorStatusBadge({ status }: DistributorStatusBadgeProps) {
  const config = statusConfig[status]
  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  )
}
