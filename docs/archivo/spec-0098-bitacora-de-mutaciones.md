# Spec 0098 — plan y bitácora

Presupuesto: cuatro defectos plausibles de la tabla de la spec; máximo dos rondas. Implementación UI única; revisión independiente posterior. Baseline de navegador antes de medir. Cada experimento tendrá copia limpia en `/tmp/spec0098`, SHA, fila abierta antes de editar, etiqueta reservada en fuente, resultado leído y restauración comprobada con diff. Gates generales una vez al final. Fuera: auth/storage/cámara reales y QA de dispositivos.

| ID | Clase | Mecanismo / oráculo | SHA limpio | Resultado y restauración |
| --- | --- | --- | --- | --- |
| M1 | Monto omitido | Validación de términos y PUT | `deb7710e331f23de17ef8292596437398feb7f80` | exit1; avance indebido; restaurada |
| M2 | Skeleton esconde error | Orden de render inicial / recuperación GET503 | `f11fe30da988f4ebf390694a6fc1737c75eb3ae8` | exit1; recuperación ausente; restaurada |
| M3 | Borrador reseteado al volver | Navegación / valores ida-vuelta | `27650300d7cfc7086b73c8337437bb6752895ff0` | exit1; borrador perdido; restaurada |
| M4 | Escritura duplicada | Guarda síncrona / dos submit mismo tick | `f78a104f4ac70b3a794dc7529803642ee528d8ff` | exit1; dos PUT; restaurada |

## M1 — abierto antes de mutar

Archivo `apps/merchant/src/app/backoffice/loyalty/program-form-state.ts`, SHA-1 limpio `deb7710e331f23de17ef8292596437398feb7f80`, copia `/tmp/spec0098/M1-clean-program-form-state.ts`. Alcance medido: todas las suites `tests/e2e/loyalty*.spec.ts` con componentes reales y HTTP controlado. Baseline 37 passed / 1 skipped autenticado.

M1 ejecutada: exit 1, 1 failed / 36 passed / 1 skipped. Falló monto vacío/cero: ausencia del error; snapshot muestra Premios y Nombre del premio tras el avance indebido. No fallo de setup. Log `/tmp/spec0098/M1.log`. Restaurada con diff vacío contra copia y SHA idéntico.

## M2 — abierto antes de mutar

Archivo `apps/merchant/src/app/backoffice/loyalty/loyalty-page.tsx`, SHA-1 limpio `f11fe30da988f4ebf390694a6fc1737c75eb3ae8`, copia `/tmp/spec0098/M2-clean-loyalty-page.tsx`. Alcance medido: todas las suites `tests/e2e/loyalty*.spec.ts` con componentes reales y HTTP controlado. Baseline 37 passed / 1 skipped autenticado.

M2 ejecutada: exit 1, 2 failed / 35 passed / 1 skipped. GET503 y DTO inválido no montan Alert ni lectura de recuperación; snapshots quedan en Cargando programa. Log `/tmp/spec0098/M2.log`. Restaurada con diff vacío y SHA idéntico.

## M3 — abierto antes de mutar

Archivo `apps/merchant/src/app/backoffice/loyalty/program-editor.tsx`, SHA-1 limpio `27650300d7cfc7086b73c8337437bb6752895ff0`, copia `/tmp/spec0098/M3-clean-program-editor.tsx`. Alcance medido: todas las suites `tests/e2e/loyalty*.spec.ts` con componentes reales y HTTP controlado. Baseline 37 passed / 1 skipped autenticado.

M3 ejecutada: exit 1, 12 failed / 25 passed / 1 skipped. Oráculo ida/vuelta esperaba Café gratis y recibió cadena vacía; fallos hermanos de preservación tras errores de escritura esperaban el mismo nombre y recibieron vacío. Defecto de borrador, sin error de setup. Log `/tmp/spec0098/M3.log`. Restauración comprobada por diff vacío/SHA idéntico.

## M4 — abierto antes de mutar

Archivo `apps/merchant/src/app/backoffice/loyalty/use-loyalty-program.ts`, SHA-1 limpio `f78a104f4ac70b3a794dc7529803642ee528d8ff`, copia `/tmp/spec0098/M4-clean-use-loyalty-program.ts`. Alcance medido: todas las suites `tests/e2e/loyalty*.spec.ts` con componentes reales y HTTP controlado. Baseline 47 passed / 1 skipped autenticado (actualizado antes de M4).

M4 ejecutada: exit 1, 1 failed / 46 passed / 1 skipped. Dos eventos submit en el mismo tick bajo PUT demorado: esperaba un request, recibió DOS PUT; fallo por duplicación, sin depender del disabled posterior. Log `/tmp/spec0098/M4.log`. Restaurada por diff vacío/SHA idéntico. Las cuatro pruebas muerden por la propiedad prevista; una ronda de medición, sin ampliar presupuesto.
