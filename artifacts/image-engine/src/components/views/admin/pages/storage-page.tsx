
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HardDrive,
  Search,
  Star,
  Download,
  Trash2,
  X,
  Plus,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { StoredImage } from '@/lib/admin-types';
import {
  AdminCard,
  AdminButton,
  AdminInput,
  AdminBadge,
  AdminLoading,
  AdminEmptyState,
} from '../shared';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 12;

export function AdminStoragePage() {
  const [images, setImages] = useState<StoredImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [showAdd, setShowAdd] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [newPrompt, setNewPrompt] = useState('');
  const [newTags, setNewTags] = useState('');

  const fetchImages = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('stored_images').select('*', { count: 'exact' });

    if (search) {
      query = query.or(`prompt.ilike.%${search}%,model.ilike.%${search}%`);
    }
    if (tagFilter) {
      query = query.contains('tags', [tagFilter]);
    }

    query = query.order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    const { data, count } = await query;
    if (data) setImages(data as StoredImage[]);
    if (count !== null) setTotalCount(count);
    setLoading(false);
  }, [search, tagFilter, page]);

  useEffect(() => { fetchImages(); }, [fetchImages]);

  const allTags = Array.from(new Set(images.flatMap((img) => img.tags || [])));

  const handleDelete = async (id: string) => {
    await supabase.from('stored_images').delete().eq('id', id);
    fetchImages();
  };

  const handleToggleFavorite = async (img: StoredImage) => {
    await supabase.from('stored_images').update({ favorite: !img.favorite }).eq('id', img.id);
    fetchImages();
  };

  const handleAddImage = async () => {
    if (!newUrl.trim()) return;
    const tags = newTags.split(',').map((t) => t.trim()).filter(Boolean);
    await supabase.from('stored_images').insert({
      url: newUrl,
      prompt: newPrompt,
      model: 'manual-upload',
      tags,
    });
    setShowAdd(false);
    setNewUrl('');
    setNewPrompt('');
    setNewTags('');
    fetchImages();
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  if (loading && images.length === 0) return <AdminLoading label="Loading images..." />;

  return (
    <div>
      {/* Controls */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <AdminInput
            value={search}
            onChange={(v) => { setSearch(v); setPage(0); }}
            placeholder="Search by prompt or model..."
            className="pl-9"
          />
        </div>
        <AdminButton variant="primary" size="sm" onClick={() => setShowAdd((v) => !v)}>
          <Plus className="h-4 w-4" />
          Add Image
        </AdminButton>
      </div>

      {/* Tag filters */}
      {allTags.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            onClick={() => { setTagFilter(null); setPage(0); }}
            className={cn(
              'rounded-lg border px-2.5 py-1 text-xs font-medium transition-all',
              !tagFilter ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground',
            )}
          >
            All
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => { setTagFilter(tag); setPage(0); }}
              className={cn(
                'rounded-lg border px-2.5 py-1 text-xs font-medium transition-all',
                tagFilter === tag ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground',
              )}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* Add form */}
      <AnimatePresence>
        {showAdd && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <AdminCard className="mb-4 overflow-hidden border-primary/30 p-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="sm:col-span-1">
                  <AdminInput value={newUrl} onChange={setNewUrl} placeholder="Image URL" />
                </div>
                <div className="sm:col-span-1">
                  <AdminInput value={newPrompt} onChange={setNewPrompt} placeholder="Prompt" />
                </div>
                <div className="flex gap-2">
                  <AdminInput value={newTags} onChange={setNewTags} placeholder="tag1, tag2" className="flex-1" />
                  <AdminButton variant="primary" size="sm" onClick={handleAddImage} disabled={!newUrl.trim()}>
                    Add
                  </AdminButton>
                  <button
                    onClick={() => setShowAdd(false)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </AdminCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Grid */}
      {images.length === 0 ? (
        <AdminCard>
          <AdminEmptyState
            icon={HardDrive}
            title="No images stored"
            description="Generated images will appear here. You can also add images manually."
            action={
              <AdminButton variant="primary" size="sm" onClick={() => setShowAdd(true)}>
                <Plus className="h-4 w-4" /> Add Image
              </AdminButton>
            }
          />
        </AdminCard>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {images.map((img, i) => (
              <motion.div
                key={img.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: Math.min(i * 0.03, 0.2) }}
                className="group relative aspect-square overflow-hidden rounded-xl border border-border bg-secondary"
              >
                <img src={img.url} alt={img.prompt} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110" />

                {/* Favorite badge */}
                <button
                  onClick={() => handleToggleFavorite(img)}
                  className={cn(
                    'absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-lg backdrop-blur transition-all',
                    img.favorite ? 'bg-primary/80 text-black' : 'bg-background/60 text-foreground opacity-0 group-hover:opacity-100',
                  )}
                >
                  <Star className={cn('h-3.5 w-3.5', img.favorite && 'fill-current')} />
                </button>

                {/* Hover overlay */}
                <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/80 to-transparent opacity-0 transition-opacity group-hover:opacity-100">
                  <p className="line-clamp-2 px-2 pt-6 text-[10px] text-white/90">{img.prompt}</p>
                  <div className="flex items-center justify-between p-2">
                    <div className="flex flex-wrap gap-1">
                      {(img.tags || []).slice(0, 2).map((t) => (
                        <span key={t} className="rounded bg-background/60 px-1 py-0.5 text-[8px] text-white backdrop-blur">{t}</span>
                      ))}
                    </div>
                    <div className="flex gap-1">
                      <a
                        href={img.url}
                        download
                        className="flex h-6 w-6 items-center justify-center rounded bg-background/60 text-white backdrop-blur hover:bg-background"
                      >
                        <Download className="h-3 w-3" />
                      </a>
                      <button
                        onClick={() => handleDelete(img.id)}
                        className="flex h-6 w-6 items-center justify-center rounded bg-background/60 text-white backdrop-blur hover:bg-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-5 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Page {page + 1} of {totalPages} · {totalCount} images total
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
