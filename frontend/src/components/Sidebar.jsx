import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import Icon from './Icon.jsx'
import { useInterval } from '../hooks/useInterval.js'
import { formatDateTime } from '../utils/format.js'

const LINKS = [
  { to: '/', label: 'Dashboard', icon: 'dashboard', end: true },
  { to: '/entry', label: 'New Entry', icon: 'plus' },
  { to: '/parked', label: 'Parked Vehicles', icon: 'parking' },
  { to: '/history', label: 'History', icon: 'history' },
  { to: '/simulator', label: 'Fee Simulator', icon: 'calculator' },
  { to: '/rates', label: 'Rate Card', icon: 'tag' },
]

function linkClass({ isActive }) {
  const base = 'flex shrink-0 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition'
  return isActive
    ? `${base} bg-brand-50 text-brand-700`
    : `${base} text-slate-600 hover:bg-slate-100 hover:text-slate-900`
}

/** Left navigation (a scrollable top bar on small screens). Hidden when printing. */
export default function Sidebar() {
  const [now, setNow] = useState(() => new Date().toISOString())
  useInterval(() => setNow(new Date().toISOString()), 1000)

  return (
    <aside className="border-b border-slate-200 bg-white print:hidden md:sticky md:top-0 md:flex md:h-screen md:w-64 md:shrink-0 md:flex-col md:border-r md:border-b-0">
      <div className="flex items-center gap-3 px-5 py-4 md:py-6">
        <span className="flex size-9 items-center justify-center rounded-lg bg-brand-600 text-lg font-bold text-white">
          P
        </span>
        <div>
          <p className="font-bold leading-tight text-slate-900">Smart Parking</p>
          <p className="text-xs text-slate-500">Fee Calculator</p>
        </div>
      </div>

      <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-1 md:flex-col md:pb-0">
        {LINKS.map((link) => (
          <NavLink key={link.to} to={link.to} end={link.end} className={linkClass}>
            <Icon name={link.icon} className="size-5 shrink-0" />
            {link.label}
          </NavLink>
        ))}
      </nav>

      <div className="hidden border-t border-slate-200 px-5 py-4 text-xs text-slate-500 md:block">
        <p className="font-medium text-slate-700">Attendant desk</p>
        <p className="font-mono tabular-nums">{formatDateTime(now)} IST</p>
      </div>
    </aside>
  )
}
