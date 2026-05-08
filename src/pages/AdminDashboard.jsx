import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  LogOut,
  RadioTower,
  RefreshCcw,
  Search,
  ShieldCheck,
  Users,
  XCircle,
} from 'lucide-react';
import ScannerLogin from '../components/ScannerLogin';
import { clearAdminSession, getStoredAdminSession, SCANNER_ACCOUNTS } from '../lib/scannerAuth';
import {
  fetchScanLogs,
  fetchScannerSessions,
  isSupabaseConfigured,
  resetAllScannerMembers,
  subscribeToScanLogs,
  subscribeToScannerSessions,
} from '../lib/supabase';

export default function AdminDashboard() {
  const [adminSession, setAdminSession] = useState(() => getStoredAdminSession());
  const [clock, setClock] = useState(new Date());
  const [logs, setLogs] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [selectedScanner, setSelectedScanner] = useState('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [resettingMembers, setResettingMembers] = useState(false);
  const [schemaWarning, setSchemaWarning] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const loadAdminData = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setSchemaWarning('Supabase environment is missing.');
      setLoading(false);
      return;
    }

    try {
      const nextLogs = await fetchScanLogs(500);
      setLogs(nextLogs);
    } catch (error) {
      setSchemaWarning(error?.message || 'Unable to fetch scan logs.');
    }

    try {
      const nextSessions = await fetchScannerSessions();
      setSessions(nextSessions);
      setSchemaWarning('');
    } catch {
      setSchemaWarning('Run supabase-scanner-admin.sql once to enable live scanner member names.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!adminSession) return undefined;

    loadAdminData();
    const unsubscribeLogs = subscribeToScanLogs(loadAdminData);
    const unsubscribeSessions = subscribeToScannerSessions(loadAdminData);
    const interval = window.setInterval(loadAdminData, 12000);

    return () => {
      unsubscribeLogs();
      unsubscribeSessions();
      window.clearInterval(interval);
    };
  }, [adminSession, loadAdminData]);

  const scannerRows = useMemo(() => {
    return SCANNER_ACCOUNTS.map((account) => {
      const session = sessions.find((item) => item.scannerId === account.id);
      const scannerLogs = logs.filter((log) => log.scannerId === account.id);
      const success = scannerLogs.filter((log) => log.status === 'success').length;
      const duplicate = scannerLogs.filter((log) => log.status === 'duplicate').length;
      const invalid = scannerLogs.filter((log) => log.status === 'invalid').length;

      return {
        id: account.id,
        label: account.label,
        name: session?.scannerName || 'Not logged in',
        live: isLiveSession(session),
        lastSeenAt: session?.lastSeenAt || '',
        total: scannerLogs.length,
        success,
        duplicate,
        invalid,
      };
    });
  }, [logs, sessions]);

  const totals = useMemo(
    () => ({
      all: logs.length,
      success: logs.filter((log) => log.status === 'success').length,
      duplicate: logs.filter((log) => log.status === 'duplicate').length,
      invalid: logs.filter((log) => log.status === 'invalid').length,
      liveScanners: scannerRows.filter((scanner) => scanner.live).length,
    }),
    [logs, scannerRows]
  );

  const filteredLogs = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return logs.filter((log) => {
      if (selectedScanner !== 'all' && log.scannerId !== selectedScanner) return false;
      if (!needle) return true;

      return [log.name, log.passId, log.detail, log.status, log.scannerId, log.scannerName]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [logs, query, selectedScanner]);

  const handleLogout = () => {
    clearAdminSession();
    setAdminSession(null);
  };

  const handleResetMembers = async () => {
    if (resettingMembers) return;

    const confirmed = window.confirm(
      'Reset all scanner members? This will erase the live member login list and force scanner phones to login fresh. Scan history will not be deleted.'
    );
    if (!confirmed) return;

    setResettingMembers(true);
    setNotice('');

    try {
      await resetAllScannerMembers();
      setSessions([]);
      setSelectedScanner('all');
      setNotice('All scanner members were reset. Phones must login again with the new VIMTECH passwords.');
      await loadAdminData();
    } catch (error) {
      setSchemaWarning(error?.message || 'Unable to reset scanner members.');
    } finally {
      setResettingMembers(false);
    }
  };

  if (!adminSession) {
    return <ScannerLogin mode="admin" onLogin={setAdminSession} />;
  }

  return (
    <div className="scanner-page relative min-h-dvh overflow-hidden bg-[#05030a] text-white">
      <div className="ambient-layer" />
      <main className="relative z-10 mx-auto flex min-h-dvh w-full max-w-6xl flex-col gap-4 px-4 py-4 pb-12">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-white/10 bg-white/[0.045] p-4 backdrop-blur-2xl">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-fuchsia-300/25 bg-fuchsia-400/10 px-3 py-1 text-[10px] uppercase tracking-[0.24em] text-fuchsia-100">
              <ShieldCheck className="h-3.5 w-3.5" />
              Admin live dashboard
            </div>
            <h1 className="font-orbitron text-2xl font-black uppercase tracking-wider text-gradient-cyan-pink">
              Scanner Control Room
            </h1>
            <p className="mt-1 text-xs uppercase tracking-[0.28em] text-white/38">10 member gate monitoring</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetMembers}
              disabled={resettingMembers}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-red-300/25 bg-red-500/10 px-3 py-2 font-orbitron text-[10px] uppercase tracking-widest text-red-100 transition active:scale-[0.98] disabled:cursor-wait disabled:opacity-60"
              title="Reset all scanner members"
            >
              <Users className="h-4 w-4" />
              {resettingMembers ? 'Resetting' : 'Reset Members'}
            </button>
            <div className="rounded-lg border border-cyan-300/20 bg-cyan-400/10 px-3 py-2 text-right">
              <p className="font-orbitron text-[10px] uppercase tracking-[0.2em] text-cyan-100/65">Live Time</p>
              <p className="mt-1 font-orbitron text-sm text-white">{formatTime(clock)}</p>
            </div>
            <button
              type="button"
              onClick={loadAdminData}
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-cyan-300/20 bg-cyan-400/10 text-cyan-100"
              title="Refresh"
            >
              <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-red-300/20 bg-red-500/10 text-red-100"
              title="Admin logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        {schemaWarning && (
          <section className="rounded-lg border border-amber-300/25 bg-amber-400/10 p-3 text-sm text-amber-100">
            {schemaWarning}
          </section>
        )}

        {notice && (
          <section className="rounded-lg border border-emerald-300/25 bg-emerald-400/10 p-3 text-sm text-emerald-100">
            {notice}
          </section>
        )}

        <section className="grid gap-3 md:grid-cols-5">
          <StatCard icon={Activity} label="Total Scans" value={totals.all} accent="cyan" />
          <StatCard icon={CheckCircle2} label="Success" value={totals.success} accent="emerald" />
          <StatCard icon={AlertTriangle} label="Duplicate" value={totals.duplicate} accent="amber" />
          <StatCard icon={XCircle} label="Invalid" value={totals.invalid} accent="red" />
          <StatCard icon={RadioTower} label="Live Members" value={`${totals.liveScanners}/10`} accent="fuchsia" />
        </section>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {scannerRows.map((scanner) => (
            <button
              key={scanner.id}
              type="button"
              onClick={() => setSelectedScanner(scanner.id)}
              className={`rounded-lg border p-3 text-left backdrop-blur-2xl transition active:scale-[0.98] ${
                selectedScanner === scanner.id
                  ? 'border-cyan-300/45 bg-cyan-400/15 shadow-[0_0_34px_rgba(0,245,255,0.14)]'
                  : 'border-white/10 bg-white/[0.045]'
              }`}
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="font-orbitron text-sm font-black text-white">{scanner.id}</span>
                <span className={`h-2.5 w-2.5 rounded-full ${scanner.live ? 'bg-emerald-300' : 'bg-white/18'}`} />
              </div>
              <p className="truncate font-semibold text-white">{scanner.name}</p>
              <p className="mt-1 truncate text-[10px] uppercase tracking-[0.18em] text-white/35">{scanner.label}</p>
              <div className="mt-3 grid grid-cols-3 gap-1.5 text-center">
                <Mini label="Ok" value={scanner.success} tone="text-emerald-200" />
                <Mini label="Dup" value={scanner.duplicate} tone="text-amber-200" />
                <Mini label="Bad" value={scanner.invalid} tone="text-red-200" />
              </div>
            </button>
          ))}
        </section>

        <section className="rounded-lg border border-white/10 bg-white/[0.045] p-4 backdrop-blur-2xl">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-orbitron text-xs uppercase tracking-[0.24em] text-pink-100">Separate Scan History</p>
              <p className="mt-1 text-xs text-white/42">
                {selectedScanner === 'all' ? 'Showing all scanner logs' : `Showing ${selectedScanner} only`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedScanner('all')}
              className={`rounded-lg border px-3 py-2 font-orbitron text-[10px] uppercase tracking-widest ${
                selectedScanner === 'all'
                  ? 'border-fuchsia-300/35 bg-fuchsia-400/15 text-fuchsia-100'
                  : 'border-white/10 bg-white/[0.04] text-white/45'
              }`}
            >
              All Scanners
            </button>
          </div>

          <label className="mb-3 flex items-center gap-2 rounded-lg border border-white/10 bg-black/25 px-3 py-2">
            <Search className="h-4 w-4 text-cyan-100/65" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search student, receipt, scanner, status"
              className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/28"
            />
          </label>

          <div className="max-h-[480px] space-y-2 overflow-y-auto pr-1">
            {filteredLogs.length === 0 ? (
              <div className="flex min-h-36 items-center justify-center rounded-lg border border-white/10 bg-black/25 text-sm text-white/35">
                No scan history yet
              </div>
            ) : (
              filteredLogs.map((log) => <AdminLogRow key={log.id} log={log} />)
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, accent }) {
  const tone = {
    cyan: 'border-cyan-300/25 bg-cyan-400/10 text-cyan-100',
    emerald: 'border-emerald-300/25 bg-emerald-400/10 text-emerald-100',
    amber: 'border-amber-300/25 bg-amber-400/10 text-amber-100',
    red: 'border-red-300/25 bg-red-500/10 text-red-100',
    fuchsia: 'border-fuchsia-300/25 bg-fuchsia-400/10 text-fuchsia-100',
  }[accent];

  return (
    <motion.div
      className={`rounded-lg border p-4 backdrop-blur-2xl ${tone}`}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Icon className="mb-4 h-5 w-5" />
      <p className="font-orbitron text-3xl font-black text-white">{value}</p>
      <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-white/45">{label}</p>
    </motion.div>
  );
}

