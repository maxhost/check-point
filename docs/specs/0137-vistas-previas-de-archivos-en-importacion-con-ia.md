---
spec: 0137
fecha: 2026-10-02
estado: cerrada
resumen: Mostrar cada archivo elegido para importar el catálogo como una tarjeta con vista previa y control para quitarlo antes de analizar.
disjunta: si
archivos: apps/merchant/src/app/backoffice/catalog/catalog-ai-import-picker.tsx, apps/merchant/src/app/backoffice/catalog/catalog-ai-import.tsx, apps/merchant/src/app/backoffice/catalog/catalog-ai-import-api.ts, apps/merchant/src/app/backoffice/catalog/use-catalog-import.ts, apps/merchant/src/app/globals.css, tests/e2e/catalog-tour-import.spec.ts, tests/e2e/support/catalog-api-fixture.ts, docs/INDEX.md
---

# 0137 — Vistas previas de archivos en «Importar con IA»

## Problema

- `apps/merchant/src/app/backoffice/catalog/catalog-ai-import-picker.tsx:64-67` junta los nombres de todos los archivos en el título de la zona de carga. En un teléfono, tres fotos se presentan como una cadena de texto: no se distingue qué imagen corresponde a cada archivo ni hay un control para retirar una sola.
- `apps/merchant/src/app/backoffice/catalog/catalog-ai-import-picker.tsx:74-99` permite elegir archivos y tomar fotos; la selección múltiple del buscador reemplaza la anterior, mientras la cámara agrega la nueva foto. No hay un patrón visual común para revisar lo seleccionado.
- `apps/merchant/src/app/backoffice/catalog/use-catalog-import.ts:223-237` inicia el análisis de un PDF en cuanto se elige. El owner confirma conservar esa acción inmediata; el PDF requiere una representación visual durante el procesamiento, con la cancelación existente.

## Alcance

**Entra:** la presentación y edición local de los archivos elegidos en el modal «Importar con IA» de `/backoffice/catalog`, en teléfono y escritorio; fotos desde buscador, cámara y arrastrar y soltar; PDF único; pruebas e2e del flujo.

**No entra:** cambios de API, límites y formatos admitidos, procesamiento de IA, orden manual de archivos, edición o recorte de imágenes, previsualización del contenido del PDF, ni rediseño del modal durante el procesamiento.

## Diseño

1. Mantener visible la zona de carga como entrada para agregar archivos. Su título permanece «Sube tu menú o lista de precios»; no se reemplaza por nombres. Debajo, mostrar una cuadrícula adaptable con **una tarjeta cuadrada por foto seleccionada**, en el mismo orden de selección. Tres fotos producen tres tarjetas.
2. Cada imagen muestra una miniatura local con recorte visual `object-fit: cover`, sin modificar el archivo original que se enviará. La tarjeta incluye el nombre del archivo, truncado visualmente si es largo y disponible completo para tecnología asistiva. La miniatura tiene alternativa accesible con el nombre.
3. Cada tarjeta de foto tiene una **X** visible en la esquina superior, con botón táctil de al menos 44 × 44 px y nombre accesible «Quitar {nombre del archivo}». Activarlo retira únicamente ese archivo antes de analizar. La cuadrícula y el botón «Analizar catálogo» reflejan de inmediato la nueva selección; al quitar el último archivo, el botón queda deshabilitado y vuelve la ayuda para agregar archivos. La X no abre el buscador.
4. Los botones «Buscar archivos», «Tomar foto» y la zona de soltar conservan su función. Las nuevas fotos se **agregan** a las ya seleccionadas, tanto al volver a buscar como al tomar otra foto o soltar archivos. El diálogo cancelado no cambia la selección. Se limpia el valor de cada `input[type=file]` después de procesarlo para poder elegir otra vez el mismo archivo. Una nueva selección con un PDF sustituye las fotos y lanza el análisis automático; no se agregan PDF a fotos.
5. Se mantiene la regla de **un PDF o varias imágenes, nunca mezclados**. Una selección simultánea de PDF e imágenes, o de varios PDF, muestra el error ya existente sin enviar archivos. El PDF conserva el **análisis automático** aprobado por el owner: aparece como tarjeta cuadrada con icono, etiqueta «PDF» y nombre durante la transición al estado de procesamiento, y sigue visible en ese estado mientras se analiza. El nombre se conserva solo en memoria local durante ese import; al reabrir un import en curso, el DTO actual no trae nombres y la tarjeta dice «PDF» sin inventar uno. La UI admite un campo opcional `sourceFileName` en el DTO; si Claude lo agrega al API, se muestra ese nombre al retomar. No tiene X para quitar antes del envío, porque el envío empieza al seleccionarlo; durante el procesamiento se usa «Cancelar importación» según el flujo existente. No se añade una espera artificial.
6. Las miniaturas usan URL local de objeto; se revocan al retirar la imagen, sustituir la selección, cerrar/desmontar el modal o iniciar el procesamiento. Una miniatura que no se pueda decodificar usa un marcador de imagen y conserva la opción de quitar; el servidor sigue siendo la autoridad para validar el archivo.
7. Mientras `busy` sea verdadero se deshabilitan selección, eliminación y análisis. En el estado de procesamiento, la tarjeta PDF es informativa, no editable. No se altera el contrato HTTP ni se sube nada por seleccionar o quitar fotos.

