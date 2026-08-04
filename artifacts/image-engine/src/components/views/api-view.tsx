
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Code2, Copy, Check, Key, Webhook, Book, Zap } from 'lucide-react';
import { PageContainer, PageHeader } from './shared';
import { cn } from '@/lib/utils';

const API_KEY = 'lm_sk_8f2a9b3c7d1e4f6a8b2c9d3e5f7a1b3c';
const ENDPOINTS = [
  { method: 'POST', path: '/v1/images/generations', desc: 'Create an image from a text prompt' },
  { method: 'GET', path: '/v1/images/:id', desc: 'Retrieve a generated image' },
  { method: 'GET', path: '/v1/models', desc: 'List available models' },
  { method: 'DELETE', path: '/v1/images/:id', desc: 'Delete an image' },
  { method: 'POST', path: '/v1/workflows/run', desc: 'Execute a ComfyUI workflow' },
];

const CODE_SAMPLE = `curl -X POST https://api.lumen.ai/v1/images/generations \\
  -H "Authorization: Bearer ${API_KEY}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "lumen-xl-v2.1",
    "prompt": "cinematic portrait, golden hour",
    "width": 1024,
    "height": 1024,
    "steps": 30,
    "cfg_scale": 7
  }'`;

export function ApiView() {
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const copy = (text: string, setter: (v: boolean) => void) => {
    navigator.clipboard?.writeText(text);
    setter(true);
    setTimeout(() => setter(false), 1500);
  };

  return (
    <PageContainer>
      <PageHeader
        title="API Access"
        description="Integrate Lumen into your applications"
        icon={Code2}
      />

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* API Key */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-border bg-card/40 p-5"
        >
          <div className="mb-4 flex items-center gap-2">
            <Key className="h-5 w-5 text-primary" />
            <h3 className="text-sm font-semibold">API Key</h3>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-border bg-background/50 p-3">
            <code className="flex-1 truncate font-mono text-sm text-muted-foreground">
              {API_KEY}
            </code>
            <button
              onClick={() => copy(API_KEY, setCopiedKey)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground transition-colors hover:text-foreground"
            >
              {copiedKey ? (
                <Check className="h-4 w-4 text-success" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Keep your API key secure. Do not expose it in client-side code.
          </p>
          <button className="mt-4 w-full rounded-xl border border-border py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground">
            Regenerate Key
          </button>
        </motion.div>

        {/* Usage stats */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-2xl border border-border bg-card/40 p-5"
        >
          <div className="mb-4 flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            <h3 className="text-sm font-semibold">Usage This Month</h3>
          </div>
          <div className="space-y-4">
            <UsageBar label="API Calls" used={12450} total={50000} />
            <UsageBar label="Images Generated" used={842} total={2000} />
            <UsageBar label="Compute Minutes" used={320} total={1000} />
          </div>
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
            onClick={() => copy(CODE_SAMPLE, setCopiedCode)}
            className="flex items-center gap-1.5 rounded-lg bg-secondary px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {copiedCode ? (
              <Check className="h-3.5 w-3.5 text-success" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {copiedCode ? 'Copied' : 'Copy'}
          </button>
        </div>
        <pre className="overflow-x-auto p-5 font-mono text-sm leading-relaxed text-muted-foreground">
          <code>{CODE_SAMPLE}</code>
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
              <span
                className={cn(
                  'w-16 shrink-0 rounded-md px-2 py-1 text-center text-[10px] font-bold uppercase',
                  ep.method === 'GET'
                    ? 'bg-success/10 text-success'
                    : ep.method === 'POST'
                      ? 'bg-primary/10 text-primary'
                      : ep.method === 'DELETE'
                        ? 'bg-destructive/10 text-destructive'
                        : 'bg-secondary text-muted-foreground',
                )}
              >
                {ep.method}
              </span>
              <code className="shrink-0 font-mono text-sm">{ep.path}</code>
              <span className="ml-auto hidden text-xs text-muted-foreground sm:block">
                {ep.desc}
              </span>
            </div>
          ))}
        </div>
      </motion.div>
    </PageContainer>
  );
}

function UsageBar({ label, used, total }: { label: string; used: number; total: number }) {
  const pct = Math.min(100, (used / total) * 100);
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
