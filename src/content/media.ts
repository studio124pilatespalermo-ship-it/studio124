/**
 * Videos del sitio. Los archivos van en public/video/ y los sirve Vercel junto con el
 * sitio. Para cambiar uno, reemplazá el archivo con el mismo nombre.
 */

/**
 * Video de fondo del hero (loop sin sonido, tipo GIF). `null` = sin video: el hero
 * muestra sólo la foto.
 *
 * Recomendado: vertical 9:16, 720×1280, 6–10 s, sin audio, MP4 H.264, 1,5–3 MB.
 */
export const heroVideoUrl: `/video/${string}` | null = "/video/studio.mp4";

/**
 * Video del medio de "Nuestro espacio", con los controles del navegador (se reproduce
 * cuando el visitante quiere). `null` = sin video: ese lugar muestra la foto del medio.
 *
 * Es el recorrido de la sala (el sillón, los arcos, los espejos y los reformers), recortado
 * desde el segundo 3 para sacar la pared del principio. Vertical 720×1280, 13,5 s, 1,6 MB.
 * Para cambiarlo: MP4 H.264 vertical (5:7 o 9:16), hasta ~6 MB, y su cuadro inicial como póster.
 */
export const spaceVideoUrl: `/video/${string}` | null = "/video/espacio.mp4";

/** Cuadro que se ve antes de darle play: el primer cuadro del video. */
export const spaceVideoPoster = "/video/espacio-poster.jpg";
