import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { OrganizerRoute } from './components/OrganizerRoute'
import { GuestRoute } from './components/GuestRoute'
import { Layout } from './components/Layout'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { EventsPage } from './pages/EventsPage'
import { EventDetailPage } from './pages/EventDetailPage'
import { OrdersPage } from './pages/OrdersPage'
import { OrderDetailPage } from './pages/OrderDetailPage'
import { TicketsPage } from './pages/TicketsPage'
import { CheckInPage } from './pages/CheckInPage'

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate to="/events" replace />} />

          <Route element={<GuestRoute />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
          </Route>

          <Route path="/events" element={<EventsPage />} />
          <Route path="/events/:id" element={<EventDetailPage />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/orders" element={<OrdersPage />} />
            <Route path="/orders/:id" element={<OrderDetailPage />} />
            <Route path="/tickets" element={<TicketsPage />} />
            <Route element={<OrganizerRoute />}>
              <Route path="/organizer/check-in" element={<CheckInPage />} />
            </Route>
          </Route>
        </Route>
      </Routes>
    </AuthProvider>
  )
}

export default App
