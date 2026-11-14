import { useEffect, useRef } from 'react'

/** How often live pages (dashboard, parked list, exit preview) refetch. */
export const REFRESH_MS = 30_000

/**
 * Call `callback` every `delayMs` milliseconds while the component is shown.
 * Pass null as the delay to pause. The latest callback is always used, so
 * the caller does not need to worry about stale state.
 */
export function useInterval(callback, delayMs) {
  const saved = useRef(callback)

  useEffect(() => {
    saved.current = callback
  })

  useEffect(() => {
    if (delayMs == null) return undefined
    const id = setInterval(() => saved.current(), delayMs)
    return () => clearInterval(id)
  }, [delayMs])
}
