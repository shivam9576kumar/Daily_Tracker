import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from '../components/auth/ProtectedRoute';
import LoginPage from '../components/auth/LoginPage';
import AuthCallback from '../components/auth/AuthCallback';
import Dashboard from '../pages/Dashboard';

/**
 * Application routes.
 * Protected routes require authentication.
 * Placeholder pages for features built in later phases.
 */
export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/callback" element={<AuthCallback />} />

        {/* Protected */}
        <Route path="/" element={
          <ProtectedRoute><Dashboard /></ProtectedRoute>
        } />

        {/* Placeholder routes for later phases */}
        <Route path="/roadmap" element={
          <ProtectedRoute><PlaceholderPage title="Roadmap" /></ProtectedRoute>
        } />
        <Route path="/progress" element={
          <ProtectedRoute><PlaceholderPage title="Progress" /></ProtectedRoute>
        } />
        <Route path="/study-slots" element={
          <ProtectedRoute><PlaceholderPage title="Study Slots" /></ProtectedRoute>
        } />
        <Route path="/generate-plan" element={
          <ProtectedRoute><PlaceholderPage title="Generate Plan" /></ProtectedRoute>
        } />
        <Route path="/settings" element={
          <ProtectedRoute><PlaceholderPage title="Settings" /></ProtectedRoute>
        } />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '1rem',
    }}>
      <h1 className="gradient-text" style={{
        fontSize: 'var(--font-size-4xl)',
        fontWeight: 'var(--font-weight-extrabold)',
      }}>
        {title}
      </h1>
      <p style={{ color: 'var(--color-text-secondary)' }}>Coming Soon</p>
      <div style={{
        width: '60px',
        height: '4px',
        borderRadius: 'var(--radius-full)',
        background: 'var(--gradient-accent)',
      }} />
    </div>
  );
}
