import { Outlet } from 'react-router-dom';
import TopBar from './TopBar';
import './layout.css';

interface Props {
  children?: React.ReactNode;
}

export default function AppLayout({ children }: Props) {
  return (
    <div className="app-layout">
      <TopBar />
      <main className="app-content">
        {children || <Outlet />}
      </main>
    </div>
  );
}