## Archivos

| Archivo | Acción |
|---|---|
| `apps/merchant/src/app/backoffice/catalog/catalog-ai-import-picker.tsx` | editar presentación, miniaturas y controles |
| `apps/merchant/src/app/backoffice/catalog/catalog-ai-import.tsx` | mostrar tarjeta PDF informativa durante el procesamiento |
| `apps/merchant/src/app/backoffice/catalog/catalog-ai-import-api.ts` | admitir nombre opcional del PDF en el DTO del cliente |
| `apps/merchant/src/app/backoffice/catalog/use-catalog-import.ts` | acumular fotos y conservar análisis automático de PDF |
| `apps/merchant/src/app/globals.css` | agregar cuadrícula y tarjetas adaptables |
| `tests/e2e/catalog-tour-import.spec.ts` | cubrir selección, vista previa, eliminación y regresión PDF |
| `tests/e2e/support/catalog-api-fixture.ts` | registrar formato y bytes originales recibidos por el upload del fixture |

**Disjunta:** sí respecto de la spec 0130, que toca la PWA de consumidor. `docs/INDEX.md` es compartido por el proceso de reserva; se preservan filas ajenas al integrar.

## Definition of Done

- [x] En viewport de 390 px, elegir tres imágenes muestra tres tarjetas con sus miniaturas y tres botones «Quitar …»; eliminar la segunda deja la primera y la tercera, y el POST de análisis contiene exactamente esas dos, en orden.
- [x] Tomar una foto, volver a buscar archivos y soltar otra foto agrega cada una en orden; cancelar el selector no cambia las tarjetas.
- [x] Elegir un PDF inicia el análisis automáticamente, muestra una tarjeta informativa «PDF» durante el procesamiento y nunca lo mezcla con imágenes; «Cancelar importación» conserva su comportamiento.
- [x] Tras quitar la última foto, «Analizar catálogo» queda deshabilitado y no sale ningún POST; seleccionar de nuevo el mismo archivo funciona.
- [x] Los botones de quitar son operables con teclado y lector de pantalla; el tamaño táctil es al menos 44 × 44 px. Las tarjetas no provocan desbordamiento horizontal a 390 px.
- [x] Las URL locales de miniaturas se revocan al retirar archivos y al salir del selector. El archivo enviado conserva bytes, nombre y tipo originales.
- [x] `pnpm exec playwright test tests/e2e/catalog-tour-import.spec.ts --config=/tmp/spec0137-playwright.config.ts --reporter=dot` pasa con Node 24 y el harness móvil: 7 passed, incluido el campo opcional `sourceFileName`. Se usó config temporal sin `webServer` porque el puerto 3000 estaba ocupado por otro checkout.
- [ ] `pnpm verify` pasa con Node 24. En la segunda corrida, ya con `:3000` libre, el e2e global pasó (110 tests, 5 omitidos); el único gate rojo fue build Turbopack del consumer (`binding to a port: Operation not permitted`). El build del merchant con `pnpm exec next build --webpack` sí pasó. No publicar hasta que el gate pase, por decisión del owner.
- [x] `rg -n MUTATION apps/merchant/src/app/backoffice/catalog apps/merchant/src/app/globals.css tests/e2e/catalog-tour-import.spec.ts` → vacío tras revertir ambas mutaciones.

