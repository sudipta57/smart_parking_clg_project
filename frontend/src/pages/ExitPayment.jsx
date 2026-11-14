import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api.js'
import PageHeader from '../components/PageHeader.jsx'
import EmptyState, { Loading } from '../components/EmptyState.jsx'
import FeeBreakdown from '../components/FeeBreakdown.jsx'
import Icon from '../components/Icon.jsx'
import TypeBadge from '../components/TypeBadge.jsx'
import { useToast } from '../components/Toast.jsx'
import { REFRESH_MS, useInterval } from '../hooks/useInterval.js'
import { formatDateTime, isoToLocalInput, localInputToISO, nowLocalInput } from '../utils/format.js'

const PAYMENT_OPTIONS = [
  { value: 'CASH', label: 'Cash' },
  { value: 'UPI', label: 'UPI' },
]

/** Exit screen: shows the fee breakdown, takes the payment method, confirms. */
export default function ExitPayment() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()

  const [session, setSession] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [customTime, setCustomTime] = useState('')
  const [preview, setPreview] = useState(null)
  const [previewError, setPreviewError] = useState(null)
  const [method, setMethod] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    api.get(`/sessions/${id}`).then(setSession).catch((err) => setLoadError(err.message))
  }, [id])

  // Ask the server what the fee would be (nothing is saved by this call).
  const loadPreview = useCallback(async () => {
    try {
      const data = await api.get(`/sessions/${id}/exit-preview`, { exit_time: localInputToISO(customTime) })
      setPreview(data)
      setPreviewError(null)
    } catch (err) {
      setPreviewError(err.message)
    }
  }, [id, customTime])

  const parked = session?.status === 'PARKED'
  useEffect(() => {
    if (parked) loadPreview()
  }, [parked, loadPreview])
  // With "now" as the exit time the fee can grow, so keep it fresh.
  useInterval(loadPreview, parked && !customTime ? REFRESH_MS : null)

  async function confirmExit() {
    setSubmitting(true)
    try {
      await api.post(`/sessions/${id}/exit`, {
        payment_method: method,
        exit_time: localInputToISO(customTime),
      })
      toast.success('Exit confirmed. Receipt generated.')
      navigate(`/receipt/${id}`)
    } catch (err) {
      toast.error(err.message)
      setSubmitting(false)
    }
  }

  if (loadError) {
    return (
      <EmptyState
        tone="error"
        title="Could not open this vehicle"
        message={loadError}
        action={<Link to="/parked" className="btn-secondary">Back to Parked Vehicles</Link>}
      />
    )
  }
  if (!session) return <Loading />
  if (!parked) {
    return (
      <EmptyState
        icon="check"
        title={`${session.vehicle_number} has already exited`}
        message={`Receipt ${session.receipt_no} was issued for this visit.`}
        action={<Link to={`/receipt/${session.id}`} className="btn-primary">View receipt</Link>}
      />
    )
  }

  const canConfirm = method && preview && !previewError && !submitting

  return (
    <>
      <PageHeader
        title="Exit & Payment"
        subtitle="Check the fee with the driver, choose how they paid, then confirm."
        actions={
          <Link to="/parked" className="btn-secondary">
            <Icon name="back" className="size-4" />
            Parked Vehicles
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-2">
          {/* Vehicle summary */}
          <div className="card p-5">
            <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">Vehicle</p>
            <p className="mt-1 font-mono text-2xl font-bold tracking-widest text-slate-900">{session.vehicle_number}</p>
            <dl className="mt-4 grid grid-cols-2 gap-y-3 text-sm">
              <dt className="text-slate-500">Type</dt>
              <dd><TypeBadge type={session.vehicle_type} /></dd>
              <dt className="text-slate-500">Slot</dt>
              <dd className="font-mono font-semibold">{session.slot_code}</dd>
              <dt className="text-slate-500">Entry</dt>
              <dd>{formatDateTime(session.entry_time)}</dd>
              <dt className="text-slate-500">Exit</dt>
              <dd>{preview ? formatDateTime(preview.exit_time) : '—'}{!customTime && ' (now)'}</dd>
            </dl>
          </div>

          <details className="demo-box">
            <summary className="font-medium text-slate-600">Demo: custom exit time</summary>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <input
                type="datetime-local"
                value={customTime}
                min={isoToLocalInput(session.entry_time)}
                max={nowLocalInput()}
                onChange={(e) => setCustomTime(e.target.value)}
                className="input w-auto"
              />
              {customTime && (
                <button type="button" onClick={() => setCustomTime('')} className="btn-secondary">
                  Use current time
                </button>
              )}
            </div>
          </details>

          {/* Payment method */}
          <div className="card p-5">
            <p className="field-label">Payment method</p>
            <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Payment method">
              {PAYMENT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={method === option.value}
                  onClick={() => setMethod(option.value)}
                  className={`rounded-xl border-2 py-4 text-lg font-semibold transition ${
                    method === option.value
                      ? 'border-brand-600 bg-brand-50 text-brand-800'
                      : 'border-slate-200 text-slate-700 hover:border-slate-300'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <button onClick={confirmExit} disabled={!canConfirm} className="btn-primary btn-lg mt-5 w-full">
              <Icon name="check" className="size-5" />
              {submitting ? 'Confirming…' : 'Confirm Exit & Generate Receipt'}
            </button>
            {!method && <p className="mt-2 text-center text-xs text-slate-500">Select a payment method to continue</p>}
          </div>
        </div>

        {/* Fee breakdown */}
        <div className="card p-5 lg:col-span-3">
          <h2 className="mb-4 font-semibold text-slate-900">Fee breakdown</h2>
          {previewError ? (
            <p className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              <Icon name="alert" className="size-4 shrink-0" />
              {previewError}
            </p>
          ) : preview ? (
            <FeeBreakdown breakdown={preview.breakdown} />
          ) : (
            <Loading label="Calculating…" />
          )}
        </div>
      </div>
    </>
  )
}
