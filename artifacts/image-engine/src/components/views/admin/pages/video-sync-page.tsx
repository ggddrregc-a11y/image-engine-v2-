import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Film, RefreshCw, Wifi, WifiOff, CheckCircle2,
  AlertCircle, SkipForward, Loader2, Trash2,
  BarChart3, Clock, Calendar, Play,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AdminCard, AdminButton, AdminBadge, AdminLoading } from '../shared';

/* ─── Types ──────────────────────────────────────────────────────── */
interface SyncEvent {
  type: 'start' | 'progress' | 'processing' | 'video' | 'error' | 'done';
  message?: string;
  fetched?: number;
  action?: 'added' | 'updated' | 'skipped';
  title?: string;
  added?: number; updated?: number; skipped?: number; errors?: number;
}
interface SyncLog {
  id: string;
  page_url: string;
  status: 'running' | 'completed' | 'failed';
  added_count: number;
  updated_count: number;
  skipped_count: number;
  error_count: number;
  error_details: string[];
  started_at: string;
  finished_at: string | null;
}
interface StatsData {
  total: number;
  fbConfigured: boolean;
  lastSync: { started_at: string; status: string; added_count: number } | null;
}

/* ─── Helpers ────────────────────────────────────────────────────── */
function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('ar', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}
function fmtDuration(start: string, end: string | null) {
  if (!end) return '—';
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}ث`;
  return `${Math.floor(s / 60)}د ${s % 60}ث`;
}

/* ─── Stats Strip ────────────────────────────────────────────────── */
function StatsStrip({ stats }: { stats: StatsData }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {[
        { label: 'إجمالي الفيديوهات', value: stats.total, icon: Film, color: 'text-primary' },
        {
          label: 'حالة Facebook', icon: stats.fbConfigured ? Wifi : WifiOff,
          value: stats.fbConfigured ? 'متصل' : 'غير مُهيأ',
          color: stats.fbConfigured ? 'text-green-500' : 'text-yellow-500',
        },
        {
          label: 'آخر مزامنة',
          value: stats.lastSync ? fmtDate(stats.lastSync.started_at).split('،')[0] : '—',
          icon: Calendar, color: 'text-muted-foreground',
        },
        {
          label: 'آخر إضافة',
          value: stats.lastSync ? `+${stats.lastSync.added_count}` : '—',
          icon: BarChart3, color: 'text-blue-400',
        },
      ].map(({ label, value, icon: Icon, color }) => (
        <AdminCard key={label} className="flex items-center gap-3 p-4">
          <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary', color)}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground truncate">{label}</p>
            <p className={cn('text-sm font-bold truncate', color)}>{value}</p>
          </div>
        </AdminCard>
      ))}
    </div>
  );
}

/* ─── Live Sync Panel ────────────────────────────────────────────── */
function LiveSyncPanel({ onDone }: { onDone: () => void }) {
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [log, setLog] = useState<{ text: string; type: 'info' | 'ok' | 'update' | 'skip' | 'err' }[]>([]);
  const [counts, setCounts] = useState({ added: 0, updated: 0, skipped: 0, errors: 0 });
  const logRef = useRef<HTMLDivElement>(null);

  async function startSync() {
    setRunning(true);
    setDone(false);
    setLog([{ text: 'جاري الاتصال بـ Facebook Graph API...', type: 'info' }]);
    setCounts({ added: 0, updated: 0, skipped: 0, errors: 0 });

    try {
      const res = await fetch('/api/videos/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page_url: 'graph-api' }),
      });
      if (!res.body) throw new Error('No response body');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done: streamDone } = await reader.read();
        if (streamDone) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          try {
            const ev = JSON.parse(line.slice(5).trim()) as SyncEvent;
            setLog(prev => {
              const next = [...prev];
              if (ev.type === 'video' && ev.title) {
                const map = { added: 'ok', updated: 'update', skipped: 'skip' } as const;
                next.push({ text: ev.title, type: map[ev.action ?? 'skipped'] ?? 'info' });
              } else if (ev.type === 'error' && ev.message) {
                next.push({ text: ev.message, type: 'err' });
              } else if (ev.type === 'progress' && ev.message) {
                // حدّث آخر سطر info
                const lastInfo = [...next].reverse().findIndex(l => l.type === 'info');
                if (lastInfo !== -1) next[next.length - 1 - lastInfo] = { text: ev.message, type: 'info' };
                else next.push({ text: ev.message, type: 'info' });
              } else if (ev.type === 'processing' && ev.message) {
                next.push({ text: ev.message, type: 'info' });
              }
              if (ev.type === 'done') {
                setCounts({ added: ev.added ?? 0, updated: ev.updated ?? 0, skipped: ev.skipped ?? 0, errors: ev.errors ?? 0 });
                setRunning(false);
                setDone(true);
                onDone();
              }
              return next.slice(-200); // حد أقصى 200 سطر في الذاكرة
            });
          } catch { /* skip */ }
        }
      }
    } catch (err) {
      setLog(prev => [...prev, { text: String(err), type: 'err' }]);
      setRunning(false);
      setDone(true);
    }
  }

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  const logColors = { info: 'text-muted-foreground', ok: 'text-green-400', update: 'text-blue-400', skip: 'text-muted-foreground/50', err: 'text-destructive' };
  const logIcons = { info: '⏳', ok: '✅', update: '🔄', skip: '⏭️', err: '❌' };

  return (
    <AdminCard className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <RefreshCw className={cn('h-5 w-5 text-primary', running && 'animate-spin')} />
          <h3 className="font-display text-base font-bold">مزامنة فيديوهات الصفحة</h3>
        </div>
        {done && (
          <div className="flex flex-wrap items-center gap-2">
            <AdminBadge variant="success">+{counts.added} جديد</AdminBadge>
            <AdminBadge variant="primary">🔄 {counts.updated} محدَّث</AdminBadge>
            <AdminBadge variant="default">⏭️ {counts.skipped} بدون تغيير</AdminBadge>
            {counts.errors > 0 && <AdminBadge variant="error">{counts.errors} خطأ</AdminBadge>}
          </div>
        )}
      </div>

      {/* Log terminal */}
      {log.length > 0 && (
        <div ref={logRef}
          className="mb-4 h-64 overflow-y-auto rounded-xl border border-border bg-black/40 p-3 space-y-0.5 font-mono text-[11px]">
          {log.map((l, i) => (
            <p key={i} className={cn('leading-relaxed', logColors[l.type])}>
              <span className="mr-1.5 select-none">{logIcons[l.type]}</span>{l.text}
            </p>
          ))}
          {running && (
            <p className="flex items-center gap-1.5 text-primary animate-pulse">
              <Loader2 className="h-3 w-3 animate-spin" />جاري...
            </p>
          )}
        </div>
      )}

      <div className="flex items-center gap-3">
        <AdminButton variant="primary" onClick={startSync} disabled={running}>
          {running
            ? <><Loader2 className="h-4 w-4 animate-spin" />جاري المزامنة...</>
            : <><Play className="h-4 w-4" />{done ? 'مزامنة مجدداً' : 'بدء المزامنة الكاملة'}</>}
        </AdminButton>
        {!running && log.length > 0 && (
          <button onClick={() => { setLog([]); setDone(false); }}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            مسح السجل
          </button>
        )}
      </div>
    </AdminCard>
  );
}

/* ─── Sync Logs Table ────────────────────────────────────────────── */
function SyncLogsTable({ logs, onDeleteAll, deleting }: {
  logs: SyncLog[]; onDeleteAll: () => void; deleting: boolean;
}) {
  if (logs.length === 0) {
    return (
      <AdminCard className="flex flex-col items-center gap-3 py-10 text-center">
        <Clock className="h-8 w-8 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">لا توجد سجلات مزامنة بعد</p>
      </AdminCard>
    );
  }

  const statusConfig = {
    completed: { label: 'مكتملة', variant: 'success' as const },
    failed:    { label: 'فشلت',   variant: 'error' as const },
    running:   { label: 'جارية',  variant: 'warning' as const },
  };

  return (
    <AdminCard>
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <h3 className="text-sm font-semibold">سجل المزامنات ({logs.length})</h3>
        <AdminButton variant="danger" size="sm" onClick={onDeleteAll} disabled={deleting}>
          {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
          حذف الكل
        </AdminButton>
      </div>
      <div className="divide-y divide-border">
        {logs.map(log => {
          const cfg = statusConfig[log.status] ?? statusConfig.completed;
          return (
            <div key={log.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3">
              <AdminBadge variant={cfg.variant}>{cfg.label}</AdminBadge>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />{fmtDate(log.started_at)}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />{fmtDuration(log.started_at, log.finished_at)}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs mr-auto">
                <span className="text-green-400">+{log.added_count}</span>
                <span className="text-blue-400">🔄{log.updated_count}</span>
                <span className="text-muted-foreground/50">⏭️{log.skipped_count}</span>
                {log.error_count > 0 && <span className="text-destructive">❌{log.error_count}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </AdminCard>
  );
}

/* ─── Main Page ──────────────────────────────────────────────────── */
export function AdminVideoSyncPage() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [deleting, setDeleting] = useState(false);

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch('/api/videos/stats');
      const data = await res.json() as StatsData & { ok: boolean };
      if (data.ok) setStats(data);
    } catch { /* silent */ } finally { setLoadingStats(false); }
  }, []);

  const loadLogs = useCallback(async () => {
    try {
      const res = await fetch('/api/videos/sync-logs');
      const data = await res.json() as { ok: boolean; logs?: SyncLog[] };
      if (data.ok) setLogs(data.logs ?? []);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { void loadStats(); void loadLogs(); }, [loadStats, loadLogs]);

  async function handleDeleteAllVideos() {
    if (!confirm('هتحذف كل الفيديوهات؟ مش هترجع!')) return;
    setDeleting(true);
    try {
      await fetch('/api/videos', { method: 'DELETE' });
      await loadStats();
    } finally { setDeleting(false); }
  }

  function handleSyncDone() { void loadStats(); void loadLogs(); }

  if (loadingStats) return <AdminLoading label="جاري التحميل..." />;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-5"
    >
      {/* Stats */}
      {stats && <StatsStrip stats={stats} />}

      {/* Facebook not configured warning */}
      {stats && !stats.fbConfigured && (
        <AdminCard className="flex items-start gap-3 border-yellow-500/20 bg-yellow-500/5 p-4">
          <WifiOff className="mt-0.5 h-4 w-4 shrink-0 text-yellow-500" />
          <div>
            <p className="text-sm font-semibold text-yellow-500">Facebook غير مُهيأ</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              أضف <code className="rounded bg-secondary px-1 font-mono text-[10px]">FACEBOOK_ACCESS_TOKEN</code> و
              <code className="rounded bg-secondary px-1 font-mono text-[10px]">FACEBOOK_PAGE_ID</code> في متغيرات البيئة.
            </p>
          </div>
        </AdminCard>
      )}

      {/* Live Sync Panel */}
      <LiveSyncPanel onDone={handleSyncDone} />

      {/* Danger zone */}
      <AdminCard className="flex items-center justify-between border-destructive/20 p-4">
        <div>
          <p className="text-sm font-semibold text-destructive">حذف كل الفيديوهات</p>
          <p className="text-xs text-muted-foreground">يحذف كل الفيديوهات من قاعدة البيانات — لا يمكن التراجع</p>
        </div>
        <AdminButton variant="danger" size="sm" onClick={handleDeleteAllVideos} disabled={deleting}>
          {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          حذف الكل
        </AdminButton>
      </AdminCard>

      {/* Sync Logs */}
      <SyncLogsTable logs={logs} onDeleteAll={() => setLogs([])} deleting={false} />
    </motion.div>
  );
}
