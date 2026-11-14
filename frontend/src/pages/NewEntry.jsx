import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'
import PageHeader from '../components/PageHeader.jsx'
import VehicleTypePicker from '../components/VehicleTypePicker.jsx'
import Icon from '../components/Icon.jsx'
import TypeBadge from '../components/TypeBadge.jsx'
import { useToast } from '../components/Toast.jsx'
import { formatDateTime, localInputToISO, nowLocalInput } from '../utils/format.js'

/** Record a vehicle entering the lot. */
export default function NewEntry() {
  const [created, setCreated] = useState(null)

  return (
    <>
      <PageHeader title="New Entry" subtitle="Record a vehicle arriving at the lot." />
      {created ? (
        <EntrySuccess session={created} onAnother={() => setCreated(null)} />
      ) : (
        <EntryForm onCreated={setCreated} />
      )}
    </>
  )
}

function EntryForm({ onCreated }) {
  const toast = useToast()
  const [plate, setPlate] = useState('')
  const [type, setType] = useState(null)
  const [customTime, setCustomTime] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const session = await api.post('/sessions', {
        vehicle_number: plate,
        vehicle_type: type,
        entry_time: localInputToISO(customTime),
      })
      toast.success(`${session.vehicle_number} parked in slot ${session.slot_code}`)
      onCreated(session)
    } catch (err) {
      setError(err.message)
      toast.error(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card max-w-3xl space-y-6 p-6">
      <div>
        <label htmlFor="plate" className="field-label">Vehicle number</label>
        <input
          id="plate"
          autoFocus
          autoComplete="off"
          value={plate}
          onChange={(e) => setPlate(e.target.value.toUpperCase())}
          placeholder="WB 02 AB 1234"
          className="input py-3 font-mono text-2xl tracking-widest uppercase"
        />
        <p className="mt-1.5 text-xs text-slate-500">
          Spaces, dots and hyphens are ignored. Bharat series (e.g. 22 BH 1234 AA) is accepted.
        </p>
      </div>

      <div>
        <p className="field-label">Vehicle type</p>
        <VehicleTypePicker value={type} onChange={setType} />
      </div>

      <details className="demo-box">
        <summary className="font-medium text-slate-600">Demo: custom entry time</summary>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <input
            type="datetime-local"
            value={customTime}
            max={nowLocalInput()}
            onChange={(e) => setCustomTime(e.target.value)}
            className="input w-auto"
          />
          {customTime && (
            <button type="button" onClick={() => setCustomTime('')} className="btn-secondary">
              Use current time
            </button>
          )}
          <p className="w-full text-xs text-slate-500">Leave empty to use the current time. Times are IST.</p>
        </div>
      </details>

      {error && (
        <p className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <Icon name="alert" className="size-4 shrink-0" />
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={submitting || !plate.trim() || !type} className="btn-primary btn-lg">
          <Icon name="login" className="size-5" />
          {submitting ? 'Saving…' : 'Record Entry'}
        </button>
        {!type && plate.trim() && <span className="text-sm text-slate-500">Select a vehicle type</span>}
      </div>
    </form>
  )
}

function EntrySuccess({ session, onAnother }) {
  return (
    <div className="card max-w-xl p-8 text-center">
      <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
        <Icon name="check" className="size-6" />
      </span>
      <p className="text-sm font-medium tracking-wide text-slate-500 uppercase">Assigned slot</p>
      <p className="my-2 font-mono text-7xl font-bold tracking-tight text-brand-700">{session.slot_code}</p>
      <p className="font-mono text-xl font-semibold tracking-widest text-slate-900">{session.vehicle_number}</p>
      <div className="mt-2 flex items-center justify-center gap-3 text-sm text-slate-500">
        <TypeBadge type={session.vehicle_type} />
        <span>·</span>
        <span>Entered {formatDateTime(session.entry_time)}</span>
      </div>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button onClick={onAnother} className="btn-primary btn-lg">
          <Icon name="plus" className="size-5" />
          Add another
        </button>
        <Link to="/parked" className="btn-secondary btn-lg">View parked vehicles</Link>
      </div>
    </div>
  )
}
