import { LOGO_FIGURE_PATH, LOGO_TYPE_PATH, LOGO_VIEWBOX } from "../../components/brand/logo-paths";

/**
 * El logo de Studio124 para el panel y el portal, con los mismos trazos que la landing
 * (src/components/brand/Logo.astro) en su versión para fondo claro, sobre el círculo
 * traslúcido que pide el manual de marca.
 */
export function BrandMark({ size = "md", label = "Studio124" }: { size?: "sm" | "md" | "lg"; label?: string }) {
  const sizes = { sm: "size-11", md: "size-14", lg: "size-24" } as const;
  return (
    <span className={`grid shrink-0 place-items-center rounded-full bg-sand/70 ${sizes[size]}`}>
      <svg viewBox={LOGO_VIEWBOX} role="img" aria-label={label} className="h-[72%] w-auto">
        <path d={LOGO_FIGURE_PATH} fill="#c2c1b9" />
        <path d={LOGO_TYPE_PATH} fill="var(--color-ink)" />
      </svg>
    </span>
  );
}
