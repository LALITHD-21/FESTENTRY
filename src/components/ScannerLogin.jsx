import { useState } from 'react';
import { motion } from 'framer-motion';
import { LockKeyhole, RadioTower, ShieldCheck, UserRound } from 'lucide-react';
import { authenticateAdmin, authenticateScanner, storeAdminSession, storeScannerSession } from '../lib/scannerAuth';

export default function ScannerLogin({ mode = 'scanner', onLogin }) {
  const isAdmin = mode === 'admin';
  const [scannerId, setScannerId] = useState(isAdmin ? 'ADMIN' : '');
  const [password, setPassword] = useState('');
  const [scannerName, setScannerName] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (event) => {
    event.preventDefault();
    setError('');

    try {
      if (isAdmin) {
        const session = authenticateAdmin(scannerId, password);
        storeAdminSession(session);
        onLogin?.(session);
        return;
      }

      const session = authenticateScanner(scannerId, password, scannerName);
      storeScannerSession(session);
      onLogin?.(session);
    } catch (loginError) {
      setError(loginError?.message || 'Login failed.');
    }
  };

  return (
    <main className="scanner-page relative flex min-h-dvh items-center justify-center overflow-hidden bg-[#05030a] px-4 py-8 text-white">
      <div className="ambient-layer" />
      <motion.form
        onSubmit={handleSubmit}
        className="relative z-10 w-full max-w-sm rounded-lg border border-cyan-300/20 bg-white/[0.055] p-5 shadow-[0_0_52px_rgba(0,245,255,0.14)] backdrop-blur-2xl"
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', damping: 22, stiffness: 180 }}
      >
        <div className="mb-5 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-fuchsia-300/35 bg-fuchsia-500/10 shadow-[0_0_38px_rgba(255,0,229,0.22)]">
            {isAdmin ? <ShieldCheck className="h-7 w-7 text-fuchsia-100" /> : <RadioTower className="h-7 w-7 text-cyan-100" />}
          </div>
          <p className="font-orbitron text-[10px] uppercase tracking-[0.28em] text-cyan-100/70">
            {isAdmin ? 'Admin Control Room' : 'Scanner Member Login'}
          </p>
          <h1 className="mt-2 font-orbitron text-2xl font-black uppercase tracking-wider text-gradient-cyan-pink">
            VIVAN VAIVIDHYA
          </h1>
          <p className="mt-1 text-xs uppercase tracking-[0.25em] text-white/38">Entry access system</p>
        </div>

        <div className="space-y-3">
          <Field
            icon={RadioTower}
            label={isAdmin ? 'Admin ID' : 'Scanner ID'}
            value={scannerId}
            onChange={setScannerId}
            placeholder={isAdmin ? 'ADMIN' : 'S01'}
            autoCapitalize="characters"
          />
          <Field icon={LockKeyhole} label="Password" value={password} onChange={setPassword} placeholder="Password" type="password" />
          {!isAdmin && (
            <Field
              icon={UserRound}
              label="Your Name"
              value={scannerName}
              onChange={setScannerName}
              placeholder="Enter volunteer name"
            />
          )}
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-300/25 bg-red-500/10 px-3 py-2 text-sm text-red-100">{error}</div>
        )}

        <button
          type="submit"
          className="mt-5 flex min-h-12 w-full items-center justify-center rounded-lg border border-cyan-300/35 bg-cyan-400/15 font-orbitron text-xs font-bold uppercase tracking-[0.22em] text-cyan-100 shadow-[0_0_34px_rgba(0,245,255,0.14)] transition active:scale-[0.98]"
        >
          {isAdmin ? 'Open Admin Dashboard' : 'Start Scanning'}
        </button>

        <p className="mt-4 text-center text-[10px] uppercase tracking-[0.16em] text-white/30">
          MADE BY VAISIRI STUDENTS | ALL RIGHTS RESERVED
        </p>
      </motion.form>
    </main>
  );
}

function Field({ icon: Icon, label, value, onChange, type = 'text', placeholder, autoCapitalize = 'off' }) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-orbitron text-[10px] uppercase tracking-[0.2em] text-white/42">{label}</span>
      <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/25 px-3 py-2.5">
        <Icon className="h-4 w-4 text-cyan-100/62" />
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoCapitalize={autoCapitalize}
          className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/25"
        />
      </div>
    </label>
  );
}
