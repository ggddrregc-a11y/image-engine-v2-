
import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Code2, Copy, Check, Key, Webhook, Book, Zap, RefreshCw, Loader2 } from 'lucide-react';
import { PageContainer, PageHeader } from './shared';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

// ── Real API endpoints ────────────────────────────────────────────
const ENDPOINTS = [
  { method: 'POST', path: '/api/image/generate',          desc: 'Generate an image from a text prompt' },
  { method: 'GET',  path: '/api/image-providers',         desc: 'List available image providers' },
  { method: 'POST', path: '/api/image-providers/test',    desc: 'Test connectivity to an image provider' },
  { method: 'POST', path: '/api/image-providers/fetch-models', desc: 'Fetch models from an image provider' },
  { method: 'POST', path: '/api/chat',                    desc: 'Send a chat message to an AI provider' },
  { method: 'GET',  path: '/api/chat/providers',          desc: 'List available chat providers' },
  { method: 'POST', path: '/api/edit',                    desc: 'Edit an image using AI' },
  { method: 'GET',  path: '/api/health',                  desc: 'Server health check' },
];

interface ApiKey {
  id: string;
  key: string;
  name: string;
  created_at: string;
  last_used: string | null;
  enabled: boolean;
}

interface UsageStats {
  totalImages: number;
  totalJobs: number;
  totalLogs: number;
}

// ── Code sample using real endpoint ──────────────────────────────
function buildCodeSample(apiKey: string) {
  return `curl -X POST https://remixofficial.online/api/image/generate \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "provider_id": "your-provider-id",
    "prompt": "cinematic portrait, golden hour",
    "width": 1024,
    "height": 1024,
    "steps": 20,
    "cfg_scale": 7
  }'`;
}

