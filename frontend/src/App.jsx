import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { DistanceUnitProvider } from './context/DistanceUnitContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Layout } from './components/Layout'
import Login from './pages/Login'
import Register from './pages/Register'
import ChangePassword from './pages/ChangePassword'
import Dashboard from './pages/Dashboard'
import Vueltas from './pages/Vueltas'
import VueltaDetail from './pages/VueltaDetail'
import NuevaVueltaWizard from './components/NuevaVueltaWizard'
import Flota from './pages/Flota'
import CamionDetail from './pages/CamionDetail'
import Conductores from './pages/Conductores'
import ConductorDetail from './pages/ConductorDetail'
import Gastos from './pages/Gastos'
import Facturas from './pages/Facturas'
import Reportes from './pages/Reportes'
import Configuracion from './pages/Configuracion'
import Usuarios from './pages/Usuarios'

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/change-password" element={<ProtectedRoute><ChangePassword /></ProtectedRoute>} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={<ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>} />
      <Route path="/vueltas" element={<ProtectedRoute><Layout><Vueltas /></Layout></ProtectedRoute>} />
      <Route path="/vueltas/nueva" element={<ProtectedRoute><Layout><NuevaVueltaWizard /></Layout></ProtectedRoute>} />
      <Route path="/vueltas/:id" element={<ProtectedRoute><Layout><VueltaDetail /></Layout></ProtectedRoute>} />
      <Route path="/flota" element={<ProtectedRoute><Layout><Flota /></Layout></ProtectedRoute>} />
      <Route path="/flota/:id" element={<ProtectedRoute><Layout><CamionDetail /></Layout></ProtectedRoute>} />
      <Route path="/conductores" element={<ProtectedRoute><Layout><Conductores /></Layout></ProtectedRoute>} />
      <Route path="/conductores/:id" element={<ProtectedRoute><Layout><ConductorDetail /></Layout></ProtectedRoute>} />
      <Route path="/gastos" element={<ProtectedRoute><Layout><Gastos /></Layout></ProtectedRoute>} />
      <Route path="/facturas" element={<ProtectedRoute><Layout><Facturas /></Layout></ProtectedRoute>} />
      <Route path="/reportes" element={<ProtectedRoute><Layout><Reportes /></Layout></ProtectedRoute>} />
      <Route path="/configuracion" element={<ProtectedRoute><Layout><Configuracion /></Layout></ProtectedRoute>} />
      <Route path="/configuracion/usuarios" element={<ProtectedRoute><Layout><Usuarios /></Layout></ProtectedRoute>} />
    </Routes>
  )
}

export default function App() {
  return (
    <DistanceUnitProvider>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </DistanceUnitProvider>
  )
}
