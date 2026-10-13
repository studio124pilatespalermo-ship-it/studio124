# Tipografía de Studio124

La marca usa **Cocomat Pro** (Zetafonts) para todo el texto. Es una fuente comercial:
para publicarla en el sitio hace falta su **licencia web**, que entrega los archivos
`.woff2`.

## Mientras no esté la licencia

El sitio usa **Quicksand** (Google Fonts, libre), la geométrica redondeada más parecida
que se puede publicar sin licencia. Es un reemplazo, no la fuente de la marca.

## Cómo poner la Cocomat Pro definitiva

1. Copiá los `.woff2` de la licencia web a esta carpeta, por ejemplo:
   `cocomat-pro-400.woff2`, `cocomat-pro-500.woff2`, `cocomat-pro-700.woff2`.
2. En `src/styles/global.css`, descomentá el bloque `@font-face` de Cocomat Pro y
   poné `--font-sans` apuntando a `"Cocomat Pro"`.
3. `npm run build` y listo: no hay que tocar ningún componente.

## Fuente caligráfica

Para "Movimiento consciente" y "The Experience" se usa **Pinyon Script** (Google Fonts).
El manual de marca no indica cuál es, así que conviene confirmarlo con el estudio.
