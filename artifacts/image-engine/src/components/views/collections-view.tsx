
import { motion } from 'framer-motion';
import { FolderOpen, Plus, MoreHorizontal, Images } from 'lucide-react';
import { PageContainer, PageHeader } from './shared';
import { COLLECTIONS, SAMPLE_IMAGES } from '@/lib/mock-data';

export function CollectionsView() {
  return (
    <PageContainer>
      <PageHeader
        title="Collections"
        description="Organize your best generations"
        icon={FolderOpen}
        actions={
          <button className="flex items-center gap-2 rounded-xl gradient-amber px-4 py-2 text-sm font-semibold text-black transition-all hover:glow-amber">
            <Plus className="h-4 w-4" />
            New Collection
          </button>
        }
      />

      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {COLLECTIONS.map((col, i) => {
          const images = SAMPLE_IMAGES.filter((img) => img.collectionId === col.id);
          const preview = images.length > 0 ? images : SAMPLE_IMAGES.slice(0, 3);

          return (
            <motion.div
              key={col.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.06, 0.3) }}
              whileHover={{ y: -4 }}
              className="group cursor-pointer overflow-hidden rounded-2xl border border-border bg-card/40 transition-all hover:border-primary/30 hover:glow-soft"
            >
              {/* Cover */}
              <div className="relative aspect-[4/3] overflow-hidden">
                <div className="grid h-full w-full grid-cols-2 gap-0.5">
                  {preview.slice(0, 4).map((img, j) => (
                    <div key={img.id} className="overflow-hidden bg-secondary">
                      <img
                        src={img.url}
                        alt=""
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                        style={{ gridColumn: j === 0 && preview.length === 1 ? 'span 2' : undefined }}
                      />
                    </div>
                  ))}
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-lg bg-background/70 px-2 py-1 text-xs font-medium backdrop-blur">
                  <Images className="h-3.5 w-3.5 text-primary" />
                  {col.count}
                </div>
                <button className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg bg-background/70 text-foreground opacity-0 backdrop-blur transition-all hover:bg-background group-hover:opacity-100">
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </div>

              {/* Info */}
              <div className="p-4">
                <h3 className="font-display text-base font-bold tracking-tight">{col.name}</h3>
                <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                  {col.description}
                </p>
                <p className="mt-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                  Created {new Date(col.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </PageContainer>
  );
}
