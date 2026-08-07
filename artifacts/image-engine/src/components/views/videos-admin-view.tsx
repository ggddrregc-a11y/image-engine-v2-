import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Video, RefreshCw, Plus, Trash2, Edit2, Check, X,
  AlertCircle, Clock, Database, Link, Play, ChevronDown,
  BarChart2, Loader2,
} from 'lucide-react';
import { PageContainer, PageHeader } from './shared';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

/* ─── Types ─────────────────────────────────────────────────────── */
interface VideoFormat { quality: string; ext: string; url: string; filesize?: number }
interface PageVideo {
  id: string; fb_video_id: string; title: string; thumbnail_url: string;
  published_at: string | null; duration_seconds: number; post_url: string;
  download_formats: VideoFormat[]; created_at: string; updated_at: string;
}
interface SyncLog {
  id: string; page_url: string; status: 'running' | 'completed' | 'failed';
  added_count: number; updated_count: number; skipped_count: number;
  error_count: number; error_details: string[]; started_at: string; finished_at: string | null;
}
interface SyncEvent {
  type: 'start' | 'progress' | 'video' | 'error' | 'done';
  message?: string; action?: 'added' | 'updated' | 'skipped'; title?: string;
  added?: number; updated?: number; skipped?: number; errors?: number;
}
interface Stats { total: number; lastSync: { started_at: string; status: string } | null }

/* ─── Helpers ───────────────────────────────────────────────────── */
function fmtDuration(s: number) {
  if (!s) return '--';
  const m = Math.floor(s / 60), sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}
function fmtDate(iso: string | null) {
  if (!iso) return '--';
  return new Date(iso).toLocaleDateString('ar', { year: 'numeric', month: 'short', day: 'numeric' });
}

