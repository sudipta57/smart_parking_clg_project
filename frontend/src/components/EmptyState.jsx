import Icon from './Icon.jsx'

/** Friendly placeholder for "nothing here yet" or "something went wrong". */
export default function EmptyState({ icon = 'parking', title, message, action, tone = 'neutral' }) {
  const color = tone === 'error' ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-500'
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <span className={`mb-4 rounded-full p-3 ${color}`}>
        <Icon name={tone === 'error' ? 'alert' : icon} className="size-6" />
      </span>
      <p className="font-semibold text-slate-800">{title}</p>
      {message && <p className="mt-1 max-w-sm text-sm text-slate-500">{message}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

/** Small "Loading…" line used while the first fetch is in progress. */
export function Loading({ label = 'Loading…' }) {
  return (
    <div className="flex items-center justify-center gap-3 py-14 text-sm text-slate-500">
      <span className="size-4 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600" />
      {label}
    </div>
  )
}
