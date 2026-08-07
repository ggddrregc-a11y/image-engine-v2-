import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wand2,
  Upload,
  X,
  Download,
  Share2,
  Loader2,
  ImageIcon,
  RotateCcw,
  Zap,
  Film,
  Users,
  Sparkles,
  Clock,
} from 'lucide-react';
import { PageContainer, PageHeader } from './shared';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useApp } from '@/components/providers/app-provider';
import { ASPECT_RATIOS } from '@/lib/mock-data';

/* ─── Count-up hook ──────────────────────────────────────────────── */
function useCountUp(target: number, duration = 1800) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (target === 0) return;
    let start = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setCount(target); clearInterval(timer); }
      else setCount(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration]);
  return count;
}

/* ─── Stats Card ─────────────────────────────────────────────────── */
function StatCard({ icon: Icon, label, value, color, delay }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; value: number | string; color: string; delay: number;
}) {
  const numVal = typeof value === 'number' ? value : 0;
  const count = useCountUp(numVal, 2000);
  const display = typeof value === 'string' ? value : count.toLocaleString('ar');

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay, ease: 'easeOut' }}
      className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card/40 p-5 text-center backdrop-blur-sm"
    >
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-2xl font-bold tabular-nums">{display}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </motion.div>
  );
}

export function EditorView() {
  const { toast } = useToast();
  const { credits, deductCredits, editCost } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadedImageName, setUploadedImageName] = useState('');
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [isLoading, setIsLoading] = useState(false);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [dragging, setDragging] = useState(false);

  // Stats
  const [stats, setStats] = useState({ visits: 0, edits: 0, videos: 0, lastUpdate: null as string | null });

  useEffect(() => {
    fetch('/api/stats')
      .then(r => r.json())
      .then((d: { ok: boolean; visits?: number; edits?: number; videos?: number; lastUpdate?: string | null }) => {
        if (d.ok) setStats({ visits: d.visits ?? 0, edits: d.edits ?? 0, videos: d.videos ?? 0, lastUpdate: d.lastUpdate ?? null });
      })
      .catch(() => {});
  }, []);

  const currentRatio = ASPECT_RATIOS.find((r) => r.value === aspectRatio)!;

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Invalid file', description: 'Please upload an image file', variant: 'destructive' });
      return;
    }
    setUploadedImageName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => setUploadedImage(e.target?.result as string);
    reader.readAsDataURL(file);
    setResultImage(null);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, []);

  const handleEdit = async () => {
    if (!uploadedImage || !prompt.trim()) return;

    // Check credits before proceeding
    if (credits < editCost) {
      toast({
        title: 'Insufficient credits',
        description: `You need ${editCost} credits to edit an image. You have ${credits}.`,
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    setResultImage(null);

    try {
      const res = await fetch('/api/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: prompt,
          imageUrl: uploadedImage,
          width: currentRatio.w,
          height: currentRatio.h,
        }),
      });

      const data = await res.json() as any;

      if (!data.ok) {
        toast({ title: 'Edit failed', description: data.error ?? 'Unknown error', variant: 'destructive' });
        return;
      }

      // Deduct credits only on success
      deductCredits(editCost);

      // زود عداد التحريرات
      fetch('/api/stats/edit', { method: 'POST' }).catch(() => {});

      if (data.imageData) {
        setResultImage(`data:image/png;base64,${data.imageData}`);
      } else if (data.imageUrl) {
        setResultImage(data.imageUrl);
      }

      toast({ title: 'Image edited successfully!' });
    } catch (err) {
      toast({ title: 'Error', description: String(err), variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setUploadedImage(null);
    setUploadedImageName('');
    setResultImage(null);
    setPrompt('');
  };

  return (
    <>
      <PageContainer>
        <PageHeader
          title="AI Image Editor"
          description="Upload an image and describe the edit you want"
          icon={Wand2}
        />

        <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
          {/* Left: Upload + Controls */}
          <div className="space-y-4">
            {/* Upload area */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => !uploadedImage && fileInputRef.current?.click()}
              className={cn(
                'relative flex min-h-64 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed transition-all',
                dragging ? 'border-primary bg-primary/5' : 'border-border bg-card/40 hover:border-primary/40',
                uploadedImage && 'cursor-default',
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />

              {uploadedImage ? (
                <>
                  <img
                    src={uploadedImage}
                    alt="Uploaded"
                    className="h-full max-h-72 w-full object-contain"
                  />
                  <button
                    onClick={(e) => { e.stopPropagation(); handleReset(); }}
                    className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-background/80 text-foreground backdrop-blur transition-colors hover:bg-background"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <div className="absolute bottom-3 left-3 rounded-lg bg-background/70 px-2 py-1 text-xs text-muted-foreground backdrop-blur">
                    {uploadedImageName}
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center gap-3 p-8 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-secondary">
                    <Upload className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Drop image here or click to upload</p>
                    <p className="mt-1 text-xs text-muted-foreground">PNG, JPG, WEBP supported</p>
                  </div>
                </div>
              )}
            </div>

            {/* Prompt */}
            <div className="rounded-2xl border border-border bg-card/40">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe the edit... e.g. 'Add a sunset sky background', 'Remove the person', 'Change the color to blue'"
                className="min-h-[100px] w-full resize-none bg-transparent px-4 py-3 text-sm outline-none placeholder:text-muted-foreground/60"
              />
              <div className="flex items-center justify-between border-t border-border px-4 py-2">
                <span className="text-xs text-muted-foreground">{prompt.length} / 5000 chars</span>
                {prompt && (
                  <button onClick={() => setPrompt('')} className="text-xs text-muted-foreground hover:text-foreground">
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Aspect Ratio */}
            <div className="rounded-2xl border border-border bg-card/40 p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Output Size</p>
              <div className="flex flex-wrap gap-2">
                {ASPECT_RATIOS.map((r) => (
                  <button
                    key={r.value}
                    onClick={() => setAspectRatio(r.value)}
                    className={cn(
                      'flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition-all',
                      aspectRatio === r.value
                        ? 'border-primary/40 bg-primary/10 text-primary'
                        : 'border-border bg-card/40 text-muted-foreground hover:border-primary/30 hover:text-foreground',
                    )}
                  >
                    <span
                      className="rounded-sm border border-current"
                      style={{ width: 16, height: 16 * (r.h / r.w), minHeight: 8 }}
                    />
                    {r.label}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">{currentRatio.w} × {currentRatio.h}px</p>
            </div>

            {/* Edit button */}
            <button
              onClick={handleEdit}
              disabled={!uploadedImage || !prompt.trim() || isLoading || credits < editCost}
              className={cn(
                'group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl py-4 text-base font-bold transition-all',
                !uploadedImage || !prompt.trim() || isLoading || credits < editCost
                  ? 'cursor-not-allowed bg-secondary text-muted-foreground'
                  : 'gradient-amber text-black hover:glow-amber',
              )}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Editing image...
                </>
              ) : credits < editCost ? (
                <>
                  <Zap className="h-5 w-5" />
                  Not enough credits ({credits}/{editCost})
                </>
              ) : (
                <>
                  <Wand2 className="h-5 w-5" />
                  Edit Image
                  {editCost > 0 && (
                    <span className="ml-1 flex items-center gap-0.5 rounded-md bg-black/20 px-1.5 py-0.5 text-xs font-medium">
                      <Zap className="h-3 w-3" />{editCost}
                    </span>
                  )}
                </>
              )}
            </button>
          </div>

          {/* Right: Result */}
          <div className="relative min-h-64 overflow-hidden rounded-2xl border border-border bg-card/40">
            {isLoading ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                <div
                  className="absolute inset-0 animate-pulse"
                  style={{ background: 'radial-gradient(circle at 50% 50%, hsl(var(--primary) / 0.1), transparent 70%)' }}
                />
                <Loader2 className="relative z-10 h-8 w-8 animate-spin text-primary" />
                <p className="relative z-10 text-sm text-muted-foreground">AI is editing your image...</p>
              </div>
            ) : resultImage ? (
              <>
                <img
                  src={resultImage}
                  alt="Edited result"
                  className="h-full w-full cursor-zoom-in object-contain transition-transform hover:scale-105"
                  onClick={() => setLightboxOpen(true)}
                />
                <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/60 to-transparent opacity-0 transition-opacity hover:opacity-100">
                  <div className="flex w-full items-center gap-2 p-3">
                    <button
                      onClick={() => setLightboxOpen(true)}
                      className="flex items-center gap-1.5 rounded-lg bg-black/40 px-2.5 py-1.5 text-xs font-medium text-white backdrop-blur"
                    >
                      <ImageIcon className="h-3.5 w-3.5" />
                      View
                    </button>
                    <a
                      href={resultImage}
                      download={`z-edit-${Date.now()}.png`}
                      className="flex items-center gap-1.5 rounded-lg bg-black/40 px-2.5 py-1.5 text-xs font-medium text-white backdrop-blur"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Save
                    </a>
                    <button
                      onClick={() => { setUploadedImage(resultImage); setResultImage(null); setPrompt(''); }}
                      className="flex items-center gap-1.5 rounded-lg bg-black/40 px-2.5 py-1.5 text-xs font-medium text-white backdrop-blur"
                      title="Use result as new input"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Re-edit
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                <ImageIcon className="h-12 w-12 opacity-20" />
                <p className="text-sm">Edited image will appear here</p>
              </div>
            )}
          </div>
        </div>
      </PageContainer>

      {/* Stats Section */}
      <div className="border-t border-border bg-card/20 py-10">
        <div className="mx-auto w-full max-w-4xl px-4">
          <motion.p
            initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
            className="mb-6 text-center text-xs font-semibold uppercase tracking-widest text-muted-foreground"
          >
            إحصاءات المنصة
          </motion.p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard icon={Users}    label="إجمالي الزوار"       value={stats.visits}  color="bg-blue-500/15 text-blue-400"   delay={0} />
            <StatCard icon={Sparkles} label="صورة تم تحريرها"     value={stats.edits}   color="bg-primary/15 text-primary"     delay={0.1} />
            <StatCard icon={Film}     label="فيديو في المكتبة"    value={stats.videos}  color="bg-purple-500/15 text-purple-400" delay={0.2} />
            <StatCard
              icon={Clock}
              label="آخر تحديث للمكتبة"
              value={stats.lastUpdate ? new Date(stats.lastUpdate).toLocaleDateString('ar', { month: 'short', day: 'numeric' }) : '—'}
              color="bg-green-500/15 text-green-400"
              delay={0.3}
            />
          </div>
        </div>
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxOpen && resultImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm"
            onClick={() => setLightboxOpen(false)}
          >
            <button
              onClick={() => setLightboxOpen(false)}
              className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            >
              <X className="h-5 w-5" />
            </button>
            <motion.img
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              src={resultImage}
              alt="Edited result"
              className="max-h-[80vh] max-w-[90vw] rounded-2xl object-contain shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="mt-6 flex gap-3"
              onClick={(e) => e.stopPropagation()}
            >
              <a
                href={resultImage}
                download={`z-edit-${Date.now()}.png`}
                className="flex items-center gap-2 rounded-xl bg-white/10 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur hover:bg-white/20"
              >
                <Download className="h-4 w-4" />
                Download
              </a>
              <button
                onClick={async () => {
                  try {
                    if (navigator.share) await navigator.share({ url: resultImage, title: 'Edited Image' });
                    else await navigator.clipboard.writeText(resultImage);
                  } catch { /* ignore */ }
                }}
                className="flex items-center gap-2 rounded-xl bg-white/10 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur hover:bg-white/20"
              >
                <Share2 className="h-4 w-4" />
                Share
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
