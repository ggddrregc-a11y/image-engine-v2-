
import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  History,
  Check,
  X,
  Ban,
  Clock,
  RotateCcw,
  Copy,
  Filter,
  Loader2,
  Image as ImageIcon,
} from 'lucide-react';
import { useApp } from '@/components/providers/app-provider';
import { PageContainer, PageHeader } from './shared';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import type { GenerationJobDB } from '@/lib/admin-types';

const STATUS_CONFIG = {
  complete: { icon: Check, color: 'text-success', bg: 'bg-success/10', label: 'Complete' },
  failed: { icon: X, color: 'text-destructive', bg: 'bg-destructive/10', label: 'Failed' },
  canceled: { icon: Ban, color: 'text-muted-foreground', bg: 'bg-secondary', label: 'Canceled' },
  queued: { icon: Clock, color: 'text-muted-foreground', bg: 'bg-secondary', label: 'Queued' },
  running: { icon: Clock, color: 'text-primary', bg: 'bg-primary/10', label: 'Running' },
};

export function HistoryView() {
  const { setPrompt, setActiveView } = useApp();
  const [jobs, setJobs] = useState<GenerationJobDB[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'complete' | 'failed' | 'canceled'>('all');

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('generation_jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    if (data) setJobs(data as GenerationJobDB[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  const entries = filter === 'all' ? jobs : jobs.filter((j) => j.status === filter);

  const handleReuse = (prompt: string) => {
    setPrompt(prompt);
    setActiveView('generate');
  };

  const durationSeconds = (job: GenerationJobDB) => {
    if (!job.started_at || !job.completed_at) return null;
    const diff = new Date(job.completed_at).getTime() - new Date(job.started_at).getTime();
    return Math.round(diff / 1000);
  };

  return (
    <PageContainer>
      <PageHeader
        title="History"
        description="Track all your generation activity"
        icon={History}
      />

      <div className="mt-5 flex flex-wrap gap-2">
        {(['all', 'complete', 'failed', 'canceled'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm font-medium capitalize transition-all',
              filter === f
                ? 'border-primary/40 bg-primary/10 text-primary'
                : 'border-border bg-card/40 text-muted-foreground hover:text-foreground',
            )}
          >
            <Filter className="h-3 w-3" />
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="mt-16 flex flex-col items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm">Loading history...</p>
        </div>
      ) : entries.length === 0 ? (
        <div className="mt-16 flex flex-col items-center justify-center gap-3 text-muted-foreground">
          <History className="h-12 w-12 opacity-40" />
          <p>No history yet — generate your first image!</p>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card/40">
          {entries.map((job, i) => {
            const config = STATUS_CONFIG[job.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.complete;
            const StatusIcon = config.icon;
            const dur = durationSeconds(job);

            return (
              <motion.div
                key={job.id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(i * 0.05, 0.3) }}
                className={cn(
                  'group flex items-center gap-4 px-4 py-3 transition-colors hover:bg-secondary/30',
                  i !== entries.length - 1 && 'border-b border-border/50',
                )}
              >
                {/* Thumbnail */}
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-border bg-secondary">
                  {job.image_url ? (
                    <img src={job.image_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <ImageIcon className="h-5 w-5 text-muted-foreground opacity-40" />
                    </div>
                  )}
                </div>

                {/* Prompt + model */}
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-sm font-medium">{job.prompt}</p>
                  <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{job.model}</span>
                    {dur !== null && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {dur}s
                      </span>
                    )}
                  </div>
                </div>

                {/* Status */}
                <div className={cn('hidden items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium sm:flex', config.bg, config.color)}>
                  <StatusIcon className="h-3.5 w-3.5" />
                  {config.label}
                </div>

                {/* Timestamp */}
                <span className="hidden w-32 shrink-0 text-right text-xs text-muted-foreground md:block">
                  {new Date(job.created_at).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>

                {/* Actions */}
                <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={() => navigator.clipboard?.writeText(job.prompt)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    title="Copy prompt"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleReuse(job.prompt)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    title="Reuse prompt"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </PageContainer>
  );
}
