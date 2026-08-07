import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Copy,
  Clipboard,
  Star,
  Image as ImageIcon,
  X,
  Loader2,
  Download,
  Share2,
  Check,
  ChevronDown,
  ChevronUp,
  Zap,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useApp } from '@/components/providers/app-provider';
import { PageContainer } from './shared';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { PROMPT_TEMPLATES, FAVORITE_PROMPTS, ASPECT_RATIOS } from '@/lib/mock-data';

const MAX_CHARS = 5000;

interface ImageProviderOption {
  id: string;
  name: string;
  model_name: string;
  provider_type: string;
  base_url: string;
  api_key: string;
  is_default?: boolean;
}

export function GenerateView() {
  const {
    prompt,
    setPrompt,
    aspectRatio,
    setAspectRatio,
    credits,
    deductCredits,
    generateCost,
  } = useApp();
  const { toast } = useToast();

  const [imageProviders, setImageProviders] = useState<ImageProviderOption[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load image providers
  useEffect(() => {
    fetch('/api/image-providers')
      .then(r => r.json())
      .then((data: { ok: boolean; providers: ImageProviderOption[] }) => {
        if (data.ok && data.providers.length > 0) {
          setImageProviders(data.providers);
          const def = data.providers.find(p => p.is_default) ?? data.providers[0];
          setSelectedProviderId(def.id);
        }
      })
      .catch(() => {});
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [prompt]);

  const currentRatio = ASPECT_RATIOS.find(r => r.value === aspectRatio) ?? ASPECT_RATIOS[0];
  const selectedProvider = imageProviders.find(p => p.id === selectedProviderId);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast({ title: 'الـ Prompt مطلوب', description: 'اكتب وصف الصورة أولاً' });
      return;
    }
    if (!selectedProviderId || !selectedProvider) {
      toast({ title: 'اختر نموذج', description: 'أضف image provider من لوحة الأدمن أولاً' });
      return;
    }
    if (credits < generateCost) {
      toast({ title: 'رصيد غير كافي', description: `تحتاج ${generateCost} credits`, variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    setGeneratedImage(null);

    try {
      const res = await fetch('/api/image-providers/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider_type: selectedProvider.provider_type,
          base_url: selectedProvider.base_url,
          api_key: selectedProvider.api_key,
          model: selectedProvider.model_name,
          prompt: prompt.trim(),
          width: currentRatio.w,
          height: currentRatio.h,
        }),
      });

      const data = await res.json() as { ok: boolean; imageUrl?: string; error?: string };

      if (!data.ok || !data.imageUrl) {
        toast({ title: 'فشل التوليد', description: data.error ?? 'حدث خطأ غير متوقع', variant: 'destructive' });
        return;
      }

      setGeneratedImage(data.imageUrl);
      deductCredits(generateCost);
      toast({ title: 'تم توليد الصورة بنجاح!' });

      // Save to Supabase
      await supabase.from('generation_jobs').insert({
        prompt: prompt.trim(),
        model: selectedProvider.model_name || selectedProvider.name,
        status: 'complete',
        progress: 100,
        image_url: data.imageUrl,
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        eta_seconds: 0,
        error_message: '',
        current_node: '',
      });

    } catch (err) {
      toast({ title: 'خطأ', description: String(err), variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard?.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setPrompt(prompt ? prompt + ' ' + text : text);
    } catch { /* ignore */ }
  };

  return (
    <>
      <PageContainer>
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_360px]">

          {/* ── Left: Prompt + Settings ── */}
          <div className="space-y-5">

            {/* Prompt card */}
            <div className="rounded-2xl border border-border bg-card/60 p-5 backdrop-blur-sm">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Prompt</h2>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={handlePaste}
                    className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  >
                    <Clipboard className="h-3.5 w-3.5" />
                    Paste
                  </button>
                  <button
                    onClick={handleCopy}
                    disabled={!prompt}
                    className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-40"
                  >
                    {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>

              <textarea
                ref={textareaRef}
                value={prompt}
                onChange={e => setPrompt(e.target.value.slice(0, MAX_CHARS))}
                placeholder="صف الصورة التي تريد إنشاءها... مثال: 'صورة سينمائية لامرأة، إضاءة ذهبية، واقعية للغاية'"
                className="min-h-[140px] w-full resize-none bg-transparent text-base leading-relaxed outline-none placeholder:text-muted-foreground/60"
              />

              <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-3">
                <span className="text-xs text-muted-foreground">{prompt.length} / {MAX_CHARS}</span>
                <button onClick={() => setPrompt('')} className="text-xs text-muted-foreground transition-colors hover:text-foreground">
                  Clear
                </button>
              </div>
            </div>

            {/* Quick Templates */}
            <div className="rounded-2xl border border-border bg-card/40">
              <button
                onClick={() => setShowTemplates(v => !v)}
                className="flex w-full items-center justify-between px-4 py-3"
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  <Star className="h-4 w-4 text-primary" />
                  Quick Templates
                </span>
                {showTemplates
                  ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                }
              </button>
              <AnimatePresence>
                {showTemplates && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden border-t border-border"
                  >
                    <div className="flex flex-wrap gap-2 p-4">
                      {PROMPT_TEMPLATES.map(t => (
                        <button
                          key={t.id}
                          onClick={() => setPrompt(t.prompt)}
                          className="group flex items-center gap-2 rounded-xl border border-border bg-card/40 px-3 py-2 text-xs font-medium transition-all hover:border-primary/40 hover:bg-card"
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-primary/60 group-hover:bg-primary" />
                          {t.label}
                        </button>
                      ))}
                    </div>
                    <div className="space-y-2 px-4 pb-4">
                      {FAVORITE_PROMPTS.map((p, i) => (
                        <button
                          key={i}
                          onClick={() => setPrompt(p)}
                          className="flex w-full items-center gap-3 rounded-xl border border-border bg-card/40 px-3 py-2.5 text-left text-xs text-muted-foreground transition-all hover:border-primary/30 hover:bg-card hover:text-foreground"
                        >
                          <Star className="h-3.5 w-3.5 shrink-0 text-primary/60" />
                          <span className="line-clamp-1">{p}</span>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Aspect Ratio */}
            <div className="rounded-2xl border border-border bg-card/40 p-4">
              <label className="mb-3 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Aspect Ratio
              </label>
              <div className="flex flex-wrap gap-2">
                {ASPECT_RATIOS.map(r => (
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
            </div>

            {/* Model Selector */}
            {imageProviders.length > 0 && (
              <div className="rounded-2xl border border-border bg-card/40 p-4">
                <label className="mb-3 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Model
                </label>
                <div className="flex flex-wrap gap-2">
                  {imageProviders.map(p => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedProviderId(p.id)}
                      className={cn(
                        'rounded-xl border px-3 py-2 text-xs font-medium transition-all',
                        selectedProviderId === p.id
                          ? 'border-primary/40 bg-primary/10 text-primary'
                          : 'border-border bg-card/40 text-muted-foreground hover:border-primary/30 hover:text-foreground',
                      )}
                    >
                      {p.name}
                      {p.model_name && (
                        <span className="ml-1.5 opacity-60">· {p.model_name}</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {imageProviders.length === 0 && (
              <div className="rounded-2xl border border-border bg-card/40 p-4 text-center text-sm text-muted-foreground">
                لم يتم إضافة أي نماذج — اذهب إلى <span className="text-primary">Admin → Image Providers</span> لإضافة نموذج
              </div>
            )}
          </div>

          {/* ── Right: Generate + Preview ── */}
          <div className="space-y-5">

            {/* Generate button */}
            <div className="rounded-2xl border border-border bg-card/60 p-5 backdrop-blur-sm">
              <button
                onClick={handleGenerate}
                disabled={!prompt.trim() || isLoading || credits < generateCost || imageProviders.length === 0}
                className={cn(
                  'group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl py-4 text-base font-bold transition-all',
                  isLoading || credits < generateCost || imageProviders.length === 0
                    ? 'cursor-not-allowed bg-secondary text-muted-foreground'
                    : 'gradient-amber text-black hover:glow-amber',
                )}
              >
                {isLoading ? (
                  <><Loader2 className="h-5 w-5 animate-spin" />جاري التوليد...</>
                ) : credits < generateCost ? (
                  <><Zap className="h-5 w-5" />رصيد غير كافي ({credits}/{generateCost})</>
                ) : (
                  <>
                    <Sparkles className="h-5 w-5" />
                    Generate
                    {generateCost > 0 && (
                      <span className="ml-1 flex items-center gap-0.5 rounded-md bg-black/20 px-1.5 py-0.5 text-xs font-medium">
                        <Zap className="h-3 w-3" />{generateCost}
                      </span>
                    )}
                  </>
                )}
              </button>

              {/* Loading animation */}
              <AnimatePresence>
                {isLoading && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-4"
                  >
                    <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                      <div className="h-full w-full animate-pulse rounded-full gradient-amber opacity-70" />
                    </div>
                    <p className="mt-2 text-center text-xs text-muted-foreground">
                      {selectedProvider?.provider_type === 'pollinations'
                        ? 'Pollinations — جاري توليد الصورة مجاناً...'
                        : selectedProvider?.provider_type === 'gemini'
                        ? 'Gemini — جاري توليد الصورة...'
                        : 'جاري توليد الصورة...'}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Preview */}
            <div className="rounded-2xl border border-border bg-card/40 p-3">
              <div className="mb-2 px-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Preview</span>
              </div>
              <div
                className="relative overflow-hidden rounded-xl bg-secondary"
                style={{ aspectRatio: `${currentRatio.w} / ${currentRatio.h}` }}
              >
                {isLoading ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="absolute inset-0 animate-pulse"
                      style={{ background: 'radial-gradient(circle at 50% 50%, hsl(var(--primary) / 0.15), transparent 70%)' }}
                    />
                    <div className="relative z-10 flex flex-col items-center gap-3">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <span className="text-xs text-muted-foreground">جاري التوليد...</span>
                    </div>
                  </div>
                ) : generatedImage ? (
                  <>
                    <img
                      src={generatedImage}
                      alt="Generated"
                      className="h-full w-full cursor-zoom-in object-cover transition-transform hover:scale-105"
                      onClick={() => setLightboxOpen(true)}
                    />
                    <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/60 to-transparent opacity-0 transition-opacity hover:opacity-100">
                      <div className="flex w-full items-center gap-2 p-3">
                        <button
                          onClick={() => setLightboxOpen(true)}
                          className="flex items-center gap-1.5 rounded-lg bg-black/40 px-2.5 py-1.5 text-xs font-medium text-white backdrop-blur-sm transition-colors hover:bg-black/60"
                        >
                          <ImageIcon className="h-3.5 w-3.5" />
                          View
                        </button>
                        <a
                          href={generatedImage}
                          download={`image-${Date.now()}.png`}
                          className="flex items-center gap-1.5 rounded-lg bg-black/40 px-2.5 py-1.5 text-xs font-medium text-white backdrop-blur-sm transition-colors hover:bg-black/60"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Save
                        </a>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <ImageIcon className="h-8 w-8 opacity-30" />
                      <span className="text-xs opacity-60">لا توجد صورة بعد</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </PageContainer>

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxOpen && generatedImage && (
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
              src={generatedImage}
              alt="Generated"
              className="max-h-[80vh] max-w-[90vw] rounded-2xl object-contain shadow-2xl"
              onClick={e => e.stopPropagation()}
            />
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              className="mt-6 flex items-center gap-3"
              onClick={e => e.stopPropagation()}
            >
              <a
                href={generatedImage}
                download={`image-${Date.now()}.png`}
                className="flex items-center gap-2 rounded-xl bg-white/10 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/20"
              >
                <Download className="h-4 w-4" />
                Download
              </a>
              <button
                onClick={async () => {
                  try {
                    if (navigator.share) await navigator.share({ url: generatedImage, title: 'Generated Image' });
                    else await navigator.clipboard.writeText(generatedImage);
                  } catch { /* ignore */ }
                }}
                className="flex items-center gap-2 rounded-xl bg-white/10 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/20"
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
