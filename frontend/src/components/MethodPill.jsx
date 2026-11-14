/** Small coloured label for the payment method: Cash or UPI. */
export default function MethodPill({ method }) {
  const upi = method === 'UPI'
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${upi ? 'bg-violet-100 text-violet-800' : 'bg-emerald-100 text-emerald-800'}`}>
      {upi ? 'UPI' : 'Cash'}
    </span>
  )
}
