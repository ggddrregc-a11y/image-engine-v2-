'use client';

import Image from 'next/image';
import { cn } from '@/lib/utils';

// The official brand uses just the icon mark in compact contexts
// and the full SVG (icon + wordmark) where space allows.
const LOGO_ICON = '/logo.svg';

type BrandLogoProps = {
  collapsed?: boolean;
  className?: string;
  /** h-px of the icon mark itself */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  forceLight?: boolean;
};

const ICON_HEIGHT: Record<NonNullable<BrandLogoProps['size']>, number> = {
  sm: 28,
  md: 36,
  lg: 48,
  xl: 64,
};

/**
 * Official image Engine brand logo.
 *
 * - Uses the SVG mark (public/logo.svg) at all sizes.
 * - When `collapsed` is true (sidebar), renders only the icon portion by
 *   cropping to the left ~80px with overflow:hidden so the wordmark is hidden.
 * - The SVG viewBox is 280×100, so aspect ratio ≈ 2.8:1.
 */
export function BrandLogo({
  collapsed = false,
  className,
  size = 'md',
  forceLight = false,
}: BrandLogoProps) {
  const h = ICON_HEIGHT[size];
  const iconW = Math.round(h * 0.88); // icon-only crop (~80 / 100 * h)
  const fullW = Math.round(h * 2.8);  // full SVG width

  return (
    <div className={cn('flex shrink-0 items-center', className)}>
      {collapsed ? (
        /* Icon-only: crop to just the mark portion */
        <div
          style={{ width: iconW, height: h, overflow: 'hidden' }}
          className="relative shrink-0"
        >
          <Image
            src={LOGO_ICON}
            alt="image Engine"
            width={fullW}
            height={h}
            className={cn(
              'h-full w-auto object-left object-contain',
              forceLight && 'brightness-110',
            )}
            priority
          />
        </div>
      ) : (
        /* Full logo with wordmark */
        <Image
          src={LOGO_ICON}
          alt="image Engine"
          width={fullW}
          height={h}
          className={cn(
            'h-auto object-contain',
            forceLight && 'brightness-110',
          )}
          style={{ maxWidth: fullW }}
          priority
        />
      )}
    </div>
  );
}

/** Backwards-compatible alias */
export const Logo = BrandLogo;
