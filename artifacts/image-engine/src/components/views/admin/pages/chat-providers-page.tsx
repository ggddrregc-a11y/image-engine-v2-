import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare,
  Plus,
  Trash2,
  Pencil,
  X,
  Check,
  Loader2,
  Star,
  RefreshCw,
  ChevronDown,
  Zap,
  AlertCircle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
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

interface ChatProvider {
  id: string;
  name: string;
  provider_type: string;
  base_url: string;
  api_key: string;
  model_name: string;
  enabled: boolean;
  is_default: boolean;
  notes: string;
  created_at: string;
}

interface FetchedModel {
  id: string;
  name: string;
  supported: boolean;
  reason?: string;
  isFree?: boolean;
  context?: number;
}

const PROVIDER_TYPES = [
  { value: 'openai',      label: 'OpenAI (ChatGPT)' },
  { value: 'groq',        label: 'Groq' },
  { value: 'gemini',      label: 'Google Gemini' },
  { value: 'openrouter',  label: 'OpenRouter' },
  { value: 'custom',      label: 'Custom / Other' },
];

const DEFAULT_URLS: Record<string, string> = {
  openai:     'https://api.openai.com',
  groq:       'https://api.groq.com/openai',
  gemini:     'https://generativelanguage.googleapis.com',
  openrouter: 'https://openrouter.ai/api',
  custom:     '',
};

const DEFAULT_MODELS: Record<string, string> = {
  openai:     'gpt-4o-mini',
  groq:       'llama-3.3-70b-versatile',
  gemini:     'gemini-1.5-flash',
  openrouter: 'openai/gpt-4o-mini',
  custom:     '',
};

