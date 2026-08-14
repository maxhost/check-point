/**
 * Shared visual of a Sellos card: a background (solid, or a linear gradient at a
 * configurable angle when a second color is present) and `target` stamp slots with a
 * white fill and a colored border; the first `filled` slots show the stamp image.
 * Pure-props so it can be reused in the wizard preview and, later, the consumer wallet.
 */
export type CardDesignColors = {
  backgroundColor: string;
  backgroundColor2: string | null;
  gradientAngle: number | null;
  borderColor: string;
};

/** CSS `background` value for the card: linear gradient when a 2nd color exists, else solid. */
export function cardBackground(design: CardDesignColors): string {
  if (design.backgroundColor2) {
    return `linear-gradient(${design.gradientAngle ?? 180}deg, ${design.backgroundColor}, ${design.backgroundColor2})`;
  }
  return design.backgroundColor;
}

/** How many slots the preview shows filled: half the objective, rounded (2→1, 5→3, 10→5). */
export function filledCount(target: number): number {
  if (!Number.isFinite(target) || target <= 0) return 0;
  return Math.min(target, Math.round(target / 2));
}

export function CardPreview({
  design,
  target,
  stampImagePath,
  filled,
}: {
  design: CardDesignColors;
  target: number;
  stampImagePath: string | null;
  filled?: number;
}) {
  const slots = Math.max(0, Math.min(50, Math.floor(target) || 0));
  const filledSlots = filled ?? filledCount(slots);
  return (
    <div
      className="card-preview"
      style={{ background: cardBackground(design) }}
    >
      <div className="card-preview-grid">
        {Array.from({ length: slots }).map((_, index) => (
          <div
            key={index}
            className={`card-slot ${index < filledSlots ? "filled" : ""}`}
            style={{ borderColor: design.borderColor }}
          >
            {index < filledSlots && stampImagePath ? (
              <img src={stampImagePath} alt="" />
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
