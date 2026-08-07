import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Download, Search, X, Play, Clock, Calendar,
  ChevronLeft, ChevronRight, Film, ExternalLink,
  Plus, Trash2, Loader2, Link,
} from 'lucide-react';
import { PageContainer, PageHeader } from './shared';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

/* ─── Types ─────────────────────────────────────────────────────── */
interface VideoFormat { quality: string; ext: string; url: string; filesize?: number }
interface PageVideo {
  id: string; title: string; thumbnail_url: string;
  published_at: string | null; duration_seconds: number;
  post_url: string; download_formats: VideoFormat[];
}

/* ─── Helpers ───────────────────────────────────────────────────── */
function fmtDuration(s: number) {
  if (!s) return '';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  return `${m}:${String(sec).padStart(2,'0')}`;
}
function fmtDate(iso: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('ar', { year: 'numeric', month: 'long', day: 'numeric' });
}
function fmtSize(bytes?: number) {
  if (!bytes) return '';
  if (bytes > 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
  if (bytes > 1_000_000) return `${(bytes / 1_000_000).toFixed(0)} MB`;
  return `${(bytes / 1_000).toFixed(0)} KB`;
}
const QUALITY_COLORS: Record<string, string> = {
  '1080p': 'bg-purple-500/15 text-purple-400 border-purple-500/20',
  '720p':  'bg-blue-500/15 text-blue-400 border-blue-500/20',
  '480p':  'bg-green-500/15 text-green-400 border-green-500/20',
  '360p':  'bg-yellow-500/15 text-yellow-400 border-yellow-500/20',
  'HD':    'bg-purple-500/15 text-purple-400 border-purple-500/20',
  'SD':    'bg-blue-500/15 text-blue-400 border-blue-500/20',
  'audio': 'bg-pink-500/15 text-pink-400 border-pink-500/20',
};

/* ─── Download Modal ────────────────────────────────────────────── */
function DownloadModal({ video, onClose }: { video: PageVideo; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        className="relative w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl overflow-hidden"
      >
        <div className="flex items-start gap-3 p-5 border-b border-border">
          <img src={video.thumbnail_url} alt={video.title}
            className="h-16 w-28 shrink-0 rounded-xl object-cover bg-secondary"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold leading-snug line-clamp-2">{video.title}</p>
            {video.duration_seconds > 0 && (
              <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                <Clock className="h-3 w-3" />{fmtDuration(video.duration_seconds)}
              </p>
            )}
          </div>
          <button onClick={onClose} className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-secondary">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">اختر الجودة</p>
          {video.download_formats.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <ExternalLink className="h-8 w-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">روابط التحميل غير متوفرة</p>
              <a href={video.post_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-secondary">
                <ExternalLink className="h-3.5 w-3.5" />فتح المنشور الأصلي
              </a>
            </div>
          ) : (
            video.download_formats.map(fmt => (
              <a key={fmt.quality} href={fmt.url} download target="_blank" rel="noopener noreferrer"
                className="group flex items-center gap-3 rounded-xl border border-border bg-card/50 px-4 py-3 transition-all hover:border-primary/30 hover:bg-card hover:shadow-sm">
                <span className={cn('shrink-0 rounded-lg border px-2.5 py-1 text-xs font-bold',
                  QUALITY_COLORS[fmt.quality] ?? 'bg-secondary text-foreground border-border')}>
                  {fmt.quality}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{fmt.quality === 'audio' ? 'صوت فقط' : `فيديو ${fmt.quality}`}</p>
                  <p className="text-[11px] text-muted-foreground">{fmt.ext.toUpperCase()}{fmt.filesize ? ` · ${fmtSize(fmt.filesize)}` : ''}</p>
                </div>
                <Download className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
              </a>
            ))
          )}
        </div>
        {video.post_url && video.download_formats.length > 0 && (
          <div className="border-t border-border px-4 py-3">
            <a href={video.post_url} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground">
              <ExternalLink className="h-3 w-3" />فتح المنشور الأصلي
            </a>
          </div>
        )}
      </motion.div>
    </div>
  );
}

/* ─── Add Video Panel ───────────────────────────────────────────── */
function AddVideoPanel({ onAdded }: { onAdded: (v: PageVideo) => void }) {
  const { toast } = useToast();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleAdd() {
    const trimmed = url.trim();
    if (!trimmed) return;
    setLoading(true);
    try {
      const res = await fetch('/api/videos/extract-single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed }),
      });
      const data = await res.json() as { ok: boolean; video?: PageVideo; error?: string };
      if (data.ok && data.video) {
        toast({ title: 'تم الإضافة بنجاح', description: data.video.title });
        onAdded(data.video);
        setUrl('');
      } else {
        toast({ title: 'فشل الاستخراج', description: data.error ?? 'تعذّر استخراج الفيديو', variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'خطأ', description: String(err), variant: 'destructive' });
    } finally { setLoading(false); }
  }

  return (
    <div className="mb-5 rounded-2xl border border-primary/20 bg-primary/5 p-4">
      <p className="mb-2.5 flex items-center gap-2 text-sm font-semibold text-primary">
        <Link className="h-4 w-4" />أضف فيديو برابطه
      </p>
      <div className="flex gap-2">
        <input
          value={url} onChange={e => setUrl(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          placeholder="https://www.facebook.com/watch?v=... أو /reel/ أو /videos/"
          className="flex-1 rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary/50"
        />
        <button onClick={handleAdd} disabled={loading || !url.trim()}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-black disabled:opacity-50 hover:opacity-90 transition-opacity">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {loading ? 'جاري...' : 'إضافة'}
        </button>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        ملاحظة: استخدم الرابط المباشر للفيديو (يحتوي على /videos/ أو /reel/ أو watch?v=)
      </p>
    </div>
  );
}

/* ─── Video Card ────────────────────────────────────────────────── */
function VideoCard({ video, onDownload, onDelete }: {
  video: PageVideo; onDownload: (v: PageVideo) => void; onDelete: (id: string) => void;
}) {
  const [imgErr, setImgErr] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const bestQuality = video.download_formats[0]?.quality ?? null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -2 }}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card/50 transition-all hover:border-primary/30 hover:bg-card hover:shadow-lg"
    >
      {/* Delete button */}
      <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
        {confirmDel ? (
          <div className="flex items-center gap-1">
            <button onClick={() => onDelete(video.id)}
              className="rounded-lg bg-destructive px-2 py-1 text-[10px] font-medium text-white hover:opacity-90">تأكيد</button>
            <button onClick={() => setConfirmDel(false)}
              className="rounded-lg bg-black/60 px-2 py-1 text-[10px] text-white hover:bg-black/80">إلغاء</button>
          </div>
        ) : (
          <button onClick={() => setConfirmDel(true)}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-black/60 text-white backdrop-blur-sm hover:bg-destructive transition-colors">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Thumbnail */}
      <div className="relative aspect-video w-full overflow-hidden bg-secondary">
        {!imgErr && video.thumbnail_url ? (
          <img src={video.thumbnail_url} alt={video.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            onError={() => setImgErr(true)} />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Film className="h-10 w-10 text-muted-foreground/30" />
          </div>
        )}
        <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/20" />
        <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/60 backdrop-blur-sm">
            <Play className="h-5 w-5 text-white translate-x-0.5" />
          </div>
        </div>
        {video.duration_seconds > 0 && (
          <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-lg bg-black/70 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">
            <Clock className="h-2.5 w-2.5" />{fmtDuration(video.duration_seconds)}
          </div>
        )}
        {bestQuality && (
          <div className={cn('absolute top-2 left-2 rounded-lg border px-2 py-0.5 text-[10px] font-bold backdrop-blur-sm',
            QUALITY_COLORS[bestQuality] ?? 'bg-secondary/80 text-foreground border-border')}>
            {bestQuality}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-1 flex-col p-3.5">
        <p className="line-clamp-2 text-sm font-medium leading-snug">{video.title}</p>
        <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
          {video.published_at && (
            <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{fmtDate(video.published_at)}</span>
          )}
          {video.download_formats.length > 0 && (
            <span className="flex items-center gap-1">
              <Download className="h-3 w-3" />{video.download_formats.length} جودة
            </span>
          )}
        </div>
        <button onClick={() => onDownload(video)}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary/10 px-3 py-2 text-sm font-medium text-primary transition-all hover:bg-primary hover:text-black">
          <Download className="h-3.5 w-3.5" />تحميل
        </button>
      </div>
    </motion.div>
  );
}

/* ─── Main View ─────────────────────────────────────────────────── */
const PAGE_SIZE = 20;

export function VideosView() {
  const { toast } = useToast();
  const [videos, setVideos] = useState<PageVideo[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<PageVideo | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async (p: number, q: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(PAGE_SIZE) });
      if (q) params.set('search', q);
      const res = await fetch(`/api/videos?${params}`);
      const data = await res.json() as { ok: boolean; videos?: PageVideo[]; total?: number };
      if (data.ok) { setVideos(data.videos ?? []); setTotal(data.total ?? 0); }
    } catch { /* silent */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(page, query); }, [page, query, load]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault(); setPage(1); setQuery(search);
  }
  function clearSearch() { setSearch(''); setQuery(''); setPage(1); searchRef.current?.focus(); }

  function handleAdded(v: PageVideo) {
    setVideos(prev => [v, ...prev.filter(x => x.id !== v.id)]);
    setTotal(p => p + 1);
  }

  async function handleDelete(id: string) {
    try {
      await fetch(`/api/videos/${id}`, { method: 'DELETE' });
      setVideos(prev => prev.filter(v => v.id !== id));
      setTotal(p => Math.max(0, p - 1));
      toast({ title: 'تم الحذف' });
    } catch { toast({ title: 'خطأ في الحذف', variant: 'destructive' }); }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col overflow-hidden">
      <PageContainer>
        <PageHeader
          title="مركز تحميل الفيديوهات"
          description={total > 0 ? `${total} فيديو متاح للتحميل` : 'أضف فيديوهات وشاركها'}
          icon={Film}
        />

        {/* Add Video */}
        <div className="mt-5">
          <AddVideoPanel onAdded={handleAdded} />
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="flex gap-2 mb-5">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input ref={searchRef} value={search} onChange={e => setSearch(e.target.value)}
              placeholder="ابحث باسم الفيديو..."
              className="w-full rounded-xl border border-border bg-card/80 py-2.5 pr-9 pl-9 text-sm outline-none transition-colors focus:border-primary/50" />
            {search && (
              <button type="button" onClick={clearSearch}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <button type="submit"
            className="rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-black hover:opacity-90 transition-opacity">
            بحث
          </button>
        </form>

        {/* Grid */}
        <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 380px)' }}>
          {loading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="overflow-hidden rounded-2xl border border-border bg-card/50 animate-pulse">
                  <div className="aspect-video bg-secondary" />
                  <div className="p-3.5 space-y-2">
                    <div className="h-4 w-3/4 rounded bg-secondary" />
                    <div className="h-3 w-1/2 rounded bg-secondary" />
                    <div className="h-8 w-full rounded-xl bg-secondary" />
                  </div>
                </div>
              ))}
            </div>
          ) : videos.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center gap-5 py-16 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-border bg-card/50">
                <Film className="h-10 w-10 text-muted-foreground/30" />
              </div>
              <div>
                <p className="font-semibold">{query ? 'لا توجد نتائج' : 'لا توجد فيديوهات بعد'}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {query ? `لم يتم العثور على فيديوهات تطابق "${query}"` : 'أضف أول فيديو من خلال الحقل أعلاه'}
                </p>
              </div>
              {query && (
                <button onClick={clearSearch} className="flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-secondary">
                  <X className="h-3.5 w-3.5" />مسح البحث
                </button>
              )}
            </motion.div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                <AnimatePresence mode="popLayout">
                  {videos.map((v, i) => (
                    <motion.div key={v.id} layout initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.03 }}>
                      <VideoCard video={v} onDownload={setSelected} onDelete={handleDelete} />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
              {totalPages > 1 && (
                <div className="mt-8 flex items-center justify-center gap-2">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-border text-muted-foreground hover:bg-secondary disabled:opacity-40">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(7, totalPages) }).map((_, i) => {
                      let p = i + 1;
                      if (totalPages > 7) {
                        if (page <= 4) p = i + 1;
                        else if (page >= totalPages - 3) p = totalPages - 6 + i;
                        else p = page - 3 + i;
                      }
                      return (
                        <button key={p} onClick={() => setPage(p)}
                          className={cn('flex h-9 w-9 items-center justify-center rounded-xl text-sm font-medium transition-all',
                            p === page ? 'bg-primary text-black' : 'border border-border text-muted-foreground hover:bg-secondary')}>
                          {p}
                        </button>
                      );
                    })}
                  </div>
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-border text-muted-foreground hover:bg-secondary disabled:opacity-40">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </PageContainer>

      <AnimatePresence>
        {selected && <DownloadModal video={selected} onClose={() => setSelected(null)} />}
      </AnimatePresence>
    </div>
  );
}
