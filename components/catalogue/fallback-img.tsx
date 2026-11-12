'use client'

import { useState } from 'react'

interface FallbackImgProps {
  /**
   * Image sources in priority order. The first that loads wins; each onError
   * advances to the next. Falsy entries are ignored, so you can pass
   * `[apiUrl, bundledUrl]` where either may be null.
   */
  candidates: (string | null | undefined)[]
  alt: string
  className?: string
  loading?: 'lazy' | 'eager'
  /** Called once every candidate has failed, so the parent can show a fallback. */
  onExhausted?: () => void
}

/**
 * An <img> that walks a list of candidate URLs, falling through on error. Used
 * for the destination photo/flag chain: eTijwaal image → bundled asset → (parent
 * renders a gradient/globe once onExhausted fires). Keeps the fallback logic in
 * one place instead of juggling several *Failed booleans per component.
 */
export function FallbackImg({ candidates, alt, className, loading, onExhausted }: FallbackImgProps) {
  const srcs = candidates.filter((c): c is string => !!c)
  // Tie the current index to the candidate list, so if the list changes (new
  // destination) we restart from the first source instead of a stale index.
  const listId = srcs.join('|')
  const [trackedList, setTrackedList] = useState('')
  const [index, setIndex] = useState(0)
  const i = trackedList === listId ? index : 0

  if (srcs.length === 0 || i >= srcs.length) return null

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={srcs[i]}
      alt={alt}
      className={className}
      loading={loading}
      onError={() => {
        const next = i + 1
        setTrackedList(listId)
        setIndex(next)
        if (next >= srcs.length) onExhausted?.()
      }}
    />
  )
}
