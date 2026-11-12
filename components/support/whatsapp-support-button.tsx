'use client'

// eTijwaal support line: +973 6655 5247 → wa.me needs digits only, no "+".
const SUPPORT_NUMBER = '97366555247'
// Pre-filled so the customer just adds their question and hits send.
const PREFILL = 'Hi eTijwaal, I need help with…'

/** WhatsApp glyph (brand mark) — lucide has no WhatsApp icon, so we inline it. */
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.945C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 018.413 3.488 11.824 11.824 0 013.48 8.413c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.51 5.26l-.999 3.648 3.978-1.185zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.767.967-.94 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
    </svg>
  )
}

/**
 * Floating "Chat on WhatsApp" support button, fixed to the bottom-right on every
 * page. Opens a WhatsApp chat (app on mobile, web on desktop) with eTijwaal
 * support, pre-filled with a starter message. Sits at z-40 so modal overlays
 * (z-50) still cover it, and clear of the top-right toasts.
 */
export function WhatsAppSupportButton() {
  const href = `https://wa.me/${SUPPORT_NUMBER}?text=${encodeURIComponent(PREFILL)}`

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with eTijwaal support on WhatsApp"
      title="Chat with support on WhatsApp"
      className="group fixed bottom-5 right-5 z-40 flex items-center gap-0 focus:outline-none"
    >
      {/* Label pill — revealed on hover/focus on pointer-capable, wider screens. */}
      <span className="pointer-events-none mr-2 hidden max-w-0 overflow-hidden whitespace-nowrap rounded-full bg-card py-2 pl-0 pr-0 text-sm font-medium text-foreground opacity-0 shadow-md ring-1 ring-black/5 transition-all duration-300 group-hover:max-w-xs group-hover:px-3.5 group-hover:opacity-100 group-focus-visible:max-w-xs group-focus-visible:px-3.5 group-focus-visible:opacity-100 motion-reduce:transition-none sm:inline-block">
        Chat with support
      </span>

      {/* Green bubble */}
      <span className="flex size-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg shadow-[#25D366]/30 ring-1 ring-black/5 transition-transform duration-200 group-hover:scale-105 group-active:scale-95 group-focus-visible:ring-2 group-focus-visible:ring-[#25D366] group-focus-visible:ring-offset-2 motion-reduce:transition-none motion-reduce:group-hover:scale-100">
        <WhatsAppIcon className="size-7" />
      </span>
    </a>
  )
}
