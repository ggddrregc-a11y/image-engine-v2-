'use client';

import { motion } from 'framer-motion';
import { Workflow, Plus, Play, Pause, Copy, MoreHorizontal, GitBranch } from 'lucide-react';
import { PageContainer, PageHeader } from './shared';
import { cn } from '@/lib/utils';
import { WORKFLOWS } from '@/lib/mock-data';

export function WorkflowsView() {
  return (
    <PageContainer>
      <PageHeader
        title="Workflows"
        description="ComfyUI pipelines and generation flows"
        icon={Workflow}
        actions={
          <button className="flex items-center gap-2 rounded-xl gradient-amber px-4 py-2 text-sm font-semibold text-black transition-all hover:glow-amber">
            <Plus className="h-4 w-4" />
            New Workflow
          </button>
        }
      />

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {WORKFLOWS.map((wf, i) => (
          <motion.div
            key={wf.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.05, 0.3) }}
            whileHover={{ y: -2 }}
            className="group rounded-2xl border border-border bg-card/40 p-5 transition-all hover:border-primary/30 hover:glow-soft"
          >
            <div className="flex items-start justify-between">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-secondary">
                <GitBranch className="h-5 w-5 text-primary" />
              </div>
              <span
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-2 py-1 text-[10px] font-semibold uppercase tracking-wide',
                  wf.active
                    ? 'bg-success/10 text-success'
                    : 'bg-secondary text-muted-foreground',
                )}
              >
                <span
                  className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    wf.active ? 'bg-success animate-pulse' : 'bg-muted-foreground',
                  )}
                />
                {wf.active ? 'Active' : 'Inactive'}
              </span>
            </div>

            <h3 className="mt-4 font-display text-base font-bold tracking-tight">{wf.name}</h3>
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{wf.description}</p>

            <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Workflow className="h-3.5 w-3.5" />
                {wf.nodes} nodes
              </span>
              <span className="rounded-md bg-secondary px-2 py-0.5">{wf.category}</span>
            </div>

            <div className="mt-4 flex items-center gap-2 border-t border-border/50 pt-4">
              <button className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-secondary py-2 text-xs font-medium transition-colors hover:bg-secondary/70">
                <Play className="h-3.5 w-3.5" />
                Run
              </button>
              <button className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground" title="Duplicate">
                <Copy className="h-3.5 w-3.5" />
              </button>
              <button className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground" title="More">
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </PageContainer>
  );
}
