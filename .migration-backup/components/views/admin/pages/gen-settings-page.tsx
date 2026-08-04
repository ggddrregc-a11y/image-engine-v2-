'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  SlidersHorizontal,
  Save,
  Check,
  Loader2,
  RotateCcw,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { GenerationSettings } from '@/lib/admin-types';
import {
  AdminCard,
  AdminButton,
  AdminInput,
  AdminLabel,
  AdminSelect,
  AdminTextarea,
  AdminToggle,
  AdminSlider,
  AdminLoading,
} from '../shared';

const SAMPLERS = ['DPM++ 2M Karras', 'DPM++ SDE Karras', 'Euler a', 'Euler', 'DDIM', 'UniPC'];
const SCHEDULERS = ['karras', 'exponential', 'normal', 'simple', 'ddim_uniform'];
const RESOLUTIONS = ['512x512', '768x768', '1024x1024', '1024x1536', '1536x1024', '1536x864', '864x1536'];

export function AdminGenerationSettingsPage() {
  const [settings, setSettings] = useState<GenerationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('generation_settings').select('*').limit(1).maybeSingle();
    if (data) setSettings(data as GenerationSettings);
    setLoading(false);
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const update = (field: keyof GenerationSettings, value: unknown) => {
    setSettings((prev) => prev ? { ...prev, [field]: value as never } : prev);
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    await supabase.from('generation_settings').update({
      width: settings.width,
      height: settings.height,
      cfg: settings.cfg,
      sampler: settings.sampler,
      scheduler: settings.scheduler,
      seed: settings.seed,
      steps: settings.steps,
      batch_count: settings.batch_count,
      batch_size: settings.batch_size,
      negative_prompt: settings.negative_prompt,
      safety_filter: settings.safety_filter,
      watermark: settings.watermark,
      save_metadata: settings.save_metadata,
      updated_at: new Date().toISOString(),
    }).eq('id', settings.id);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading || !settings) return <AdminLoading label="Loading settings..." />;

  return (
    <div className="space-y-6">
      <AdminCard className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <SlidersHorizontal className="h-5 w-5 text-primary" />
          <h3 className="font-display text-base font-bold">Global Generation Defaults</h3>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* Dimensions */}
          <div>
            <AdminLabel>Default Resolution</AdminLabel>
            <AdminSelect
              value={`${settings.width}x${settings.height}`}
              onChange={(v) => {
                const [w, h] = v.split('x').map(Number);
                update('width', w);
                update('height', h);
              }}
              options={RESOLUTIONS.map((r) => ({ value: r, label: r }))}
            />
          </div>

          {/* CFG */}
          <AdminSlider
            label="CFG Scale"
            value={settings.cfg}
            onChange={(v) => update('cfg', v)}
            min={1}
            max={20}
            step={0.5}
          />

          {/* Steps */}
          <AdminSlider
            label="Steps"
            value={settings.steps}
            onChange={(v) => update('steps', v)}
            min={1}
            max={150}
          />

          {/* Batch count */}
          <AdminSlider
            label="Batch Count"
            value={settings.batch_count}
            onChange={(v) => update('batch_count', v)}
            min={1}
            max={8}
          />

          {/* Batch size */}
          <AdminSlider
            label="Batch Size"
            value={settings.batch_size}
            onChange={(v) => update('batch_size', v)}
            min={1}
            max={8}
          />

          {/* Sampler */}
          <div>
            <AdminLabel>Sampler</AdminLabel>
            <AdminSelect
              value={settings.sampler}
              onChange={(v) => update('sampler', v)}
              options={SAMPLERS.map((s) => ({ value: s, label: s }))}
            />
          </div>

          {/* Scheduler */}
          <div>
            <AdminLabel>Scheduler</AdminLabel>
            <AdminSelect
              value={settings.scheduler}
              onChange={(v) => update('scheduler', v)}
              options={SCHEDULERS.map((s) => ({ value: s, label: s }))}
            />
          </div>

          {/* Seed */}
          <div>
            <AdminLabel>Seed (-1 = random)</AdminLabel>
            <AdminInput value={settings.seed} onChange={(v) => update('seed', v)} placeholder="-1" />
          </div>

          {/* Negative prompt */}
          <div className="lg:col-span-2">
            <AdminLabel>Negative Prompt</AdminLabel>
            <AdminTextarea
              value={settings.negative_prompt}
              onChange={(v) => update('negative_prompt', v)}
              rows={2}
              placeholder="Global negative prompt applied to all generations..."
            />
          </div>
        </div>
      </AdminCard>

      {/* Safety & metadata toggles */}
      <AdminCard className="p-5">
        <h3 className="mb-4 font-display text-base font-bold">Safety & Metadata</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex items-center justify-between rounded-xl border border-border bg-card/40 p-4">
            <div>
              <p className="text-sm font-medium">Safety Filter</p>
              <p className="text-xs text-muted-foreground">Block unsafe content</p>
            </div>
            <AdminToggle checked={settings.safety_filter} onChange={(v) => update('safety_filter', v)} />
          </div>
          <div className="flex items-center justify-between rounded-xl border border-border bg-card/40 p-4">
            <div>
              <p className="text-sm font-medium">Watermark</p>
              <p className="text-xs text-muted-foreground">Embed invisible watermark</p>
            </div>
            <AdminToggle checked={settings.watermark} onChange={(v) => update('watermark', v)} />
          </div>
          <div className="flex items-center justify-between rounded-xl border border-border bg-card/40 p-4">
            <div>
              <p className="text-sm font-medium">Save Metadata</p>
              <p className="text-xs text-muted-foreground">Store generation params</p>
            </div>
            <AdminToggle checked={settings.save_metadata} onChange={(v) => update('save_metadata', v)} />
          </div>
        </div>
      </AdminCard>

      {/* Save bar */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky bottom-4 z-10"
      >
        <AdminCard className="glass-strong flex items-center justify-between p-4">
          <p className="text-sm text-muted-foreground">
            {saved ? (
              <span className="flex items-center gap-1.5 text-success">
                <Check className="h-4 w-4" /> Settings saved successfully
              </span>
            ) : (
              'Changes will apply to all new generations'
            )}
          </p>
          <div className="flex gap-2">
            <AdminButton variant="ghost" size="sm" onClick={fetchSettings}>
              <RotateCcw className="h-4 w-4" />
              Reset
            </AdminButton>
            <AdminButton variant="primary" size="sm" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Settings
            </AdminButton>
          </div>
        </AdminCard>
      </motion.div>
    </div>
  );
}
