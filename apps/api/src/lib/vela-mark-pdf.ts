import type PDFKit from "pdfkit";

// Vela Logo Identity System v1.0 §02/§07 — same construction proportions as
// apps/web/components/brand/VelaLogo.tsx, ported to PDFKit's vector drawing
// primitives (PDFKit can't render the React/SVG source directly). The rule
// "never redraw this freehand" means never eyeball these numbers — they're
// copied from the same documented percentages the web mark uses.
const BAR1 = { xPct: 0.156, yPct: 0.27, widthPct: 0.6875, heightPct: 0.125 };
const BAR2 = { xPct: 0.156, yPct: 0.45, widthPct: 0.469, heightPct: 0.125 };
const BASELINE = { xPct: 0.156, yPct: 0.68, widthPct: 0.6875, heightPct: 0.047 };
const CONTAINER_RADIUS_PCT = 0.14;

type MarkVariant = "primary-dark" | "mono-dark";

const MARK_COLORS: Record<MarkVariant, { container: string; bars: string; filled: boolean }> = {
  "primary-dark": { container: "#0D1B2A", bars: "#C9A84C", filled: true },
  // Single-ink outline — used wherever the mark sits on a plain white/cream
  // page (invoice/payslip footers), matching the web app's own light-surface
  // treatment (apps/web/app/(auth)/layout.tsx).
  "mono-dark": { container: "#0D1B2A", bars: "#0D1B2A", filled: false },
};

// Draws the mark's rounded-square container + three bars at (x, y) with the
// given edge length `size`. Leaves the document's fill/stroke color mutated
// (PDFKit is stateful) — callers set their own color before drawing again.
export function drawVelaMark(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  size: number,
  variant: MarkVariant = "primary-dark",
): void {
  const colors = MARK_COLORS[variant];
  const radius = size * CONTAINER_RADIUS_PCT;

  if (colors.filled) {
    doc.roundedRect(x, y, size, size, radius).fill(colors.container);
  } else {
    doc
      .roundedRect(x + 1, y + 1, size - 2, size - 2, radius)
      .lineWidth(1)
      .stroke(colors.container);
  }

  doc
    .fillColor(colors.bars)
    .rect(x + BAR1.xPct * size, y + BAR1.yPct * size, BAR1.widthPct * size, BAR1.heightPct * size)
    .fill(colors.bars);
  doc
    .rect(x + BAR2.xPct * size, y + BAR2.yPct * size, BAR2.widthPct * size, BAR2.heightPct * size)
    .fill(colors.bars);
  doc
    .fillOpacity(0.4)
    .rect(
      x + BASELINE.xPct * size,
      y + BASELINE.yPct * size,
      BASELINE.widthPct * size,
      BASELINE.heightPct * size,
    )
    .fill(colors.bars);
  doc.fillOpacity(1);
}
