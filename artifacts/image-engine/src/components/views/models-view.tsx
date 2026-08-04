
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Boxes, Search, Download, Heart, Upload, Check } from 'lucide-react';
import { PageContainer, PageHeader } from './shared';
import { cn } from '@/lib/utils';
import { MODELS } from '@/lib/mock-data';

const TYPE_FILTERS = ['all', 'checkpoint', 'lora', 'vae', 'controlnet'] as const;

export function ModelsView() {
  const [filter, setFilter] = useState<(typeof TYPE_FILTERS)[number]>('all');
  const [search, setSearch] = useState('');
  const [activeModel, setActiveModel] = useState('Lumen-XL v2.1');

  const models = MODELS.filter((m) => {
    if (filter !== 'all' && m.type !== filter) return false;
    if (search && !m.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <PageContainer>
      <PageHeader
        title="Models"
        description="Manage checkpoints, LoRAs, and ControlNets"
        icon={Boxes}
        actions={
          <button className="flex items-center gap-2 rounded-xl gradient-amber px-4 py-2 text-sm font-semibold text-black transition-all hover:glow-amber">
            <Upload className="h-4 w-4" />
            Upload Model
          </button>
        }
      />

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search models..."
            className="h-10 w-full rounded-xl border border-border bg-card/50 pl-9 pr-3 text-sm outline-none transition-colors focus:border-primary/40"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {TYPE_FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'rounded-xl border px-3 py-2 text-sm font-medium capitalize transition-all',
                filter === f
                  ? 'border-primary/40 bg-primary/10 text-primary'
                  : 'border-border bg-card/40 text-muted-foreground hover:text-foreground',
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {models.map((m, i) => {
          const isActive = activeModel === m.name;
          return (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.05, 0.3) }}
              whileHover={{ y: -2 }}
              className={cn(
                'group rounded-2xl border bg-card/40 p-5 transition-all hover:glow-soft',
                isActive ? 'border-primary/40' : 'border-border hover:border-primary/30',
              )}
            >
              <div className="flex items-start justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl gradient-amber text-black">
                  <Boxes className="h-6 w-6" />
                </div>
                <span className="rounded-lg bg-secondary px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {m.type}
                </span>
              </div>

              <h3 className="mt-4 font-display text-base font-bold tracking-tight">{m.name}</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">Base: {m.base}</p>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {m.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-md border border-border bg-secondary/50 px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Download className="h-3.5 w-3.5" />
                  {(m.downloads / 1000).toFixed(1)}k
                </span>
                <span className="flex items-center gap-1">
                  <Heart className="h-3.5 w-3.5" />
                  {(m.likes / 1000).toFixed(1)}k
                </span>
                <span className="ml-auto">{m.size}</span>
              </div>

              <div className="mt-4 flex items-center gap-2 border-t border-border/50 pt-4">
                <button
                  onClick={() => setActiveModel(m.name)}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all',
                    isActive
                      ? 'bg-primary/15 text-primary'
                      : 'bg-secondary text-foreground hover:bg-secondary/70',
                  )}
                >
                  {isActive ? (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      Active
                    </>
                  ) : (
                    'Use Model'
                  )}
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>
    </PageContainer>
  );
}
