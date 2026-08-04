
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Workflow,
  Upload,
  Save,
  RefreshCw,
  Trash2,
  Link2,
  Check,
  X,
  Loader2,
  ArrowRight,
  ArrowLeft,
  FileJson,
  AlertCircle,
  KeyRound,
  Plus,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { AIProvider, ComfyUIWorkflow, WorkflowNode, ApiConfig, AuthType } from '@/lib/admin-types';
import {
  AdminCard,
  AdminButton,
  AdminInput,
  AdminLabel,
  AdminLoading,
  AdminEmptyState,
  AdminBadge,
  AdminSelect,
  AdminTextarea,
} from '../shared';
import { cn } from '@/lib/utils';

export function AdminComfyUIPage() {
  const [providers, setProviders] = useState<AIProvider[]>([]);
  const [workflows, setWorkflows] = useState<ComfyUIWorkflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const [workflowName, setWorkflowName] = useState('');
  const [workflowJson, setWorkflowJson] = useState<Record<string, unknown> | null>(null);
  const [inputNodes, setInputNodes] = useState<WorkflowNode[]>([]);
  const [outputNodes, setOutputNodes] = useState<WorkflowNode[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [parseError, setParseError] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'connected' | 'failed' | ''>('');
  const [testError, setTestError] = useState('');
  const [connectionInfo, setConnectionInfo] = useState<{
    providerType: string;
    endpoint: string;
    version?: string;
    availableModels?: string[];
    raw?: Record<string, unknown>;
  } | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [{ data: provData }, { data: wfData }] = await Promise.all([
      supabase.from('ai_providers').select('*').eq('provider_type', 'comfyui').order('priority', { ascending: false }),
      supabase.from('comfyui_workflows').select('*').order('created_at', { ascending: false }),
    ]);
    if (provData) setProviders(provData as AIProvider[]);
    if (wfData) setWorkflows(wfData as ComfyUIWorkflow[]);
    if (provData && provData.length > 0 && !selectedProvider) {
      setSelectedProvider(provData[0].id);
    }
    setLoading(false);
  }, [selectedProvider]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const parseWorkflow = (json: Record<string, unknown>) => {
    setParseError('');
    const inputs: WorkflowNode[] = [];
    const outputs: WorkflowNode[] = [];

    // ComfyUI workflow_api.json format: { "node_id": { "class_type": "...", "inputs": {...} } }
    for (const [nodeId, nodeData] of Object.entries(json)) {
      const node = nodeData as { class_type?: string; inputs?: Record<string, unknown> };
      if (!node.class_type) continue;

      const isInput =
        node.class_type.includes('CLIPTextEncode') ||
        node.class_type.includes('LoadImage') ||
        node.class_type.includes('EmptyLatentImage') ||
        node.class_type.includes('CheckpointLoader') ||
        node.class_type.includes('Load');
      const isOutput =
        node.class_type.includes('SaveImage') ||
        node.class_type.includes('PreviewImage') ||
        node.class_type.includes('VAEDecode');

      const workflowNode: WorkflowNode = {
        id: nodeId,
        type: isInput ? 'input' : isOutput ? 'output' : 'process',
        title: node.class_type,
        class_type: node.class_type,
      };

      if (isInput) inputs.push(workflowNode);
      else if (isOutput) outputs.push(workflowNode);
    }

    setInputNodes(inputs);
    setOutputNodes(outputs);
    setWorkflowJson(json);
  };

  const normalizeUrl = (url: string) => url.replace(/\/$/, '');

  const detectConnection = async (url: string, providerType?: string) => {
    const endpoint = normalizeUrl(url);
    const info = {
      providerType: providerType ?? 'Unknown',
      endpoint,
      version: undefined as string | undefined,
      availableModels: undefined as string[] | undefined,
      raw: undefined as Record<string, unknown> | undefined,
    };

    const probe = async (path: string) => {
      const response = await fetch(`${endpoint}${path}`, { method: 'GET' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const json = (await response.json()) as Record<string, unknown>;
      return { path, json };
    };

    const tryPaths = async (paths: string[]) => {
      for (const path of paths) {
        try {
          const result = await probe(path);
          return result;
        } catch {
          // ignore and continue
        }
      }
      throw new Error('No supported endpoint responded');
    };

    try {
      const knownType = providerType === 'comfyui' ? 'ComfyUI' : providerType === 'openai' ? 'OpenAI-compatible' : providerType === 'openrouter' ? 'OpenRouter' : 'Generic';
      info.providerType = knownType;

      if (providerType === 'comfyui') {
        const { json } = await tryPaths(['/api/version', '/api/info', '/api/health']);
        info.version = (json.version as string) ?? (json.server as string) ?? undefined;
        info.raw = json;
      } else if (providerType === 'openai' || providerType === 'openrouter') {
        const { json } = await tryPaths(['/v1/models', '/openapi.json']);
        info.availableModels = Array.isArray(json.data)
          ? json.data.map((item) => String((item as any).id ?? (item as any).name ?? 'unknown'))
          : undefined;
        info.raw = json;
      } else {
        const { path, json } = await tryPaths(['/api/version', '/api/info', '/api/health', '/v1/models', '/openapi.json']);
        info.raw = json;
        if (path.startsWith('/api')) {
          info.providerType = 'ComfyUI-compatible';
          info.version = (json.version as string) ?? (json.server as string) ?? undefined;
        } else if (path.startsWith('/v1') || path === '/openapi.json') {
          info.providerType = 'OpenAI-compatible';
          info.availableModels = Array.isArray(json.data)
            ? json.data.map((item) => String((item as any).id ?? (item as any).name ?? 'unknown'))
            : undefined;
        }
      }
    } catch (err) {
      throw err;
    }

    return info;
  };

  const handleFileUpload = async (file: File) => {
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      parseWorkflow(json);
    } catch {
      setParseError('Invalid JSON file. Please upload a valid workflow_api.json');
      setWorkflowJson(null);
      setInputNodes([]);
      setOutputNodes([]);
    }
  };

  const handleSave = async () => {
    if (!selectedProvider || !serverUrl || !workflowJson) return;
    setSaving(true);
    await supabase.from('comfyui_workflows').insert({
      provider_id: selectedProvider,
      server_url: serverUrl,
      workflow_name: workflowName || 'Untitled Workflow',
      workflow_json: workflowJson,
      input_nodes: inputNodes,
      output_nodes: outputNodes,
    });
    await supabase.from('system_logs').insert({
      log_type: 'api',
      message: `ComfyUI workflow saved: ${workflowName || 'Untitled'}`,
      level: 'info',
      details: { server_url: serverUrl, node_count: inputNodes.length + outputNodes.length },
    });
    setSaving(false);
    setWorkflowJson(null);
    setInputNodes([]);
    setOutputNodes([]);
    setWorkflowName('');
    fetchData();
  };

  const handleTestConnection = async () => {
    if (!serverUrl) return;
    setTesting(true);
    setTestResult('');
    setTestError('');
    setConnectionInfo(null);

    const providerType = providers.find((p) => p.id === selectedProvider)?.provider_type;

    try {
      // Use server-side proxy to check ComfyUI (avoid direct client->ComfyUI requests)
      const res = await fetch('/api/comfy/check', { method: 'GET' });
      const json = await res.json().catch(() => ({}));
      if (res.ok && (json.ok === true || json.status === 'ok' || json.health)) {
        setTestResult('connected');
        const info = {
          providerType: 'ComfyUI (proxied)',
          endpoint: serverUrl,
          version: (json.version as string) ?? undefined,
          availableModels: undefined as string[] | undefined,
          raw: json as Record<string, unknown>,
        };
        setConnectionInfo(info);
        await supabase.from('system_logs').insert({
          log_type: 'connection',
          message: `Connection test to ${serverUrl} via proxy: SUCCESS`,
          level: 'info',
          details: { server_url: serverUrl, provider_type: providerType, info },
        });
      } else {
        const msg = json?.error ?? `Status ${res.status}`;
        setTestResult('failed');
        setTestError(String(msg));
        await supabase.from('system_logs').insert({
          log_type: 'connection',
          message: `ComfyUI connection test to ${serverUrl} via proxy: FAILED`,
          level: 'error',
          details: { server_url: serverUrl, provider_type: providerType, error: msg },
        });
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      setTestResult('failed');
      setTestError(msg);
      await supabase.from('system_logs').insert({
        log_type: 'connection',
        message: `ComfyUI connection test to ${serverUrl} via proxy: FAILED`,
        level: 'error',
        details: { server_url: serverUrl, provider_type: providerType, error: msg },
      });
    } finally {
      setTesting(false);
    }
  };

  const handleDeleteWorkflow = async (id: string) => {
    await supabase.from('comfyui_workflows').delete().eq('id', id);
    fetchData();
  };

  const handleReloadWorkflow = async (wf: ComfyUIWorkflow) => {
    setServerUrl(wf.server_url);
    setWorkflowName(wf.workflow_name);
    setWorkflowJson(wf.workflow_json);
    setInputNodes(wf.input_nodes || []);
    setOutputNodes(wf.output_nodes || []);
    if (wf.provider_id) setSelectedProvider(wf.provider_id);
  };

  if (loading) return <AdminLoading label="Loading ComfyUI configuration..." />;

  return (
    <div className="space-y-6">
      {/* Configuration form */}
      <AdminCard className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <Workflow className="h-5 w-5 text-primary" />
          <h3 className="font-display text-base font-bold">ComfyUI Configuration</h3>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Left: Server + provider */}
          <div className="space-y-4">
            <div>
              <AdminLabel>Provider</AdminLabel>
              {providers.length === 0 ? (
                <p className="rounded-xl border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-warning">
                  No ComfyUI providers found. Add one in the AI Providers tab first.
                </p>
              ) : (
                <select
                  value={selectedProvider}
                  onChange={(e) => setSelectedProvider(e.target.value)}
                  className="h-10 w-full rounded-xl border border-border bg-background/50 px-3 text-sm outline-none focus:border-primary/40"
                >
                  {providers.map((p) => (
                    <option key={p.id} value={p.id} className="bg-card">{p.name}</option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <AdminLabel>Server URL</AdminLabel>
              <div className="flex gap-2">
                <AdminInput
                  value={serverUrl}
                  onChange={setServerUrl}
                  placeholder="http://localhost:8188"
                  className="flex-1"
                />
                <AdminButton
                  variant="secondary"
                  size="md"
                  onClick={handleTestConnection}
                  disabled={!serverUrl || testing}
                >
                  {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                  Test
                </AdminButton>
              </div>
              {testResult === 'connected' && (
                <div className="space-y-2">
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-success">
                    <Check className="h-3.5 w-3.5" /> Connected successfully
                  </div>
                  {connectionInfo && (
                    <div className="rounded-xl border border-success/30 bg-success/5 p-3 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">Detected:</span>
                        <span>{connectionInfo.providerType}</span>
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="font-semibold">Endpoint:</span>
                        <span className="truncate">{connectionInfo.endpoint}</span>
                      </div>
                      {connectionInfo.version && (
                        <div className="mt-1 flex items-center gap-2">
                          <span className="font-semibold">Version:</span>
                          <span>{connectionInfo.version}</span>
                        </div>
                      )}
                      {connectionInfo.availableModels && connectionInfo.availableModels.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          <span className="font-semibold">Models:</span>
                          {connectionInfo.availableModels.slice(0, 5).map((model) => (
                            <span key={model} className="rounded-full bg-success/20 px-2 py-0.5 text-[10px]">
                              {model}
                            </span>
                          ))}
                          {connectionInfo.availableModels.length > 5 && (
                            <span className="text-muted-foreground">+{connectionInfo.availableModels.length - 5} more</span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              {testResult === 'failed' && (
                <div className="mt-2 space-y-2 text-xs">
                  <div className="flex items-center gap-1.5 text-destructive">
                    <AlertCircle className="h-3.5 w-3.5" /> Connection failed
                  </div>
                  {testError && <div className="text-destructive/80">{testError}</div>}
                </div>
              )}
            </div>
            <div>
              <AdminLabel>Workflow Name</AdminLabel>
              <AdminInput
                value={workflowName}
                onChange={setWorkflowName}
                placeholder="e.g. SDXL Text-to-Image"
              />
            </div>
          </div>

          {/* Right: Upload area */}
          <div>
            <AdminLabel>Workflow JSON (workflow_api.json)</AdminLabel>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const file = e.dataTransfer.files[0];
                if (file) handleFileUpload(file);
              }}
              className={cn(
                'flex min-h-[120px] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-4 transition-colors',
                dragOver ? 'border-primary bg-primary/5' : 'border-border bg-background/30',
              )}
            >
              {workflowJson ? (
                <div className="flex w-full items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <FileJson className="h-5 w-5 text-primary" />
                    <span>Workflow loaded ({Object.keys(workflowJson).length} nodes)</span>
                  </div>
                  <button
                    onClick={() => { setWorkflowJson(null); setInputNodes([]); setOutputNodes([]); }}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <>
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Drop workflow_api.json here</p>
                  <label className="cursor-pointer">
                    <span className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium transition-colors hover:border-primary/30">
                      Browse files
                    </span>
                    <input
                      type="file"
                      accept=".json"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file);
                      }}
                    />
                  </label>
                </>
              )}
            </div>
            {parseError && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-destructive">
                <AlertCircle className="h-3.5 w-3.5" /> {parseError}
              </div>
            )}
          </div>
        </div>

        {/* Node preview */}
        <AnimatePresence>
          {workflowJson && (inputNodes.length > 0 || outputNodes.length > 0) && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 overflow-hidden"
            >
              <div className="grid grid-cols-1 gap-4 border-t border-border pt-4 sm:grid-cols-2">
                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
                    <ArrowRight className="h-3.5 w-3.5" />
                    Input Nodes ({inputNodes.length})
                  </p>
                  <div className="space-y-1.5">
                    {inputNodes.map((n) => (
                      <div key={n.id} className="flex items-center gap-2 rounded-lg border border-border bg-secondary/30 px-3 py-2">
                        <span className="font-mono text-[10px] text-muted-foreground">#{n.id}</span>
                        <span className="text-sm">{n.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-success">
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Output Nodes ({outputNodes.length})
                  </p>
                  <div className="space-y-1.5">
                    {outputNodes.map((n) => (
                      <div key={n.id} className="flex items-center gap-2 rounded-lg border border-border bg-secondary/30 px-3 py-2">
                        <span className="font-mono text-[10px] text-muted-foreground">#{n.id}</span>
                        <span className="text-sm">{n.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Actions */}
        <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
          <AdminButton variant="primary" size="sm" onClick={handleSave} disabled={!workflowJson || !serverUrl || saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Workflow
          </AdminButton>
          <AdminButton variant="secondary" size="sm" onClick={handleTestConnection} disabled={!serverUrl}>
            <RefreshCw className="h-4 w-4" />
            Reload Workflow
          </AdminButton>
        </div>
      </AdminCard>

      {/* API Configuration */}
      <AdminCard className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-primary" />
          <h3 className="font-display text-base font-bold">API Configuration</h3>
        </div>
        <ApiConfigSection providerId={selectedProvider} />
      </AdminCard>

      {/* Saved workflows */}
      <div>
        <h3 className="mb-3 text-sm font-semibold">Saved Workflows</h3>
        {workflows.length === 0 ? (
          <AdminCard>
            <AdminEmptyState
              icon={Workflow}
              title="No workflows saved"
              description="Upload a workflow_api.json file and save it to see it here"
            />
          </AdminCard>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {workflows.map((wf, i) => (
              <motion.div
                key={wf.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <AdminCard className="p-4" >
                  <div className="flex items-start justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-secondary">
                      <Workflow className="h-5 w-5 text-primary" />
                    </div>
                    <AdminBadge variant="primary">
                      {(wf.input_nodes?.length ?? 0) + (wf.output_nodes?.length ?? 0)} nodes
                    </AdminBadge>
                  </div>
                  <h4 className="mt-3 font-display text-sm font-bold">{wf.workflow_name}</h4>
                  <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">{wf.server_url}</p>
                  <div className="mt-3 flex gap-2 border-t border-border/50 pt-3">
                    <AdminButton variant="secondary" size="sm" onClick={() => handleReloadWorkflow(wf)}>
                      <RefreshCw className="h-3.5 w-3.5" />
                      Load
                    </AdminButton>
                    <button
                      onClick={() => handleDeleteWorkflow(wf.id)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </AdminCard>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ApiConfigSection({ providerId }: { providerId: string }) {
  const [configs, setConfigs] = useState<ApiConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [authType, setAuthType] = useState<AuthType>('none');
  const [endpointPath, setEndpointPath] = useState('');
  const [headersText, setHeadersText] = useState('{}');
  const [bodyText, setBodyText] = useState('{}');

  const fetchConfigs = useCallback(async () => {
    if (!providerId) { setConfigs([]); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase.from('api_configs').select('*').eq('provider_id', providerId);
    if (data) setConfigs(data as ApiConfig[]);
    setLoading(false);
  }, [providerId]);

  useEffect(() => { fetchConfigs(); }, [fetchConfigs]);

  const handleSave = async () => {
    let headers = {};
    let body = {};
    try { headers = JSON.parse(headersText); } catch { /* ignore */ }
    try { body = JSON.parse(bodyText); } catch { /* ignore */ }
    await supabase.from('api_configs').insert({
      provider_id: providerId,
      auth_type: authType,
      endpoint_path: endpointPath,
      headers,
      request_body: body,
    });
    setShowForm(false);
    setEndpointPath('');
    setHeadersText('{}');
    setBodyText('{}');
    fetchConfigs();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('api_configs').delete().eq('id', id);
    fetchConfigs();
  };

  if (loading) return <p className="text-sm text-muted-foreground">Loading...</p>;

  return (
    <div>
      {configs.length > 0 && (
        <div className="mb-3 space-y-2">
          {configs.map((c) => (
            <div key={c.id} className="flex items-center gap-3 rounded-xl border border-border bg-card/40 p-3">
              <AdminBadge variant="primary">{c.auth_type}</AdminBadge>
              <code className="flex-1 truncate font-mono text-xs text-muted-foreground">{c.endpoint_path || '(default)'}</code>
              <button
                onClick={() => handleDelete(c.id)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {!showForm ? (
        <AdminButton variant="secondary" size="sm" onClick={() => setShowForm(true)} disabled={!providerId}>
          <Plus className="h-4 w-4" />
          Add API Config
        </AdminButton>
      ) : (
        <div className="space-y-3 rounded-xl border border-primary/30 bg-card/30 p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <AdminLabel>Authentication Type</AdminLabel>
              <AdminSelect
                value={authType}
                onChange={(v) => setAuthType(v as AuthType)}
                options={[
                  { value: 'none', label: 'None' },
                  { value: 'api_key', label: 'API Key' },
                  { value: 'bearer', label: 'Bearer Token' },
                  { value: 'custom_headers', label: 'Custom Headers' },
                  { value: 'basic', label: 'Basic Auth' },
                  { value: 'cookie', label: 'Cookie' },
                ]}
              />
            </div>
            <div>
              <AdminLabel>Custom Endpoint Path</AdminLabel>
              <AdminInput value={endpointPath} onChange={setEndpointPath} placeholder="/v1/images/generations" />
            </div>
            <div className="sm:col-span-2">
              <AdminLabel>Headers (JSON)</AdminLabel>
              <AdminTextarea value={headersText} onChange={setHeadersText} rows={2} placeholder='{"Authorization": "Bearer ..."}' />
            </div>
            <div className="sm:col-span-2">
              <AdminLabel>Request Body (JSON)</AdminLabel>
              <AdminTextarea value={bodyText} onChange={setBodyText} rows={2} placeholder='{"key": "value"}' />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <AdminButton variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancel</AdminButton>
            <AdminButton variant="primary" size="sm" onClick={handleSave}>Save Config</AdminButton>
          </div>
        </div>
      )}
    </div>
  );
}
