'use client'

import { useState } from 'react'
import { ArrowLeft, Globe } from 'lucide-react'
import { destinationImage, gradientFor, flagUrl } from '@/lib/featured-destinations'
import { FallbackImg } from '@/components/catalogue/fallback-img'

interface DestinationHeroProps {
  name: string
  /** Bundled photo slug (featured destinations). */
  slug?: string
  /** ISO code → flag. Omit for regions/global. */
  countryCode?: string
  isRegion?: boolean
  /** Formatted starting price, e.g. "$4.00". */
  startingPrice?: string | null
  onBack: () => void
  /** eTijwaal destination photo (proxied). Preferred over the bundled photo. */
  apiPhoto?: string | null
  /** eTijwaal flag image (proxied). Preferred over the flagcdn flag. */
  apiFlag?: string | null
}

export function DestinationHero({
  name,
  slug,
  countryCode,
  isRegion,
  startingPrice,
  onBack,
  apiPhoto,
  apiFlag,
}: DestinationHeroProps) {
  const [photoDead, setPhotoDead] = useState(false)
  const [flagDead, setFlagDead] = useState(false)

  const photoCandidates = [apiPhoto, slug ? destinationImage(slug) : null]
  const showPhoto = photoCandidates.some(Boolean) && !photoDead

  const flagCandidates = [apiFlag, countryCode && !isRegion ? flagUrl(countryCode, 160) : null]
  const showFlag = flagCandidates.some(Boolean) && !flagDead

  return (
    <div
      className="relative overflow-hidden rounded-xl"
      style={showPhoto ? undefined : { backgroundImage: gradientFor(slug ?? name) }}
    >
      {showPhoto && (
        <FallbackImg
          candidates={photoCandidates}
          alt={name}
          className="absolute inset-0 h-full w-full object-cover"
          onExhausted={() => setPhotoDead(true)}
        />
      )}
      <div className="absolute inset-0 bg-linear-to-r from-black/80 via-black/55 to-black/25" />

      <div className="relative z-10 p-5 sm:p-7">
        <button
          type="button"
          onClick={onBack}
          className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <ArrowLeft className="size-4" /> All destinations
        </button>

        <div className="flex items-start gap-3 sm:gap-4">
          {/* Flag / region badge */}
          <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white/90 shadow sm:size-14">
            {showFlag ? (
              <FallbackImg
                candidates={flagCandidates}
                alt=""
                className="h-full w-full object-cover"
                onExhausted={() => setFlagDead(true)}
              />
            ) : (
              <Globe className="size-7 text-slate-600" />
            )}
          </div>

          <div className="min-w-0 space-y-1.5">
            <h1 className="text-xl font-bold text-white sm:text-3xl">
              eSIM for <span className="text-white">{name}</span>
            </h1>
            <p className="max-w-xl text-sm text-white/80">
              Stay connected with high-speed data across {name}. No physical SIM needed — instant
              activation on arrival.
            </p>
            {startingPrice && (
              <p className="pt-1 text-sm font-medium text-white/90">
                Starting Price{' '}
                <span className="text-lg font-bold text-white">{startingPrice}</span>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
