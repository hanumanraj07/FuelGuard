import { Routes, Route } from 'react-router-dom'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { LandingPage } from '@/pages/LandingPage'
import { UploadPage } from '@/pages/UploadPage'
import { ResultsPage } from '@/pages/ResultsPage'
import { HowItWorksPage } from '@/pages/HowItWorksPage'
import { PricingPage } from '@/pages/PricingPage'
import { FleetDashboard } from '@/pages/FleetDashboard'
import { FleetVehiclePage } from '@/pages/FleetVehiclePage'
import { FleetVehicleEditPage } from '@/pages/FleetVehicleEditPage'
import { ReportsPage } from '@/pages/ReportsPage'
import { PumpProfilePage } from '@/pages/PumpProfilePage'
import { GovPortal } from '@/pages/GovPortal'
import { ProfilePage } from '@/pages/ProfilePage'
import { LoginPage } from '@/pages/LoginPage'
import { RegisterPage } from '@/pages/RegisterPage'
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage'
import { RequireAuth } from '@/components/auth/RequireAuth'
import { InstallPrompt } from '@/components/pwa/InstallPrompt'

function App() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Navbar />
      <InstallPrompt />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/upload" element={<UploadPage />} />
          <Route path="/results/:id" element={<ResultsPage />} />
          <Route path="/how-it-works" element={<HowItWorksPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route
            path="/fleet"
            element={(
              <RequireAuth>
                <FleetDashboard />
              </RequireAuth>
            )}
          />
          <Route
            path="/fleet/vehicle/:id"
            element={(
              <RequireAuth>
                <FleetVehiclePage />
              </RequireAuth>
            )}
          />
          <Route
            path="/fleet/vehicle/:id/edit"
            element={(
              <RequireAuth>
                <FleetVehicleEditPage />
              </RequireAuth>
            )}
          />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/pump/:id" element={<PumpProfilePage />} />
          <Route path="/gov" element={<GovPortal />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route
            path="/profile"
            element={(
              <RequireAuth>
                <ProfilePage />
              </RequireAuth>
            )}
          />
        </Routes>
      </main>
      <Footer />
    </div>
  )
}

export default App
