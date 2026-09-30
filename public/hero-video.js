// Control del video de fondo del hero. El video arranca solo (autoplay); este script
// sólo agrega lo que exige WCAG 2.2.2: poder pausarlo, y no moverlo si el usuario pidió
// reducir movimiento. Archivo externo para mantener una CSP estricta (script-src 'self').
(function () {
  var video = document.querySelector("[data-hero-video]");
  var toggle = document.querySelector("[data-hero-video-toggle]");
  if (!video) return;

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    // Se quita el video: queda visible la foto que está debajo.
    video.pause();
    video.remove();
    return;
  }

  if (!toggle) return;

  function setState(playing) {
    toggle.setAttribute("data-state", playing ? "playing" : "paused");
    toggle.setAttribute("aria-label", toggle.getAttribute(playing ? "data-label-pause" : "data-label-play"));
  }

  toggle.hidden = false;
  setState(!video.paused);
  video.addEventListener("play", function () { setState(true); });
  video.addEventListener("pause", function () { setState(false); });
  toggle.addEventListener("click", function () {
    if (video.paused) video.play();
    else video.pause();
  });
})();
