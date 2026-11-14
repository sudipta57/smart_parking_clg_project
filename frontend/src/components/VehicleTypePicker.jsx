import Icon, { VEHICLE_ICONS } from './Icon.jsx'
import { useConfig } from '../hooks/useConfig.js'
import { formatINR } from '../utils/format.js'

/**
 * Three large selectable cards: Bike / Car / SUV, with their rates.
 * `compact` shows smaller cards (used on the Fee Simulator).
 */
export default function VehicleTypePicker({ value, onChange, compact = false }) {
  const { config } = useConfig()

  if (!config) {
    return (
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className={`animate-pulse rounded-xl bg-slate-100 ${compact ? 'h-16' : 'h-36'}`} />
        ))}
      </div>
    )
  }

  return (
    <div role="radiogroup" aria-label="Vehicle type" className="grid grid-cols-3 gap-3">
      {config.vehicle_types.map((t) => {
        const selected = t.type === value
        return (
          <button
            key={t.type}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(t.type)}
            className={`flex flex-col items-center rounded-xl border-2 text-center transition ${
              compact ? 'gap-1 px-2 py-3' : 'gap-2 px-3 py-5'
            } ${
              selected
                ? 'border-brand-600 bg-brand-50 text-brand-800 shadow-sm'
                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            <Icon name={VEHICLE_ICONS[t.type]} className={compact ? 'size-6' : 'size-10'} />
            <span className={`font-semibold ${compact ? 'text-sm' : 'text-base'}`}>{t.label}</span>
            {!compact && (
              <span className="text-xs text-slate-500">
                Day {formatINR(t.day_rate)}/hr · Night {formatINR(t.night_rate)}/hr
                <br />
                Cap {formatINR(t.daily_cap)} per 24h
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
