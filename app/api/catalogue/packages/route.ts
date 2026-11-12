import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  fetchCataloguePackages,
  EtijwaalError,
  type CatalogueType,
} from '@/lib/etijwaal-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// The six currency codes the live API supports; every package comes back priced
// in each so the UI can switch display currency without re-fetching.
const CURRENCY_CODES = ['USD', 'AED', 'BHD', 'GBP', 'SAR', 'EUR']

const VALID_TYPES: CatalogueType[] = ['global', 'local', 'regional']

/**
 * GET /api/catalogue/packages?type=local&id=58
 * Returns the plans for a single destination (all currencies). `id` is required
 * for local/regional, omitted for global.
 */
export async function GET(request: Request) {
  const admin = createAdminClient()
  const token = (request.headers.get('Authorization') ?? '').replace('Bearer ', '')
  const {
    data: { user },
  } = token ? await admin.auth.getUser(token) : { data: { user: null } }
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type') as CatalogueType | null
  const idParam = searchParams.get('id')

  if (!type || !VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: 'Invalid or missing type.' }, { status: 400 })
  }
  const id = type === 'global' ? null : Number(idParam)
  if (type !== 'global' && !Number.isInteger(id as number)) {
    return NextResponse.json({ error: 'A destination id is required.' }, { status: 400 })
  }

  try {
    const packages = await fetchCataloguePackages({ type, id, currencyCodes: CURRENCY_CODES })
    return NextResponse.json({ packages })
  } catch (e) {
    const message =
      e instanceof EtijwaalError ? e.message : 'Could not load packages from eTijwaal.'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
