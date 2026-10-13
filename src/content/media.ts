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
 * Recomendado: vertical 5:7, 900×1260, 10–20 s, MP4 H.264, hasta 6 MB.
 * TODO: hoy apunta al mismo archivo que el hero, a la espera del clip del estudio.
 */
export const spaceVideoUrl: `/video/${string}` | null = "/video/studio.mp4";
