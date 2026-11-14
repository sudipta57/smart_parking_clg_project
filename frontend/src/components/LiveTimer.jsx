import { useState } from 'react'
import { useInterval } from '../hooks/useInterval.js'
import { formatElapsed } from '../utils/format.js'

/** Time since `since` (an ISO string), ticking every second on the client. */
export default function LiveTimer({ since }) {
  const [now, setNow] = useState(Date.now())
  useInterval(() => setNow(Date.now()), 1000)

  const seconds = (now - Date.parse(since)) / 1000
  return <span className="font-mono tabular-nums">{formatElapsed(seconds)}</span>
}
