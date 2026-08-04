
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Boxes,
  Plus,
  Trash2,
  Pencil,
  X,
  Check,
  Star,
  ImageIcon,
  Type,
  Video,
  Music,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { AIProvider, AIModel, ModelType } from '@/lib/admin-types';
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
  AdminSlider,
} from '../shared';
import { cn } from '@/lib/utils';

const MODEL_TYPES: { value: ModelType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: 'image', label: 'Image', icon: ImageIcon },
  { value: 'text', label: 'Text', icon: Type },
  { value: 'video', label: 'Video', icon: Video },
  { value: 'audio', label: 'Audio', icon: Music },
];

const SAMPLERS = ['DPM++ 2M Karras', 'DPM++ SDE Karras', 'Euler a', 'Euler', 'DDIM', 'UniPC'];
const SCHEDULERS = ['karras', 'exponential', 'normal', 'simple', 'ddim_uniform'];
const SEED_MODES = ['random', 'fixed', 'iterative'];

export function AdminModelsPage() {
  const [models, setModels] = useState<AIModel[]>([]);
  const [providers, setProviders] = useState<AIProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<AIModel | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [{ data: mData }, { data: pData }] = await Promise.all([
      supabase.from('ai_models').select('*').order('created_at', { ascending: false }),
      supabase.from('ai_providers').select('*').order('priority', { ascending: false }),
    ]);
    if (mData) setModels(mData as AIModel[]);
    if (pData) setProviders(pData as AIProvider[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSave = async (m: Partial<AIModel>) => {
    if (editing) {
      await supabase.from('ai_models').update({
        name: m.name,
        provider_id: m.provider_id,
        model_type: m.model_type,
        enabled: m.enabled,
        is_default: m.is_default,
        max_resolution: m.max_resolution,
        max_steps: m.max_steps,
        sampler: m.sampler,
        scheduler: m.scheduler,
        cfg: m.cfg,
        seed_mode: m.seed_mode,
        custom_params: m.custom_params,
        updated_at: new Date().toISOString(),
      }).eq('id', editing.id);
    } else {
      await supabase.from('ai_models').insert({
        name: m.name,
        provider_id: m.provider_id,
        model_type: m.model_type,
        enabled: m.enabled ?? true,
        is_default: m.is_default ?? false,
        max_resolution: m.max_resolution ?? '1024x1024',
        max_steps: m.max_steps ?? 50,
        sampler: m.sampler ?? 'DPM++ 2M Karras',
        scheduler: m.scheduler ?? 'karras',
        cfg: m.cfg ?? 7,
        seed_mode: m.seed_mode ?? 'random',
        custom_params: m.custom_params ?? {},
      });
    }
    // If setting as default, unset other defaults
    if (m.is_default) {
      const others = models.filter((x) => x.id !== editing?.id && x.is_default);
      for (const o of others) {
        await supabase.from('ai_models').update({ is_default: false }).eq('id', o.id);
      }
    }
    setShowForm(false);
    setEditing(null);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('ai_models').delete().eq('id', id);
    fetchData();
  };

  const handleToggle = async (m: AIModel) => {
    await supabase.from('ai_models').update({ enabled: !m.enabled }).eq('id', m.id);
    fetchData();
  };

  const providerName = (id: string | null) =>
    providers.find((p) => p.id === id)?.name ?? 'Unassigned';

  if (loading) return <AdminLoading label="Loading models..." />;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{models.length} models configured</p>
        <AdminButton variant="primary" size="sm" onClick={() => { setEditing(null); setShowForm(true); }}>
          <Plus className="h-4 w-4" />
          Add Model
        </AdminButton>
      </div>

      <AnimatePresence>
        {showForm && (
          <ModelForm
            key="form"
            model={editing}
            providers={providers}
            onSave={handleSave}
            onCancel={() => { setShowForm(false); setEditing(null); }}
          />
        )}
      </AnimatePresence>

      {models.length === 0 && !showForm ? (
        <AdminCard>
          <AdminEmptyState
            icon={Boxes}
            title="No models configured"
            description="Add your first AI model to get started"
            action={
              <AdminButton variant="primary" size="sm" onClick={() => setShowForm(true)}>
                <Plus className="h-4 w-4" /> Add Model
              </AdminButton>
            }
          />
        </AdminCard>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {models.map((m, i) => {
            const typeConfig = MODEL_TYPES.find((t) => t.value === m.model_type);
            const TypeIcon = typeConfig?.icon ?? ImageIcon;
            return (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <AdminCard className={cn('p-4', m.is_default && 'border-primary/40')}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'flex h-10 w-10 items-center justify-center rounded-xl border',
                        m.enabled ? 'border-primary/30 bg-primary/10' : 'border-border bg-secondary',
                      )}>
                        <TypeIcon className={cn('h-5 w-5', m.enabled ? 'text-primary' : 'text-muted-foreground')} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-display text-sm font-bold">{m.name}</h4>
                          {m.is_default && (
                            <Star className="h-3.5 w-3.5 fill-primary text-primary" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{providerName(m.provider_id)}</p>
                      </div>
                    </div>
                    <AdminBadge variant={m.enabled ? 'success' : 'default'}>
                      {m.enabled ? 'Enabled' : 'Disabled'}
                    </AdminBadge>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div><span className="text-muted-foreground">Type:</span> <span className="font-medium capitalize">{m.model_type}</span></div>
                    <div><span className="text-muted-foreground">Max Res:</span> <span className="font-medium">{m.max_resolution}</span></div>
                    <div><span className="text-muted-foreground">Max Steps:</span> <span className="font-medium">{m.max_steps}</span></div>
                    <div><span className="text-muted-foreground">CFG:</span> <span className="font-medium">{m.cfg}</span></div>
                    <div className="truncate"><span className="text-muted-foreground">Sampler:</span> <span className="font-medium">{m.sampler}</span></div>
                    <div><span className="text-muted-foreground">Seed:</span> <span className="font-medium capitalize">{m.seed_mode}</span></div>
                  </div>

                  <div className="mt-3 flex items-center gap-1.5 border-t border-border/50 pt-3">
                    <AdminToggle checked={m.enabled} onChange={() => handleToggle(m)} />
                    <div className="ml-auto flex gap-1">
                      <button
                        onClick={() => { setEditing(m); setShowForm(true); }}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(m.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </AdminCard>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ModelForm({
  model,
  providers,
  onSave,
  onCancel,
}: {
  model: AIModel | null;
  providers: AIProvider[];
  onSave: (m: Partial<AIModel>) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(model?.name ?? '');
  const [providerId, setProviderId] = useState(model?.provider_id ?? providers[0]?.id ?? '');
  const [modelType, setModelType] = useState<ModelType>(model?.model_type ?? 'image');
  const [enabled, setEnabled] = useState(model?.enabled ?? true);
  const [isDefault, setIsDefault] = useState(model?.is_default ?? false);
  const [maxResolution, setMaxResolution] = useState(model?.max_resolution ?? '1024x1024');
  const [maxSteps, setMaxSteps] = useState(model?.max_steps ?? 50);
  const [sampler, setSampler] = useState(model?.sampler ?? 'DPM++ 2M Karras');
  const [scheduler, setScheduler] = useState(model?.scheduler ?? 'karras');
  const [cfg, setCfg] = useState(model?.cfg ?? 7);
  const [seedMode, setSeedMode] = useState(model?.seed_mode ?? 'random');
  const [customParams, setCustomParams] = useState(
    model ? JSON.stringify(model.custom_params, null, 2) : '{}',
  );

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
    >
      <AdminCard className="overflow-hidden border-primary/30 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-base font-bold">{model ? 'Edit Model' : 'New Model'}</h3>
          <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <AdminLabel>Model Name</AdminLabel>
            <AdminInput value={name} onChange={setName} placeholder="e.g. Lumen-XL v2.1" />
          </div>
          <div>
            <AdminLabel>Provider</AdminLabel>
            <AdminSelect
              value={providerId}
              onChange={setProviderId}
              options={providers.map((p) => ({ value: p.id, label: p.name }))}
            />
          </div>
          <div>
            <AdminLabel>Model Type</AdminLabel>
            <AdminSelect
              value={modelType}
              onChange={(v) => setModelType(v as ModelType)}
              options={MODEL_TYPES.map((t) => ({ value: t.value, label: t.label }))}
            />
          </div>
          <div>
            <AdminLabel>Maximum Resolution</AdminLabel>
            <AdminInput value={maxResolution} onChange={setMaxResolution} placeholder="1024x1024" />
          </div>
          <div>
            <AdminLabel>Sampler</AdminLabel>
            <AdminSelect
              value={sampler}
              onChange={setSampler}
              options={SAMPLERS.map((s) => ({ value: s, label: s }))}
            />
          </div>
          <div>
            <AdminLabel>Scheduler</AdminLabel>
            <AdminSelect
              value={scheduler}
              onChange={setScheduler}
              options={SCHEDULERS.map((s) => ({ value: s, label: s }))}
            />
          </div>
          <div>
            <AdminLabel>Seed Mode</AdminLabel>
            <AdminSelect
              value={seedMode}
              onChange={setSeedMode}
              options={SEED_MODES.map((s) => ({ value: s, label: s }))}
            />
          </div>
          <div className="flex items-end pb-2">
            <AdminSlider label="CFG" value={cfg} onChange={setCfg} min={1} max={20} step={0.5} />
          </div>
          <div className="flex items-end pb-2">
            <AdminSlider label="Max Steps" value={maxSteps} onChange={setMaxSteps} min={1} max={150} />
          </div>
          <div className="flex items-end gap-6 pb-2">
            <AdminToggle checked={enabled} onChange={setEnabled} label="Enabled" />
            <AdminToggle checked={isDefault} onChange={setIsDefault} label="Default Model" />
          </div>
          <div className="sm:col-span-2">
            <AdminLabel>Custom Parameters (JSON)</AdminLabel>
            <AdminTextarea
              value={customParams}
              onChange={setCustomParams}
              rows={4}
              placeholder='{"param_name": "value"}'
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <AdminButton variant="ghost" size="sm" onClick={onCancel}>Cancel</AdminButton>
          <AdminButton
            variant="primary"
            size="sm"
            onClick={() => {
              let parsed = {};
              try { parsed = JSON.parse(customParams); } catch { /* ignore */ }
              onSave({
                name, provider_id: providerId, model_type: modelType, enabled, is_default: isDefault,
                max_resolution: maxResolution, max_steps: maxSteps, sampler, scheduler, cfg, seed_mode: seedMode,
                custom_params: parsed,
              });
            }}
            disabled={!name.trim()}
          >
            <Check className="h-4 w-4" />
            {model ? 'Save Changes' : 'Add Model'}
          </AdminButton>
        </div>
      </AdminCard>
    </motion.div>
  );
}
