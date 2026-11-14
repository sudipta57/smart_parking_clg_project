import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'
import PageHeader from '../components/PageHeader.jsx'
import StatCard from '../components/StatCard.jsx'
import EmptyState, { Loading } from '../components/EmptyState.jsx'
import Icon, { VEHICLE_ICONS } from '../components/Icon.jsx'
import MethodPill from '../components/MethodPill.jsx'
import TypeBadge from '../components/TypeBadge.jsx'
import { useConfig, vehicleLabel } from '../hooks/useConfig.js'
import { REFRESH_MS, useInterval } from '../hooks/useInterval.js'
import { formatINR, formatLongDate, formatTime } from '../utils/format.js'

const RECENT_EXITS = 5

/** Today's numbers at a glance. Refreshes itself every 30 seconds. */
export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [recent, setRecent] = useState([])
  const [error, setError] = useState(null)
  const [updatedAt, setUpdatedAt] = useState(null)

  const load = useCallback(async () => {
    try {
      const [todayStats, recentExits] = await Promise.all([
        api.get('/stats/today'),
        api.get('/sessions/history', { limit: RECENT_EXITS }),
      ])
      setStats(todayStats)
      setRecent(recentExits)
      setError(null)
      setUpdatedAt(new Date().toISOString())
    } catch (err) {
      setError(err.message)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])
  useInterval(load, REFRESH_MS)

  if (!stats) {
    return error ? (
      <EmptyState
        tone="error"
        title="Could not load the dashboard"
        message={error}
        action={<button onClick={load} className="btn-primary">Try again</button>}
      />
    ) : (
      <Loading />
    )
  }

  const totalCapacity = Object.values(stats.occupancy).reduce((sum, o) => sum + o.capacity, 0)

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={formatLongDate(stats.date)}
        actions={
          <>
            <span className="text-xs text-slate-500">Updated {formatTime(updatedAt)}</span>
            <button onClick={load} className="btn-secondary" aria-label="Refresh now">
              <Icon name="refresh" className="size-4" />
            </button>
            <Link to="/entry" className="btn-primary">
              <Icon name="plus" className="size-4" />
              New Entry
            </Link>
          </>
        }
      />

      {error && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
          Auto-refresh failed: {error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Earnings today" value={formatINR(stats.earnings_today)} icon="rupee" hint="By exit time" highlight />
        <StatCard label="Vehicles in" value={stats.vehicles_in_today} icon="login" hint="Entered today" />
        <StatCard label="Vehicles out" value={stats.vehicles_out_today} icon="logout" hint="Exited today" />
        <StatCard
          label="Currently parked"
          value={stats.currently_parked}
          icon="parking"
          hint={`of ${totalCapacity} slots`}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Occupancy occupancy={stats.occupancy} />
        <EarningsByMethod byMethod={stats.earnings_by_method} total={stats.earnings_today} />
      </div>

      <div className="card mt-6">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="font-semibold text-slate-900">Recent exits</h2>
          <Link to="/history" className="text-sm font-medium text-brand-700 hover:underline">View history</Link>
        </div>
        {recent.length === 0 ? (
          <EmptyState icon="history" title="No exits yet" message="Completed visits will appear here." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {recent.map((s) => (
              <li key={s.id}>
                <Link to={`/receipt/${s.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-sm hover:bg-slate-50">
                  <span className="w-28 font-mono font-semibold tracking-wider text-slate-900">{s.vehicle_number}</span>
                  <span className="w-32"><TypeBadge type={s.vehicle_type} /></span>
                  <span className="flex-1 text-slate-500">
                    {formatTime(s.exit_time)} · <span className="font-mono text-xs">{s.receipt_no}</span>
                  </span>
                  <MethodPill method={s.payment_method} />
                  <span className="w-16 text-right font-semibold tabular-nums text-slate-900">{formatINR(s.amount)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}

function Occupancy({ occupancy }) {
  const { config } = useConfig()
  return (
    <div className="card p-5">
      <h2 className="mb-4 font-semibold text-slate-900">Occupancy</h2>
      <div className="space-y-4">
        {Object.entries(occupancy).map(([type, { parked, capacity }]) => {
          const percent = capacity ? Math.round((parked / capacity) * 100) : 0
          const barColor = percent >= 100 ? 'bg-red-500' : percent >= 80 ? 'bg-amber-500' : 'bg-brand-600'
          return (
            <div key={type}>
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 font-medium text-slate-700">
                  <Icon name={VEHICLE_ICONS[type]} className="size-4 text-slate-400" />
                  {vehicleLabel(config, type)}
                </span>
                <span className="tabular-nums text-slate-600">
                  <strong className="text-slate-900">{parked}</strong> / {capacity}
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${percent}%` }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function EarningsByMethod({ byMethod, total }) {
  const cash = byMethod.CASH ?? 0
  const upi = byMethod.UPI ?? 0
  const cashPercent = total ? (cash / total) * 100 : 50
  return (
    <div className="card p-5">
      <h2 className="mb-4 font-semibold text-slate-900">Earnings by method</h2>
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg bg-emerald-50 p-4">
          <p className="text-sm font-medium text-emerald-800">Cash</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-900">{formatINR(cash)}</p>
        </div>
        <div className="rounded-lg bg-violet-50 p-4">
          <p className="text-sm font-medium text-violet-800">UPI</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-violet-900">{formatINR(upi)}</p>
        </div>
      </div>
      <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-slate-100">
        {total > 0 && (
          <>
            <div className="h-full bg-emerald-500" style={{ width: `${cashPercent}%` }} />
            <div className="h-full bg-violet-500" style={{ width: `${100 - cashPercent}%` }} />
          </>
        )}
      </div>
      <p className="mt-2 text-xs text-slate-500">
        {total > 0 ? `${Math.round(cashPercent)}% cash · ${Math.round(100 - cashPercent)}% UPI` : 'No payments yet today'}
      </p>
    </div>
  )
}
