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
  StarOff,
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

const PROVIDER_TYPES = [
  { value: 'openai',  label: 'OpenAI (ChatGPT)' },
  { value: 'groq',    label: 'Groq' },
  { value: 'gemini',  label: 'Google Gemini' },
  { value: 'openrouter', label: 'OpenRouter' },
  { value: 'custom',  label: 'Custom / Other' },
];

const DEFAULT_URLS: Record<string, string> = {
  openai:      'https://api.openai.com',
  groq:        'https://api.groq.com/openai',
  gemini:      'https://generativelanguage.googleapis.com',
  openrouter:  'https://openrouter.ai/api',
  custom:      '',
};

const DEFAULT_MODELS: Record<string, string> = {
  openai:      'gpt-4o-mini',
  groq:        'llama-3.3-70b-versatile',
  gemini:      'gemini-1.5-flash',
  openrouter:  'openai/gpt-4o-mini',
  custom:      '',
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
      await supabase.from('chat_providers').update({
        ...p,
        updated_at: new Date().toISOString(),
      }).eq('id', editing.id);
    } else {
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
    // Remove default from all
    await supabase.from('chat_providers').update({ is_default: false }).neq('id', '');
    // Set this one as default
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
                onCancel={() => { setShowForm(false); setEditing(null); }}
              />
            )}
          </AnimatePresence>

          {providers.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <AdminCard className="p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                  {/* Icon */}
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${p.enabled ? 'border-primary/30 bg-primary/10' : 'border-border bg-secondary'}`}>
                    <MessageSquare className={`h-5 w-5 ${p.enabled ? 'text-primary' : 'text-muted-foreground'}`} />
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
                        {p.model_name}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {PROVIDER_TYPES.find(t => t.value === p.provider_type)?.label ?? p.provider_type}
                      {' · '}
                      {p.base_url}
                    </p>
                    {p.notes && <p className="mt-1 text-xs text-muted-foreground">{p.notes}</p>}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5">
                    {!p.is_default && (
                      <AdminButton variant="secondary" size="sm" onClick={() => handleSetDefault(p)}>
                        <Star className="h-3.5 w-3.5" />
                        Set Default
                      </AdminButton>
                    )}
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
              </AdminCard>
            </motion.div>
          ))}
        </div>
      )}

      {/* Info box */}
      <AdminCard className="mt-4 p-4">
        <h4 className="mb-3 text-sm font-semibold">كيفية إضافة نموذج جديد</h4>
        <div className="space-y-2 text-xs text-muted-foreground">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-secondary/30 p-3">
              <p className="font-semibold text-foreground">OpenAI / ChatGPT</p>
              <p className="mt-1">Base URL: api.openai.com</p>
              <p>Model: gpt-4o-mini أو gpt-4o</p>
              <p>API Key: من platform.openai.com</p>
            </div>
            <div className="rounded-xl border border-border bg-secondary/30 p-3">
              <p className="font-semibold text-foreground">Groq (مجاني وسريع)</p>
              <p className="mt-1">Base URL: api.groq.com/openai</p>
              <p>Model: llama-3.3-70b-versatile</p>
              <p>API Key: من console.groq.com</p>
            </div>
            <div className="rounded-xl border border-border bg-secondary/30 p-3">
              <p className="font-semibold text-foreground">Google Gemini</p>
              <p className="mt-1">Base URL: generativelanguage.googleapis.com</p>
              <p>Model: gemini-1.5-flash</p>
              <p>API Key: من aistudio.google.com</p>
            </div>
          </div>
        </div>
      </AdminCard>
    </div>
  );
}

function ChatProviderForm({
  provider,
  onSave,
  onCancel,
}: {
  provider: ChatProvider | null;
  onSave: (p: Partial<ChatProvider>) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(provider?.name ?? '');
  const [providerType, setProviderType] = useState(provider?.provider_type ?? 'openai');
  const [baseUrl, setBaseUrl] = useState(provider?.base_url ?? DEFAULT_URLS['openai']);
  const [apiKey, setApiKey] = useState(provider?.api_key ?? '');
  const [modelName, setModelName] = useState(provider?.model_name ?? DEFAULT_MODELS['openai']);
  const [enabled, setEnabled] = useState(provider?.enabled ?? true);
  const [isDefault, setIsDefault] = useState(provider?.is_default ?? false);
  const [notes, setNotes] = useState(provider?.notes ?? '');
  const [showKey, setShowKey] = useState(false);

  const handleTypeChange = (v: string) => {
    setProviderType(v);
    if (DEFAULT_URLS[v]) setBaseUrl(DEFAULT_URLS[v]);
    if (DEFAULT_MODELS[v]) setModelName(DEFAULT_MODELS[v]);
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
    >
      <AdminCard className="overflow-hidden border-primary/30 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold">{provider ? 'Edit Chat Provider' : 'New Chat Provider'}</h3>
          <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
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
              <AdminInput
                value={apiKey}
                onChange={setApiKey}
                type={showKey ? 'text' : 'password'}
                placeholder="sk-... أو مفتاح الـ API"
              />
              <button
                type="button"
                onClick={() => setShowKey(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
              >
                {showKey ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>
          <div className="sm:col-span-2">
            <AdminLabel>Model Name</AdminLabel>
            <AdminInput value={modelName} onChange={setModelName} placeholder="gpt-4o-mini" />
            <p className="mt-1 text-[11px] text-muted-foreground">
              الاسم الدقيق للنموذج كما هو في الـ API — مثلاً: gpt-4o-mini، llama-3.3-70b-versatile، gemini-1.5-flash
            </p>
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
            onClick={() => onSave({ name, provider_type: providerType, base_url: baseUrl, api_key: apiKey, model_name: modelName, enabled, is_default: isDefault, notes })}
            disabled={!name.trim() || !modelName.trim()}
          >
            <Check className="h-4 w-4" />
            {provider ? 'Save Changes' : 'Add Provider'}
          </AdminButton>
        </div>
      </AdminCard>
    </motion.div>
  );
}
