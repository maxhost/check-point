# Wallet — mocks HTML/CSS

Prototipo local de **Club cotidiano, paleta A**, elegido por el owner. Cuatro estados: acceso, inscripción sin sesión, inscripción con sesión y confirmación/instalación. Las pantallas de producción no se modificaron.

## Abrir

Servidor de esta sesión: <http://127.0.0.1:58407/>. Los enlaces con `#access`, `#guest`, `#signed` y `#ready` abren la vista individual.

Para levantarlo de nuevo, desde la raíz del repo:

```sh
source ~/.nvm/nvm.sh
nvm use
python3 -m http.server 58407 --bind 127.0.0.1 --directory docs/qa/0207/mocks
```

Archivos editables: [index.html](mocks/index.html), [styles.css](mocks/styles.css) y [mock.js](mocks/mock.js).

## Revisar y ajustar

- **Comparar** muestra las cuatro pantallas. **Pantalla** o un botón de sección abre una sola.
- **Ajustar textos y espacios** permite cambiar comercio, nombre, dispositivo, ancho390/360/430, titular, margen lateral y separación vertical.
- **Editar textos al hacer clic** habilita las copias marcadas como editables; comercio y nombre se cambian desde sus campos y se propagan a los titulares.
- **Restablecer** recupera los valores originales. Los ajustes no se guardan al recargar; este prototipo sirve para revisar y comunicar cambios al implementador.
- Apple/Google y Unirme recorren estados simulados. Instalación y Ver mi pase explican el destino sin ejecutar OAuth, inscripción, instalación ni abrir datos reales.

## Evidencia — 2026-10-12

Chromium: cuatro estados a320/360/390/430px y captura comparativa1440px. Sin overflow horizontal, errores JS ni solicitudes aAPI. Probados nombre/comercio, sliders, edición, reset, inscripción, proveedores, plataformaAndroid, instalación simulada y acceso al pase. Comprobación final salida0, [checks.json](captures/checks.json).

Capturas finales con Nunito Sans local: [comparación desktop](captures/desktop.png), [acceso](captures/screen-access.png), [inscripción sin sesión](captures/screen-guest.png), [inscripción con sesión](captures/screen-signed.png), [confirmación](captures/screen-ready.png). También se conservaron las cuatro páginas completas a390px para inspeccionar el marco de revisión.

Contrastes calculados: verde/blanco12.78:1; secundario/blanco5.99:1; secundario/superficie5.60:1; checkverde/coral4.40:1; verde/superficie de avatar10.48:1. Coral es acento y fondo de icono, no texto pequeño.

Revisor independiente Impeccable: primer dictamen `fix` para fuente de titulares; se añadió Nunito Sans variable autohospedada y se recapturaron las nueve vistas. Verdict pass `ship`: hallazgo tipográfico resuelto, saltos de línea y acciones preservados. Este dictamen cubre la corrección puntuada, no una nueva auditoría de producción.

Hook: hallazgo dark-glow en sombra de aviso corregido a sombra neutra con desplazamiento; siguiente scan sin hallazgos deterministas. Stop posterior señaló icon-tile-stack: se conserva el sello coral de confirmación del concepto2 elegido por el owner. Excepción de esa regla limitada a `docs/qa/0207/mocks/index.html`, registrada mediante `hooks ignore-value`; no se ignora el archivo completo. SintaxisJS y `git diff --check` salida0. No verify global ni suites de app para este mock documental.

## Fuentes y alcance

Nunito Sans: [Google Fonts oficial](https://github.com/google/fonts/tree/main/ofl/nunitosans), [licencia OFL](mocks/fonts/OFL.txt), font variable local. SímboloC derivado de `apps/consumer/public/checkpass-icon.svg`, con el color elegido para el prototipo. El comercio y el nombre son ejemplos; no se inventan recompensas ni consentimiento legal nuevo. No hay imágenes raster para publicar.

El sistema elegido se documenta en `apps/consumer/DESIGN.md` y `.impeccable/design.json` con alcance de prototipo. Integrar estas pantallas con las rutas reales requerirá un encargo posterior. Sin push, merge ni deploy.
