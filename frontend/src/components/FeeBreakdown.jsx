import Icon from './Icon.jsx'
import { useConfig } from '../hooks/useConfig.js'
import { formatDateTime, formatINR } from '../utils/format.js'

/**
 * Explains a fee step by step (PRD 8.3). Used on Exit, Receipt and Simulator.
 *   1. duration + billable hours      4. capped windows (highlighted)
 *   2. grace badge (if free)          5. hour-by-hour list (collapsible)
 *   3. day hours x rate, night x rate 6. total
 */
export default function FeeBreakdown({ breakdown: b, showTotal = true, showBlocks = true }) {
  const { config } = useConfig()
  const cappedWindows = b.windows.filter((w) => w.capped)
  // The first window is always full, so its size tells us the window length (24).
  const windowSize = b.windows[0]?.hours ?? 0
  const rawTotal = b.day_hours * b.day_rate + b.night_hours * b.night_rate

  return (
    <div className="space-y-4 text-sm">
      {/* 1. Duration and billable hours */}
      <div className="grid grid-cols-2 gap-3">
        <Metric label="Duration" value={b.duration_text} />
        <Metric label="Billable hours" value={b.billable_hours} />
      </div>

      {/* 2. Grace period */}
      {b.grace_applied && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 font-medium text-emerald-800">
          <Icon name="check" className="size-4" />
          Within {config?.grace_minutes ?? '…'}-min grace period — Free
        </div>
      )}

      {/* 3. Day and night hours */}
      {!b.grace_applied && (
        <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          <RateLine icon="sun" label="Day hours" hours={b.day_hours} rate={b.day_rate} />
          <RateLine icon="moon" label="Night hours" hours={b.night_hours} rate={b.night_rate} />
          {cappedWindows.length > 0 && (
            <div className="flex justify-between px-4 py-2.5 text-slate-500">
              <span>Before daily cap</span>
              <span className="tabular-nums">{formatINR(rawTotal)}</span>
            </div>
          )}
        </div>
      )}

      {/* 4. Daily cap */}
      {cappedWindows.map((w) => (
        <div
          key={w.index}
          className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900"
        >
          <Icon name="alert" className="mt-0.5 size-4 shrink-0" />
          <span>
            <strong>Window {w.index}:</strong> {formatINR(w.raw_amount)} capped to {formatINR(w.cap)}
            <span className="block text-xs text-amber-700">
              Daily cap for hours {firstHour(w, windowSize)}–{firstHour(w, windowSize) + w.hours - 1} of the stay
            </span>
          </span>
        </div>
      ))}

      {/* 5. Hour-by-hour list */}
      {showBlocks && b.blocks.length > 0 && <HourByHour breakdown={b} />}

      {/* 6. Total */}
      {showTotal && (
        <div className="flex items-end justify-between rounded-xl bg-slate-900 px-5 py-4 text-white">
          <span className="text-sm font-medium text-slate-300">Total payable</span>
          <span className="text-4xl font-bold tracking-tight tabular-nums">{formatINR(b.total)}</span>
        </div>
      )}
    </div>
  )
}

/** Hour number where a window starts: window 1 -> hour 1, window 2 -> hour 25, ... */
function firstHour(window, windowSize) {
  return (window.index - 1) * windowSize + 1
}

function Metric({ label, value }) {
  return (
    <div className="rounded-lg bg-slate-50 px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 text-lg font-semibold text-slate-900 tabular-nums">{value}</p>
    </div>
  )
}

function RateLine({ icon, label, hours, rate }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <span className="flex items-center gap-2 text-slate-700">
        <Icon name={icon} className="size-4 text-slate-400" />
        {label}
      </span>
      <span className="tabular-nums text-slate-700">
        {hours} × {formatINR(rate)} = <strong className="text-slate-900">{formatINR(hours * rate)}</strong>
      </span>
    </div>
  )
}

export function KindBadge({ kind }) {
  const night = kind === 'NIGHT'
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
        night ? 'bg-indigo-100 text-indigo-800' : 'bg-amber-100 text-amber-800'
      }`}
    >
      <Icon name={night ? 'moon' : 'sun'} className="size-3" />
      {kind}
    </span>
  )
}

function HourByHour({ breakdown: b }) {
  const multipleWindows = b.windows.length > 1
  const windowSize = b.windows[0]?.hours ?? b.blocks.length
  return (
    <details className="group rounded-lg border border-slate-200 print:hidden">
      <summary className="flex items-center justify-between px-4 py-2.5 font-medium text-slate-700">
        Hour-by-hour ({b.blocks.length} block{b.blocks.length === 1 ? '' : 's'})
        <Icon name="chevron" className="size-4 transition group-open:rotate-180" />
      </summary>
      <div className="max-h-80 overflow-y-auto border-t border-slate-200">
        <table className="w-full">
          <thead className="table-head sticky top-0">
            <tr>
              <th className="px-4 py-2">#</th>
              <th className="px-4 py-2">Starts</th>
              <th className="px-4 py-2">Rate</th>
              <th className="px-4 py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {b.blocks.map((block) => {
              const startsWindow = multipleWindows && (block.index - 1) % windowSize === 0
              return [
                startsWindow && (
                  <tr key={`w${block.index}`} className="bg-slate-50">
                    <td colSpan={4} className="px-4 py-1.5 text-xs font-semibold text-slate-500">
                      Window {Math.floor((block.index - 1) / windowSize) + 1}
                    </td>
                  </tr>
                ),
                <tr key={block.index}>
                  <td className="px-4 py-2 text-slate-500 tabular-nums">{block.index}</td>
                  <td className="px-4 py-2 tabular-nums">{formatDateTime(block.start)}</td>
                  <td className="px-4 py-2">
                    <KindBadge kind={block.kind} />
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatINR(block.amount)}</td>
                </tr>,
              ]
            })}
          </tbody>
        </table>
      </div>
    </details>
  )
}
