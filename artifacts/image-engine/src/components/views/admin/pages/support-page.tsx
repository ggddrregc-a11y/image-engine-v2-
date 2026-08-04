import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  LifeBuoy, Save, Check, Loader2, Plus, Trash2, RotateCcw,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  AdminCard, AdminButton, AdminLabel, AdminInput, AdminLoading,
} from '../shared';

interface SupportLink {
  id: string;
  label: string;
  url: string;
  icon: string;
  sort_order: number;
}

const ICON_OPTIONS = [
  { value: '💬', label: 'Telegram' },
  { value: '📘', label: 'Facebook' },
  { value: '🐦', label: 'X / Twitter' },
  { value: '📸', label: 'Instagram' },
  { value: '▶️', label: 'YouTube' },
  { value: '📧', label: 'Email' },
  { value: '🌐', label: 'Website' },
  { value: '💼', label: 'LinkedIn' },
  { value: '🎮', label: 'Discord' },
  { value: '📞', label: 'Phone' },
];

export function AdminSupportPage() {
  const [links, setLinks] = useState<SupportLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const fetchLinks = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('support_links')
      .select('*')
      .order('sort_order', { ascending: true });
    if (data) setLinks(data as SupportLink[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchLinks(); }, [fetchLinks]);

  const addLink = () => {
    const newLink: SupportLink = {
      id: `new-${Date.now()}`,
      label: '',
      url: '',
      icon: '💬',
      sort_order: links.length,
    };
    setLinks((prev) => [...prev, newLink]);
  };

  const updateLink = (id: string, field: keyof SupportLink, value: string | number) => {
    setLinks((prev) => prev.map((l) => l.id === id ? { ...l, [field]: value } : l));
  };

  const removeLink = (id: string) => {
    setLinks((prev) => prev.filter((l) => l.id !== id));
  };

  const handleSave = async () => {
    setSaving(true);

    // Delete all existing and re-insert (simplest approach for small datasets)
    await supabase.from('support_links').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    const toInsert = links
      .filter((l) => l.label.trim() && l.url.trim())
      .map((l, i) => ({
        label: l.label.trim(),
        url: l.url.trim(),
        icon: l.icon,
        sort_order: i,
      }));

    if (toInsert.length > 0) {
      const { data } = await supabase.from('support_links').insert(toInsert).select();
      if (data) setLinks(data as SupportLink[]);
    } else {
      setLinks([]);
    }

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading) return <AdminLoading label="Loading support links..." />;

  return (
    <div className="space-y-6">
      <AdminCard className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LifeBuoy className="h-5 w-5 text-primary" />
            <h3 className="font-display text-base font-bold">Support Links</h3>
          </div>
          <AdminButton variant="ghost" size="sm" onClick={addLink}>
            <Plus className="h-4 w-4" />
            Add Link
          </AdminButton>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          These links appear in the Support section of the settings page.
        </p>

        {links.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-10 text-muted-foreground">
            <LifeBuoy className="h-8 w-8 opacity-30" />
            <p className="text-sm">No support links yet — click "Add Link" to add one</p>
          </div>
        ) : (
          <div className="space-y-3">
            {links.map((link) => (
              <div key={link.id} className="grid grid-cols-[40px_1fr_2fr_32px] items-center gap-2 rounded-xl border border-border bg-card/40 p-3">
                {/* Icon picker */}
                <select
                  value={link.icon}
                  onChange={(e) => updateLink(link.id, 'icon', e.target.value)}
                  className="h-9 w-full rounded-lg border border-border bg-card text-center text-lg outline-none focus:border-primary/40"
                >
                  {ICON_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.value}</option>
                  ))}
                </select>

                {/* Label */}
                <input
                  type="text"
                  value={link.label}
                  onChange={(e) => updateLink(link.id, 'label', e.target.value)}
                  placeholder="Label (e.g. Telegram)"
                  className="h-9 rounded-lg border border-border bg-background/50 px-3 text-sm outline-none focus:border-primary/40"
                />

                {/* URL */}
                <input
                  type="url"
                  value={link.url}
                  onChange={(e) => updateLink(link.id, 'url', e.target.value)}
                  placeholder="https://..."
                  className="h-9 rounded-lg border border-border bg-background/50 px-3 text-sm outline-none focus:border-primary/40"
                />

                {/* Delete */}
                <button
                  onClick={() => removeLink(link.id)}
                  className="flex h-9 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </AdminCard>

      {/* Save bar */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="sticky bottom-4 z-10">
        <AdminCard className="glass-strong flex items-center justify-between p-4">
          <p className="text-sm text-muted-foreground">
            {saved ? (
              <span className="flex items-center gap-1.5 text-success">
                <Check className="h-4 w-4" /> Links saved successfully
              </span>
            ) : (
              'Changes will appear in the Support section of settings'
            )}
          </p>
          <div className="flex gap-2">
            <AdminButton variant="ghost" size="sm" onClick={fetchLinks}>
              <RotateCcw className="h-4 w-4" /> Reset
            </AdminButton>
            <AdminButton variant="primary" size="sm" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Links
            </AdminButton>
          </div>
        </AdminCard>
      </motion.div>
    </div>
  );
}
