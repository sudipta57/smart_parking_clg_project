import Icon, { VEHICLE_ICONS } from './Icon.jsx'
import { useConfig, vehicleLabel } from '../hooks/useConfig.js'

/** Vehicle type shown as an icon + label, e.g. [car] Car. */
export default function TypeBadge({ type }) {
  const { config } = useConfig()
  return (
    <span className="inline-flex items-center gap-1.5 text-slate-700">
      <Icon name={VEHICLE_ICONS[type]} className="size-4 text-slate-500" />
      {vehicleLabel(config, type)}
    </span>
  )
}