function Mini({ label, value, tone }) {
  return (
    <div className="rounded-md border border-white/10 bg-black/25 px-2 py-1.5">
      <p className={`font-orbitron text-sm font-bold ${tone}`}>{value}</p>
      <p className="text-[9px] uppercase tracking-wider text-white/32">{label}</p>
    </div>
  );
}

function AdminLogRow({ log }) {
  const meta = {
    success: { icon: CheckCircle2, tone: 'text-emerald-200', bg: 'bg-emerald-400/10', label: 'Success' },
    duplicate: { icon: AlertTriangle, tone: 'text-amber-200', bg: 'bg-amber-400/10', label: 'Duplicate' },
    invalid: { icon: XCircle, tone: 'text-red-200', bg: 'bg-red-500/10', label: 'Invalid' },
  }[log.status] || { icon: XCircle, tone: 'text-red-200', bg: 'bg-red-500/10', label: 'Invalid' };
  const Icon = meta.icon;

  return (
    <motion.div
      className="grid gap-3 rounded-lg border border-white/10 bg-black/25 p-3 md:grid-cols-[44px_1.3fr_1fr_1fr_86px]"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${meta.bg}`}>
        <Icon className={`h-5 w-5 ${meta.tone}`} />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-white">{log.name || 'Unknown student'}</p>
        <p className="truncate font-mono text-[11px] text-white/35">{log.passId || '-'}</p>
      </div>
      <div className="min-w-0">
        <p className="font-orbitron text-[10px] uppercase tracking-[0.18em] text-white/35">Scanner</p>
        <p className="truncate text-sm text-cyan-100">{log.scannerId || 'LEGACY'} {log.scannerName ? `| ${log.scannerName}` : ''}</p>
      </div>
      <div className="min-w-0">
        <p className="font-orbitron text-[10px] uppercase tracking-[0.18em] text-white/35">Detail</p>
        <p className="truncate text-sm text-white/68">{log.detail || '-'}</p>
      </div>
      <div className="text-left md:text-right">
        <p className={`font-orbitron text-[10px] uppercase tracking-wider ${meta.tone}`}>{meta.label}</p>
        <p className="mt-1 text-[11px] text-white/35">{formatLogTime(log.scanTime)}</p>
      </div>
    </motion.div>
  );
}

function isLiveSession(session) {
  if (!session?.lastSeenAt || !session.isActive) return false;
  const seenAt = new Date(session.lastSeenAt).getTime();
  if (Number.isNaN(seenAt)) return false;
  return Date.now() - seenAt < 70000;
}

function formatTime(value) {
  return new Date(value).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

function formatLogTime(value) {
  if (!value) return '';
  return new Date(value).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}
