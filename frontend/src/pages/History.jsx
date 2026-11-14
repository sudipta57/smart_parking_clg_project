import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api.js'
import PageHeader from '../components/PageHeader.jsx'
import EmptyState, { Loading } from '../components/EmptyState.jsx'
import Icon from '../components/Icon.jsx'
import MethodPill from '../components/MethodPill.jsx'
import TypeBadge from '../components/TypeBadge.jsx'
import { useDebounced } from '../hooks/useDebounced.js'
import { addDays, formatDateTime, formatDuration, formatINR, formatLongDate, todayIST } from '../utils/format.js'

/** Completed sessions, filtered by exit date and plate. */
export default function History() {
  const navigate = useNavigate()
  const today = todayIST()
  const [day, setDay] = useState(today)
  const [search, setSearch] = useState('')
  const q = useDebounced(search, 300)
  const [rows, setRows] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false // ignore a slow response if the filters changed meanwhile
    api
      .get('/sessions/history', { date: day, q })
      .then((data) => {
        if (!cancelled) {
          setRows(data)
          setError(null)
        }
      })
      .catch((err) => !cancelled && setError(err.message))
    return () => {
      cancelled = true
    }
  }, [day, q])

  const total = (rows ?? []).reduce((sum, s) => sum + s.amount, 0)
  const quickDays = [
    ['Today', today],
    ['Yesterday', addDays(today, -1)],
    ['All dates', ''],
  ]

  return (
    <>
      <PageHeader title="History" subtitle={day ? `Exits on ${formatLongDate(day)}` : 'All completed visits'} />

      <div className="card">
        <div className="flex flex-wrap items-end gap-3 border-b border-slate-200 p-4">
          <div>
            <label htmlFor="day" className="field-label">Exit date</label>
            <input id="day" type="date" value={day} max={today} onChange={(e) => setDay(e.target.value)} className="input w-auto" />
          </div>
          <div className="flex gap-1 pb-0.5">
            {quickDays.map(([label, value]) => (
              <button
                key={label}
                onClick={() => setDay(value)}
                className={`rounded-lg px-3 py-2 text-sm font-medium ${
                  day === value ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="relative ml-auto w-full max-w-xs">
            <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by plate…"
              aria-label="Search by plate"
              className="input pl-9 uppercase placeholder:normal-case"
            />
          </div>
        </div>

        {error && <EmptyState tone="error" title="Could not load history" message={error} />}
        {!error && !rows && <Loading />}
        {!error && rows?.length === 0 && (
          <EmptyState icon="history" title="No completed visits" message="Nothing matches this date and search." />
        )}

        {!error && rows?.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="table-head">
                <tr>
                  <th className="px-4 py-3">Receipt No.</th>
                  <th className="px-4 py-3">Plate</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Entry</th>
                  <th className="px-4 py-3">Exit</th>
                  <th className="px-4 py-3">Duration</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3">Method</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((s) => (
                  <tr
                    key={s.id}
                    tabIndex={0}
                    onClick={() => navigate(`/receipt/${s.id}`)}
                    onKeyDown={(e) => e.key === 'Enter' && navigate(`/receipt/${s.id}`)}
                    className="cursor-pointer hover:bg-brand-50/50 focus:bg-brand-50/50 focus:outline-none"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-brand-700">{s.receipt_no}</td>
                    <td className="px-4 py-3 font-mono font-semibold tracking-wider text-slate-900">{s.vehicle_number}</td>
                    <td className="px-4 py-3"><TypeBadge type={s.vehicle_type} /></td>
                    <td className="px-4 py-3 text-slate-600">{formatDateTime(s.entry_time)}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDateTime(s.exit_time)}</td>
                    <td className="px-4 py-3 tabular-nums">{formatDuration(s.duration_minutes)}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatINR(s.amount)}</td>
                    <td className="px-4 py-3"><MethodPill method={s.payment_method} /></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold text-slate-900">
                  <td className="px-4 py-3" colSpan={6}>
                    Total · {rows.length} visit{rows.length === 1 ? '' : 's'}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatINR(total)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
