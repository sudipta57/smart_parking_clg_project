import { createContext, useCallback, useContext, useState } from 'react'
import Icon from './Icon.jsx'

// Global toasts: any page can call toast.success("...") or toast.error("...").

const ToastContext = createContext(null)
const TOAST_MS = 4500
let nextId = 1

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id))
  }, [])

  const show = useCallback(
    (kind, message) => {
      const id = nextId++
      setToasts((list) => [...list, { id, kind, message }])
      setTimeout(() => dismiss(id), TOAST_MS)
    },
    [dismiss],
  )

  const [api] = useState(() => ({
    success: (message) => show('success', message),
    error: (message) => show('error', message),
  }))

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="fixed top-4 right-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2 print:hidden" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm shadow-lg ${
              t.kind === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : 'border-red-200 bg-red-50 text-red-900'
            }`}
          >
            <Icon name={t.kind === 'success' ? 'check' : 'alert'} className="mt-0.5 size-4 shrink-0" />
            <p className="flex-1">{t.message}</p>
            <button onClick={() => dismiss(t.id)} className="opacity-60 hover:opacity-100" aria-label="Dismiss">
              <Icon name="close" className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

/** Returns { success(message), error(message) }. */
export function useToast() {
  return useContext(ToastContext)
}
