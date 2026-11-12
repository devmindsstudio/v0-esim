import Image from 'next/image'
import { cn } from '@/lib/utils'

/**
 * Official eTijwaal brand logo. The artwork is a teal "e" mark with a grey
 * "Tijwaal / Anywhere, Anytime" wordmark on a transparent background — designed
 * for LIGHT surfaces. Our co-brand areas are dark navy (so the ibara logo's
 * baked-in navy blends in), where the grey wordmark would wash out. So we seat
 * the logo on a small white "safe-area" chip; it stays crisp and legible while
 * ibara continues to sit directly on the navy beside it.
 *
 * Intrinsic size 128×44. Control the rendered height with `imgClassName`
 * (e.g. "h-6 w-auto"); the chip padding scales with it.
 */
export function EtijwaalMark({
  className,
  imgClassName = 'h-6 w-auto',
  priority = false,
}: {
  className?: string
  imgClassName?: string
  priority?: boolean
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-lg bg-white px-2 py-1 shadow-sm ring-1 ring-black/5',
        className,
      )}
    >
      <Image
        src="/eTijwal_Logo_Test.webp"
        alt="eTijwaal — Anywhere, Anytime"
        width={128}
        height={44}
        priority={priority}
        className={imgClassName}
      />
    </span>
  )
}
