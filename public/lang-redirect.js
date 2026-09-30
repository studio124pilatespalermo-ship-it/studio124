// Respaldo de la redirección por idioma (en Vercel la hace el servidor, ver vercel.json).
// Archivo externo en lugar de script inline para mantener una CSP estricta (script-src 'self').
(function () {
  var supported = ["en", "pt", "es"];
  var preferred = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || ""];
  for (var i = 0; i < preferred.length; i++) {
    var code = String(preferred[i]).slice(0, 2).toLowerCase();
    if (supported.indexOf(code) !== -1) {
      location.replace("/" + code + "/");
      return;
    }
  }
  location.replace("/en/");
})();
