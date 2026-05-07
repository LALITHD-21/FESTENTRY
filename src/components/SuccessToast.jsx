import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, XCircle, Zap } from 'lucide-react';

const variants = {
  success: {
    icon: CheckCircle2,
    title: 'Entry Approved',
    border: 'border-emerald-300/35',
    bg: 'bg-emerald-400/10',
    tone: 'text-emerald-200',
  },
  invalid: {
    icon: XCircle,
    title: 'Invalid Pass',
    border: 'border-red-300/35',
    bg: 'bg-red-400/10',
    tone: 'text-red-200',
  },
  info: {
    icon: Zap,
    title: 'Scanner Update',
    border: 'border-cyan-300/35',
    bg: 'bg-cyan-400/10',
    tone: 'text-cyan-200',
  },
};

export default function SuccessToast({ toast }) {
  const meta = variants[toast?.type] || variants.info;
  const Icon = meta.icon;

  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          className="fixed inset-x-0 bottom-0 z-[70] p-4"
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', damping: 24, stiffness: 220 }}
        >
          <div className={`mx-auto max-w-md rounded-lg border bg-black/85 p-4 shadow-2xl backdrop-blur-xl ${meta.border}`}>
            <div className="flex items-center gap-3">
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${meta.bg}`}>
                <Icon className={`h-6 w-6 ${meta.tone}`} />
              </div>
              <div className="min-w-0 flex-1">
                <p className={`font-orbitron text-xs uppercase tracking-widest ${meta.tone}`}>{toast.title || meta.title}</p>
                <p className="truncate text-sm font-semibold text-white">{toast.name || toast.passId}</p>
                <p className="text-xs text-white/50">{toast.message}</p>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
