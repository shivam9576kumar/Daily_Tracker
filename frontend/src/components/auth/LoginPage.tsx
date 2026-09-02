import GoogleLoginButton from './GoogleLoginButton';
import './auth.css';

export default function LoginPage() {
  return (
    <div className="login-page">
      <div className="login-card">
        <h1 className="gradient-text">DSA Study Planner</h1>
        <div className="login-divider" />
        <p>
          AI-powered study planning with spaced repetition,
          progress tracking, and smart scheduling.
        </p>
        <GoogleLoginButton />
      </div>
    </div>
  );
}