export function ApiView() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [stats, setStats] = useState<UsageStats>({ totalImages: 0, totalJobs: 0, totalLogs: 0 });
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [keysRes, imagesRes, jobsRes, logsRes] = await Promise.all([
      supabase.from('api_keys').select('*').order('created_at', { ascending: true }),
      supabase.from('stored_images').select('id', { count: 'exact', head: true }),
      supabase.from('generation_jobs').select('id', { count: 'exact', head: true }),
      supabase.from('system_logs').select('id', { count: 'exact', head: true }),
    ]);

    if (keysRes.data) setApiKeys(keysRes.data as ApiKey[]);
    setStats({
      totalImages: imagesRes.count ?? 0,
      totalJobs:   jobsRes.count  ?? 0,
      totalLogs:   logsRes.count  ?? 0,
    });
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleRegenerate = async (id: string) => {
    setRegenerating(true);
    const newKey = `sk_${crypto.randomUUID().replace(/-/g, '')}`;
    await supabase.from('api_keys').update({ key: newKey }).eq('id', id);
    await fetchData();
    setRegenerating(false);
  };

  const copy = (text: string, id: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const primaryKey = apiKeys[0];
  const codeSample = buildCodeSample(primaryKey?.key ?? 'sk_your_api_key');

  return (
    <PageContainer>
      <PageHeader
        title="API Access"
        description="Integrate the engine into your applications"
        icon={Code2}
      />

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* API Keys */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-border bg-card/40 p-5"
        >
          <div className="mb-4 flex items-center gap-2">
            <Key className="h-5 w-5 text-primary" />
            <h3 className="text-sm font-semibold">API Keys</h3>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : apiKeys.length === 0 ? (
            <p className="text-sm text-muted-foreground">No API keys found. Run the SQL setup first.</p>
          ) : (
            <div className="space-y-3">
              {apiKeys.map((k) => (
                <div key={k.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">{k.name}</span>
                    <span className={cn(
                      'rounded-md px-2 py-0.5 text-[10px] font-semibold',
                      k.enabled ? 'bg-success/10 text-success' : 'bg-secondary text-muted-foreground',
                    )}>
                      {k.enabled ? 'Active' : 'Disabled'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 rounded-xl border border-border bg-background/50 p-3">
                    <code className="flex-1 truncate font-mono text-sm text-muted-foreground">
                      {k.key}
                    </code>
                    <button
                      onClick={() => copy(k.key, k.id)}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {copiedKey === k.id
                        ? <Check className="h-4 w-4 text-success" />
                        : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                  {k.last_used && (
                    <p className="text-[11px] text-muted-foreground">
                      Last used: {new Date(k.last_used).toLocaleDateString()}
                    </p>
                  )}
                  <button
                    onClick={() => handleRegenerate(k.id)}
                    disabled={regenerating}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground disabled:opacity-50"
                  >
                    {regenerating
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <RefreshCw className="h-3.5 w-3.5" />}
                    Regenerate Key
                  </button>
                </div>
              ))}
            </div>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Keep your API key secure. Do not expose it in client-side code.
          </p>
        </motion.div>

        {/* Usage Stats */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-2xl border border-border bg-card/40 p-5"
        >
          <div className="mb-4 flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            <h3 className="text-sm font-semibold">Usage Stats</h3>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-4">
              <UsageBar label="Images Generated" used={stats.totalImages} total={Math.max(stats.totalImages, 100)} />
              <UsageBar label="Generation Jobs"  used={stats.totalJobs}   total={Math.max(stats.totalJobs, 100)} />
              <UsageBar label="System Logs"      used={stats.totalLogs}   total={Math.max(stats.totalLogs, 100)} />
            </div>
          )}
        </motion.div>
      </div>

      {/* Code sample */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mt-6 overflow-hidden rounded-2xl border border-border bg-card/40"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div className="flex items-center gap-2">
            <Book className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Quick Start</h3>
          </div>
          <button
            onClick={() => { navigator.clipboard?.writeText(codeSample); setCopiedCode(true); setTimeout(() => setCopiedCode(false), 1500); }}
            className="flex items-center gap-1.5 rounded-lg bg-secondary px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {copiedCode
              ? <Check className="h-3.5 w-3.5 text-success" />
              : <Copy className="h-3.5 w-3.5" />}
            {copiedCode ? 'Copied' : 'Copy'}
          </button>
        </div>
        <pre className="overflow-x-auto p-5 font-mono text-sm leading-relaxed text-muted-foreground">
          <code>{codeSample}</code>
        </pre>
      </motion.div>

      {/* Endpoints */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="mt-6 rounded-2xl border border-border bg-card/40"
      >
        <div className="flex items-center gap-2 border-b border-border px-5 py-3">
          <Webhook className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Endpoints</h3>
        </div>
        <div>
          {ENDPOINTS.map((ep, i) => (
            <div
              key={ep.path}
              className={cn(
                'flex items-center gap-4 px-5 py-3 transition-colors hover:bg-secondary/30',
                i !== ENDPOINTS.length - 1 && 'border-b border-border/50',
              )}
            >
              <span className={cn(
                'w-16 shrink-0 rounded-md px-2 py-1 text-center text-[10px] font-bold uppercase',
                ep.method === 'GET'    ? 'bg-success/10 text-success'
                : ep.method === 'POST'  ? 'bg-primary/10 text-primary'
                : ep.method === 'DELETE' ? 'bg-destructive/10 text-destructive'
                : 'bg-secondary text-muted-foreground',
              )}>
                {ep.method}
              </span>
              <code className="shrink-0 font-mono text-sm">{ep.path}</code>
              <span className="ml-auto hidden text-xs text-muted-foreground sm:block">{ep.desc}</span>
            </div>
          ))}
        </div>
      </motion.div>
    </PageContainer>
  );
}

function UsageBar({ label, used, total }: { label: string; used: number; total: number }) {
  const pct = total === 0 ? 0 : Math.min(100, (used / total) * 100);
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">
          {used.toLocaleString()} / {total.toLocaleString()}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className={cn(
            'h-full rounded-full',
            pct > 80 ? 'bg-destructive' : 'gradient-amber',
          )}
        />
      </div>
    </div>
  );
}
