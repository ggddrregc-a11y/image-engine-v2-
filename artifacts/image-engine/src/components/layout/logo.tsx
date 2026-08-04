import { cn } from '@/lib/utils';

const LOGO_ICON = '/logo.jpg';

type BrandLogoProps = {
  collapsed?: boolean;
  className?: string;
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
 * Uses the SVG mark (public/logo.svg) at all sizes.
 */
export function BrandLogo({
  collapsed = false,
  className,
  size = 'md',
  forceLight = false,
}: BrandLogoProps) {
  const h = ICON_HEIGHT[size];
  const iconW = Math.round(h * 0.88);
  const fullW = Math.round(h * 2.8);

  return (
    <div className={cn('flex shrink-0 items-center', className)}>
      {collapsed ? (
        <div
          style={{ width: iconW, height: h, overflow: 'hidden' }}
          className="relative shrink-0"
        >
          <img
            src={LOGO_ICON}
            alt="image Engine"
            width={fullW}
            height={h}
            className={cn(
              'h-full w-auto object-left object-contain',
              forceLight && 'brightness-110',
            )}
          />
        </div>
      ) : (
        <img
          src={LOGO_ICON}
          alt="image Engine"
          width={fullW}
          height={h}
          className={cn(
            'h-auto object-contain',
            forceLight && 'brightness-110',
          )}
          style={{ maxWidth: fullW }}
        />
      )}
    </div>
  );
}

export const Logo = BrandLogo;
