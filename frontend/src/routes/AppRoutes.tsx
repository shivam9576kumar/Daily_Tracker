import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from '../components/auth/ProtectedRoute';
import LoginPage from '../components/auth/LoginPage';
import AuthCallback from '../components/auth/AuthCallback';
import AppLayout from '../components/layout/AppLayout';
import Dashboard from '../pages/Dashboard';
import RoadmapPage from '../pages/RoadmapPage';
import ProgressPage from '../pages/ProgressPage';
import StudySlotsPage from '../pages/StudySlotsPage';
import GeneratePlanPage from '../pages/GeneratePlanPage';

/**
 * Application routes.
 * Protected routes require authentication and are wrapped in AppLayout.
 */
export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/callback" element={<AuthCallback />} />

        {/* Protected + wrapped in layout */}
        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<Dashboard />} />
          <Route path="/roadmap" element={<RoadmapPage />} />
          <Route path="/progress" element={<ProgressPage />} />
          <Route path="/study-slots" element={<StudySlotsPage />} />
          <Route path="/generate-plan" element={<GeneratePlanPage />} />
          <Route path="/plan/wizard" element={<GeneratePlanPage />} />
          <Route
            path="/settings"
            element={<PlaceholderPage title="Settings" />}
          />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div
      style={{
        minHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1rem',
      }}
    >
      <h1
        className="gradient-text"
        style={{
          fontSize: 'var(--font-size-4xl)',
          fontWeight: 'var(--font-weight-extrabold)',
        }}
      >
        {title}
      </h1>
      <p style={{ color: 'var(--color-text-secondary)' }}>Coming Soon</p>
      <div
        style={{
          width: '60px',
          height: '4px',
          borderRadius: 'var(--radius-full)',
          background: 'var(--gradient-accent)',
        }}
      />
    </div>
  );
}
