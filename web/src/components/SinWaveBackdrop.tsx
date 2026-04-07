"use client";

/**
 * Tiled /img/sin.svg with CSS background-position drift (1600px = one horizontal period).
 * Two layers + opposite directions add depth; SVG SMIL still animates the wave paths.
 */
export type SinWaveBackdropVariant = "search" | "company";

export function SinWaveBackdrop({
  className = "",
  variant = "search",
}: {
  className?: string;
  variant?: SinWaveBackdropVariant;
}) {
  return (
    <div
      className={`sin-wave-backdrop pointer-events-none absolute inset-0 z-0 overflow-hidden ${className}`}
      data-variant={variant}
      aria-hidden
    >
      <div className="sin-wave-tiles sin-wave-tiles--a absolute inset-0" />
      <div className="sin-wave-tiles sin-wave-tiles--b absolute inset-0" />
    </div>
  );
}
