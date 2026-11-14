import { useEffect, useState } from 'react'
import { api } from '../api.js'

// The rate card never changes while the app runs, so it is fetched once
// and shared by every component that needs it.
let cached = null
let pending = null

/** Returns { config, error } where config is the /api/config response. */
export function useConfig() {
  const [config, setConfig] = useState(cached)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (cached) return
    pending ??= api.get('/config').then((data) => (cached = data))
    pending.then(setConfig).catch((err) => {
      pending = null // allow a retry on the next mount
      setError(err.message)
    })
  }, [])

  return { config, error }
}

/** Display label for a vehicle type, e.g. "BIKE" -> "Two-Wheeler". */
export function vehicleLabel(config, type) {
  return config?.vehicle_labels?.[type] ?? type
}
