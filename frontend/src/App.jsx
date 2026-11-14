import { Link, Route, Routes } from 'react-router-dom'
import Sidebar from './components/Sidebar.jsx'
import EmptyState from './components/EmptyState.jsx'
import { ToastProvider } from './components/Toast.jsx'
import Dashboard from './pages/Dashboard.jsx'
import NewEntry from './pages/NewEntry.jsx'
import ParkedVehicles from './pages/ParkedVehicles.jsx'
import ExitPayment from './pages/ExitPayment.jsx'
import Receipt from './pages/Receipt.jsx'
import History from './pages/History.jsx'
import Simulator from './pages/Simulator.jsx'
import RateCard from './pages/RateCard.jsx'

export default function App() {
  return (
    <ToastProvider>
      <div className="min-h-screen md:flex">
        <Sidebar />
        <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8 print:p-0">
          <div className="mx-auto max-w-6xl">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/entry" element={<NewEntry />} />
              <Route path="/parked" element={<ParkedVehicles />} />
              <Route path="/exit/:id" element={<ExitPayment />} />
              <Route path="/receipt/:id" element={<Receipt />} />
              <Route path="/history" element={<History />} />
              <Route path="/simulator" element={<Simulator />} />
              <Route path="/rates" element={<RateCard />} />
              <Route
                path="*"
                element={
                  <EmptyState
                    title="Page not found"
                    message="That address does not exist in this app."
                    action={<Link to="/" className="btn-primary">Go to Dashboard</Link>}
                  />
                }
              />
            </Routes>
          </div>
        </main>
      </div>
    </ToastProvider>
  )
}
