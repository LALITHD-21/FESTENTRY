import ScannerDashboard from './pages/ScannerDashboard';
import WelcomeScreen from './pages/WelcomeScreen';

export default function App() {
  const mobileOnly = import.meta.env.VITE_MOBILE_ONLY === 'true';
  const path = window.location.pathname.toLowerCase();

  if (mobileOnly) return <ScannerDashboard />;
  if (path === '/welcome') return <WelcomeScreen />;
  return <ScannerDashboard />;
}
