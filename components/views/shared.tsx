'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export function PageHeader({
  title,
  description,
  icon: Icon,
  actions,
}: {
  title: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-card/60">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        )}
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight md:text-3xl">
            {title}
          </h1>
          {description && (
            <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function PageContainer({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={cn('mx-auto w-full max-w-[1600px] px-4 py-6 md:px-8 md:py-8', className)}
    >
      {children}
    </motion.div>
  );
}

export function Card({
  children,
  className,
  hover = false,
}: {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-border bg-card/50 backdrop-blur-sm',
        hover &&
          'transition-all duration-300 hover:border-primary/30 hover:bg-card/80 hover:glow-soft',
        className,
      )}
    >
      {children}
    </div>
  );
}
