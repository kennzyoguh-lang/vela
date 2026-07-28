// Single source of truth for VELA design tokens — Engineering Handbook Part 2.2,
// corrected/extended by Product Design System Part 2.3/2.12. Never hand-duplicate
// these values in apps/web or apps/api; import from this package only.
import colorsJson from "./colors.json";
import semanticJson from "./semantic.json";
import typographyJson from "./typography.json";
import fontsJson from "./fonts.json";
import spacingJson from "./spacing.json";
import radiusJson from "./radius.json";
import elevationJson from "./elevation.json";
import motionJson from "./motion.json";

export const colors = colorsJson;
export const semantic = semanticJson as Record<string, { light: string; dark: string }>;
export const typography = typographyJson;
export const fonts = fontsJson;
export const spacing = spacingJson;
export const radius = radiusJson;
export const elevation = elevationJson;
export const motion = motionJson;

export type ThemeMode = "light" | "dark";

/**
 * Resolves a semantic token reference (e.g. "color.midnight", "neutral.500", or a
 * literal hex) down to a concrete value. Semantic aliases are the only thing
 * components should consume (Handbook 2.2) — this is the one place that
 * understands the raw token graph.
 */
type ColorEntry = { value: string; role: string; usage: string };
const namedColors = colors as unknown as Record<string, ColorEntry | typeof colors.neutral>;

export function resolveTokenRef(ref: string): string {
  if (ref.startsWith("#")) return ref;
  const [group, key] = ref.split(".");
  if (!key) return ref;
  if (group === "color") {
    const entry = namedColors[key];
    if (!entry || !("value" in entry)) throw new Error(`Unknown color token: ${ref}`);
    return entry.value;
  }
  if (group === "neutral") {
    const step = colors.neutral[key as keyof typeof colors.neutral];
    if (!step) throw new Error(`Unknown neutral step: ${ref}`);
    return step;
  }
  return ref;
}

export function resolveSemantic(name: string, mode: ThemeMode): string {
  const entry = semantic[name];
  if (!entry) throw new Error(`Unknown semantic token: ${name}`);
  return resolveTokenRef(entry[mode]);
}
