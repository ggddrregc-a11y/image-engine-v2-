
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ListOrdered,
  RotateCw,
  X,
  Check,
  AlertCircle,
  Loader2,
  Clock,
  Cpu,
  Plus,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { GenerationJobDB, JobStatus } from '@/lib/admin-types';
import {
  AdminCard,
  AdminButton,
  AdminBadge,
  AdminLoading,
  AdminEmptyState,
} from '../shared';
import { cn } from '@/lib/utils';

const STATUS_CONFIG: Record<JobStatus, { icon: React.ComponentType<{ className?: string }>; color: string; bg: string; label: string }> = {
  queued: { icon: Clock, color: 'text-muted-foreground', bg: 'bg-secondary', label: 'Queued' },
  running: { icon: Loader2, color: 'text-primary', bg: 'bg-primary/10', label: 'Running' },
  complete: { icon: Check, color: 'text-success', bg: 'bg-success/10', label: 'Complete' },
  failed: { icon: AlertCircle, color: 'text-destructive', bg: 'bg-destructive/10', label: 'Failed' },
  canceled: { icon: X, color: 'text-muted-foreground', bg: 'bg-secondary', label: 'Canceled' },
};

export function AdminQueuePage() {
  const [jobs, setJobs] = useState<GenerationJobDB[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | JobStatus>('all');

  const fetchJobs = useCallback(async () => {
    const { data } = await supabase
      .from('generation_jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    if (data) setJobs(data as GenerationJobDB[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 3000);
    return () => clearInterval(interval);
  }, [fetchJobs]);

  const handleCancel = async (id: string) => {
    await supabase.from('generation_jobs').update({
      status: 'canceled',
      completed_at: new Date().toISOString(),
    }).eq('id', id);
    fetchJobs();
  };

  const handleRetry = async (job: GenerationJobDB) => {
    await supabase.from('generation_jobs').insert({
      prompt: job.prompt,
      model: job.model,
      status: 'queued',
      progress: 0,
      provider_id: job.provider_id,
    });
    fetchJobs();
  };

  const handleAddTestJob = async () => {
    const testPrompts = [
      'cinematic portrait, golden hour lighting',
      'neon cyberpunk cityscape at night',
      'ethereal fantasy landscape, floating islands',
      'minimalist product shot, studio lighting',
    ];
    await supabase.from('generation_jobs').insert({
      prompt: testPrompts[Math.floor(Math.random() * testPrompts.length)],
      model: 'lumen-xl-v2.1',
      status: 'queued',
      progress: 0,
      eta_seconds: 14,
    });
    fetchJobs();
  };

  const filtered = filter === 'all' ? jobs : jobs.filter((j) => j.status === filter);

  const counts = {
    queued: jobs.filter((j) => j.status === 'queued').length,
    running: jobs.filter((j) => j.status === 'running').length,
    complete: jobs.filter((j) => j.status === 'complete').length,
    failed: jobs.filter((j) => j.status === 'failed').length,
  };

  if (loading) return <AdminLoading label="Loading queue..." />;

  return (
    <div>
      {/* Summary cards */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {([
          ['queued', 'Queued', Clock],
          ['running', 'Running', Loader2],
          ['complete', 'Completed', Check],
          ['failed', 'Failed', AlertCircle],
        ] as const).map(([key, label, Icon]) => (
          <AdminCard key={key} className="p-4">
            <div className="flex items-center gap-3">
              <div className={cn(
                'flex h-9 w-9 items-center justify-center rounded-lg',
                STATUS_CONFIG[key].bg,
              )}>
                <Icon className={cn('h-4 w-4', STATUS_CONFIG[key].color, key === 'running' && 'animate-spin')} />
              </div>
              <div>
                <p className="font-display text-xl font-bold tabular-nums">{counts[key as keyof typeof counts]}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </div>
          </AdminCard>
        ))}
      </div>

      {/* Filter + add */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {(['all', 'queued', 'running', 'complete', 'failed', 'canceled'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'rounded-xl border px-3 py-1.5 text-xs font-medium capitalize transition-all',
                filter === f
                  ? 'border-primary/40 bg-primary/10 text-primary'
                  : 'border-border bg-card/40 text-muted-foreground hover:text-foreground',
              )}
            >
              {f}
            </button>
          ))}
        </div>
        <AdminButton variant="secondary" size="sm" onClick={handleAddTestJob}>
          <Plus className="h-4 w-4" />
          Add Test Job
        </AdminButton>
      </div>

      {/* Jobs list */}
      {filtered.length === 0 ? (
        <AdminCard>
          <AdminEmptyState
            icon={ListOrdered}
            title="Queue is empty"
            description="No generation jobs in the queue. Add a test job to see it here."
            action={
              <AdminButton variant="primary" size="sm" onClick={handleAddTestJob}>
                <Plus className="h-4 w-4" /> Add Test Job
              </AdminButton>
            }
          />
        </AdminCard>
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {filtered.map((job, i) => {
              const config = STATUS_CONFIG[job.status];
              const StatusIcon = config.icon;
              return (
                <motion.div
                  key={job.id}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 12 }}
                  transition={{ delay: Math.min(i * 0.03, 0.2) }}
                >
                  <AdminCard className="p-3.5">
                    <div className="flex items-center gap-4">
                      {/* Status icon */}
                      <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', config.bg)}>
                        <StatusIcon className={cn('h-4 w-4', config.color, job.status === 'running' && 'animate-spin')} />
                      </div>

                      {/* Prompt + model */}
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-1 text-sm font-medium">{job.prompt || '(empty prompt)'}</p>
                        <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                          <span>{job.model}</span>
                          {job.current_node && job.status === 'running' && (
                            <span className="flex items-center gap-1">
                              <Cpu className="h-3 w-3" />
                              {job.current_node}
                            </span>
                          )}
                          {job.eta_seconds > 0 && job.status === 'running' && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              ~{job.eta_seconds}s
                            </span>
                          )}
                          {job.error_message && (
                            <span className="text-destructive">{job.error_message}</span>
                          )}
                        </div>
                      </div>

                      {/* Progress bar (running) */}
                      {job.status === 'running' && (
                        <div className="hidden w-32 sm:block">
                          <div className="mb-1 flex justify-between text-xs">
                            <span className="text-muted-foreground">Progress</span>
                            <span className="font-semibold tabular-nums">{job.progress}%</span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                            <motion.div
                              className="h-full rounded-full gradient-amber"
                              animate={{ width: `${job.progress}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Status badge */}
                      <AdminBadge variant={
                        job.status === 'complete' ? 'success' :
                        job.status === 'failed' ? 'error' :
                        job.status === 'running' ? 'primary' :
                        'default'
                      }>
                        {config.label}
                      </AdminBadge>

                      {/* Actions */}
                      <div className="flex shrink-0 gap-1">
                        {(job.status === 'queued' || job.status === 'running') && (
                          <button
                            onClick={() => handleCancel(job.id)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                            title="Cancel"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                        {(job.status === 'failed' || job.status === 'canceled') && (
                          <button
                            onClick={() => handleRetry(job)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                            title="Retry"
                          >
                            <RotateCw className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </AdminCard>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
