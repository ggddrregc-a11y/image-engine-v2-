
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function AdminPageContainer({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn('w-full', className)}
    >
      {children}
    </motion.div>
  );
}

export function AdminCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-border bg-card/50 backdrop-blur-sm',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function AdminButton({
  children,
  onClick,
  variant = 'secondary',
  size = 'md',
  disabled,
  className,
  type = 'button',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  disabled?: boolean;
  className?: string;
  type?: 'button' | 'submit';
}) {
  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled}
      whileHover={disabled ? {} : { scale: 1.02 }}
      whileTap={disabled ? {} : { scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1',
        size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2.5 text-sm',
        variant === 'primary' && 'gradient-amber text-black hover:glow-amber active:brightness-95',
        variant === 'secondary' &&
          'border border-border bg-card/60 text-foreground hover:border-primary/30 hover:bg-card active:bg-secondary',
        variant === 'ghost' &&
          'text-muted-foreground hover:bg-secondary hover:text-foreground active:bg-secondary/70',
        variant === 'danger' &&
          'border border-destructive/30 text-destructive hover:bg-destructive/10 active:bg-destructive/20',
        className,
      )}
    >
      {children}
    </motion.button>
  );
}

export function AdminInput({
  value,
  onChange,
  placeholder,
  type = 'text',
  className,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn(
        'h-10 w-full rounded-xl border border-border bg-background/50 px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary/40 disabled:opacity-50',
        className,
      )}
    />
  );
}

export function AdminTextarea({
  value,
  onChange,
  placeholder,
  rows = 3,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className={cn(
        'w-full resize-none rounded-xl border border-border bg-background/50 px-3 py-2.5 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary/40',
        className,
      )}
    />
  );
}

export function AdminLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label
      className={cn(
        'mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground',
        className,
      )}
    >
      {children}
    </label>
  );
}

export function AdminSelect({
  value,
  onChange,
  options,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        'h-10 w-full rounded-xl border border-border bg-background/50 px-3 text-sm outline-none transition-colors focus:border-primary/40',
        className,
      )}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value} className="bg-card text-foreground">
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function AdminToggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center gap-3"
    >
      <span
        className={cn(
          'relative h-6 w-11 shrink-0 rounded-full transition-colors',
          checked ? 'bg-primary' : 'bg-secondary',
        )}
      >
        <motion.span
          layout
          transition={{ type: 'spring', stiffness: 500, damping: 32 }}
          className={cn(
            'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-md',
            checked ? 'left-[22px]' : 'left-0.5',
          )}
        />
      </span>
      {label && <span className="text-sm font-medium">{label}</span>}
    </button>
  );
}

export function AdminSlider({
  value,
  onChange,
  min,
  max,
  step = 1,
  label,
  unit,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  label: string;
  unit?: string;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span className="text-sm font-semibold tabular-nums">
          {value}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-secondary accent-primary"
      />
    </div>
  );
}

export function AdminBadge({
  children,
  variant = 'default',
}: {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'primary';
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium',
        variant === 'default' && 'bg-secondary text-muted-foreground',
        variant === 'success' && 'bg-success/10 text-success',
        variant === 'warning' && 'bg-warning/10 text-warning',
        variant === 'error' && 'bg-destructive/10 text-destructive',
        variant === 'primary' && 'bg-primary/15 text-primary',
      )}
    >
      {children}
    </span>
  );
}

export function AdminLoading({ label = 'Loading...' }: { label?: string }) {
  return (
    <div className="flex h-64 items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm">{label}</p>
      </div>
    </div>
  );
}

export function AdminEmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-secondary">
        <Icon className="h-7 w-7 text-muted-foreground" />
      </div>
      <div>
        <p className="font-display text-base font-bold">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}
