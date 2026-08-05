import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Wand2, Save, Check, Loader2, RotateCcw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  AdminCard,
  AdminButton,
  AdminInput,
  AdminLabel,
  AdminToggle,
  AdminLoading,
} from '../shared';

interface EditorSettings {
  enabled: boolean;
  api_url: string;
}

export function AdminImageEditorPage() {
  const [settings, setSettings] = useState<EditorSettings>({
    enabled: false,
    api_url: 'https://viscodev.x10.mx/img_editing/api.php',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('feature_settings')
      .select('*')
      .eq('id', 'image_editor')
      .maybeSingle();
    if (data) {
      setSettings({
        enabled: data.enabled,
        api_url: (data.config as any)?.api_url ?? settings.api_url,
      });
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const handleSave = async () => {
    setSaving(true);
    await supabase.from('feature_settings').upsert({
      id: 'image_editor',
      enabled: settings.enabled,
      config: { api_url: settings.api_url },
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading) return <AdminLoading label="Loading Image Editor settings..." />;

  return (
    <div className="space-y-5">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      >
        <AdminCard className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <Wand2 className="h-5 w-5 text-primary" />
          <h3 className="font-display text-base font-bold">Image Editor Feature</h3>
        </div>

        <div className="space-y-5">
          {/* Enable/Disable */}
          <div className="flex items-center justify-between rounded-xl border border-border bg-card/40 p-4">
            <div>
              <p className="text-sm font-medium">Enable Image Editor</p>
              <p className="text-xs text-muted-foreground">
                Show the Editor page in the sidebar for all users
              </p>
            </div>
            <AdminToggle
              checked={settings.enabled}
              onChange={(v) => setSettings((prev) => ({ ...prev, enabled: v }))}
            />
          </div>

          {/* API URL */}
          <div>
            <AdminLabel>Editor API URL</AdminLabel>
            <AdminInput
              value={settings.api_url}
              onChange={(v) => setSettings((prev) => ({ ...prev, api_url: v }))}
              placeholder="https://your-editor-api.com/api.php"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              The backend API that handles image editing requests.
            </p>
          </div>
        </div>
        </AdminCard>
      </motion.div>

      {/* Save bar */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut', delay: 0.1 }}
      >
        <AdminCard className="flex items-center justify-between p-4">
        <p className="text-sm text-muted-foreground">
          {saved ? (
            <span className="flex items-center gap-1.5 text-success">
              <Check className="h-4 w-4" /> Settings saved
            </span>
          ) : (
            'Changes apply immediately after saving'
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
