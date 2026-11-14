import { useEffect, useState } from 'react'

/** Returns `value`, but only after it has stopped changing for `delayMs`. */
export function useDebounced(value, delayMs = 300) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(id)
  }, [value, delayMs])
  return debounced
}
