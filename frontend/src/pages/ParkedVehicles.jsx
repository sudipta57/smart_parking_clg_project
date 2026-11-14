import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'
import PageHeader from '../components/PageHeader.jsx'
import EmptyState, { Loading } from '../components/EmptyState.jsx'
import Icon from '../components/Icon.jsx'
import LiveTimer from '../components/LiveTimer.jsx'
import TypeBadge from '../components/TypeBadge.jsx'
import { REFRESH_MS, useInterval } from '../hooks/useInterval.js'
import { formatDateTime, formatINR } from '../utils/format.js'

/** Every vehicle currently in the lot, with a live timer and the fee so far. */
export default function ParkedVehicles() {
  const [sessions, setSessions] = useState(null)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')

  // The timer ticks in the browser every second; the fee comes from the
  // server (the fee engine), so it is refetched every 30 seconds.
  const load = useCallback(async () => {
    try {
      setSessions(await api.get('/sessions/active'))
      setError(null)
    } catch (err) {
      setError(err.message)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])
  useInterval(load, REFRESH_MS)

  const term = search.replace(/[\s.-]/g, '').toUpperCase()
  const visible = (sessions ?? []).filter((s) => s.vehicle_number.includes(term))

  return (
    <>
      <PageHeader
        title="Parked Vehicles"
        subtitle={sessions ? `${sessions.length} vehicle${sessions.length === 1 ? '' : 's'} in the lot` : ' '}
        actions={
          <Link to="/entry" className="btn-primary">
            <Icon name="plus" className="size-4" />
            New Entry
          </Link>
        }
      />

      <div className="card">
        <div className="border-b border-slate-200 p-4">
          <div className="relative max-w-sm">
            <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by plate…"
              className="input pl-9 uppercase placeholder:normal-case"
            />
          </div>
        </div>

        {error && !sessions && <EmptyState tone="error" title="Could not load parked vehicles" message={error} />}
        {!error && !sessions && <Loading />}
        {sessions && sessions.length === 0 && (
          <EmptyState
            title="The lot is empty"
            message="No vehicles are parked right now. Record an entry to get started."
            action={<Link to="/entry" className="btn-primary">New Entry</Link>}
          />
        )}
        {sessions && sessions.length > 0 && visible.length === 0 && (
          <EmptyState icon="search" title="No match" message={`No parked vehicle matches “${search}”.`} />
        )}

        {visible.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="table-head">
                <tr>
                  <th className="px-4 py-3">Plate</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Slot</th>
                  <th className="px-4 py-3">Entry time</th>
                  <th className="px-4 py-3">Elapsed</th>
                  <th className="px-4 py-3 text-right">Fee so far</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visible.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono font-semibold tracking-wider text-slate-900">{s.vehicle_number}</td>
                    <td className="px-4 py-3"><TypeBadge type={s.vehicle_type} /></td>
                    <td className="px-4 py-3">
                      <span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-xs font-semibold">{s.slot_code}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{formatDateTime(s.entry_time)}</td>
                    <td className="px-4 py-3 text-slate-900"><LiveTimer since={s.entry_time} /></td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-900">{formatINR(s.current_fee)}</td>
                    <td className="px-4 py-3 text-right">
                      <Link to={`/exit/${s.id}`} className="btn-secondary px-3 py-1.5">
                        <Icon name="logout" className="size-4" />
                        Exit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {error && sessions && (
        <p className="mt-3 text-sm text-red-700">Auto-refresh failed: {error}</p>
      )}
    </>
  )
}
