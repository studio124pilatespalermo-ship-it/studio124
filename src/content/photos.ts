import type { ImageMetadata } from "astro";
import classroom from "../assets/photos/classroom.jpg";
import closing from "../assets/photos/closing.jpg";
import detail from "../assets/photos/detail.jpg";
import hero from "../assets/photos/hero.jpg";
import pillarPalermo from "../assets/photos/pillar-palermo.jpg";
import pillarVisitors from "../assets/photos/pillar-visitors.jpg";
import space1 from "../assets/photos/space-1.jpg";
import space2 from "../assets/photos/space-2.jpg";
import space3 from "../assets/photos/space-3.jpg";
import type { Dictionary } from "../i18n";

/**
 * Para cambiar una foto, reemplazá el archivo en src/assets/photos/ con el mismo nombre
 * (o editá scripts/import-photos.mjs y volvé a correrlo). Astro la recorta y comprime al
 * compilar. Si la foto nueva muestra otra cosa, actualizá su texto alternativo en
 * `photos` de cada archivo de src/i18n/.
 */
export type PhotoId = keyof Dictionary["photos"];

export const photos: Readonly<Record<PhotoId, ImageMetadata>> = {
  hero,
  classroom,
  detail,
  space1,
  space2,
  space3,
  pillarPalermo,
  pillarVisitors,
};

export const galleryPhotos: readonly PhotoId[] = ["space1", "space2", "space3"];

export interface PillarPhoto {
  readonly id: PhotoId;
  /** Encuadre (object-position) que deja visible lo importante dentro del arco. */
  readonly position: string;
  /**
   * Ancho que ocupa la foto recortada. Una foto horizontal recortada a cuadrado necesita
   * más píxeles de ancho que el marco, si no el navegador elige una versión borrosa.
   */
  readonly sizes: string;
}

/** Una foto por pilar, en el mismo orden que `pillars.items` de i18n. */
export const pillarPhotos: readonly PillarPhoto[] = [
  { id: "pillarPalermo", position: "object-[50%_78%]", sizes: "(min-width: 768px) 30vw, 100vw" },
  { id: "hero", position: "object-[50%_45%]", sizes: "(min-width: 768px) 30vw, 100vw" },
  { id: "pillarVisitors", position: "object-[62%_50%]", sizes: "(min-width: 768px) 56vw, 160vw" },
];

/** Fondo del cierre: es decorativo (alt vacío), por eso no tiene texto alternativo en i18n. */
export const closingBackground: ImageMetadata = closing;
