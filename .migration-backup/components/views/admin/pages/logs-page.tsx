'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  ScrollText,
  Search,
  Trash2,
  Code2,
  Image as ImageIcon,
  AlertCircle,
  Webhook,
  Link2,
  Info,
  AlertTriangle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { SystemLog, LogType, LogLevel } from '@/lib/admin-types';
import {
  AdminCard,
  AdminButton,
  AdminInput,
  AdminBadge,
  AdminLoading,
  AdminEmptyState,
} from '../shared';
import { cn } from '@/lib/utils';

const LOG_TYPES: { value: LogType | 'all'; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: 'all', label: 'All', icon: ScrollText },
  { value: 'api', label: 'API', icon: Code2 },
  { value: 'generation', label: 'Generation', icon: ImageIcon },
  { value: 'error', label: 'Errors', icon: AlertCircle },
  { value: 'webhook', label: 'Webhook', icon: Webhook },
  { value: 'connection', label: 'Connection', icon: Link2 },
];

const LEVEL_CONFIG: Record<LogLevel, { color: string; bg: string; icon: React.ComponentType<{ className?: string }> }> = {
  info: { color: 'text-primary', bg: 'bg-primary/10', icon: Info },
  warning: { color: 'text-warning', bg: 'bg-warning/10', icon: AlertTriangle },
  error: { color: 'text-destructive', bg: 'bg-destructive/10', icon: AlertCircle },
};

export function AdminLogsPage() {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<LogType | 'all'>('all');
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('system_logs').select('*').order('created_at', { ascending: false }).limit(100);
    if (filterType !== 'all') {
      query = query.eq('log_type', filterType);
    }
    if (search) {
      query = query.ilike('message', `%${search}%`);
    }
    const { data } = await query;
    if (data) setLogs(data as SystemLog[]);
    setLoading(false);
  }, [filterType, search]);

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 5000);
    return () => clearInterval(interval);
  }, [fetchLogs]);

  const handleClearLogs = async () => {
    await supabase.from('system_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    fetchLogs();
  };

  if (loading && logs.length === 0) return <AdminLoading label="Loading logs..." />;

  return (
    <div>
      {/* Controls */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 gap-2">
          <div className="relative flex-1 max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <AdminInput
              value={search}
              onChange={setSearch}
              placeholder="Search logs..."
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {LOG_TYPES.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.value}
                  onClick={() => setFilterType(t.value)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all',
                    filterType === t.value
                      ? 'border-primary/40 bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
        <AdminButton variant="danger" size="sm" onClick={handleClearLogs}>
          <Trash2 className="h-4 w-4" />
          Clear All
        </AdminButton>
      </div>

      {/* Logs */}
      {logs.length === 0 ? (
        <AdminCard>
          <AdminEmptyState
            icon={ScrollText}
            title="No logs found"
            description="System logs will appear here as the platform runs"
          />
        </AdminCard>
      ) : (
        <AdminCard className="overflow-hidden">
          <div className="max-h-[600px] overflow-y-auto scrollbar-thin">
            {logs.map((log, i) => {
              const levelConfig = LEVEL_CONFIG[log.level as LogLevel] ?? LEVEL_CONFIG.info;
              const LevelIcon = levelConfig.icon;
              const isExpanded = expanded === log.id;
              return (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(i * 0.02, 0.2) }}
                  className={cn(
                    'cursor-pointer border-b border-border/50 px-4 py-3 transition-colors hover:bg-secondary/20',
                    isExpanded && 'bg-secondary/20',
                  )}
                  onClick={() => setExpanded(isExpanded ? null : log.id)}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn('mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg', levelConfig.bg)}>
                      <LevelIcon className={cn('h-3.5 w-3.5', levelConfig.color)} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <AdminBadge variant="default">{log.log_type}</AdminBadge>
                        <p className="line-clamp-1 flex-1 text-sm">{log.message}</p>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {new Date(log.created_at).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </p>
                      {isExpanded && log.details && Object.keys(log.details).length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="mt-2 overflow-x-auto rounded-lg border border-border bg-background/50 p-3"
                        >
                          <pre className="text-xs text-muted-foreground">
                            <code>{JSON.stringify(log.details, null, 2)}</code>
                          </pre>
                        </motion.div>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </AdminCard>
      )}
    </div>
  );
}
