import { useEffect } from 'react';
import ScannerDashboard from './pages/ScannerDashboard';
import WelcomeScreen from './pages/WelcomeScreen';

function getLocalHttpsUrl() {
  if (!import.meta.env.DEV) return '';
  if (window.location.protocol !== 'http:') return '';

  const { hostname, pathname, search, hash } = window.location;
  if (hostname === 'localhost' || hostname === '127.0.0.1') return '';

  return `https://${hostname}:5174${pathname}${search}${hash}`;
}

export default function App() {
  const mobileOnly = import.meta.env.VITE_MOBILE_ONLY === 'true';
  const path = window.location.pathname.toLowerCase();
  const localHttpsUrl = getLocalHttpsUrl();

  if (localHttpsUrl) return <LocalHttpsRedirect url={localHttpsUrl} />;

  if (mobileOnly) return <ScannerDashboard />;
  if (path === '/welcome') return <WelcomeScreen />;
  return <ScannerDashboard />;
}

function LocalHttpsRedirect({ url }) {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      window.location.replace(url);
    }, 650);

    return () => window.clearTimeout(timer);
  }, [url]);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#05030a] px-5 text-center text-white">
      <div className="max-w-sm rounded-lg border border-cyan-300/25 bg-white/[0.055] p-5 shadow-[0_0_45px_rgba(0,245,255,0.12)] backdrop-blur-2xl">
        <p className="font-orbitron text-xs uppercase tracking-[0.25em] text-cyan-100">Opening Secure Scanner</p>
        <p className="mt-3 text-sm leading-relaxed text-white/60">
          Mobile camera needs HTTPS. Redirecting to the secure local scanner now.
        </p>
        <a
          href={url}
          className="mt-4 inline-flex rounded-lg border border-cyan-300/30 bg-cyan-500/15 px-4 py-2 font-orbitron text-xs uppercase tracking-widest text-cyan-100"
        >
          Open HTTPS
        </a>
      </div>
    </main>
  );
}
