import { useEffect, useState } from 'react'
import { api } from '../api.js'
import PageHeader from '../components/PageHeader.jsx'
import FeeBreakdown from '../components/FeeBreakdown.jsx'
import VehicleTypePicker from '../components/VehicleTypePicker.jsx'
import Icon from '../components/Icon.jsx'
import { Loading } from '../components/EmptyState.jsx'
import { useDebounced } from '../hooks/useDebounced.js'
import { addDays, localInputToISO, todayIST } from '../utils/format.js'

// Ready-made scenarios for the viva. Times are on today's date (IST);
// exitDays = 1 means the exit is on the next day.
const PRESETS = [
  { label: '2h 40m day', entry: '10:00', exit: '12:40', exitDays: 0 },
  { label: 'Overnight 9PM–2AM', entry: '21:00', exit: '02:00', exitDays: 1 },
  { label: 'Full day (cap)', entry: '08:00', exit: '08:00', exitDays: 1 },
  { label: 'Grace (10 min)', entry: '10:00', exit: '10:10', exitDays: 0 },
]

function presetTimes(preset, today) {
  return {
    entry: `${today}T${preset.entry}`,
    exit: `${addDays(today, preset.exitDays)}T${preset.exit}`,
  }
}

/** "What would this cost?" — calls /api/quote, saves nothing. */
export default function Simulator() {
  const today = todayIST()
  const [type, setType] = useState('CAR')
  const [times, setTimes] = useState(() => presetTimes(PRESETS[0], today))
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  // Recalculate shortly after the user stops changing the form.
  const request = useDebounced(JSON.stringify({ type, ...times }), 250)

  useEffect(() => {
    const { type: vehicleType, entry, exit } = JSON.parse(request)
    if (!entry || !exit) return undefined
    let cancelled = false
    api
      .post('/quote', {
        vehicle_type: vehicleType,
        entry_time: localInputToISO(entry),
        exit_time: localInputToISO(exit),
      })
      .then((data) => {
        if (!cancelled) {
          setResult(data)
          setError(null)
        }
      })
      .catch((err) => !cancelled && setError(err.message))
    return () => {
      cancelled = true
    }
  }, [request])

  const activePreset = PRESETS.find((p) => {
    const t = presetTimes(p, today)
    return t.entry === times.entry && t.exit === times.exit
  })

  return (
    <>
      <PageHeader
        title="Fee Simulator"
        subtitle="Try any entry and exit time to see exactly how the fee is worked out. Nothing is saved."
      />

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-5 lg:col-span-2">
          <div className="card space-y-5 p-5">
            <div>
              <p className="field-label">Presets</p>
              <div className="grid grid-cols-2 gap-2">
                {PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => setTimes(presetTimes(preset, today))}
                    className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                      activePreset === preset
                        ? 'border-brand-600 bg-brand-50 text-brand-800'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="field-label">Vehicle type</p>
              <VehicleTypePicker value={type} onChange={setType} compact />
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <div>
                <label htmlFor="sim-entry" className="field-label">Entry time</label>
                <input
                  id="sim-entry"
                  type="datetime-local"
                  value={times.entry}
                  onChange={(e) => setTimes({ ...times, entry: e.target.value })}
                  className="input"
                />
              </div>
              <div>
                <label htmlFor="sim-exit" className="field-label">Exit time</label>
                <input
                  id="sim-exit"
                  type="datetime-local"
                  value={times.exit}
                  onChange={(e) => setTimes({ ...times, exit: e.target.value })}
                  className="input"
                />
              </div>
            </div>
          </div>

          <p className="px-1 text-xs text-slate-500">
            Each hour block is priced by the time it <strong>starts</strong>, so a block starting at 9:59 PM is
            a day block. Open “Hour-by-hour” to see every block.
          </p>
        </div>

        <div className="card p-5 lg:col-span-3">
          <h2 className="mb-4 flex items-center gap-2 font-semibold text-slate-900">
            <Icon name="calculator" className="size-5 text-slate-400" />
            Result
          </h2>
          {error ? (
            <p className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              <Icon name="alert" className="size-4 shrink-0" />
              {error}
            </p>
          ) : result ? (
            <FeeBreakdown breakdown={result} />
          ) : (
            <Loading label="Calculating…" />
          )}
        </div>
      </div>
    </>
  )
}
