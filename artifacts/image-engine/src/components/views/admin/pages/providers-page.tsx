
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Server,
  Plus,
  Trash2,
  Pencil,
  X,
  Zap,
  Check,
  AlertCircle,
  Loader2,
  GripVertical,
  Activity,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { AIProvider, ProviderType, ConnectionTestResult } from '@/lib/admin-types';
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

const PROVIDER_TYPES: { value: ProviderType; label: string }[] = [
  { value: 'comfyui', label: 'ComfyUI' },
  { value: 'openai', label: 'OpenAI Compatible' },
  { value: 'ollama', label: 'Ollama' },
  { value: 'stability', label: 'Stability AI' },
  { value: 'huggingface', label: 'HuggingFace' },
  { value: 'custom', label: 'Custom REST API' },
];

export function AdminProvidersPage() {
  const [providers, setProviders] = useState<AIProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<AIProvider | null>(null);
  const [testResults, setTestResults] = useState<Record<string, ConnectionTestResult | undefined>>({});
  const [testing, setTesting] = useState<string | null>(null);

  const fetchProviders = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('ai_providers')
      .select('*')
      .order('priority', { ascending: false });
    if (!error && data) setProviders(data as AIProvider[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  const handleSave = async (provider: Partial<AIProvider> & { api_key?: string; base_url?: string }) => {
    if (editing) {
      await supabase.from('ai_providers').update({
        name: provider.name,
        provider_type: provider.provider_type,
        enabled: provider.enabled,
        priority: provider.priority,
        notes: provider.notes,
        api_key: provider.api_key ?? '',
        base_url: provider.base_url ?? '',
        updated_at: new Date().toISOString(),
      }).eq('id', editing.id);
    } else {
      await supabase.from('ai_providers').insert({
        name: provider.name,
        provider_type: provider.provider_type,
        enabled: provider.enabled ?? true,
        priority: provider.priority ?? 0,
        notes: provider.notes ?? '',
        api_key: provider.api_key ?? '',
        base_url: provider.base_url ?? '',
      });
    }
    setShowForm(false);
    setEditing(null);
    fetchProviders();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('ai_providers').delete().eq('id', id);
    fetchProviders();
  };

  const handleToggle = async (p: AIProvider) => {
    await supabase.from('ai_providers').update({ enabled: !p.enabled }).eq('id', p.id);
    fetchProviders();
  };

  const normalizeUrl = (url: string) => url.replace(/\/$/, '');

  const probeConnection = async (endpoint: string, paths: string[]) => {
    const start = Date.now();
    for (const path of paths) {
      try {
        const response = await fetch(`${endpoint}${path}`, { method: 'GET' });
        if (!response.ok) continue;
        const json = (await response.json()) as Record<string, unknown>;
        return {
          path,
          json,
          latencyMs: Date.now() - start,
        };
      } catch {
        continue;
      }
    }
    throw new Error('No supported endpoint responded');
  };

  const detectProviderConnection = async (p: AIProvider) => {
    const workflowResponse = await supabase
      .from('comfyui_workflows')
      .select('server_url')
      .eq('provider_id', p.id)
      .limit(1)
      .single();

    if (workflowResponse.error || !workflowResponse.data?.server_url) {
      throw new Error('No configured workflow found for this provider. Configure ComfyUI workflow first.');
    }

    const endpoint = normalizeUrl(workflowResponse.data.server_url);
    let result: ConnectionTestResult = {
      success: false,
      latencyMs: 0,
      authStatus: 'not_required',
      version: undefined,
      availableModels: undefined,
      error: undefined,
    };

    if (p.provider_type === 'comfyui') {
      const probes = await probeConnection(endpoint, ['/api/version', '/api/info', '/api/health']);
      result = {
        success: true,
        latencyMs: probes.latencyMs,
        authStatus: 'not_required',
        version: (probes.json.version as string) ?? (probes.json.server as string) ?? 'unknown',
        availableModels: undefined,
      };
    } else if (p.provider_type === 'openai') {
      const probes = await probeConnection(endpoint, ['/v1/models', '/openapi.json']);
      const models = Array.isArray(probes.json.data)
        ? probes.json.data.map((item) => String((item as any).id ?? (item as any).name ?? 'unknown'))
        : undefined;
      result = {
        success: true,
        latencyMs: probes.latencyMs,
        authStatus: 'not_required',
        version: models?.[0] ?? 'unknown',
        availableModels: models,
      };
    } else {
      const probes = await probeConnection(endpoint, ['/api/version', '/api/info', '/api/health', '/v1/models', '/openapi.json']);
      result = {
        success: true,
        latencyMs: probes.latencyMs,
        authStatus: 'not_required',
        version: (probes.json.version as string) ?? (probes.json.server as string) ?? 'unknown',
        availableModels: Array.isArray(probes.json.data)
          ? probes.json.data.map((item) => String((item as any).id ?? (item as any).name ?? 'unknown'))
          : undefined,
      };
    }

    return result;
  };

  const handleTest = async (p: AIProvider) => {
    setTesting(p.id);
    let result: ConnectionTestResult;

    try {
      const res = await fetch('/api/provider/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider_type: p.provider_type,
          base_url: (p as any).base_url ?? '',
          api_key: (p as any).api_key ?? '',
        }),
      });
      const data = await res.json() as any;
      result = {
        success: data.success,
        latencyMs: data.latencyMs ?? 0,
        authStatus: data.success ? 'authenticated' : 'failed',
        version: data.version,
        availableModels: data.availableModels,
        error: data.error,
      };
    } catch (error) {
      result = {
        success: false,
        latencyMs: 0,
        authStatus: 'failed',
        error: error instanceof Error ? error.message : 'Connection failed',
      };
    }

    setTestResults((prev) => ({ ...prev, [p.id]: result }));
    setTesting(null);

    await supabase.from('system_logs').insert({
      log_type: 'connection',
      message: `Connection test for ${p.name}: ${result.success ? 'SUCCESS' : 'FAILED'}`,
      level: result.success ? 'info' : 'error',
      details: { latencyMs: result.latencyMs, provider: p.name, error: result.error },
    });
  };

  if (loading) return <AdminLoading label="Loading providers..." />;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {providers.length} provider{providers.length !== 1 ? 's' : ''} configured
        </p>
        <AdminButton
          variant="primary"
          size="sm"
          onClick={() => { setEditing(null); setShowForm(true); }}
        >
          <Plus className="h-4 w-4" />
          Add Provider
        </AdminButton>
      </div>

      {providers.length === 0 && !showForm ? (
        <AdminCard>
          <AdminEmptyState
            icon={Server}
            title="No providers configured"
            description="Add your first AI generation backend to get started"
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
              <ProviderForm
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
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                    {/* Drag handle + icon */}
                    <div className="flex items-center gap-3">
                      <GripVertical className="h-5 w-5 text-muted-foreground/40" />
                      <div className={cn(
                        'flex h-10 w-10 items-center justify-center rounded-xl border',
                        p.enabled ? 'border-primary/30 bg-primary/10' : 'border-border bg-secondary',
                      )}>
                        <Server className={cn('h-5 w-5', p.enabled ? 'text-primary' : 'text-muted-foreground')} />
                      </div>
                    </div>

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-display text-base font-bold tracking-tight">{p.name}</h3>
                        <AdminBadge variant={p.enabled ? 'success' : 'default'}>
                          {p.enabled ? 'Enabled' : 'Disabled'}
                        </AdminBadge>
                        <AdminBadge variant="primary">Priority {p.priority}</AdminBadge>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {PROVIDER_TYPES.find((t) => t.value === p.provider_type)?.label ?? p.provider_type}
                      </p>
                      {p.notes && <p className="mt-1 text-xs text-muted-foreground">{p.notes}</p>}
                    </div>

                    {/* Test result */}
                    {test && (
                      <div className="flex flex-wrap gap-3 text-xs">
                        <div className="flex items-center gap-1.5 rounded-lg border border-border bg-secondary/30 px-2.5 py-1.5">
                          {test.success ? (
                            <Check className="h-3.5 w-3.5 text-success" />
                          ) : (
                            <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                          )}
                          <span className={test.success ? 'text-success' : 'text-destructive'}>
                            {test.success ? 'Connected' : 'Failed'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 rounded-lg border border-border bg-secondary/30 px-2.5 py-1.5">
                          <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-muted-foreground">{test.latencyMs}ms</span>
                        </div>
                        {test.version && (
                          <div className="flex items-center gap-1.5 rounded-lg border border-border bg-secondary/30 px-2.5 py-1.5">
                            <span className="text-muted-foreground">v{test.version}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-1.5">
                      <AdminButton
                        variant="secondary"
                        size="sm"
                        onClick={() => handleTest(p)}
                        disabled={isTesting}
                      >
                        {isTesting ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Zap className="h-3.5 w-3.5" />
                        )}
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

                  {/* Available models from test */}
                  {test?.availableModels && test.availableModels.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border/50 pt-3">
                      <span className="text-xs text-muted-foreground">Available models:</span>
                      {test.availableModels.map((m) => (
                        <span key={m} className="rounded-md bg-secondary px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                          {m}
                        </span>
                      ))}
                    </div>
                  )}
                  {test?.error && (
                    <div className="mt-3 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2">
                      <AlertCircle className="h-4 w-4 text-destructive" />
                      <span className="text-xs text-destructive">{test.error}</span>
                    </div>
                  )}
                </AdminCard>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ProviderForm({
  provider,
  onSave,
  onCancel,
}: {
  provider: AIProvider | null;
  onSave: (p: Partial<AIProvider>) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(provider?.name ?? '');
  const [providerType, setProviderType] = useState<ProviderType>(provider?.provider_type ?? 'comfyui');
  const [enabled, setEnabled] = useState(provider?.enabled ?? true);
  const [priority, setPriority] = useState(String(provider?.priority ?? 1));
  const [notes, setNotes] = useState(provider?.notes ?? '');
  const [apiKey, setApiKey] = useState((provider as any)?.api_key ?? '');
  const [baseUrl, setBaseUrl] = useState((provider as any)?.base_url ?? '');
  const [showKey, setShowKey] = useState(false);

  // Default base URLs per provider type
  const DEFAULT_URLS: Partial<Record<ProviderType, string>> = {
    openai: 'https://api.openai.com',
    ollama: 'http://localhost:11434',
    stability: 'https://api.stability.ai',
    huggingface: 'https://api-inference.huggingface.co',
    custom: '',
  };

  const handleTypeChange = (v: string) => {
    const t = v as ProviderType;
    setProviderType(t);
    if (!baseUrl && DEFAULT_URLS[t]) setBaseUrl(DEFAULT_URLS[t]!);
  };

  const needsApiKey = providerType !== 'comfyui' && providerType !== 'ollama';
  const needsBaseUrl = providerType !== 'comfyui';

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
    >
      <AdminCard className="overflow-hidden border-primary/30 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-base font-bold">
            {provider ? 'Edit Provider' : 'New Provider'}
          </h3>
          <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <AdminLabel>Provider Name</AdminLabel>
            <AdminInput value={name} onChange={setName} placeholder="e.g. My OpenAI" />
          </div>
          <div>
            <AdminLabel>Provider Type</AdminLabel>
            <AdminSelect
              value={providerType}
              onChange={handleTypeChange}
              options={PROVIDER_TYPES}
            />
          </div>

          {needsBaseUrl && (
            <div className="sm:col-span-2">
              <AdminLabel>Base URL</AdminLabel>
              <AdminInput
                value={baseUrl}
                onChange={setBaseUrl}
                placeholder="https://api.openai.com"
              />
            </div>
          )}

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
              <p className="mt-1 text-[11px] text-muted-foreground">
                {providerType === 'openai' && 'Get your key from platform.openai.com/api-keys'}
                {providerType === 'stability' && 'Get your key from platform.stability.ai'}
                {providerType === 'huggingface' && 'Get your key from huggingface.co/settings/tokens'}
                {providerType === 'custom' && 'Enter the API key for your custom provider'}
              </p>
            </div>
          )}

          <div>
            <AdminLabel>Priority (higher = preferred)</AdminLabel>
            <AdminInput value={priority} onChange={setPriority} type="number" placeholder="1" />
          </div>
          <div className="flex items-end pb-2">
            <AdminToggle checked={enabled} onChange={setEnabled} label="Enabled" />
          </div>
          <div className="sm:col-span-2">
            <AdminLabel>Notes</AdminLabel>
            <AdminTextarea value={notes} onChange={setNotes} placeholder="Internal notes about this provider..." />
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <AdminButton variant="ghost" size="sm" onClick={onCancel}>Cancel</AdminButton>
          <AdminButton
            variant="primary"
            size="sm"
            onClick={() => onSave({
              name,
              provider_type: providerType,
              enabled,
              priority: Number(priority),
              notes,
              api_key: apiKey,
              base_url: baseUrl,
            } as any)}
            disabled={!name.trim()}
          >
            <Check className="h-4 w-4" />
            {provider ? 'Save Changes' : 'Add Provider'}
          </AdminButton>
        </div>
      </AdminCard>
    </motion.div>
  );
}