/* ─── EditModal ─────────────────────────────────────────────────── */
function EditModal({ video, onClose, onSave }: {
  video: PageVideo; onClose: () => void;
  onSave: (id: string, data: Partial<PageVideo>) => Promise<void>;
}) {
  const [title, setTitle] = useState(video.title);
  const [thumbnail, setThumbnail] = useState(video.thumbnail_url);
  const [postUrl, setPostUrl] = useState(video.post_url);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await onSave(video.id, { title, thumbnail_url: thumbnail, post_url: postUrl });
    setSaving(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
        className="relative w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">تعديل الفيديو</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-4">
          {[['العنوان', title, setTitle], ['رابط الصورة المصغرة', thumbnail, setThumbnail], ['رابط المنشور', postUrl, setPostUrl]].map(([label, val, setter]) => (
            <div key={label as string}>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{label as string}</label>
              <input value={val as string} onChange={e => (setter as (v: string) => void)(e.target.value)}
                className="w-full rounded-xl border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-primary/50" />
            </div>
          ))}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-secondary">إلغاء</button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-black disabled:opacity-60">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            حفظ
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/* ─── SyncPanel ─────────────────────────────────────────────────── */
function SyncPanel({ onSyncDone }: { onSyncDone: () => void }) {
  const { toast } = useToast();
  const [pageUrl, setPageUrl] = useState('');
  const [singleUrl, setSingleUrl] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [progress, setProgress] = useState<SyncEvent[]>([]);
  const [report, setReport] = useState<{ added: number; updated: number; skipped: number; errors: number } | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => { logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' }); }, [progress]);

  async function startSync() {
    if (!pageUrl.trim()) return;
    setSyncing(true); setProgress([]); setReport(null);
    try {
      const res = await fetch('/api/videos/sync', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page_url: pageUrl.trim() }),
      });
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error('No response body');
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const ev = JSON.parse(line.slice(6)) as SyncEvent;
            setProgress(p => [...p, ev]);
            if (ev.type === 'done') {
              setReport({ added: ev.added ?? 0, updated: ev.updated ?? 0, skipped: ev.skipped ?? 0, errors: ev.errors ?? 0 });
              onSyncDone();
            }
          } catch { /* skip */ }
        }
      }
    } catch (err) {
      toast({ title: 'خطأ', description: String(err), variant: 'destructive' });
    } finally { setSyncing(false); }
  }

  async function extractSingle() {
    if (!singleUrl.trim()) return;
    setExtracting(true);
    try {
      const res = await fetch('/api/videos/extract-single', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: singleUrl.trim() }),
      });
      const data = await res.json() as { ok: boolean; error?: string; video?: { title: string } };
      if (data.ok) {
        toast({ title: 'تم بنجاح', description: `تم إضافة: ${data.video?.title}` });
        setSingleUrl(''); onSyncDone();
      } else {
        toast({ title: 'فشل الاستخراج', description: data.error, variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'خطأ', description: String(err), variant: 'destructive' });
    } finally { setExtracting(false); }
  }

  const progressPct = report ? 100 : syncing && progress.length > 0 ? Math.min(95, progress.length * 2) : 0;

  return (
    <div className="space-y-4">
      {/* مزامنة الصفحة */}
      <div className="rounded-2xl border border-border bg-card/50 p-5">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><RefreshCw className="h-4 w-4 text-primary" />مزامنة صفحة فيسبوك</h3>
        <div className="flex gap-2">
          <input value={pageUrl} onChange={e => setPageUrl(e.target.value)} placeholder="https://www.facebook.com/yourpage/videos"
            className="flex-1 rounded-xl border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-primary/50" />
          <button onClick={startSync} disabled={syncing || !pageUrl.trim()}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-black disabled:opacity-50">
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {syncing ? 'جاري...' : 'بدء المزامنة'}
          </button>
        </div>
        {(syncing || report) && (
          <div className="mt-3">
            <div className="mb-1 flex justify-between text-xs text-muted-foreground">
              <span>تقدم المزامنة</span><span>{progressPct}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
              <motion.div className="h-full rounded-full bg-primary" animate={{ width: `${progressPct}%` }} transition={{ duration: 0.3 }} />
            </div>
          </div>
        )}
        {progress.length > 0 && (
          <div ref={logRef} className="mt-3 max-h-40 overflow-y-auto rounded-xl border border-border bg-secondary/50 p-3 space-y-1 text-xs">
            {progress.map((ev, i) => (
              <div key={i} className={cn('flex items-start gap-2', ev.type === 'error' ? 'text-destructive' : ev.type === 'done' ? 'text-primary font-medium' : 'text-muted-foreground')}>
                <span className="mt-0.5 shrink-0">{ev.type === 'error' ? '✗' : ev.type === 'done' ? '✓' : ev.action === 'added' ? '+' : ev.action === 'updated' ? '↑' : ev.action === 'skipped' ? '—' : '·'}</span>
                <span>{ev.message ?? (ev.title ? `${ev.action === 'added' ? 'أُضيف' : ev.action === 'updated' ? 'حُدِّث' : 'تجاهل'}: ${ev.title}` : '')}</span>
              </div>
            ))}
          </div>
        )}
        {report && (
          <div className="mt-3 grid grid-cols-4 gap-2">
            {[['أُضيف', report.added, 'text-green-500'], ['حُدِّث', report.updated, 'text-blue-500'], ['تجاهل', report.skipped, 'text-muted-foreground'], ['أخطاء', report.errors, 'text-destructive']].map(([label, count, color]) => (
              <div key={label as string} className="rounded-xl border border-border bg-card/50 p-2 text-center">
                <p className={cn('text-xl font-bold', color as string)}>{count as number}</p>
                <p className="text-[10px] text-muted-foreground">{label as string}</p>
              </div>
            ))}
          </div>
        )}
      </div>
      {/* إضافة فيديو واحد */}
      <div className="rounded-2xl border border-border bg-card/50 p-5">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><Link className="h-4 w-4 text-primary" />إضافة فيديو واحد برابطه</h3>
        <div className="flex gap-2">
          <input value={singleUrl} onChange={e => setSingleUrl(e.target.value)} placeholder="https://www.facebook.com/watch?v=..."
            className="flex-1 rounded-xl border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-primary/50" />
          <button onClick={extractSingle} disabled={extracting || !singleUrl.trim()}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-black disabled:opacity-50">
            {extracting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {extracting ? 'جاري...' : 'استخراج'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Admin View ───────────────────────────────────────────── */
export function VideosAdminView() {
  const { toast } = useToast();
  const [videos, setVideos] = useState<PageVideo[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, lastSync: null });
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [editTarget, setEditTarget] = useState<PageVideo | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleteAllConfirm, setDeleteAllConfirm] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'videos' | 'sync'>('sync');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [vRes, sRes, lRes] = await Promise.all([
        fetch('/api/videos?limit=50'),
        fetch('/api/videos/stats'),
        fetch('/api/videos/sync-logs'),
      ]);
      const [vData, sData, lData] = await Promise.all([vRes.json(), sRes.json(), lRes.json()]) as [
        { ok: boolean; videos?: PageVideo[] },
        { ok: boolean; total?: number; lastSync?: Stats['lastSync'] },
        { ok: boolean; logs?: SyncLog[] },
      ];
      if (vData.ok) setVideos(vData.videos ?? []);
      if (sData.ok) setStats({ total: sData.total ?? 0, lastSync: sData.lastSync ?? null });
      if (lData.ok) setSyncLogs(lData.logs ?? []);
    } catch { /* silent */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(id: string) {
    try {
      await fetch(`/api/videos/${id}`, { method: 'DELETE' });
      setVideos(p => p.filter(v => v.id !== id));
      setStats(p => ({ ...p, total: p.total - 1 }));
      setDeleteConfirm(null);
      toast({ title: 'تم الحذف' });
    } catch { toast({ title: 'خطأ في الحذف', variant: 'destructive' }); }
  }

  async function handleDeleteAll() {
    try {
      await fetch('/api/videos', { method: 'DELETE' });
      setVideos([]); setStats(p => ({ ...p, total: 0 }));
      setDeleteAllConfirm(false);
      toast({ title: 'تم حذف جميع الفيديوهات' });
    } catch { toast({ title: 'خطأ', variant: 'destructive' }); }
  }

  async function handleSave(id: string, data: Partial<PageVideo>) {
    await fetch(`/api/videos/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    setVideos(p => p.map(v => v.id === id ? { ...v, ...data } : v));
    toast({ title: 'تم الحفظ' });
  }

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col overflow-hidden">
      <PageContainer>
        <PageHeader title="إدارة فيديوهات الصفحة" description="مزامنة وإدارة فيديوهات صفحة فيسبوك" icon={Video}
          actions={
            <div className="flex items-center gap-2">
              <button onClick={load} className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-secondary">
                <RefreshCw className="h-3 w-3" />تحديث
              </button>
              {videos.length > 0 && (
                <button onClick={() => setDeleteAllConfirm(true)} className="flex items-center gap-1.5 rounded-xl border border-destructive/30 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10">
                  <Trash2 className="h-3 w-3" />حذف الكل
                </button>
              )}
            </div>
          }
        />

        {/* Stats Bar */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[
            { icon: Database, label: 'إجمالي الفيديوهات', value: stats.total },
            { icon: Clock, label: 'آخر مزامنة', value: stats.lastSync ? fmtDate(stats.lastSync.started_at) : 'لم تتم بعد' },
            { icon: BarChart2, label: 'حالة آخر مزامنة', value: stats.lastSync?.status === 'completed' ? 'ناجحة ✓' : stats.lastSync?.status === 'failed' ? 'فشلت ✗' : 'لا يوجد' },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="rounded-2xl border border-border bg-card/50 px-4 py-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><Icon className="h-3.5 w-3.5 text-primary" />{label}</div>
              <p className="text-lg font-bold">{value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="mt-5 flex gap-1 rounded-xl border border-border bg-secondary/40 p-1 w-fit">
          {([['sync', 'المزامنة'], ['videos', 'الفيديوهات']] as const).map(([tab, label]) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={cn('rounded-lg px-4 py-1.5 text-sm font-medium transition-all', activeTab === tab ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
              {label} {tab === 'videos' && `(${stats.total})`}
            </button>
          ))}
        </div>

        <div className="mt-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 360px)' }}>
          {activeTab === 'sync' && <SyncPanel onSyncDone={load} />}
          {activeTab === 'videos' && (
            loading ? (
              <div className="flex flex-col gap-3">{[1,2,3].map(i => <div key={i} className="h-20 rounded-2xl border border-border animate-pulse bg-card/50" />)}</div>
            ) : videos.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
                <Video className="h-12 w-12 text-muted-foreground/30" />
                <p className="text-muted-foreground">لا توجد فيديوهات بعد. ابدأ المزامنة من تبويب "المزامنة"</p>
              </div>
            ) : (
              <div className="space-y-2">
                {videos.map((v, i) => (
                  <motion.div key={v.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                    className="flex items-center gap-3 rounded-2xl border border-border bg-card/50 p-3 hover:border-primary/20 hover:bg-card transition-all">
                    <img src={v.thumbnail_url} alt={v.title} className="h-14 w-24 shrink-0 rounded-xl object-cover bg-secondary" onError={e => { (e.target as HTMLImageElement).src = ''; }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{v.title}</p>
                      <div className="flex items-center gap-3 mt-0.5 text-[11px] text-muted-foreground">
                        <span>{fmtDate(v.published_at)}</span>
                        <span>{fmtDuration(v.duration_seconds)}</span>
                        <span>{v.download_formats.length} جودة</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => setEditTarget(v)} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground">
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      {deleteConfirm === v.id ? (
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleDelete(v.id)} className="rounded-lg bg-destructive/10 px-2 py-1 text-xs text-destructive hover:bg-destructive/20">تأكيد</button>
                          <button onClick={() => setDeleteConfirm(null)} className="rounded-lg px-2 py-1 text-xs text-muted-foreground hover:bg-secondary">إلغاء</button>
                        </div>
                      ) : (
                        <button onClick={() => setDeleteConfirm(v.id)} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            )
          )}
        </div>

        {/* Sync Logs toggle */}
        {syncLogs.length > 0 && (
          <div className="mt-4">
            <button onClick={() => setLogsOpen(v => !v)} className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
              <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', logsOpen && 'rotate-180')} />
              سجل المزامنة ({syncLogs.length})
            </button>
            <AnimatePresence>
              {logsOpen && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  className="mt-2 overflow-hidden rounded-xl border border-border">
                  <div className="divide-y divide-border">
                    {syncLogs.map(log => (
                      <div key={log.id} className="flex items-center gap-3 px-4 py-2.5 text-xs">
                        <span className={cn('h-2 w-2 rounded-full shrink-0', log.status === 'completed' ? 'bg-green-500' : log.status === 'failed' ? 'bg-destructive' : 'bg-yellow-500')} />
                        <span className="text-muted-foreground flex-1 truncate">{log.page_url}</span>
                        <span className="text-green-500">+{log.added_count}</span>
                        <span className="text-blue-500">↑{log.updated_count}</span>
                        <span className="text-muted-foreground">—{log.skipped_count}</span>
                        {log.error_count > 0 && <span className="text-destructive">✗{log.error_count}</span>}
                        <span className="text-muted-foreground shrink-0">{fmtDate(log.started_at)}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </PageContainer>

      {/* Edit Modal */}
      {editTarget && <EditModal video={editTarget} onClose={() => setEditTarget(null)} onSave={handleSave} />}

      {/* Delete All Confirm */}
      <AnimatePresence>
        {deleteAllConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDeleteAllConfirm(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
              className="relative rounded-2xl border border-border bg-card p-6 shadow-xl max-w-sm w-full">
              <div className="flex items-center gap-3 mb-3"><AlertCircle className="h-5 w-5 text-destructive shrink-0" /><h3 className="font-bold">حذف جميع الفيديوهات؟</h3></div>
              <p className="text-sm text-muted-foreground mb-5">سيتم حذف {stats.total} فيديو نهائياً. هذا الإجراء لا يمكن التراجع عنه.</p>
              <div className="flex justify-end gap-2">
                <button onClick={() => setDeleteAllConfirm(false)} className="rounded-xl border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-secondary">إلغاء</button>
                <button onClick={handleDeleteAll} className="rounded-xl bg-destructive px-4 py-2 text-sm font-medium text-white hover:opacity-90">حذف الكل</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
