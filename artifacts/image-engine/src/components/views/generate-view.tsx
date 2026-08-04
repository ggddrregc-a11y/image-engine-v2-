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
  Share2,
  Check,
  ChevronDown,
  ChevronUp,
  Layers,
  Clock,
  Cpu,
  Zap,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useApp } from '@/components/providers/app-provider';
import { PageContainer } from './shared';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { patchWorkflow } from '@/lib/workflow-utils';
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

const MAX_CHARS = 5000;

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
    credits,
    deductCredits,
    generateCost,
  } = useApp();
  const { toast } = useToast();
  const [quality, setQuality] = useState<'turbo' | 'standard' | 'high'>('standard');
  const [savedWorkflows, setSavedWorkflows] = useState<ComfyUIWorkflow[]>([]);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>('');

  const [showNegative, setShowNegative] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(true);
  const [copied, setCopied] = useState(false);
  const [jobs, setJobs] = useState<GenerationJob[]>([]);
  const [recentResults, setRecentResults] = useState(SAMPLE_IMAGES.slice(0, 4));
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load saved workflows so their models appear in the UI
  useEffect(() => {
    const fetchWorkflows = async () => {
      const { data, error } = await supabase
        .from('comfyui_workflows')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data) {
        const workflows = data as ComfyUIWorkflow[];
        setSavedWorkflows(workflows);
        if (workflows.length > 0) {
          setSelectedWorkflowId(workflows[0].id);
          setSelectedModel(workflows[0].workflow_name);
        }
      }
    };
    fetchWorkflows();
  }, [setSelectedModel]);

  // Keep job in running state while waiting — no fake progress simulation
  useEffect(() => {
    if (jobs.length === 0) return;
    const running = jobs.find((j) => j.status === 'running' || j.status === 'queued');
    if (!running) return;

    // Just transition from queued to running, no progress increment
    const timeout = setTimeout(() => {
      setJobs((prev) =>
        prev.map((j) =>
          j.status === 'queued' ? { ...j, status: 'running' } : j,
        ),
      );
    }, 800);
    return () => clearTimeout(timeout);
  }, [jobs]);

  const handleGenerate = async () => {
    console.log('[Generate] workflowId=', selectedWorkflowId, 'prompt=', prompt);
    if (!selectedWorkflowId) {
      toast({
        title: 'Workflow not selected',
        description: 'Please select a saved workflow before generating.',
      });
      return;
    }

    if (!prompt.trim()) {
      toast({
        title: 'Prompt is required',
        description: 'Please add a prompt before generating.',
      });
      return;
    }

    if (jobs.some((j) => j.status === 'running' || j.status === 'queued')) return;

    // Check credits before proceeding
    if (credits < generateCost) {
      toast({
        title: 'Insufficient credits',
        description: `You need ${generateCost} credits to generate an image. You have ${credits}.`,
        variant: 'destructive',
      });
      return;
    }

    // Find the selected workflow from state (already fetched client-side)
    const workflow = savedWorkflows.find((w) => w.id === selectedWorkflowId);
    if (!workflow) {
      toast({
        title: 'Workflow not found',
        description: 'Could not find the selected workflow.',
      });
      return;
    }

    // Parse workflow_json safely (may be stored as a string or object)
    let workflowJson: Record<string, unknown>;
    try {
      workflowJson =
        typeof workflow.workflow_json === 'string'
          ? JSON.parse(workflow.workflow_json)
          : (workflow.workflow_json as Record<string, unknown>);
    } catch {
      toast({
        title: 'Invalid workflow',
        description: 'Could not parse workflow JSON.',
      });
      return;
    }

    // Patch workflow with current generation settings
    const patchedWorkflow = patchWorkflow(
      workflowJson,
      currentRatio.w,
      currentRatio.h,
      quality,
      prompt,
      cfgScale,
      steps,
    );

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
      // Send the patched workflow JSON as prompt (JSON object, not a stringified string)
      const response = await fetch('/api/comfy/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: patchedWorkflow }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(async () => {
          const text = await response.text().catch(() => 'Unable to read error body');
          return { error: text };
        });
        console.error('[generate] API error:', response.status, JSON.stringify(errData, null, 2));
        toast({
          title: 'Generation failed',
          description: errData?.error ?? `Server error ${response.status}`,
          variant: 'destructive',
        });
        setJobs((prev) =>
          prev.map((j) => (j.id === newJob.id ? { ...j, status: 'failed' } : j)),
        );
        return;
      }

      const result = await response.json();
      console.log('[generate] ComfyUI response:', JSON.stringify(result, null, 2));
      if (result?.ok && result?.imageUrl) {
        // Deduct credits on success
        deductCredits(generateCost);

        // Show the generated image
        setGeneratedImage(result.imageUrl);
        setDownloadUrl(result.downloadUrl ?? result.imageUrl);
        setJobs((prev) =>
          prev.map((j) => (j.id === newJob.id ? { ...j, status: 'complete', progress: 100 } : j)),
        );
        toast({ title: 'Image generated successfully!' });

        // Save to Supabase stored_images
        const workflow = savedWorkflows.find((w) => w.id === selectedWorkflowId);
        await supabase.from('stored_images').insert({
          url: result.imageUrl,
          prompt,
          model: workflow?.workflow_name ?? selectedModel,
          width: currentRatio.w,
          height: currentRatio.h,
          favorite: false,
          tags: [],
        });

        // Save to generation_jobs
        await supabase.from('generation_jobs').insert({
          prompt,
          model: workflow?.workflow_name ?? selectedModel,
          status: 'complete',
          progress: 100,
          image_url: result.imageUrl,
          started_at: newJob.startedAt,
          completed_at: new Date().toISOString(),
          eta_seconds: 0,
          error_message: '',
          current_node: '',
        });
      } else {
        console.error('[generate] Generation failed:', JSON.stringify(result, null, 2));
        setJobs((prev) =>
          prev.map((j) => (j.id === newJob.id ? { ...j, status: 'failed' } : j)),
        );
      }
    } catch (error) {
      console.error('[generate] Request failed:', error);
      setJobs((prev) =>
        prev.map((j) => (j.id === newJob.id ? { ...j, status: 'failed' } : j)),
      );
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
    <>
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
                            onClick={() => {
                              setSelectedModel(workflow.workflow_name);
                              setSelectedWorkflowId(workflow.id);
                            }}
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

                  {/* Quality */}
                  <div>
                    <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Quality
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {([
                        { value: 'turbo', label: 'Turbo', hint: '4 steps' },
                        { value: 'standard', label: 'Standard', hint: '8 steps' },
                        { value: 'high', label: 'HD', hint: '12 steps' },
                      ] as const).map((q) => (
                        <button
                          key={q.value}
                          onClick={() => setQuality(q.value)}
                          className={cn(
                            'flex flex-col items-center rounded-xl border px-3 py-2 text-xs font-medium transition-all',
                            quality === q.value
                              ? 'border-primary/40 bg-primary/10 text-primary'
                              : 'border-border bg-card/40 text-muted-foreground hover:border-primary/30 hover:text-foreground',
                          )}
                        >
                          <span>{q.label}</span>
                          <span className="text-[10px] opacity-60">{q.hint}</span>
                        </button>
                      ))}
                    </div>
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
              disabled={!prompt.trim() || !!activeJob || credits < generateCost}
              className={cn(
                'group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl py-4 text-base font-bold transition-all',
                activeJob || credits < generateCost
                  ? 'cursor-not-allowed bg-secondary text-muted-foreground'
                  : 'gradient-amber text-black hover:glow-amber',
              )}
            >
              {activeJob ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Generating...
                </>
              ) : credits < generateCost ? (
                <>
                  <Zap className="h-5 w-5" />
                  Not enough credits ({credits}/{generateCost})
                </>
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
                      {activeJob.status === 'queued' ? 'Queued...' : 'Generating...'}
                    </span>
                    <span className="font-semibold tabular-nums text-muted-foreground">
                      waiting
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                    <div className="h-full w-full animate-pulse rounded-full gradient-amber opacity-70" />
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
                      Generating your image...
                    </span>
                  </div>
                </div>
              ) : generatedImage ? (
                <>
                  <img
                    src={generatedImage}
                    alt="Generated image"
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
                        href={downloadUrl ?? generatedImage ?? ''}
                        download={`z-image-${Date.now()}.png`}
                        className="flex items-center gap-1.5 rounded-lg bg-black/40 px-2.5 py-1.5 text-xs font-medium text-white backdrop-blur-sm transition-colors hover:bg-black/60"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Save
                      </a>
                    </div>
                  </div>
                </>
              ) : recentResults[0] ? (
                <>
                  <img
                    src={recentResults[0].url}
                    alt="Latest generation"
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/60 to-transparent opacity-0 transition-opacity hover:opacity-100">
                    <div className="flex w-full items-center justify-between p-3">
                      <button className="flex items-center gap-1.5 rounded-lg bg-black/40 px-2.5 py-1.5 text-xs font-medium text-white backdrop-blur-sm transition-colors hover:bg-black/60">
                        <Download className="h-3.5 w-3.5" />
                        Save
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <ImageIcon className="h-8 w-8 opacity-30" />
                    <span className="text-xs opacity-60">No image yet</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Recent generations */}
          {recentResults.length > 1 && (
            <div>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Recent
              </h3>
              <div className="grid grid-cols-3 gap-2">
                {recentResults.slice(1, 4).map((img) => (
                  <button
                    key={img.id}
                    onClick={() => setRecentResults((prev) => [img, ...prev.filter((i) => i.id !== img.id)])}
                    className="group relative aspect-square overflow-hidden rounded-xl border border-border bg-secondary transition-all hover:border-primary/30"
                  >
                    <img
                      src={img.url}
                      alt={img.prompt}
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
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
            {/* Close button */}
            <button
              onClick={() => setLightboxOpen(false)}
              className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Image */}
            <motion.img
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              src={generatedImage}
              alt="Generated image"
              className="max-h-[80vh] max-w-[90vw] rounded-2xl object-contain shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />

            {/* Actions bar */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              className="mt-6 flex items-center gap-3"
              onClick={(e) => e.stopPropagation()}
            >
              <a
                href={downloadUrl ?? generatedImage}
                download={`z-image-${Date.now()}.png`}
                className="flex items-center gap-2 rounded-xl bg-white/10 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/20"
              >
                <Download className="h-4 w-4" />
                Download
              </a>
              <button
                onClick={async () => {
                  try {
                    if (navigator.share) {
                      await navigator.share({ url: generatedImage, title: 'Generated Image' });
                    } else {
                      await navigator.clipboard.writeText(generatedImage);
                    }
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
