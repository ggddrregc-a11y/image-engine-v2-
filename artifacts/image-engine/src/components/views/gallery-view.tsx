
import { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Images,
  Download,
  Share2,
  Trash2,
  Star,
  Copy,
  RotateCcw,
  X,
  Search,
  LayoutGrid,
  Rows3,
  Loader2,
} from 'lucide-react';
import { useApp } from '@/components/providers/app-provider';
import { PageContainer, PageHeader } from './shared';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { SAMPLE_IMAGES } from '@/lib/mock-data';
import type { StoredImage } from '@/lib/admin-types';

// Convert SAMPLE_IMAGES to StoredImage shape for fallback display
const FALLBACK_IMAGES: StoredImage[] = SAMPLE_IMAGES.map((img) => ({
  id: img.id,
  url: img.url,
  prompt: img.prompt,
  model: img.model,
  width: img.width,
  height: img.height,
  favorite: img.favorite,
  tags: [],
  created_at: img.createdAt,
}));

export function GalleryView() {
  const { setPrompt, setActiveView } = useApp();
  const [images, setImages] = useState<StoredImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'favorites'>('all');
  const [layout, setLayout] = useState<'masonry' | 'grid'>('masonry');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<StoredImage | null>(null);

  const fetchImages = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('stored_images')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data && data.length > 0) {
        setImages(data as StoredImage[]);
      } else {
        // Supabase empty or unavailable — show sample images as fallback
        setImages(FALLBACK_IMAGES);
      }
    } catch {
      setImages(FALLBACK_IMAGES);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchImages(); }, [fetchImages]);

  const filtered = useMemo(() => {
    let result = images;
    if (filter === 'favorites') result = result.filter((img) => img.favorite);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (img) =>
          img.prompt.toLowerCase().includes(q) ||
          img.model.toLowerCase().includes(q),
      );
    }
    return result;
  }, [images, filter, search]);

  const toggleFavorite = async (img: StoredImage) => {
    await supabase.from('stored_images').update({ favorite: !img.favorite }).eq('id', img.id);
    setImages((prev) => prev.map((i) => i.id === img.id ? { ...i, favorite: !i.favorite } : i));
  };

  const deleteImage = async (id: string) => {
    await supabase.from('stored_images').delete().eq('id', id);
    setImages((prev) => prev.filter((i) => i.id !== id));
    if (selected?.id === id) setSelected(null);
  };

  const handleReuse = (img: StoredImage) => {
    setPrompt(img.prompt);
    setActiveView('generate');
  };

  return (
    <PageContainer>
      <PageHeader
        title="Gallery"
        description={`${filtered.length} images in your workspace`}
        icon={Images}
        actions={
          <>
            <div className="relative hidden sm:block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="h-9 w-44 rounded-xl border border-border bg-card/50 pl-9 pr-3 text-sm outline-none transition-colors focus:border-primary/40"
              />
            </div>
            <div className="flex rounded-xl border border-border bg-card/50 p-1">
              <button
                onClick={() => setLayout('masonry')}
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-lg transition-colors',
                  layout === 'masonry' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setLayout('grid')}
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-lg transition-colors',
                  layout === 'grid' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Rows3 className="h-4 w-4" />
              </button>
            </div>
          </>
        }
      />

      <div className="mt-5 flex gap-2">
        {(['all', 'favorites'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'rounded-xl border px-3 py-1.5 text-sm font-medium capitalize transition-all',
              filter === f
                ? 'border-primary/40 bg-primary/10 text-primary'
                : 'border-border bg-card/40 text-muted-foreground hover:text-foreground',
            )}
          >
            {f === 'favorites' && <Star className="mr-1.5 inline h-3.5 w-3.5" />}
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="mt-16 flex flex-col items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm">Loading gallery...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-16 flex flex-col items-center justify-center gap-3 text-muted-foreground">
          <Images className="h-12 w-12 opacity-40" />
          <p>{search ? 'No images found' : 'No images yet — generate your first image!'}</p>
        </div>
      ) : layout === 'masonry' ? (
        <div className="mt-6 columns-2 gap-4 sm:columns-3 lg:columns-4 xl:columns-5">
          {filtered.map((img, i) => (
            <GalleryCard
              key={img.id}
              img={img}
              index={i}
              onFavorite={() => toggleFavorite(img)}
              onClick={() => setSelected(img)}
              onReuse={() => handleReuse(img)}
            />
          ))}
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filtered.map((img, i) => (
            <GalleryCard
              key={img.id}
              img={img}
              index={i}
              onFavorite={() => toggleFavorite(img)}
              onClick={() => setSelected(img)}
              onReuse={() => handleReuse(img)}
              fixed
            />
          ))}
        </div>
      )}

      <AnimatePresence>
        {selected && (
          <Lightbox
            image={selected}
            onClose={() => setSelected(null)}
            onFavorite={() => toggleFavorite(selected)}
            onReuse={() => handleReuse(selected)}
            onDelete={() => deleteImage(selected.id)}
          />
        )}
      </AnimatePresence>
    </PageContainer>
  );
}

