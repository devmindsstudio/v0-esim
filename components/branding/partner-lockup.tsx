import Image from 'next/image'
import { cn } from '@/lib/utils'
import { EtijwaalMark } from '@/components/branding/etijwaal-mark'

/**
 * Co-branded partner lockup: eTijwaal and ibara.ai shown as equal platform
 * partners. Both marks sit together on one dark "partner bar" (#0b1524 — the
 * navy baked into the ibara logo, so the image blends seamlessly). eTijwaal
 * uses its official logo on a white safe-area chip so the wordmark stays crisp.
 * This reads as a single intentional badge rather than two mismatched logos.
 *
 * Used on the login screen (size "lg") and in the sidebar footers (size "sm").
 */
export function PartnerLockup({
  size = 'sm',
  className = '',
}: {
  size?: 'sm' | 'lg'
  className?: string
}) {
  const lg = size === 'lg'
  return (
    <div
      className={cn(
        'mx-auto flex w-fit items-center rounded-xl bg-[#0b1524] ring-1 ring-white/10',
        lg ? 'gap-4 px-5 py-3' : 'gap-2.5 px-3 py-2',
        className,
      )}
    >
      {/* eTijwaal — official logo on a white safe-area chip */}
      <EtijwaalMark imgClassName={cn('w-auto', lg ? 'h-8' : 'h-6')} priority={lg} />

      {/* Divider */}
      <span aria-hidden className={cn('w-px shrink-0 bg-white/20', lg ? 'h-9' : 'h-7')} />

      {/* ibara.ai — blends into the dark bar */}
      <Image
        src="/ibara.png"
        alt="ibara.ai"
        width={676}
        height={188}
        priority={lg}
        className={cn('w-auto', lg ? 'h-8' : 'h-6')}
      />
    </div>
  )
}