export function AdminChatProvidersPage() {
  const [providers, setProviders] = useState<ChatProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ChatProvider | null>(null);

  const fetchProviders = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('chat_providers')
      .select('*')
      .order('created_at', { ascending: true });
    if (!error && data) setProviders(data as ChatProvider[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchProviders(); }, [fetchProviders]);

  const handleSave = async (p: Partial<ChatProvider>) => {
    if (editing) {
      await supabase.from('chat_providers').update({ ...p, updated_at: new Date().toISOString() }).eq('id', editing.id);
    } else {
      await supabase.from('chat_providers').insert(p);
    }
    setShowForm(false);
    setEditing(null);
    fetchProviders();
  };

  const handleSaveMulti = async (providers: Partial<ChatProvider>[]) => {
    for (const p of providers) {
      await supabase.from('chat_providers').insert(p);
    }
    setShowForm(false);
    setEditing(null);
    fetchProviders();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('chat_providers').delete().eq('id', id);
    fetchProviders();
  };

  const handleToggle = async (p: ChatProvider) => {
    await supabase.from('chat_providers').update({ enabled: !p.enabled }).eq('id', p.id);
    fetchProviders();
  };

  const handleSetDefault = async (p: ChatProvider) => {
    await supabase.from('chat_providers').update({ is_default: false }).neq('id', '');
    await supabase.from('chat_providers').update({ is_default: true }).eq('id', p.id);
    fetchProviders();
  };

  if (loading) return <AdminLoading label="Loading chat providers..." />;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {providers.length} provider{providers.length !== 1 ? 's' : ''} — النموذج الافتراضي يُستخدم في الشات
        </p>
        <AdminButton variant="primary" size="sm" onClick={() => { setEditing(null); setShowForm(true); }}>
          <Plus className="h-4 w-4" />
          Add Chat Provider
        </AdminButton>
      </div>

      {providers.length === 0 && !showForm ? (
        <AdminCard>
          <AdminEmptyState
            icon={MessageSquare}
            title="No chat providers configured"
            description="Add an AI chat provider with your API key to enable multi-model chat"
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
              <ChatProviderForm
                key="form"
                provider={editing}
                onSave={handleSave}
                onSaveMulti={handleSaveMulti}
                onCancel={() => { setShowForm(false); setEditing(null); }}
              />
            )}
          </AnimatePresence>

          {providers.map((p, i) => (
            <motion.div key={p.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <AdminCard className="p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${p.enabled ? 'border-primary/30 bg-primary/10' : 'border-border bg-secondary'}`}>
                    <MessageSquare className={`h-5 w-5 ${p.enabled ? 'text-primary' : 'text-muted-foreground'}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{p.name}</h3>
                      {p.is_default && <AdminBadge variant="primary">Default</AdminBadge>}
                      <AdminBadge variant={p.enabled ? 'success' : 'default'}>{p.enabled ? 'Enabled' : 'Disabled'}</AdminBadge>
                      <span className="rounded-md bg-secondary px-2 py-0.5 font-mono text-[11px] text-muted-foreground">{p.model_name}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {PROVIDER_TYPES.find(t => t.value === p.provider_type)?.label ?? p.provider_type} · {p.base_url}
                    </p>
                    {p.notes && <p className="mt-1 text-xs text-muted-foreground">{p.notes}</p>}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {!p.is_default && (
                      <AdminButton variant="secondary" size="sm" onClick={() => handleSetDefault(p)}>
                        <Star className="h-3.5 w-3.5" />
                        Set Default
                      </AdminButton>
                    )}
                    <AdminToggle checked={p.enabled} onChange={() => handleToggle(p)} />
                    <button onClick={() => { setEditing(p); setShowForm(true); }} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => handleDelete(p.id)} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </AdminCard>
            </motion.div>
          ))}
        </div>
      )}

      {/* Info box */}
      <AdminCard className="mt-4 p-4">
        <h4 className="mb-3 text-sm font-semibold">كيفية إضافة نموذج جديد</h4>
        <div className="grid grid-cols-1 gap-2 text-xs text-muted-foreground sm:grid-cols-3">
          {[
            { title: 'OpenAI / ChatGPT', url: 'api.openai.com', model: 'gpt-4o-mini', key: 'platform.openai.com' },
            { title: 'Groq (مجاني وسريع)', url: 'api.groq.com/openai', model: 'llama-3.3-70b-versatile', key: 'console.groq.com' },
            { title: 'Google Gemini', url: 'generativelanguage.googleapis.com', model: 'gemini-1.5-flash', key: 'aistudio.google.com' },
          ].map(item => (
            <div key={item.title} className="rounded-xl border border-border bg-secondary/30 p-3">
              <p className="font-semibold text-foreground">{item.title}</p>
              <p className="mt-1">Base URL: {item.url}</p>
              <p>Model: {item.model}</p>
              <p>API Key: من {item.key}</p>
            </div>
          ))}
        </div>
      </AdminCard>
    </div>
  );
}

/* ── Form with Fetch Models ─────────────────────────────────────── */
function ChatProviderForm({
  provider,
  onSave,
  onSaveMulti,
  onCancel,
}: {
  provider: ChatProvider | null;
  onSave: (p: Partial<ChatProvider>) => void;
  onSaveMulti: (providers: Partial<ChatProvider>[]) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(provider?.name ?? '');
  const [providerType, setProviderType] = useState(provider?.provider_type ?? 'openai');
  const [baseUrl, setBaseUrl] = useState(provider?.base_url ?? DEFAULT_URLS['openai']);
  const [apiKey, setApiKey] = useState(provider?.api_key ?? '');
  const [modelName, setModelName] = useState(provider?.model_name ?? DEFAULT_MODELS['openai']);
  const [selectedModels, setSelectedModels] = useState<string[]>(provider?.model_name ? [provider.model_name] : []);
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

  const handleTypeChange = (v: string) => {
    setProviderType(v);
    if (DEFAULT_URLS[v]) setBaseUrl(DEFAULT_URLS[v]);
    if (DEFAULT_MODELS[v]) {
      setModelName(DEFAULT_MODELS[v]);
      setSelectedModels([DEFAULT_MODELS[v]]);
    }
    setFetchedModels([]);
    setFetchError('');
  };

  const toggleModelSelection = (modelId: string) => {
    setSelectedModels(prev =>
      prev.includes(modelId) ? prev.filter(m => m !== modelId) : [...prev, modelId]
    );
  };

  const handleFetchModels = async () => {
    if (!baseUrl || !apiKey) {
      setFetchError('ادخل Base URL و API Key الأول');
      return;
    }
    setFetchLoading(true);
    setFetchError('');
    setFetchedModels([]);
    setShowModelPicker(false);

    try {
      const res = await fetch('/api/chat/fetch-models', {
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

  const filteredModels = fetchedModels.filter(m =>
    m.id.toLowerCase().includes(modelSearch.toLowerCase()) ||
    m.name.toLowerCase().includes(modelSearch.toLowerCase())
  );

  const supportedCount = fetchedModels.filter(m => m.supported).length;
  const freeCount = fetchedModels.filter(m => m.isFree).length;

  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
      <AdminCard className="overflow-hidden border-primary/30 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold">{provider ? 'Edit Chat Provider' : 'New Chat Provider'}</h3>
          <button onClick={onCancel} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <AdminLabel>Provider Name</AdminLabel>
            <AdminInput value={name} onChange={setName} placeholder="e.g. My GPT-4o" />
          </div>
          <div>
            <AdminLabel>Provider Type</AdminLabel>
            <AdminSelect value={providerType} onChange={handleTypeChange} options={PROVIDER_TYPES} />
          </div>
          <div className="sm:col-span-2">
            <AdminLabel>Base URL</AdminLabel>
            <AdminInput value={baseUrl} onChange={setBaseUrl} placeholder="https://api.openai.com" />
          </div>
          <div className="sm:col-span-2">
            <AdminLabel>API Key</AdminLabel>
            <div className="relative">
              <AdminInput value={apiKey} onChange={setApiKey} type={showKey ? 'text' : 'password'} placeholder="sk-..." />
              <button type="button" onClick={() => setShowKey(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground">
                {showKey ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {/* Model Name + Fetch */}
          <div className="sm:col-span-2">
            <div className="mb-2 flex items-center justify-between">
              <AdminLabel>Model Name</AdminLabel>
              <AdminButton
                variant="secondary"
                size="sm"
                onClick={handleFetchModels}
                disabled={fetchLoading || !baseUrl || !apiKey}
              >
                {fetchLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                {fetchLoading ? 'جاري السحب...' : 'Fetch Models'}
              </AdminButton>
            </div>
            <AdminInput value={modelName} onChange={setModelName} placeholder="gpt-4o-mini" />
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

            {/* Model picker */}
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
                      <span className="text-primary font-medium">{supportedCount} مدعوم للشات</span>
                      {freeCount > 0 && <span className="text-emerald-500 font-medium">{freeCount} مجاني</span>}
                      {selectedModels.length > 0 && (
                        <span className="font-semibold text-primary">{selectedModels.length} محدد</span>
                      )}
                    </div>
                    <button onClick={() => setShowModelPicker(false)} className="text-muted-foreground hover:text-foreground">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Search */}
                  <div className="border-b border-border px-3 py-2">
                    <input
                      value={modelSearch}
                      onChange={e => setModelSearch(e.target.value)}
                      placeholder="ابحث عن نموذج..."
                      className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
                    />
                  </div>

                  {/* List */}
                  <div className="max-h-72 overflow-y-auto">
                    {filteredModels.length === 0 ? (
                      <p className="py-6 text-center text-sm text-muted-foreground">لا توجد نتائج</p>
                    ) : (
                      filteredModels.map(m => (
                        <button
                          key={m.id}
                          onClick={() => { if (m.supported) { toggleModelSelection(m.id); setModelName(m.id); setModelSearch(''); } }}
                          disabled={!m.supported}
                          className={cn(
                            'flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors',
                            m.supported
                              ? 'hover:bg-secondary cursor-pointer'
                              : 'opacity-50 cursor-not-allowed',
                            selectedModels.includes(m.id) && 'bg-primary/10',
                          )}
                        >
                          {/* Icon */}
                          <div className={cn(
                            'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-[10px] font-bold',
                            m.supported ? 'border-primary/30 bg-primary/10 text-primary' : 'border-border bg-secondary text-muted-foreground',
                          )}>
                            {m.supported ? '✓' : '✗'}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-mono text-xs font-medium truncate">{m.id}</span>
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
                            {m.context && (
                              <p className="text-[10px] text-muted-foreground mt-0.5">{(m.context / 1000).toFixed(0)}K context</p>
                            )}
                          </div>

                          {selectedModels.includes(m.id) && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                        </button>
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex items-end pb-2">
            <AdminToggle checked={enabled} onChange={setEnabled} label="Enabled" />
          </div>
          <div className="flex items-end pb-2">
            <AdminToggle checked={isDefault} onChange={setIsDefault} label="Set as Default" />
          </div>
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
            onClick={() => {
              const modelsToSave = selectedModels.length > 0 ? selectedModels : [modelName];
              if (modelsToSave.length === 1) {
                onSave({ name, provider_type: providerType, base_url: baseUrl, api_key: apiKey, model_name: modelsToSave[0], enabled, is_default: isDefault, notes });
              } else {
                onSaveMulti(modelsToSave.map((m, i) => ({
                  name: `${name} (${m})`,
                  provider_type: providerType,
                  base_url: baseUrl,
                  api_key: apiKey,
                  model_name: m,
                  enabled,
                  is_default: isDefault && i === 0,
                  notes,
                })));
              }
            }}
            disabled={!name.trim() || (selectedModels.length === 0 && !modelName.trim())}
          >
            <Check className="h-4 w-4" />
            {provider ? 'Save Changes' : selectedModels.length > 1 ? `Add ${selectedModels.length} Providers` : 'Add Provider'}
          </AdminButton>
        </div>
      </AdminCard>
    </motion.div>
  );
}
