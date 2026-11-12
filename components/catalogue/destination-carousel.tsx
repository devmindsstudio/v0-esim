'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface DestinationCarouselProps {
  title: string
  children: ReactNode
}

/**
 * A titled, horizontally-scrollable row of destination cards. Each arrow is
 * shown only while there is more to scroll in that direction — the right arrow
 * disappears at the end of the list, the left arrow at the start, and both are
 * hidden when every card already fits without scrolling.
 */
export function DestinationCarousel({ title, children }: DestinationCarouselProps) {
  const scroller = useRef<HTMLDivElement>(null)
  const [canLeft, setCanLeft] = useState(false)
  const [canRight, setCanRight] = useState(false)

  function update() {
    const el = scroller.current
    if (!el) return
    // 1px tolerance absorbs sub-pixel rounding at the extremes.
    setCanLeft(el.scrollLeft > 1)
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1)
  }

  // Recompute after each render (covers packages loading in / a Refresh swapping
  // the cards) and on resize. State setters bail out when the value is unchanged,
  // so running this every render doesn't loop.
  useEffect(() => {
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  })

  function scrollBy(dir: 1 | -1) {
    scroller.current?.scrollBy({ left: dir * 320, behavior: 'smooth' })
  }

  return (
    <section className="space-y-3">
      <div className="flex min-h-8 items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        {(canLeft || canRight) && (
          <div className="flex items-center gap-1.5">
            {canLeft && (
              <button
                type="button"
                onClick={() => scrollBy(-1)}
                aria-label={`Scroll ${title} left`}
                className="flex size-8 items-center justify-center rounded-full border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <ChevronLeft className="size-4" />
              </button>
            )}
            {canRight && (
              <button
                type="button"
                onClick={() => scrollBy(1)}
                aria-label={`Scroll ${title} right`}
                className="flex size-8 items-center justify-center rounded-full border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <ChevronRight className="size-4" />
              </button>
            )}
          </div>
        )}
      </div>

      <div
        ref={scroller}
        onScroll={update}
        className="flex gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
    </section>
  )
}
