
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  Plus,
  Trash2,
  Pencil,
  X,
  Check,
  Search,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { PromptTemplateDB } from '@/lib/admin-types';
import {
  AdminCard,
  AdminButton,
  AdminInput,
  AdminLabel,
  AdminSelect,
  AdminTextarea,
  AdminLoading,
  AdminEmptyState,
  AdminBadge,
} from '../shared';
import { cn } from '@/lib/utils';

const CATEGORIES = [
  'realistic',
  'anime',
  'logo',
  'product',
  'architecture',
  'portrait',
  'fantasy',
  'nsfw',
];

export function AdminTemplatesPage() {
  const [templates, setTemplates] = useState<PromptTemplateDB[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<PromptTemplateDB | null>(null);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('all');

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('prompt_templates').select('*').order('created_at', { ascending: false });
    if (data) setTemplates(data as PromptTemplateDB[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  const handleSave = async (t: Partial<PromptTemplateDB>) => {
    if (editing) {
      await supabase.from('prompt_templates').update({
        name: t.name,
        prompt_text: t.prompt_text,
        category: t.category,
        negative_prompt: t.negative_prompt,
        updated_at: new Date().toISOString(),
      }).eq('id', editing.id);
    } else {
      await supabase.from('prompt_templates').insert({
        name: t.name,
        prompt_text: t.prompt_text,
        category: t.category,
        negative_prompt: t.negative_prompt ?? '',
      });
    }
    setShowForm(false);
    setEditing(null);
    fetchTemplates();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('prompt_templates').delete().eq('id', id);
    fetchTemplates();
  };

  const filtered = templates.filter((t) => {
    if (filterCat !== 'all' && t.category !== filterCat) return false;
    if (search && !t.name.toLowerCase().includes(search.toLowerCase()) && !t.prompt_text.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  if (loading) return <AdminLoading label="Loading templates..." />;

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 gap-2">
          <div className="relative flex-1 max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <AdminInput value={search} onChange={setSearch} placeholder="Search templates..." className="pl-9" />
          </div>
          <select
            value={filterCat}
            onChange={(e) => setFilterCat(e.target.value)}
            className="h-10 rounded-xl border border-border bg-background/50 px-3 text-sm outline-none focus:border-primary/40"
          >
            <option value="all" className="bg-card">All Categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c} className="bg-card capitalize">{c}</option>
            ))}
          </select>
        </div>
        <AdminButton variant="primary" size="sm" onClick={() => { setEditing(null); setShowForm(true); }}>
          <Plus className="h-4 w-4" />
          New Template
        </AdminButton>
      </div>

      <AnimatePresence>
        {showForm && (
          <TemplateForm key="form" template={editing} onSave={handleSave} onCancel={() => { setShowForm(false); setEditing(null); }} />
        )}
      </AnimatePresence>

      {filtered.length === 0 && !showForm ? (
        <AdminCard>
          <AdminEmptyState
            icon={FileText}
            title="No prompt templates"
            description="Create reusable prompt templates to speed up generation"
            action={
              <AdminButton variant="primary" size="sm" onClick={() => setShowForm(true)}>
                <Plus className="h-4 w-4" /> New Template
              </AdminButton>
            }
          />
        </AdminCard>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((t, i) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <AdminCard className="group p-4 transition-all hover:border-primary/30 hover:glow-soft">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-secondary">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-display text-sm font-bold">{t.name}</h4>
                      <AdminBadge variant="primary" >{t.category}</AdminBadge>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={() => { setEditing(t); setShowForm(true); }}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(t.id)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <p className="mt-3 line-clamp-3 text-xs leading-relaxed text-muted-foreground">{t.prompt_text}</p>
                {t.negative_prompt && (
                  <p className="mt-2 line-clamp-1 text-[10px] text-destructive/70">Neg: {t.negative_prompt}</p>
                )}
              </AdminCard>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

function TemplateForm({
  template,
  onSave,
  onCancel,
}: {
  template: PromptTemplateDB | null;
  onSave: (t: Partial<PromptTemplateDB>) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(template?.name ?? '');
  const [promptText, setPromptText] = useState(template?.prompt_text ?? '');
  const [category, setCategory] = useState(template?.category ?? 'realistic');
  const [negativePrompt, setNegativePrompt] = useState(template?.negative_prompt ?? '');

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
    >
      <AdminCard className="overflow-hidden border-primary/30 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-base font-bold">{template ? 'Edit Template' : 'New Template'}</h3>
          <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <AdminLabel>Template Name</AdminLabel>
            <AdminInput value={name} onChange={setName} placeholder="e.g. Cinematic Portrait" />
          </div>
          <div>
            <AdminLabel>Category</AdminLabel>
            <AdminSelect
              value={category}
              onChange={setCategory}
              options={CATEGORIES.map((c) => ({ value: c, label: c.charAt(0).toUpperCase() + c.slice(1) }))}
            />
          </div>
          <div className="sm:col-span-2">
            <AdminLabel>Prompt Text</AdminLabel>
            <AdminTextarea value={promptText} onChange={setPromptText} rows={4} placeholder="Enter the prompt text..." />
          </div>
          <div className="sm:col-span-2">
            <AdminLabel>Negative Prompt (optional)</AdminLabel>
            <AdminTextarea value={negativePrompt} onChange={setNegativePrompt} rows={2} placeholder="What to avoid in the image..." />
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <AdminButton variant="ghost" size="sm" onClick={onCancel}>Cancel</AdminButton>
          <AdminButton
            variant="primary"
            size="sm"
            onClick={() => onSave({ name, prompt_text: promptText, category, negative_prompt: negativePrompt })}
            disabled={!name.trim() || !promptText.trim()}
          >
            <Check className="h-4 w-4" />
            {template ? 'Save Changes' : 'Create Template'}
          </AdminButton>
        </div>
      </AdminCard>
    </motion.div>
  );
}
