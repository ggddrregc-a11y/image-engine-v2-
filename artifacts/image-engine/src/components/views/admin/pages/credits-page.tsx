import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Zap, Save, Check, Loader2, RotateCcw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  AdminCard,
  AdminButton,
  AdminLabel,
  AdminLoading,
} from '../shared';

interface CreditSettings {
  id: string;
  initial_credits: number;
  generate_cost: number;
  edit_cost: number;
  updated_at: string;
}

const DEFAULTS: Omit<CreditSettings, 'id' | 'updated_at'> = {
  initial_credits: 100,
  generate_cost: 10,
  edit_cost: 5,
};

function NumberInput({
  label,
  description,
  value,
  onChange,
  min = 0,
  max = 10000,
}: {
  label: string;
  description: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-card/40 p-4">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onChange(Math.max(min, value - 1))}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-secondary text-sm font-bold transition-colors hover:bg-secondary/80"
        >
          −
        </button>
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            if (!isNaN(v)) onChange(Math.min(max, Math.max(min, v)));
          }}
          className="h-8 w-20 rounded-lg border border-border bg-card text-center text-sm font-semibold outline-none focus:border-primary/40"
        />
        <button
          onClick={() => onChange(Math.min(max, value + 1))}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-secondary text-sm font-bold transition-colors hover:bg-secondary/80"
        >
          +
        </button>
      </div>
    </div>
  );
}

export function AdminCreditsPage() {
  const [settings, setSettings] = useState<CreditSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('credit_settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (data) {
      setSettings(data as CreditSettings);
    } else {
      // Create default row if it doesn't exist
      const { data: inserted } = await supabase
        .from('credit_settings')
        .insert({ ...DEFAULTS })
        .select()
        .single();
      if (inserted) setSettings(inserted as CreditSettings);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const update = (field: keyof typeof DEFAULTS, value: number) => {
    setSettings((prev) => prev ? { ...prev, [field]: value } : prev);
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    await supabase
      .from('credit_settings')
      .update({
        initial_credits: settings.initial_credits,
        generate_cost: settings.generate_cost,
        edit_cost: settings.edit_cost,
        updated_at: new Date().toISOString(),
      })
      .eq('id', settings.id);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading || !settings) return <AdminLoading label="Loading credit settings..." />;

  return (
    <div className="space-y-6">
      {/* New visitor credits */}
      <AdminCard className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          <h3 className="font-display text-base font-bold">Visitor Credits</h3>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          Credits are stored in the browser (localStorage). Each new visitor gets the initial amount automatically.
        </p>
        <NumberInput
          label="Initial Credits"
          description="Credits given to every new visitor on first visit"
          value={settings.initial_credits}
          onChange={(v) => update('initial_credits', v)}
          min={1}
          max={10000}
        />
      </AdminCard>

      {/* Cost per operation */}
      <AdminCard className="p-5">
        <h3 className="mb-4 font-display text-base font-bold">Cost per Operation</h3>
        <div className="space-y-3">
          <NumberInput
            label="Generate Image Cost"
            description="Credits deducted for each image generation"
            value={settings.generate_cost}
            onChange={(v) => update('generate_cost', v)}
            min={0}
            max={1000}
          />
          <NumberInput
            label="Edit Image Cost"
            description="Credits deducted for each AI image edit"
            value={settings.edit_cost}
            onChange={(v) => update('edit_cost', v)}
            min={0}
            max={1000}
          />
        </div>
      </AdminCard>

      {/* Preview */}
      <AdminCard className="p-5">
        <h3 className="mb-3 font-display text-base font-bold">Summary</h3>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Starting Credits', value: settings.initial_credits, color: 'text-primary' },
            { label: 'Generate Cost', value: settings.generate_cost, color: 'text-warning' },
            { label: 'Edit Cost', value: settings.edit_cost, color: 'text-warning' },
          ].map((item) => (
            <div key={item.label} className="rounded-xl border border-border bg-card/40 p-3 text-center">
              <p className={`text-2xl font-bold tabular-nums ${item.color}`}>{item.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{item.label}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          A visitor starting with <strong>{settings.initial_credits}</strong> credits can generate{' '}
          <strong>{settings.generate_cost > 0 ? Math.floor(settings.initial_credits / settings.generate_cost) : '∞'}</strong> images
          or edit <strong>{settings.edit_cost > 0 ? Math.floor(settings.initial_credits / settings.edit_cost) : '∞'}</strong> images.
        </p>
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
              'Changes apply to new visitors only (existing browsers keep their credits)'
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
