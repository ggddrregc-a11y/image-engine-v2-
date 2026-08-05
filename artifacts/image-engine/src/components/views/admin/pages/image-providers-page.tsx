import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ImageIcon,
  Plus,
  Trash2,
  Pencil,
  X,
  Check,
  Loader2,
  Star,
  RefreshCw,
  Zap,
  AlertCircle,
  Activity,
  Link2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { ImageProvider, ImageProviderType } from '@/lib/admin-types';
import {
  AdminCard,
  AdminButton,
  AdminInput,
  AdminLabel,
  AdminSelect,
  AdminTextarea,
  AdminToggle,
  AdminBadge,
  AdminLoading,
  AdminEmptyState,
} from '../shared';
import { cn } from '@/lib/utils';

interface FetchedModel {
  id: string;
  name: string;
  supported: boolean;
  reason?: string;
  isFree?: boolean;
}

const PROVIDER_TYPES: { value: ImageProviderType; label: string }[] = [
  { value: 'comfyui',      label: 'ComfyUI (Local)' },
  { value: 'openai',       label: 'OpenAI (DALL·E)' },
  { value: 'stability',    label: 'Stability AI' },
  { value: 'huggingface',  label: 'HuggingFace' },
  { value: 'replicate',    label: 'Replicate' },
  { value: 'fal',          label: 'fal.ai' },
  { value: 'custom',       label: 'Custom / Other' },
];

const DEFAULT_URLS: Record<ImageProviderType, string> = {
  comfyui:     'http://localhost:8188',
  openai:      'https://api.openai.com',
  stability:   'https://api.stability.ai',
  huggingface: 'https://api-inference.huggingface.co',
  replicate:   'https://api.replicate.com',
  fal:         'https://fal.run',
  custom:      '',
};

const DEFAULT_MODELS: Record<ImageProviderType, string> = {
  comfyui:     '',
  openai:      'dall-e-3',
  stability:   'stable-diffusion-xl-1024-v1-0',
  huggingface: 'stabilityai/stable-diffusion-xl-base-1.0',
  replicate:   'stability-ai/sdxl',
  fal:         'fal-ai/fast-sdxl',
  custom:      '',
};

