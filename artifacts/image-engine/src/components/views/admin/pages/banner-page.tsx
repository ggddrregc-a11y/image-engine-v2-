import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Megaphone, Save, Check, Loader2, RotateCcw, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  AdminCard, AdminButton, AdminLabel, AdminInput, AdminLoading, AdminToggle,
} from '../shared';
import { cn } from '@/lib/utils';

interface BannerConfig {
  id: string;
  enabled: boolean;
  text: string;
  cta_text: string;
  cta_url: string;
  icon: string;
  color: 'amber' | 'blue' | 'green' | 'rose' | 'violet' | 'cyan';
}

const ICON_OPTIONS = [
  { value: 'sparkles', label: '✦ Sparkles' },
  { value: 'zap',      label: '⚡ Zap' },
  { value: 'star',     label: '★ Star' },
  { value: 'bell',     label: '🔔 Bell' },
  { value: 'megaphone',label: '📢 Megaphone' },
  { value: 'rocket',   label: '🚀 Rocket' },
  { value: 'gift',     label: '🎁 Gift' },
];

const COLOR_OPTIONS: { value: BannerConfig['color']; label: string; swatch: string }[] = [
  { value: 'amber',  label: 'Amber',  swatch: 'bg-amber-400' },
  { value: 'blue',   label: 'Blue',   swatch: 'bg-blue-400' },
  { value: 'green',  label: 'Green',  swatch: 'bg-emerald-400' },
  { value: 'rose',   label: 'Rose',   swatch: 'bg-rose-400' },
  { value: 'violet', label: 'Violet', swatch: 'bg-violet-400' },
  { value: 'cyan',   label: 'Cyan',   swatch: 'bg-cyan-400' },
];

const DEFAULT: BannerConfig = {
  id: 'main',
  enabled: false,
  text: '✨ New feature just dropped — try it now!',
  cta_text: 'Learn more',
  cta_url: '#',
  icon: 'sparkles',
  color: 'amber',
};

export function AdminBannerPage() {
  const [config, setConfig] = useState<BannerConfig>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [preview, setPreview] = useState(false);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('banner_config')
      .select('*')
      .eq('id', 'main')
      .maybeSingle();
    if (data) setConfig(data as BannerConfig);
    setLoading(false);
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const handleSave = async () => {
    setSaving(true);
    await supabase.from('banner_config').upsert({ ...config, id: 'main' });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const set = <K extends keyof BannerConfig>(key: K, value: BannerConfig[K]) =>
    setConfig((prev) => ({ ...prev, [key]: value }));

  if (loading) return <AdminLoading label="Loading banner settings..." />;

  const previewColors: Record<BannerConfig['color'], string> = {
    amber:  'from-amber-500/20 via-orange-500/10 to-amber-500/20',
    blue:   'from-blue-500/20 via-indigo-500/10 to-blue-500/20',
    green:  'from-emerald-500/20 via-green-500/10 to-emerald-500/20',
    rose:   'from-rose-500/20 via-pink-500/10 to-rose-500/20',
    violet: 'from-violet-500/20 via-purple-500/10 to-violet-500/20',
    cyan:   'from-cyan-500/20 via-teal-500/10 to-cyan-500/20',
  };

  return (
    <div className="space-y-6">
      {/* Live Preview */}
      {preview && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            'rounded-xl border border-white/10 bg-gradient-to-r p-3',
            previewColors[config.color],
          )}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="text-sm">{config.icon}</span>
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-white/80" />
              </span>
              <p className="text-sm font-medium text-white/90">{config.text || '(no text)'}</p>
              {config.cta_text && (
                <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold text-white">
                  {config.cta_text} →
                </span>
              )}
            </div>
            <span className="text-xs text-white/40">× dismiss</span>
          </div>
        </motion.div>
      )}

      {/* Main config card */}
      <AdminCard className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" />
            <h3 className="font-display text-base font-bold">Announcement Bar</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPreview((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
            >
              {preview ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {preview ? 'Hide Preview' : 'Preview'}
            </button>
            <AdminToggle
              checked={config.enabled}
              onChange={(v) => set('enabled', v)}
              label={config.enabled ? 'Enabled' : 'Disabled'}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* Left column */}
          <div className="space-y-4">
            {/* Text */}
            <div>
              <AdminLabel>Announcement Text</AdminLabel>
              <AdminInput
                value={config.text}
                onChange={(v) => set('text', v)}
                placeholder="✨ New feature just dropped — try it now!"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">This is the main message shown in the bar.</p>
            </div>

            {/* CTA text */}
            <div>
              <AdminLabel>CTA Button Text</AdminLabel>
              <AdminInput
                value={config.cta_text}
                onChange={(v) => set('cta_text', v)}
                placeholder="Learn more"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">Leave empty to hide the button.</p>
            </div>

            {/* CTA URL */}
            <div>
              <AdminLabel>CTA URL</AdminLabel>
              <AdminInput
                value={config.cta_url}
                onChange={(v) => set('cta_url', v)}
                placeholder="https://..."
              />
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-4">
            {/* Icon */}
            <div>
              <AdminLabel>Icon</AdminLabel>
              <div className="flex flex-wrap gap-2">
                {ICON_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    onClick={() => set('icon', o.value)}
                    className={cn(
                      'rounded-xl border px-3 py-2 text-xs font-medium transition-all',
                      config.icon === o.value
                        ? 'border-primary/40 bg-primary/10 text-primary'
                        : 'border-border bg-card/40 text-muted-foreground hover:border-primary/30 hover:text-foreground',
                    )}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Color */}
            <div>
              <AdminLabel>Color Theme</AdminLabel>
              <div className="flex flex-wrap gap-2">
                {COLOR_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    onClick={() => set('color', o.value)}
                    className={cn(
                      'flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition-all',
                      config.color === o.value
                        ? 'border-primary/40 bg-primary/10 text-primary'
                        : 'border-border bg-card/40 text-muted-foreground hover:border-primary/30 hover:text-foreground',
                    )}
                  >
                    <span className={cn('h-3 w-3 rounded-full', o.swatch)} />
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </AdminCard>

      {/* Save bar */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="sticky bottom-4 z-10">
        <AdminCard className="glass-strong flex items-center justify-between p-4">
          <p className="text-sm text-muted-foreground">
            {saved ? (
              <span className="flex items-center gap-1.5 text-success">
                <Check className="h-4 w-4" /> Banner settings saved
              </span>
            ) : (
              'Changes apply immediately after saving'
            )}
          </p>
          <div className="flex gap-2">
            <AdminButton variant="ghost" size="sm" onClick={fetchConfig}>
              <RotateCcw className="h-4 w-4" /> Reset
            </AdminButton>
            <AdminButton variant="primary" size="sm" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Banner
            </AdminButton>
          </div>
        </AdminCard>
      </motion.div>
    </div>
  );
}
