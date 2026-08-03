'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Copy,
  Clipboard,
  Star,
  Wand2,
  Settings2,
  Image as ImageIcon,
  X,
  Loader2,
  RotateCcw,
  Download,
  Check,
  ChevronDown,
  ChevronUp,
  Layers,
  Clock,
  Cpu,
} from 'lucide-react';
import { useApp } from '@/components/providers/app-provider';
import { PageContainer } from './shared';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import {
  PROMPT_TEMPLATES,
  FAVORITE_PROMPTS,
  SAMPLE_IMAGES,
  SAMPLERS,
  ASPECT_RATIOS,
  MODELS,
} from '@/lib/mock-data';
import type { GenerationJob } from '@/lib/types';
import type { ComfyUIWorkflow } from '@/lib/admin-types';

const MAX_CHARS = 1000;

export function GenerateView() {
  const {
    prompt,
    setPrompt,
    negativePrompt,
    setNegativePrompt,
    selectedModel,
    setSelectedModel,
    aspectRatio,
    setAspectRatio,
    steps,
    setSteps,
    cfgScale,
    setCfgScale,
    sampler,
    setSampler,
    batchCount,
    setBatchCount,
  } = useApp();
  const [quality, setQuality] = useState<'standard' | 'high'>('standard');
  const [savedWorkflows, setSavedWorkflows] = useState<ComfyUIWorkflow[]>([]);

  const [showNegative, setShowNegative] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(true);
  const [copied, setCopied] = useState(false);
  const [jobs, setJobs] = useState<GenerationJob[]>([]);
  const [recentResults, setRecentResults] = useState(SAMPLE_IMAGES.slice(0, 4));
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load saved workflows so their models appear in the UI
  useEffect(() => {
    const fetchWorkflows = async () => {
      const { data, error } = await supabase.from('comfyui_workflows').select('*').order('created_at', { ascending: false });
      if (data) {
        setSavedWorkflows(data as ComfyUIWorkflow[]);
      }
    };
    fetchWorkflows();
  }, []);

  // Simulate generation progress
  useEffect(() => {
    if (jobs.length === 0) return;
    const running = jobs.find((j) => j.status === 'running' || j.status === 'queued');
    if (!running) return;

    const interval = setInterval(() => {
      setJobs((prev) =>
        prev.map((j) => {
          if (j.status !== 'running' && j.status !== 'queued') return j;
          if (j.status === 'queued') {
            return { ...j, status: 'running', startedAt: new Date().toISOString() };
          }
          const next = Math.min(100, j.progress + Math.random() * 12 + 5);
          if (next >= 100) {
            return { ...j, status: 'complete', progress: 100 };
          }
          return { ...j, progress: next };
        }),
      );
    }, 400);
    return () => clearInterval(interval);
  }, [jobs]);

  const handleGenerate = async () => {
    if (!prompt.trim() || jobs.some((j) => j.status === 'running' || j.status === 'queued'))
      return;

    const nodes = ['Load Model', 'Encode Prompt', 'Sample', 'Decode Latent', 'Upscale', 'VAE Decode'];
    const newJob: GenerationJob = {
      id: `job-${Date.now()}`,
      prompt,
      model: selectedModel,
      status: 'queued',
      progress: 0,
      currentNode: nodes[0],
      startedAt: new Date().toISOString(),
      etaSeconds: 14,
    };

    setJobs((prev) => [newJob, ...prev].slice(0, 3));

    try {
      const response = await fetch('/api/comfy/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          negativePrompt,
          model: selectedModel,
          width: currentRatio.w,
          height: currentRatio.h,
          steps,
          cfgScale,
          sampler,
          batchCount,
          quality,
          workflowId: undefined,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Generation request failed');
      }
    } catch (error) {
      console.error(error);
    }

    // Cycle nodes for visual effect
    let ni = 0;
    const nodeInterval = setInterval(() => {
      ni++;
      setJobs((prev) =>
        prev.map((j) =>
          j.id === newJob.id && j.status === 'running'
            ? { ...j, currentNode: nodes[Math.min(ni, nodes.length - 1)] }
            : j,
        ),
      );
      if (ni >= nodes.length) clearInterval(nodeInterval);
    }, 600);
  };

  const handleCancel = (id: string) => {
    setJobs((prev) =>
      prev.map((j) => (j.id === id ? { ...j, status: 'canceled' } : j)),
    );
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
    } catch {
      // ignore
    }
  };

  const activeJob = jobs.find((j) => j.status === 'running' || j.status === 'queued');
  const currentRatio = ASPECT_RATIOS.find((r) => r.value === aspectRatio)!;

  return (
    <PageContainer>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_380px]">
        {/* Left: Prompt + controls */}
        <div className="space-y-6">
          {/* Prompt card */}
          <div className="rounded-2xl border border-border bg-card/60 p-5 backdrop-blur-sm">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Prompt
                </h2>
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
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-success" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>

            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value.slice(0, MAX_CHARS))}
              placeholder="Describe the image you want to create... e.g. 'cinematic portrait of a woman, soft golden hour lighting, shallow depth of field, ultra detailed'"
              className="min-h-[140px] w-full resize-none bg-transparent text-base leading-relaxed outline-none placeholder:text-muted-foreground/60"
            />

            <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-3">
              <span className="text-xs text-muted-foreground">
                {prompt.length} / {MAX_CHARS}
              </span>
              <button
                onClick={() => setPrompt('')}
                className="text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Quick templates */}
          <div>
            <div className="mb-3 flex items-center gap-2">
              <Wand2 className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Quick Templates</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {PROMPT_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setPrompt(t.prompt)}
                  className="group flex items-center gap-2 rounded-xl border border-border bg-card/40 px-3 py-2 text-xs font-medium transition-all hover:border-primary/40 hover:bg-card hover:glow-soft"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-primary/60 group-hover:bg-primary" />
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Favorite prompts */}
          <div>
            <div className="mb-3 flex items-center gap-2">
              <Star className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Favorite Prompts</h3>
            </div>
            <div className="space-y-2">
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
          </div>

          {/* Negative prompt */}
          <div className="rounded-2xl border border-border bg-card/40">
            <button
              onClick={() => setShowNegative((v) => !v)}
              className="flex w-full items-center justify-between px-4 py-3"
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                <X className="h-4 w-4 text-muted-foreground" />
                Negative Prompt
              </span>
              {showNegative ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
            <AnimatePresence>
              {showNegative && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <textarea
                    value={negativePrompt}
                    onChange={(e) => setNegativePrompt(e.target.value)}
                    placeholder="What to avoid... e.g. 'blurry, low quality, distorted, extra fingers'"
                    className="min-h-[80px] w-full resize-none border-t border-border bg-transparent px-4 py-3 text-sm outline-none placeholder:text-muted-foreground/60"
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Advanced controls */}
          <div className="rounded-2xl border border-border bg-card/40 p-5">
            <button
              onClick={() => setShowAdvanced((v) => !v)}
              className="mb-4 flex w-full items-center justify-between"
            >
              <span className="flex items-center gap-2 text-sm font-semibold">
                <Settings2 className="h-4 w-4 text-primary" />
                Generation Settings
              </span>
              {showAdvanced ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
            <AnimatePresence>
              {showAdvanced && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="space-y-5 overflow-hidden"
                >
                  {/* Model */}
                  <div>
                    <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Model
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {savedWorkflows.length > 0 ? (
                        savedWorkflows.map((workflow) => (
                          <button
                            key={workflow.id}
                            onClick={() => setSelectedModel(workflow.workflow_name)}
                            className={cn(
                              'rounded-xl border px-3 py-2 text-xs font-medium transition-all',
                              selectedModel === workflow.workflow_name
                                ? 'border-primary/40 bg-primary/10 text-primary'
                                : 'border-border bg-card/40 text-muted-foreground hover:border-primary/30 hover:text-foreground',
                            )}
                          >
                            {workflow.workflow_name}
                          </button>
                        ))
                      ) : (
                        MODELS.filter((m) => m.type === 'checkpoint').map((m) => (
                          <button
                            key={m.id}
                            onClick={() => setSelectedModel(m.name)}
                            className={cn(
                              'rounded-xl border px-3 py-2 text-xs font-medium transition-all',
                              selectedModel === m.name
                                ? 'border-primary/40 bg-primary/10 text-primary'
                                : 'border-border bg-card/40 text-muted-foreground hover:border-primary/30 hover:text-foreground',
                            )}
                          >
                            {m.name}
                          </button>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Aspect ratio */}
                  <div>
                    <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Aspect Ratio
                    </label>
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
                            style={{
                              width: 18,
                              height: 18 * (r.h / r.w),
                              minHeight: 8,
                            }}
                          />
                          {r.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Steps */}
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Steps
                      </label>
                      <span className="text-sm font-semibold tabular-nums">{steps}</span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={60}
                      value={steps}
                      onChange={(e) => setSteps(Number(e.target.value))}
                      className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-secondary accent-primary"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Quality
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setQuality('standard')}
                        className={cn(
                          'rounded-xl border px-3 py-2 text-xs font-medium transition-all',
                          quality === 'standard'
                            ? 'border-primary/40 bg-primary/10 text-primary'
                            : 'border-border bg-card/40 text-muted-foreground hover:border-primary/30 hover:text-foreground',
                        )}
                      >
                        Standard
                      </button>
                      <button
                        onClick={() => setQuality('high')}
                        className={cn(
                          'rounded-xl border px-3 py-2 text-xs font-medium transition-all',
                          quality === 'high'
                            ? 'border-primary/40 bg-primary/10 text-primary'
                            : 'border-border bg-card/40 text-muted-foreground hover:border-primary/30 hover:text-foreground',
                        )}
                      >
                        HD
                      </button>
                    </div>
                  </div>

                  {/* CFG Scale */}
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        CFG Scale
                      </label>
                      <span className="text-sm font-semibold tabular-nums">
                        {cfgScale.toFixed(1)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={20}
                      step={0.5}
                      value={cfgScale}
                      onChange={(e) => setCfgScale(Number(e.target.value))}
                      className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-secondary accent-primary"
                    />
                  </div>

                  {/* Sampler */}
                  <div>
                    <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Sampler
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {SAMPLERS.map((s) => (
                        <button
                          key={s}
                          onClick={() => setSampler(s)}
                          className={cn(
                            'rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all',
                            sampler === s
                              ? 'border-primary/40 bg-primary/10 text-primary'
                              : 'border-border bg-card/40 text-muted-foreground hover:text-foreground',
                          )}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Batch count */}
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Batch Count
                      </label>
                      <span className="text-sm font-semibold tabular-nums">{batchCount}</span>
                    </div>
                    <div className="flex gap-2">
                      {[1, 2, 4, 8].map((n) => (
                        <button
                          key={n}
                          onClick={() => setBatchCount(n)}
                          className={cn(
                            'h-9 flex-1 rounded-lg border text-sm font-semibold transition-all',
                            batchCount === n
                              ? 'border-primary/40 bg-primary/10 text-primary'
                              : 'border-border bg-card/40 text-muted-foreground hover:text-foreground',
                          )}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Right: Generation panel */}
        <div className="space-y-6">
          {/* Generate button + status */}
          <div className="rounded-2xl border border-border bg-card/60 p-5 backdrop-blur-sm">
            <button
              onClick={handleGenerate}
              disabled={!prompt.trim() || !!activeJob}
              className={cn(
                'group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl py-4 text-base font-bold transition-all',
                activeJob
                  ? 'cursor-not-allowed bg-secondary text-muted-foreground'
                  : 'gradient-amber text-black hover:glow-amber',
              )}
            >
              {activeJob ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-5 w-5" />
                  Generate
                </>
              )}
            </button>

            {/* Live status */}
            <AnimatePresence>
              {activeJob && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-4 space-y-3"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 font-medium text-primary">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
                      {activeJob.status === 'queued' ? 'Queued' : 'Running'}
                    </span>
                    <span className="font-semibold tabular-nums">
                      {Math.round(activeJob.progress)}%
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                    <motion.div
                      className="h-full rounded-full gradient-amber"
                      animate={{ width: `${activeJob.progress}%` }}
                      transition={{ ease: 'easeOut' }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Cpu className="h-3.5 w-3.5" />
                      {activeJob.currentNode}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      ~{activeJob.etaSeconds}s
                    </span>
                  </div>
                  <button
                    onClick={() => handleCancel(activeJob.id)}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-destructive/30 py-2 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
                  >
                    <X className="h-3.5 w-3.5" />
                    Cancel Generation
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Config summary */}
            <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border/50 pt-4 text-xs">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Layers className="h-3.5 w-3.5" />
                {selectedModel.split(' ')[0]}
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <ImageIcon className="h-3.5 w-3.5" />
                {currentRatio.w}×{currentRatio.h}
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Settings2 className="h-3.5 w-3.5" />
                {steps} steps · {cfgScale} CFG
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5" />
                {sampler.split(' ')[0]}
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="rounded-2xl border border-border bg-card/40 p-3">
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Preview
              </span>
              {activeJob?.status === 'running' && (
                <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                  <RotateCcw className="h-3 w-3" />
                  Regenerate
                </button>
              )}
            </div>
            <div
              className="relative overflow-hidden rounded-xl bg-secondary"
              style={{ aspectRatio: `${currentRatio.w} / ${currentRatio.h}` }}
            >
              {activeJob ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="absolute inset-0 bg-grid opacity-30" />
                  <div
                    className="absolute inset-0 animate-pulse"
                    style={{
                      background: `radial-gradient(circle at 50% 50%, hsl(var(--primary) / 0.15), transparent 70%)`,
                    }}
                  />
                  <div className="relative z-10 flex flex-col items-center gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <span className="text-xs text-muted-foreground">
                      Rendering... {Math.round(activeJob.progress)}%
                    </span>
                  </div>
                </div>
              ) : recentResults[0] ? (
                <>
                  <img
                    src={recentResults[0].url}
                    alt="Latest generation"
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/60 to-transparent opacity-0 transition-opacity hover:opacity-100">
                    <div className="flex w-full items-center justify-between p-3">
                      <button className="flex h-8 w-8 items-center justify-center rounded-lg bg-background/80 text-foreground backdrop-blur transition-colors hover:bg-background">
                        <Download className="h-4 w-4" />
                      </button>
                      <button className="flex h-8 w-8 items-center justify-center rounded-lg bg-background/80 text-foreground backdrop-blur transition-colors hover:bg-background">
                        <RotateCcw className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  <ImageIcon className="h-8 w-8" />
                </div>
              )}
            </div>
          </div>

          {/* Recent results */}
          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Recent Generations
            </h3>
            <div className="grid grid-cols-4 gap-2">
              {recentResults.map((img) => (
                <div
                  key={img.id}
                  className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-secondary"
                >
                  <img
                    src={img.url}
                    alt={img.prompt}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