export function AdminImageProvidersPage() {
  const [providers, setProviders] = useState<ImageProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ImageProvider | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; latencyMs: number; error?: string }>>({});
  const [testing, setTesting] = useState<string | null>(null);

  const fetchProviders = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('image_providers')
      .select('*')
      .order('created_at', { ascending: true });
    if (!error && data) setProviders(data as ImageProvider[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchProviders(); }, [fetchProviders]);

  const handleSave = async (p: Partial<ImageProvider>) => {
    if (editing) {
      await supabase
        .from('image_providers')
        .update({ ...p, updated_at: new Date().toISOString() })
        .eq('id', editing.id);
    } else {
      await supabase.from('image_providers').insert(p);
    }
    setShowForm(false);
    setEditing(null);
    fetchProviders();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('image_providers').delete().eq('id', id);
    fetchProviders();
  };

  const handleToggle = async (p: ImageProvider) => {
    await supabase.from('image_providers').update({ enabled: !p.enabled }).eq('id', p.id);
    fetchProviders();
  };

  const handleSetDefault = async (p: ImageProvider) => {
    await supabase.from('image_providers').update({ is_default: false }).neq('id', '');
    await supabase.from('image_providers').update({ is_default: true }).eq('id', p.id);
    fetchProviders();
  };

  const handleTest = async (p: ImageProvider) => {
    setTesting(p.id);
    const start = Date.now();
    try {
      const res = await fetch('/api/image-providers/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider_type: p.provider_type,
          base_url: p.base_url,
          api_key: p.api_key,
        }),
      });
      const data = await res.json() as { ok: boolean; error?: string };
      setTestResults((prev) => ({
        ...prev,
        [p.id]: { ok: data.ok, latencyMs: Date.now() - start, error: data.error },
      }));
    } catch (err) {
      setTestResults((prev) => ({
        ...prev,
        [p.id]: { ok: false, latencyMs: Date.now() - start, error: String(err) },
      }));
    } finally {
      setTesting(null);
    }
  };

  if (loading) return <AdminLoading label="Loading image providers..." />;

  return (
    <div>
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {providers.length} provider{providers.length !== 1 ? 's' : ''} — الـ default يُستخدم في صفحة Generate
        </p>
        <AdminButton
          variant="primary"
          size="sm"
          onClick={() => { setEditing(null); setShowForm(true); }}
        >
          <Plus className="h-4 w-4" />
          Add Image Provider
        </AdminButton>
      </div>

      {providers.length === 0 && !showForm ? (
        <AdminCard>
          <AdminEmptyState
            icon={ImageIcon}
            title="No image providers configured"
            description="Add an image generation provider to enable image generation"
            action={
              <AdminButton variant="primary" size="sm" onClick={() => setShowForm(true)}>
                <Plus className="h-4 w-4" />
                Add Provider
              </AdminButton>
            }
          />
        </AdminCard>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {showForm && (
              <ImageProviderForm
                key="form"
                provider={editing}
                onSave={handleSave}
                onCancel={() => { setShowForm(false); setEditing(null); }}
              />
            )}
          </AnimatePresence>

          {providers.map((p, i) => {
            const test = testResults[p.id];
            const isTesting = testing === p.id;
            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <AdminCard className="p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                    {/* Icon */}
                    <div className={cn(
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border',
                      p.enabled ? 'border-primary/30 bg-primary/10' : 'border-border bg-secondary',
                    )}>
                      <ImageIcon className={cn('h-5 w-5', p.enabled ? 'text-primary' : 'text-muted-foreground')} />
                    </div>

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">{p.name}</h3>
                        {p.is_default && <AdminBadge variant="primary">Default</AdminBadge>}
                        <AdminBadge variant={p.enabled ? 'success' : 'default'}>
                          {p.enabled ? 'Enabled' : 'Disabled'}
                        </AdminBadge>
                        <span className="rounded-md bg-secondary px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                          {p.model_name || '—'}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {PROVIDER_TYPES.find((t) => t.value === p.provider_type)?.label ?? p.provider_type}
                        {p.base_url ? ` · ${p.base_url}` : ''}
                      </p>
                      {p.notes && <p className="mt-1 text-xs text-muted-foreground">{p.notes}</p>}
                    </div>

                    {/* Test result badge */}
                    {test && (
                      <div className="flex items-center gap-2 text-xs">
                        <div className={cn(
                          'flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5',
                          test.ok
                            ? 'border-success/30 bg-success/5 text-success'
                            : 'border-destructive/30 bg-destructive/5 text-destructive',
                        )}>
                          {test.ok
                            ? <Check className="h-3.5 w-3.5" />
                            : <AlertCircle className="h-3.5 w-3.5" />}
                          {test.ok ? 'Connected' : 'Failed'}
                        </div>
                        <div className="flex items-center gap-1.5 rounded-lg border border-border bg-secondary/30 px-2.5 py-1.5 text-muted-foreground">
                          <Activity className="h-3.5 w-3.5" />
                          {test.latencyMs}ms
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-1.5">
                      {!p.is_default && (
                        <AdminButton variant="secondary" size="sm" onClick={() => handleSetDefault(p)}>
                          <Star className="h-3.5 w-3.5" />
                          Set Default
                        </AdminButton>
                      )}
                      <AdminButton
                        variant="secondary"
                        size="sm"
                        onClick={() => handleTest(p)}
                        disabled={isTesting}
                      >
                        {isTesting
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <Link2 className="h-3.5 w-3.5" />}
                        Test
                      </AdminButton>
                      <AdminToggle checked={p.enabled} onChange={() => handleToggle(p)} />
                      <button
                        onClick={() => { setEditing(p); setShowForm(true); }}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(p.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Test error */}
                  {test?.error && !test.ok && (
                    <div className="mt-3 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2">
                      <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
                      <span className="text-xs text-destructive">{test.error}</span>
                    </div>
                  )}
                </AdminCard>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Info box */}
      <AdminCard className="mt-4 p-4">
        <h4 className="mb-3 text-sm font-semibold">كيفية إضافة Provider جديد</h4>
        <div className="grid grid-cols-1 gap-2 text-xs text-muted-foreground sm:grid-cols-3">
          {[
            { title: 'ComfyUI (Local)', url: 'localhost:8188', model: 'اسم الـ workflow', key: 'لا يحتاج API Key' },
            { title: 'OpenAI DALL·E', url: 'api.openai.com', model: 'dall-e-3', key: 'platform.openai.com' },
            { title: 'Stability AI', url: 'api.stability.ai', model: 'stable-diffusion-xl-1024-v1-0', key: 'platform.stability.ai' },
          ].map((item) => (
            <div key={item.title} className="rounded-xl border border-border bg-secondary/30 p-3">
              <p className="font-semibold text-foreground">{item.title}</p>
              <p className="mt-1">Base URL: {item.url}</p>
              <p>Model: {item.model}</p>
              <p>API Key: {item.key}</p>
            </div>
          ))}
        </div>
      </AdminCard>
    </div>
  );
}

/* ── Form ─────────────────────────────────────────────────────── */
function ImageProviderForm({
  provider,
  onSave,
  onCancel,
}: {
  provider: ImageProvider | null;
  onSave: (p: Partial<ImageProvider>) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(provider?.name ?? '');
  const [providerType, setProviderType] = useState<ImageProviderType>(provider?.provider_type ?? 'comfyui');
  const [baseUrl, setBaseUrl] = useState(provider?.base_url ?? DEFAULT_URLS['comfyui']);
  const [apiKey, setApiKey] = useState(provider?.api_key ?? '');
  const [modelName, setModelName] = useState(provider?.model_name ?? DEFAULT_MODELS['comfyui']);
  const [enabled, setEnabled] = useState(provider?.enabled ?? true);
  const [isDefault, setIsDefault] = useState(provider?.is_default ?? false);
  const [notes, setNotes] = useState(provider?.notes ?? '');
  const [showKey, setShowKey] = useState(false);

  // Fetch models state
  const [fetchedModels, setFetchedModels] = useState<FetchedModel[]>([]);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [modelSearch, setModelSearch] = useState('');

  const needsApiKey = providerType !== 'comfyui';

  const handleTypeChange = (v: string) => {
    const t = v as ImageProviderType;
    setProviderType(t);
    setBaseUrl(DEFAULT_URLS[t]);
    setModelName(DEFAULT_MODELS[t]);
    setFetchedModels([]);
    setFetchError('');
    setShowModelPicker(false);
  };

  const handleFetchModels = async () => {
    if (!baseUrl || (!apiKey && needsApiKey)) {
      setFetchError('ادخل Base URL' + (needsApiKey ? ' و API Key' : '') + ' الأول');
      return;
    }
    setFetchLoading(true);
    setFetchError('');
    setFetchedModels([]);
    setShowModelPicker(false);

    try {
      const res = await fetch('/api/image-providers/fetch-models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base_url: baseUrl, api_key: apiKey, provider_type: providerType }),
      });
      const data = await res.json() as { ok: boolean; models?: FetchedModel[]; error?: string };
      if (!data.ok) {
        setFetchError(data.error ?? 'Failed to fetch models');
      } else {
        setFetchedModels(data.models ?? []);
        setShowModelPicker(true);
      }
    } catch (err) {
      setFetchError(String(err));
    } finally {
      setFetchLoading(false);
    }
  };

  const filteredModels = fetchedModels.filter((m) =>
    m.id.toLowerCase().includes(modelSearch.toLowerCase()) ||
    m.name.toLowerCase().includes(modelSearch.toLowerCase()),
  );

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
    >
      <AdminCard className="overflow-hidden border-primary/30 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold">
            {provider ? 'Edit Image Provider' : 'New Image Provider'}
          </h3>
          <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Name */}
          <div>
            <AdminLabel>Provider Name</AdminLabel>
            <AdminInput value={name} onChange={setName} placeholder="e.g. My ComfyUI Server" />
          </div>

          {/* Type */}
          <div>
            <AdminLabel>Provider Type</AdminLabel>
            <AdminSelect value={providerType} onChange={handleTypeChange} options={PROVIDER_TYPES} />
          </div>

          {/* Base URL */}
          <div className="sm:col-span-2">
            <AdminLabel>Base URL</AdminLabel>
            <AdminInput
              value={baseUrl}
              onChange={setBaseUrl}
              placeholder={DEFAULT_URLS[providerType] || 'https://...'}
            />
          </div>

          {/* API Key — only when needed */}
          {needsApiKey && (
            <div className="sm:col-span-2">
              <AdminLabel>API Key</AdminLabel>
              <div className="relative">
                <AdminInput
                  value={apiKey}
                  onChange={setApiKey}
                  type={showKey ? 'text' : 'password'}
                  placeholder="sk-..."
                />
                <button
                  type="button"
                  onClick={() => setShowKey((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
                >
                  {showKey ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
          )}

          {/* Model Name + Fetch */}
          <div className="sm:col-span-2">
            <div className="mb-2 flex items-center justify-between">
              <AdminLabel>Model Name</AdminLabel>
              <AdminButton
                variant="secondary"
                size="sm"
                onClick={handleFetchModels}
                disabled={fetchLoading || !baseUrl}
              >
                {fetchLoading
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <RefreshCw className="h-3.5 w-3.5" />}
                {fetchLoading ? 'جاري السحب...' : 'Fetch Models'}
              </AdminButton>
            </div>
            <AdminInput
              value={modelName}
              onChange={setModelName}
              placeholder={DEFAULT_MODELS[providerType] || 'اسم النموذج'}
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              اكتب اسم النموذج يدوياً أو اضغط "Fetch Models" لسحبها تلقائياً
            </p>

            {/* Fetch error */}
            {fetchError && (
              <div className="mt-2 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {fetchError}
              </div>
            )}

            {/* Model picker dropdown */}
            <AnimatePresence>
              {showModelPicker && fetchedModels.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="mt-3 overflow-hidden rounded-xl border border-border bg-card shadow-lg"
                >
                  {/* Stats bar */}
                  <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{fetchedModels.length} نموذج</span>
                      <span className="font-medium text-primary">
                        {fetchedModels.filter((m) => m.supported).length} مدعوم للصور
                      </span>
                      {fetchedModels.filter((m) => m.isFree).length > 0 && (
                        <span className="font-medium text-emerald-500">
                          {fetchedModels.filter((m) => m.isFree).length} مجاني
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => setShowModelPicker(false)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Search */}
                  <div className="border-b border-border px-3 py-2">
                    <input
                      value={modelSearch}
                      onChange={(e) => setModelSearch(e.target.value)}
                      placeholder="ابحث عن نموذج..."
                      className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
                    />
                  </div>

                  {/* List */}
                  <div className="max-h-72 overflow-y-auto">
                    {filteredModels.length === 0 ? (
                      <p className="py-6 text-center text-sm text-muted-foreground">لا توجد نتائج</p>
                    ) : (
                      filteredModels.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => {
                            if (m.supported) {
                              setModelName(m.id);
                              setShowModelPicker(false);
                              setModelSearch('');
                            }
                          }}
                          disabled={!m.supported}
                          className={cn(
                            'flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors',
                            m.supported
                              ? 'cursor-pointer hover:bg-secondary'
                              : 'cursor-not-allowed opacity-50',
                            modelName === m.id && 'bg-primary/10',
                          )}
                        >
                          {/* Icon */}
                          <div className={cn(
                            'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-[10px] font-bold',
                            m.supported
                              ? 'border-primary/30 bg-primary/10 text-primary'
                              : 'border-border bg-secondary text-muted-foreground',
                          )}>
                            {m.supported ? '✓' : '✗'}
                          </div>

                          {/* Info */}
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="truncate font-mono text-xs font-medium">{m.id}</span>
                              {m.isFree && (
                                <span className="flex items-center gap-0.5 rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-500">
                                  <Zap className="h-2.5 w-2.5" />Free
                                </span>
                              )}
                              {!m.supported && (
                                <span className="rounded-md bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
                                  {m.reason ?? 'غير مدعوم'}
                                </span>
                              )}
                            </div>
                          </div>

                          {modelName === m.id && (
                            <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                          )}
                        </button>
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Toggles */}
          <div className="flex items-end pb-2">
            <AdminToggle checked={enabled} onChange={setEnabled} label="Enabled" />
          </div>
          <div className="flex items-end pb-2">
            <AdminToggle checked={isDefault} onChange={setIsDefault} label="Set as Default" />
          </div>

          {/* Notes */}
          <div className="sm:col-span-2">
            <AdminLabel>Notes (optional)</AdminLabel>
            <AdminTextarea value={notes} onChange={setNotes} placeholder="ملاحظات داخلية..." />
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <AdminButton variant="ghost" size="sm" onClick={onCancel}>Cancel</AdminButton>
          <AdminButton
            variant="primary"
            size="sm"
            onClick={() =>
              onSave({
                name,
                provider_type: providerType,
                base_url: baseUrl,
                api_key: apiKey,
                model_name: modelName,
                enabled,
                is_default: isDefault,
                notes,
              })
            }
            disabled={!name.trim() || !baseUrl.trim()}
          >
            <Check className="h-4 w-4" />
            {provider ? 'Save Changes' : 'Add Provider'}
          </AdminButton>
        </div>
      </AdminCard>
    </motion.div>
  );
}
