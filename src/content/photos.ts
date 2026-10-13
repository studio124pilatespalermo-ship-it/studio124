import type { ImageMetadata } from "astro";
import arches from "../assets/photos/arches.jpg";
import hero from "../assets/photos/hero.jpg";
import reception from "../assets/photos/space-1.jpg";
import reformerDetail from "../assets/photos/reformer-detail.jpg";
import strapPull from "../assets/photos/strap-pull.jpg";
import straps from "../assets/photos/straps.jpg";
import training from "../assets/photos/training.jpg";
import type { Dictionary } from "../i18n";

/**
 * Para cambiar una foto, editá scripts/import-photos.mjs (archivo de origen y recorte) y
 * volvé a correrlo; Astro recorta y comprime al compilar. Si la foto nueva muestra otra
 * cosa, actualizá su texto alternativo en `photos` de cada archivo de src/i18n/.
 */
export type PhotoId = keyof Dictionary["photos"];

export const photos: Readonly<Record<PhotoId, ImageMetadata>> = {
  hero,
  space1: arches,
  space2: reception,
  space3: reformerDetail,
  about: training,
  method: straps,
};

/** Las tres fotos de "Nuestro espacio", en el orden en que se ven. */
export const spacePhotos: readonly PhotoId[] = ["space1", "space2", "space3"];


/** Fondo del pie: decorativo (alt vacío), los datos del estudio van escritos encima. */
export const footerBackground: ImageMetadata = strapPull;
