import Icon from './Icon.jsx'

/** A dashboard number with a label, an icon and an optional hint line. */
export default function StatCard({ label, value, icon, hint, highlight = false }) {
  return (
    <div className={`card p-5 ${highlight ? 'border-brand-200 bg-brand-50/50' : ''}`}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <span className={`rounded-lg p-2 ${highlight ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
          <Icon name={icon} className="size-4" />
        </span>
      </div>
      <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900 tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  )
}
