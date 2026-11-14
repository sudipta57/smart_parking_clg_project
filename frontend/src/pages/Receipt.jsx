import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api.js'
import EmptyState, { Loading } from '../components/EmptyState.jsx'
import FeeBreakdown from '../components/FeeBreakdown.jsx'
import Icon from '../components/Icon.jsx'
import { useConfig, vehicleLabel } from '../hooks/useConfig.js'
import { formatDateTime, formatINR } from '../utils/format.js'

/** Printable receipt for a completed session. */
export default function Receipt() {
  const { id } = useParams()
  const { config } = useConfig()
  const [session, setSession] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.get(`/sessions/${id}`).then(setSession).catch((err) => setError(err.message))
  }, [id])

  if (error) return <EmptyState tone="error" title="Could not load the receipt" message={error} />
  if (!session) return <Loading />
  if (session.status !== 'COMPLETED') {
    return (
      <EmptyState
        title={`${session.vehicle_number} is still parked`}
        message="A receipt is generated when the vehicle exits."
        action={<Link to={`/exit/${session.id}`} className="btn-primary">Go to exit</Link>}
      />
    )
  }

  const rows = [
    ['Vehicle number', <span className="font-mono font-semibold tracking-wider">{session.vehicle_number}</span>],
    ['Vehicle type', vehicleLabel(config, session.vehicle_type)],
    ['Slot', <span className="font-mono">{session.slot_code}</span>],
    ['Entry', formatDateTime(session.entry_time)],
    ['Exit', formatDateTime(session.exit_time)],
  ]

  return (
    <div className="mx-auto max-w-md">
      <div className="mb-4 flex justify-between gap-2 print:hidden">
        <Link to="/" className="btn-secondary">
          <Icon name="back" className="size-4" />
          Back to Dashboard
        </Link>
        <button onClick={() => window.print()} className="btn-primary">
          <Icon name="printer" className="size-4" />
          Print
        </button>
      </div>

      <article className="card p-6 [print-color-adjust:exact] print:border-slate-300 print:shadow-none">
        <header className="border-b border-dashed border-slate-300 pb-4 text-center">
          <span className="mx-auto flex size-10 items-center justify-center rounded-lg bg-brand-600 text-xl font-bold text-white">P</span>
          <h1 className="mt-2 text-lg font-bold text-slate-900">Smart Parking</h1>
          <p className="text-xs tracking-wide text-slate-500 uppercase">Parking receipt</p>
          <p className="mt-3 font-mono text-sm font-semibold text-slate-900">{session.receipt_no}</p>
        </header>

        <dl className="divide-y divide-slate-100 py-2 text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4 py-2">
              <dt className="text-slate-500">{label}</dt>
              <dd className="text-right text-slate-900">{value}</dd>
            </div>
          ))}
        </dl>

        <div className="border-t border-dashed border-slate-300 pt-4">
          <FeeBreakdown breakdown={session.fee_breakdown} showTotal={false} />
        </div>

        <div className="mt-4 flex items-end justify-between border-t border-dashed border-slate-300 pt-4">
          <div>
            <p className="text-xs tracking-wide text-slate-500 uppercase">Total paid</p>
            <p className="text-sm text-slate-600">
              via <span className="font-semibold text-slate-900">{session.payment_method === 'UPI' ? 'UPI' : 'Cash'}</span>
            </p>
          </div>
          <p className="text-4xl font-bold tracking-tight text-slate-900 tabular-nums">{formatINR(session.amount)}</p>
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">Thank you for parking with us. Drive safe!</p>
      </article>
    </div>
  )
}