## Mutaciones — presupuesto: 2

| # | Mutación | Oráculo que tiene que ponerse ROJO |
|---|---|---|
| 1 | Quitar una tarjeta deja su archivo en la selección usada por «Analizar catálogo». | E2E de tres fotos: el POST contiene la foto retirada y falla la aserción de nombres y orden. |
| 2 | La X de una tarjeta dispara también la apertura del buscador. | E2E de eliminación: se dispara el selector o no se mantiene la selección esperada. |

**Protocolo:** `shasum` limpio antes de mutar → fila de bitácora antes de medir → etiqueta `MUTATION` → medir y transcribir la salida ejecutada → revertir con `diff` contra copia limpia. Una mutación por vez; el rojo debe venir de la aserción buscada. Tras dos vueltas consecutivas donde un arreglo abre otro fallo, detener y consultar al owner.

**Evidencia local:** M1 dio `Expected: 2, Received: 3` al contar tarjetas tras quitar la segunda foto; M2 dio `Expected: 0, Received: 1` al contar aperturas del selector desde la X. Ambas se revirtieron con `diff` vacío contra copias limpias; bitácora y salidas en `/tmp/spec0137-mutations.md` y `/tmp/spec0137-m{1,2}.log`.

**Tabla final de `pnpm verify` (Node 24):**

| Gate | Resultado | Segundos |
|---|---|---:|
| typecheck | ok | 10.4 |
| lint | ok | 6.8 |
| format:check | ok | 7.0 |
| test | ok | 37.8 |
| build | ROJO, Turbopack consumer / puerto interno | 2.8 |
| test:e2e | ROJO, puerto 3000 ocupado | 1.3 |
| neon related merchant | ok, 3 tests | 4.4 |
| neon related consumer | salteado, sin cambios | — |

La suite e2e propia pasó 7/7 con un config temporal sin `webServer`; su última corrida y el typecheck/lint dirigidos fueron posteriores al adaptador opcional `sourceFileName`. El build Webpack del merchant pasó. Se vio la captura de las tres tarjetas a 390 px en Chromium; falta QA de cámara real en teléfono y PASS independiente.

**Segunda corrida de `pnpm verify` tras liberar `:3000`:** typecheck 3.6 s, lint 7.0 s, formato 7.8 s, test 40.7 s, e2e 37.0 s (110 passed, 5 skipped) y Neon related merchant 4.0 s, todos verdes. Build rojo en 2.7 s por el mismo `EPERM` interno de Turbopack consumer. `origin/main` tenía CI verde (`7e99d5f`) antes de esta corrida. El owner pidió esperar el gate verde antes del push.

## Declarado afuera

- QA de cámara real en iOS y Android, necesaria para confirmar las opciones del selector nativo; se documenta por separado si no hay dispositivos disponibles.
- Vista de páginas dentro del PDF.

## Handoff

Un implementador para toda la spec y un revisor independiente al final. El revisor deja `PASS` con evidencia ejecutada antes de marcarla `implementada`.

## Abierto

Nada. El owner confirmó el análisis automático del PDF y la acumulación de fotos el 2026-10-02.
