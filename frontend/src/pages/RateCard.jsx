import { Link } from 'react-router-dom'
import PageHeader from '../components/PageHeader.jsx'
import EmptyState, { Loading } from '../components/EmptyState.jsx'
import Icon, { VEHICLE_ICONS } from '../components/Icon.jsx'
import { useConfig } from '../hooks/useConfig.js'
import { formatINR } from '../utils/format.js'

/** Rates table from /api/config plus the fee rules in plain English. */
export default function RateCard() {
  const { config, error } = useConfig()

  if (error) return <EmptyState tone="error" title="Could not load the rate card" message={error} />
  if (!config) return <Loading />

  const grace = config.grace_minutes
  const windowHours = config.cap_window_hours
  const rules = [
    ['Grace period', `If the stay is ${grace} minutes or less, the fee is ₹0.`],
    [
      'Hourly billing, rounded up',
      `After the grace period, every started hour is billed in full. ${grace + 1} min = 1 hour, 61 min = 2 hours. The grace period is not subtracted: ${grace + 1} min bills as 1 full hour.`,
    ],
    [
      'Rate per hour block',
      `Each hour block is charged at the rate in effect when that block starts. A block starting at or after ${config.night_start}, or before ${config.night_end}, uses the night rate. Otherwise it uses the day rate.`,
    ],
    [
      'Daily cap',
      `Hour blocks are grouped into ${windowHours}-hour windows counted from the entry time (blocks 1–${windowHours}, ${windowHours + 1}–${windowHours * 2}, …). Each window's total is capped at the vehicle's daily cap.`,
    ],
    ['Total', 'The total is the sum of all capped windows.'],
  ]

  return (
    <>
      <PageHeader
        title="Rate Card"
        subtitle={`Night rates apply ${config.night_start}–${config.night_end}. All amounts in rupees.`}
        actions={<Link to="/simulator" className="btn-secondary"><Icon name="calculator" className="size-4" />Try the Fee Simulator</Link>}
      />

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="table-head">
            <tr>
              <th className="px-5 py-3">Vehicle type</th>
              <th className="px-5 py-3 text-right">Day rate / hr</th>
              <th className="px-5 py-3 text-right">Night rate / hr</th>
              <th className="px-5 py-3 text-right">Daily cap (per {windowHours}h)</th>
              <th className="px-5 py-3 text-right">Capacity</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {config.vehicle_types.map((t) => (
              <tr key={t.type}>
                <td className="px-5 py-4">
                  <span className="flex items-center gap-3 font-medium text-slate-900">
                    <span className="rounded-lg bg-slate-100 p-2 text-slate-600">
                      <Icon name={VEHICLE_ICONS[t.type]} className="size-5" />
                    </span>
                    {t.label}
                  </span>
                </td>
                <td className="px-5 py-4 text-right tabular-nums">{formatINR(t.day_rate)}</td>
                <td className="px-5 py-4 text-right tabular-nums">{formatINR(t.night_rate)}</td>
                <td className="px-5 py-4 text-right font-semibold tabular-nums">{formatINR(t.daily_cap)}</td>
                <td className="px-5 py-4 text-right tabular-nums">{t.capacity} slots</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mt-8 mb-3 text-lg font-semibold text-slate-900">How the fee is calculated</h2>
      <ol className="card divide-y divide-slate-100">
        {rules.map(([title, text], i) => (
          <li key={title} className="flex gap-4 px-5 py-4">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-bold text-brand-700">
              {i + 1}
            </span>
            <div>
              <p className="font-semibold text-slate-900">{title}</p>
              <p className="mt-0.5 text-sm text-slate-600">{text}</p>
            </div>
          </li>
        ))}
      </ol>
    </>
  )
}
