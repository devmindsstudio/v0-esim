import Image from 'next/image'
import { EtijwaalMark } from '@/components/branding/etijwaal-mark'

/**
 * Co-brand banner shown at the top of every dashboard (admin + distributor +
 * sub-distributor): "eTijwaal — powered by ibara". A dark navy strip (so the
 * ibara logo's baked-in background blends in) with a drifting brand-gradient
 * glow and a slow sheen sweep. Motion is subtle and respects reduced-motion.
 */
export function BrandBanner() {
  return (
    <div className="brand-banner-in relative overflow-hidden rounded-2xl border border-white/10 bg-brand-navy px-5 py-4 shadow-(--shadow-brand) sm:px-7">
      {/* Drifting brand-gradient glows */}
      <span
        aria-hidden
        className="brand-banner-glow pointer-events-none absolute -left-12 -top-16 h-48 w-48 rounded-full bg-brand-gradient opacity-60 blur-3xl"
      />
      <span
        aria-hidden
        style={{ animationDelay: '-4s' }}
        className="brand-banner-glow pointer-events-none absolute -bottom-20 -right-10 h-48 w-48 rounded-full bg-brand-gradient opacity-40 blur-3xl"
      />
      {/* Sheen sweep */}
      <span
        aria-hidden
        className="brand-banner-sheen pointer-events-none absolute inset-y-0 left-[-60%] w-2/5 bg-linear-to-r from-transparent via-white/15 to-transparent"
      />

      {/* Co-branded content */}
      <div className="relative z-10 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-center">
        <EtijwaalMark imgClassName="h-8 w-auto" priority />

        <span className="text-[11px] font-semibold uppercase tracking-[0.25em] text-white/55">
          powered by
        </span>

        <Image
          src="/ibara.png"
          alt="ibara.ai"
          width={676}
          height={188}
          priority
          className="h-8 w-auto"
        />
      </div>
    </div>
  )
}
