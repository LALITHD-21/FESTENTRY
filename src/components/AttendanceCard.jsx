import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Download, RefreshCcw, Ticket, Users } from 'lucide-react';
import { getAttendanceStats, isSupabaseConfigured, subscribeToAttendance } from '../lib/supabase';

export default function AttendanceCard({
  refreshKey = 0,
  successScans = 0,
  duplicateScans = 0,
  totalScans = 0,
  onResetAttendance,
  resettingAttendance = false,
  onDownloadAttendance,
  downloadingAttendance = false,
}) {
  const [stats, setStats] = useState({ checkedIn: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const previousChecked = useRef(0);
  const [pop, setPop] = useState(false);

  useEffect(() => {
    let alive = true;

    async function loadStats() {
      if (!isSupabaseConfigured) {
        setError('Env missing');
        setLoading(false);
        return;
      }

      try {
        const nextStats = await getAttendanceStats();
        if (!alive) return;

        if (nextStats.checkedIn > previousChecked.current) {
          setPop(true);
          window.setTimeout(() => setPop(false), 450);
        }

        previousChecked.current = nextStats.checkedIn;
        setStats(nextStats);
        setError('');
      } catch (statsError) {
        if (alive) setError(statsError?.message || 'Stats error');
      } finally {
        if (alive) setLoading(false);
      }
    }

    loadStats();
    const interval = window.setInterval(loadStats, 10000);
    const unsubscribe = subscribeToAttendance(loadStats);

    return () => {
      alive = false;
      window.clearInterval(interval);
      unsubscribe();
    };
  }, [refreshKey]);

  const percent = stats.total > 0 ? Math.round((stats.checkedIn / stats.total) * 100) : 0;

  return (
    <section className="rounded-lg border border-cyan-300/25 bg-white/[0.055] p-4 shadow-[0_0_45px_rgba(0,245,255,0.12)] backdrop-blur-2xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-cyan-200" />
          <span className="font-orbitron text-xs uppercase tracking-[0.25em] text-cyan-100">Attendance</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-[10px] uppercase tracking-widest text-emerald-200">
            Live
          </span>
          {onDownloadAttendance && (
            <button
              type="button"
              onClick={onDownloadAttendance}
              disabled={downloadingAttendance}
              className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-cyan-300/25 bg-cyan-500/10 px-3 py-1 font-orbitron text-[10px] uppercase tracking-widest text-cyan-100 transition hover:bg-cyan-500/20 disabled:cursor-wait disabled:opacity-60"
            >
              <Download className={`h-3.5 w-3.5 ${downloadingAttendance ? 'animate-pulse' : ''}`} />
              {downloadingAttendance ? 'PDF...' : 'Pass PDF'}
            </button>
          )}
          {onResetAttendance && (
            <button
              type="button"
              onClick={onResetAttendance}
              disabled={resettingAttendance}
              className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-red-300/25 bg-red-500/10 px-3 py-1 font-orbitron text-[10px] uppercase tracking-widest text-red-100 transition hover:bg-red-500/20 disabled:cursor-wait disabled:opacity-60"
            >
              <RefreshCcw className={`h-3.5 w-3.5 ${resettingAttendance ? 'animate-spin' : ''}`} />
              {resettingAttendance ? 'Resetting' : 'Make 0'}
            </button>
          )}
        </div>
      </div>

      <div className="mb-4 flex items-end justify-center gap-2">
        <motion.span
          key={stats.checkedIn}
          className={`font-orbitron text-5xl font-black text-glow-cyan ${pop ? 'counter-pop' : ''}`}
        >
          {loading ? '--' : stats.checkedIn}
        </motion.span>
        <span className="mb-2 font-orbitron text-xl text-white/35">/</span>
        <span className="mb-1 font-orbitron text-2xl text-white/70">{loading ? '--' : stats.total}</span>
      </div>

      <div className="mb-4 h-2 overflow-hidden rounded-full bg-white/10">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-pink-400 to-purple-400"
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <MiniStat label="Scans" value={totalScans} icon={Ticket} />
        <MiniStat label="Success" value={successScans} icon={CheckCircle2} />
        <MiniStat label="Duplicate" value={duplicateScans} icon={Ticket} danger />
      </div>

      {error && <p className="mt-3 text-center text-xs text-red-200/70">{error}</p>}
    </section>
  );
}

function MiniStat({ label, value, icon: Icon, danger = false }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/25 p-3">
      <Icon className={`mb-2 h-4 w-4 ${danger ? 'text-red-300' : 'text-pink-200'}`} />
      <p className="font-orbitron text-xl font-bold text-white">{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-white/40">{label}</p>
    </div>
  );
}
