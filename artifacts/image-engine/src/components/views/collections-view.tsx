
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FolderOpen, Plus, MoreHorizontal, Images, Trash2, X, Check, Loader2 } from 'lucide-react';
import { PageContainer, PageHeader } from './shared';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import type { StoredImage } from '@/lib/admin-types';

interface Collection {
  id: string;
  name: string;
  description: string;
  created_at: string;
  cover_url?: string;
  image_count?: number;
}

export function CollectionsView() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Collection | null>(null);
  const [collectionImages, setCollectionImages] = useState<StoredImage[]>([]);
  const [allImages, setAllImages] = useState<StoredImage[]>([]);

  const fetchCollections = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('collections')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) {
      // Get image count and cover for each collection
      const enriched = await Promise.all(
        (data as Collection[]).map(async (col) => {
          const { data: imgs } = await supabase
            .from('collection_images')
            .select('stored_images(url)')
            .eq('collection_id', col.id)
            .limit(1);
          const { count } = await supabase
            .from('collection_images')
            .select('*', { count: 'exact', head: true })
            .eq('collection_id', col.id);
          const cover = imgs?.[0] ? (imgs[0] as any).stored_images?.url : undefined;
          return { ...col, cover_url: cover, image_count: count ?? 0 };
        }),
      );
      setCollections(enriched);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchCollections(); }, [fetchCollections]);

  const openCollection = async (col: Collection) => {
    setSelected(col);
    const { data } = await supabase
      .from('collection_images')
      .select('stored_images(*)')
      .eq('collection_id', col.id)
      .order('added_at', { ascending: false });
    if (data) {
      setCollectionImages(data.map((r: any) => r.stored_images as StoredImage));
    }
    // Load all images for adding
    const { data: all } = await supabase.from('stored_images').select('*').order('created_at', { ascending: false });
    if (all) setAllImages(all as StoredImage[]);
  };

  const addImageToCollection = async (imageId: string) => {
    if (!selected) return;
    await supabase.from('collection_images').upsert({ collection_id: selected.id, image_id: imageId });
    openCollection(selected);
  };

  const removeImageFromCollection = async (imageId: string) => {
    if (!selected) return;
    await supabase.from('collection_images').delete().eq('collection_id', selected.id).eq('image_id', imageId);
    setCollectionImages((prev) => prev.filter((i) => i.id !== imageId));
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    await supabase.from('collections').insert({ name: newName.trim(), description: newDesc.trim() });
    setNewName('');
    setNewDesc('');
    setShowForm(false);
    setSaving(false);
    fetchCollections();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('collections').delete().eq('id', id);
    setCollections((prev) => prev.filter((c) => c.id !== id));
  };

  return (
    <PageContainer>
      <PageHeader
        title="Collections"
        description="Organize your best generations"
        icon={FolderOpen}
        actions={
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 rounded-xl gradient-amber px-4 py-2 text-sm font-semibold text-black transition-all hover:glow-amber"
          >
            <Plus className="h-4 w-4" />
            New Collection
          </button>
        }
      />

      {/* New collection form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 overflow-hidden rounded-2xl border border-primary/30 bg-card/40 p-5"
          >
            <h3 className="mb-4 font-semibold">New Collection</h3>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Collection name..."
              className="mb-3 h-10 w-full rounded-xl border border-border bg-background/50 px-3 text-sm outline-none focus:border-primary/40"
            />
            <input
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Description (optional)..."
              className="mb-4 h-10 w-full rounded-xl border border-border bg-background/50 px-3 text-sm outline-none focus:border-primary/40"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} className="rounded-xl border border-border px-4 py-2 text-sm">Cancel</button>
              <button
                onClick={handleCreate}
                disabled={!newName.trim() || saving}
                className="flex items-center gap-2 rounded-xl gradient-amber px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Create
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="mt-16 flex flex-col items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm">Loading collections...</p>
        </div>
      ) : collections.length === 0 ? (
        <div className="mt-16 flex flex-col items-center justify-center gap-3 text-muted-foreground">
          <FolderOpen className="h-12 w-12 opacity-40" />
          <p>No collections yet — create your first one!</p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {collections.map((col, i) => (
            <motion.div
              key={col.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.06, 0.3) }}
              whileHover={{ y: -4 }}
              className="group cursor-pointer overflow-hidden rounded-2xl border border-border bg-card/40 transition-all hover:border-primary/30 hover:glow-soft"
              onClick={() => openCollection(col)}
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-secondary">
                {col.cover_url ? (
                  <img src={col.cover_url} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Images className="h-10 w-10 text-muted-foreground opacity-30" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-lg bg-background/70 px-2 py-1 text-xs font-medium backdrop-blur">
                  <Images className="h-3.5 w-3.5 text-primary" />
                  {col.image_count}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(col.id); }}
                  className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg bg-background/70 text-destructive opacity-0 backdrop-blur transition-all hover:bg-background group-hover:opacity-100"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="p-4">
                <h3 className="font-display text-base font-bold tracking-tight">{col.name}</h3>
                {col.description && <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{col.description}</p>}
                <p className="mt-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                  Created {new Date(col.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Collection detail modal */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
            onClick={() => setSelected(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-border bg-card"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-border p-5">
                <div>
                  <h2 className="font-display text-lg font-bold">{selected.name}</h2>
                  {selected.description && <p className="text-sm text-muted-foreground">{selected.description}</p>}
                </div>
                <button onClick={() => setSelected(null)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-border text-muted-foreground hover:text-foreground">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5">
                {collectionImages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
                    <Images className="h-10 w-10 opacity-30" />
                    <p className="text-sm">No images yet — add from your gallery below</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5">
                    {collectionImages.map((img) => (
                      <div key={img.id} className="group relative aspect-square overflow-hidden rounded-xl border border-border bg-secondary">
                        <img src={img.url} alt={img.prompt} className="h-full w-full object-cover" />
                        <button
                          onClick={() => removeImageFromCollection(img.id)}
                          className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-destructive/80 text-white opacity-0 transition-opacity group-hover:opacity-100"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {allImages.filter((img) => !collectionImages.find((ci) => ci.id === img.id)).length > 0 && (
                  <div className="mt-6">
                    <h3 className="mb-3 text-sm font-semibold text-muted-foreground">Add from Gallery</h3>
                    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5">
                      {allImages
                        .filter((img) => !collectionImages.find((ci) => ci.id === img.id))
                        .map((img) => (
                          <button
                            key={img.id}
                            onClick={() => addImageToCollection(img.id)}
                            className="group relative aspect-square overflow-hidden rounded-xl border border-border bg-secondary opacity-60 transition-opacity hover:opacity-100"
                          >
                            <img src={img.url} alt={img.prompt} className="h-full w-full object-cover" />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                              <Plus className="h-6 w-6 text-white" />
                            </div>
                          </button>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </PageContainer>
  );
}
