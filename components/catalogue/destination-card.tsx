'use client'

import { useState } from 'react'
import { Globe } from 'lucide-react'
import { destinationImage, gradientFor, flagUrl } from '@/lib/featured-destinations'
import { FallbackImg } from '@/components/catalogue/fallback-img'

interface DestinationCardProps {
  name: string
  onClick: () => void
  /** 'featured' = large photo card in a carousel; 'compact' = browse-all tile. */
  variant?: 'featured' | 'compact'
  /** Featured only: the bundled photo under /images/destinations/<slug>.jpg. */
  imageSlug?: string
  /** ISO code → real flag image. Omit for regions/global. */
  countryCode?: string
  /** Show a globe icon instead of a flag (regions / global). */
  isRegion?: boolean
  /** Cheapest price in USD → "From $X" badge. null/undefined hides it. */
  fromUSD?: number | null
  /** eTijwaal destination photo (proxied). Preferred over the bundled photo. */
  apiPhoto?: string | null
  /** eTijwaal flag image (proxied). Preferred over the flagcdn flag. */
  apiFlag?: string | null
}

export function DestinationCard({
  name,
  onClick,
  variant = 'compact',
  imageSlug,
  countryCode,
  isRegion,
  fromUSD,
  apiPhoto,
  apiFlag,
}: DestinationCardProps) {
  const [photoDead, setPhotoDead] = useState(false)
  const [flagDead, setFlagDead] = useState(false)

  const gradient = gradientFor(imageSlug ?? name)

  // Photo sources in priority order: eTijwaal → our bundled asset.
  const photoCandidates = [apiPhoto, imageSlug ? destinationImage(imageSlug) : null]
  const hasPhoto = photoCandidates.some(Boolean) && !photoDead

  // Flag sources: eTijwaal → flagcdn (countries only).
  const flagCandidates = [apiFlag, countryCode && !isRegion ? flagUrl(countryCode, 160) : null]
  const hasFlag = flagCandidates.some(Boolean) && !flagDead

  // ---- Compact tile (browse-all): photo/flag banner + name below --------
  if (variant !== 'featured') {
    const showPhoto = hasPhoto
    const showFlag = !showPhoto && hasFlag
    const useGradient = !showPhoto && !showFlag
    return (
      <button
        type="button"
        onClick={onClick}
        title={`View ${name} plans`}
        className="group flex w-full flex-col overflow-hidden rounded-lg border bg-card text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <div
          className="relative flex h-16 w-full items-center justify-center overflow-hidden"
          style={useGradient ? { backgroundImage: gradient } : undefined}
        >
          {showPhoto ? (
            <FallbackImg
              candidates={photoCandidates}
              alt={name}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              onExhausted={() => setPhotoDead(true)}
            />
          ) : showFlag ? (
            <FallbackImg
              candidates={flagCandidates}
              alt={`${name} flag`}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              onExhausted={() => setFlagDead(true)}
            />
          ) : (
            <Globe className="size-6 text-white/90 drop-shadow" />
          )}
        </div>
        <div className="flex min-h-11 items-center px-2.5 py-2">
          <span className="line-clamp-2 text-sm font-medium leading-tight text-foreground">
            {name}
          </span>
        </div>
      </button>
    )
  }

  // ---- Featured card (carousel): full photo with overlaid name/price -----
  return (
    <button
      type="button"
      onClick={onClick}
      title={`View ${name} plans`}
      className="group relative flex h-40 w-56 shrink-0 flex-col justify-end overflow-hidden rounded-xl text-left shadow-sm ring-1 ring-black/5 transition-all hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:h-44 sm:w-64"
      style={hasPhoto ? undefined : { backgroundImage: gradient }}
    >
      {hasPhoto && (
        <FallbackImg
          candidates={photoCandidates}
          alt={name}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          onExhausted={() => setPhotoDead(true)}
        />
      )}

      {/* Legibility gradient so text/badges read on any background */}
      <div className="absolute inset-0 bg-linear-to-t from-black/75 via-black/25 to-black/10" />

      {/* Flag / region chip (top-left) */}
      <div className="absolute left-3 top-3 flex items-center justify-center overflow-hidden rounded-md bg-white/90 shadow-sm">
        {hasFlag ? (
          <FallbackImg
            candidates={flagCandidates}
            alt=""
            className="h-7 w-10 rounded-md object-cover"
            onExhausted={() => setFlagDead(true)}
          />
        ) : (
          <span className="flex size-8 items-center justify-center">
            <Globe className="size-5 text-slate-600" />
          </span>
        )}
      </div>

      {/* "From $X" badge (top-right) */}
      {fromUSD != null && (
        <span className="absolute right-3 top-3 rounded-full bg-red-600 px-2.5 py-1 text-xs font-semibold text-white shadow">
          From ${fromUSD.toFixed(2)}
        </span>
      )}

      {/* Name (bottom-left) */}
      <span className="relative z-10 line-clamp-2 p-3 text-base font-semibold text-white drop-shadow">
        {name}
      </span>
    </button>
  )
}