function GalleryCard({
  img,
  index,
  onFavorite,
  onClick,
  onReuse,
  fixed = false,
}: {
  img: StoredImage;
  index: number;
  onFavorite: () => void;
  onClick: () => void;
  onReuse: () => void;
  fixed?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(img.prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.4), duration: 0.3 }}
      className={cn(
        'group relative mb-4 break-inside-avoid overflow-hidden rounded-xl border border-border bg-card/40 cursor-pointer',
        fixed && 'aspect-square',
      )}
      onClick={onClick}
    >
      <img
        src={img.url}
        alt={img.prompt}
        className={cn('w-full object-cover transition-transform duration-500 group-hover:scale-105', fixed ? 'h-full' : 'auto')}
        loading="lazy"
      />

      <button
        onClick={(e) => { e.stopPropagation(); onFavorite(); }}
        className={cn(
          'absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-lg backdrop-blur transition-all',
          img.favorite ? 'bg-primary/80 text-black opacity-100' : 'bg-background/60 text-foreground opacity-0 group-hover:opacity-100',
        )}
      >
        <Star className={cn('h-4 w-4', img.favorite && 'fill-current')} />
      </button>

      <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100">
        <p className="line-clamp-2 px-3 pt-8 text-xs text-white/90">{img.prompt}</p>
        <div className="flex items-center justify-between p-3">
          <span className="rounded-md bg-background/60 px-2 py-1 text-[10px] font-medium text-white backdrop-blur">
            {img.model}
          </span>
          <div className="flex gap-1">
            <button
              onClick={handleCopy}
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-background/60 text-white backdrop-blur transition-colors hover:bg-background"
              title="Copy prompt"
            >
              {copied ? <span className="text-[10px] font-bold text-success">✓</span> : <Copy className="h-3.5 w-3.5" />}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onReuse(); }}
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-background/60 text-white backdrop-blur transition-colors hover:bg-background"
              title="Reuse prompt"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
            <a
              href={img.url}
              download={`z-image-${new Date(img.created_at).getTime()}.png`}
              onClick={(e) => e.stopPropagation()}
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-background/60 text-white backdrop-blur transition-colors hover:bg-background"
              title="Download"
            >
              <Download className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function Lightbox({
  image,
  onClose,
  onFavorite,
  onReuse,
  onDelete,
}: {
  image: StoredImage;
  onClose: () => void;
  onFavorite: () => void;
  onReuse: () => void;
  onDelete: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-md"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-xl bg-card/80 text-foreground backdrop-blur transition-colors hover:bg-card"
      >
        <X className="h-5 w-5" />
      </button>

      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="flex max-h-full w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-border bg-card lg:flex-row"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-1 overflow-hidden bg-black lg:max-h-[80vh]">
          <img
            src={image.url}
            alt={image.prompt}
            className="h-full max-h-[40vh] w-full object-contain lg:max-h-[80vh]"
          />
        </div>

        <div className="flex w-full flex-col gap-4 overflow-y-auto p-5 lg:w-80 lg:max-h-[80vh]">
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Prompt</h3>
            <p className="text-sm leading-relaxed">{image.prompt}</p>
          </div>

          <div className="grid grid-cols-2 gap-3 border-t border-border pt-4 text-sm">
            <MetaInfo label="Model" value={image.model} />
            <MetaInfo label="Size" value={`${image.width}×${image.height}`} />
            <MetaInfo label="Date" value={new Date(image.created_at).toLocaleDateString()} />
          </div>

          {image.tags && image.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {image.tags.map((tag) => (
                <span key={tag} className="rounded-md bg-secondary px-2 py-0.5 text-xs text-muted-foreground">{tag}</span>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            <button
              onClick={onReuse}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl gradient-amber py-2.5 text-sm font-semibold text-black transition-all hover:glow-amber"
            >
              <RotateCcw className="h-4 w-4" />
              Reuse
            </button>
            <button
              onClick={onFavorite}
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-xl border transition-colors',
                image.favorite ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground',
              )}
            >
              <Star className={cn('h-4 w-4', image.favorite && 'fill-current')} />
            </button>
            <a
              href={image.url}
              download={`z-image-${new Date(image.created_at).getTime()}.png`}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-border text-muted-foreground transition-colors hover:text-foreground"
            >
              <Download className="h-4 w-4" />
            </a>
            <button
              onClick={async () => {
                try {
                  if (navigator.share) await navigator.share({ url: image.url, title: 'Generated Image' });
                  else await navigator.clipboard.writeText(image.url);
                } catch { /* ignore */ }
              }}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-border text-muted-foreground transition-colors hover:text-foreground"
            >
              <Share2 className="h-4 w-4" />
            </button>
            <button
              onClick={onDelete}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-destructive/30 text-destructive transition-colors hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function MetaInfo({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-medium">{value}</p>
    </div>
  );
}
