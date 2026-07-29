import { cn } from "@/lib/utils";

// Vela Logo Identity System v1.0 (Vela_Logo_Identity_System.pdf) — "The
// Double Horizon". Construction rules (§02): rounded-square container,
// corner radius 14% of mark size; Bar 1 (top) height 12.5%, width 68.75%,
// left-inset 15.6%; Bar 2 (bottom) same height and left-inset, width 46.9%
// (70% of Bar 1); Base Line height 4.7%, same width/inset as Bar 1, 40%
// opacity. Never redraw this freehand elsewhere — import from here (§07,
// "use fresh mark files, never recreate the mark from memory").
const BAR1 = { x: 15.6, y: 27, width: 68.75, height: 12.5 };
const BAR2 = { x: 15.6, y: 45, width: 46.9, height: 12.5 };
const BASELINE = { x: 15.6, y: 68, width: 68.75, height: 4.7 };
const CONTAINER_RADIUS = 14;

type MarkVariant = "primary-dark" | "primary-light" | "mono-dark" | "mono-light";

const MARK_COLORS: Record<MarkVariant, { container: string; bars: string; filled: boolean }> = {
  // Default — on Midnight/dark surfaces (§02).
  "primary-dark": { container: "#0D1B2A", bars: "#C9A84C", filled: true },
  // On gold accent backgrounds and brand-highlight moments (§02).
  "primary-light": { container: "#C9A84C", bars: "#0D1B2A", filled: true },
  // Single-colour print/embossing/engraving — outline container, solid ink bars (§02).
  "mono-dark": { container: "#0D1B2A", bars: "#0D1B2A", filled: false },
  "mono-light": { container: "#FFFFFF", bars: "#FFFFFF", filled: false },
};

export function VelaMark({
  variant = "primary-dark",
  className,
}: {
  variant?: MarkVariant;
  className?: string;
}) {
  const colors = MARK_COLORS[variant];
  return (
    <svg viewBox="0 0 100 100" className={cn("size-6", className)} aria-hidden focusable="false">
      {colors.filled ? (
        <rect width="100" height="100" rx={CONTAINER_RADIUS} fill={colors.container} />
      ) : (
        <rect
          x="2"
          y="2"
          width="96"
          height="96"
          rx={CONTAINER_RADIUS}
          fill="none"
          stroke={colors.container}
          strokeWidth="4"
        />
      )}
      <rect {...BAR1} fill={colors.bars} />
      <rect {...BAR2} fill={colors.bars} />
      <rect {...BASELINE} fill={colors.bars} opacity="0.4" />
    </svg>
  );
}

export function VelaLogo({
  variant = "primary-dark",
  showTagline = false,
  className,
}: {
  variant?: MarkVariant;
  showTagline?: boolean;
  className?: string;
}) {
  const onDark = variant === "primary-dark" || variant === "mono-light";
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <VelaMark variant={variant} className="size-8 shrink-0" />
      <div className="flex flex-col leading-none">
        <span
          className={cn(
            "font-ui text-[1.25rem] font-bold tracking-[0.18em]",
            onDark ? "text-white" : "text-text-primary",
          )}
        >
          VELA
        </span>
        {showTagline ? (
          <span
            className={cn(
              "font-data mt-0.5 text-[0.6rem] font-bold tracking-[0.1em]",
              onDark ? "text-gold" : "text-gold-dark",
            )}
          >
            BUSINESS OS&trade;
          </span>
        ) : null}
      </div>
    </div>
  );
}
