import { useThemeStore } from '../../store/themeStore';
import './theme-toggle.css';

export default function ThemeToggle() {
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const isLight = theme === 'light';

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggleTheme}
      role="switch"
      aria-checked={isLight}
      aria-label={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
      title={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
      data-testid="theme-toggle"
    >
      <span className="theme-toggle__track" aria-hidden="true">
        <span className="theme-toggle__thumb">{isLight ? '☀️' : '🌙'}</span>
      </span>
      <span className="theme-toggle__label">{isLight ? 'Light' : 'Dark'}</span>
    </button>
  );
}
