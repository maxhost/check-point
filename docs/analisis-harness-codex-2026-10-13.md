> Investigación/plan previo. El owner adoptó el piloto en ADR0144; las reglas vigentes están en TRABAJO-EN-PARALELO, AGENT-WORKFLOW y VERIFICACION. Este documento conserva el razonamiento previo y no impone gates adicionales.

# Revisión del harness de CheckPoint: velocidad, riesgo y verificación

Fecha: 2026-10-13. Estado: **propuesta para discutir; no modifica reglas vigentes**.

Ampliación del pedido: [Orquestación de features en paralelo](diseno-orquestacion-paralela-2026-10-13.md). Desarrolla coordinador, agentes por feature, aislamiento, QA compartido, integración, recuperación y publicación; este análisis original se centra en el coste de verificación.

Se revisaron instrucciones, skills, hooks, selector de gates, configuraciones de pruebas y registros recientes. Tres agentes investigaron en paralelo, solo lectura; se contrastaron sus hallazgos con archivos, fuentes primarias y dos planes `--dry-run`. No se ejecutaron suites completas, migraciones, merge ni push durante esta investigación.

## Resultado principal

CheckPoint ya tiene niveles L0–L3 aprobados en ADR 0129. El problema principal es que esas reglas no están alineadas entre Claude, Codex, plantillas y automatización. Además, la selección de `verify` distingue principalmente rutas y no el riesgo del cambio, y distintas etapas vuelven a pagar los mismos controles.

La propuesta es conservar pruebas fuertes y reducir su alcance y frecuencia: controles por riesgo durante desarrollo, una validación del candidato de integración, y reutilización de resultados válidos sobre el mismo código. Esta matriz es nuestra propuesta de ingeniería, no una clasificación universal de OpenAI.

## Qué dicen las fuentes

**OpenAI, guía actual de modelos.** Recomienda calibrar la verificación según el cambio, evitar tests que solo reflejen cambios reversibles de bajo impacto y ampliar/repetir comprobaciones cuando haya cambios nuevos, fallos o dudas concretas. [Guía oficial: Testing and verification](https://developers.openai.com/api/docs/guides/latest-model?model=gpt-6.1-sol).

**OpenAI, revisión de skills y prompts, 11/09/2026.** Advierte que instrucciones acumuladas pueden provocar lecturas y tests innecesarios. Recomienda descripciones de skills precisas, carga progresiva y consultar documentación según la tarea. Es consejo contextual para los modelos actuales; no elimina los controles de negocio. [Artículo oficial](https://developers.openai.com/blog/rethinking-skills-and-prompts-for-gpt-6-astra).

**OpenAI, subagentes y worktrees.** Recomienda comenzar con delegación de investigación/lectura y tener más cuidado con escritura simultánea. Los subagentes añaden consumo y coordinación. Los worktrees permiten chats independientes con archivos separados. [Subagentes](https://learn.chatgpt.com/docs/agent-configuration/subagents), [worktrees](https://learn.chatgpt.com/docs/environments/git-worktrees).

**El propio repositorio de Codex.** La versión consultada de su AGENTS.md selecciona tests del crate cambiado; amplía a todos al modificar common/core/protocol y limita lint al proyecto. También distingue la revisión de interfaz de otras verificaciones. Es una política para Rust/TUI, no una norma para toda web. Fuente obtenida por la versión accesible en el navegador; la descarga directa de main devolvió 404, por lo que no se afirma conocer el HEAD remoto exacto. [AGENTS.md consultado](https://github.com/openai/codex/raw/refs/heads/main/AGENTS.md), sección de pruebas, líneas 61–65.

**Comunidad, Peter Steinberger, 14/10/2025.** Describe commits pequeños, estimar el alcance de cada cambio y tests para funcionalidades/arreglos, con menor utilidad para retoques puramente visuales. Prefiere en su flujo personal un servidor/carpeta compartidos a worktrees. Es experiencia individual de 2025, no consenso ni documentación actual de funciones de Codex. [Just Talk To It](https://steipete.me/posts/just-talk-to-it).

**AGENTS.md, formato comunitario.** Permite instrucciones específicas por paquete y archivos anidados. Los agentes intentan ejecutar los checks que se escriban: por eso un ejemplo de “todo antes de cada commit” no debe copiarse sin adaptarlo a CheckPoint. [Formato y ejemplos](https://agents.md/).

**La investigación sobre instrucciones no da una receta única.** Un estudio sobre 10 repos y 124 PRs encontró mejoras de tiempo; otro benchmark encontró costes mayores sin una mejora general de éxito. Sus muestras/métodos difieren; ninguno demuestra que quitar pruebas mejore CheckPoint. La conclusión práctica es medir nuestro flujo. [Estudio de enero 2026](https://arxiv.org/abs/2601.20404), [estudio de febrero, versión revisada septiembre 2026](https://arxiv.org/abs/2602.11988).

**OpenAI propone evaluar también eficiencia.** Los evals de skills deberían medir resultado y proceso, con pocas señales importantes; eso permite detectar una skill que se activa de más o un agente que ejecuta comandos innecesarios. [Evaluación de skills](https://developers.openai.com/blog/eval-skills).

## Diagnóstico comprobado en el repo

| Problema | Evidencia | Efecto |
|---|---|---|
| Niveles existentes, pero instrucciones diferentes | `CLAUDE.md:19–26`, `docs/adr/0129-niveles-l0-a-l3.md`; frente a `AGENTS.md:31–33` | Claude puede hacer L0 sin spec; Codex recibe spec obligatoria para toda tarea |
| Instrucciones viejas de rama/reserva | `AGENTS.md:13,25–33`, `docs/TRABAJO-EN-PARALELO.md:42`; ADR0128:20–40 | Se mezcla dev local sin push con main/pull/push de reserva |
| Plantilla chica fuerza verificación global y revisor | `docs/specs/TEMPLATE-CHICA.md:52–53,75–76` | L2 hereda trabajo propio de L3 |
| Verificación duplicada entre agentes | `.claude/agents/implementador.md:80`, `.claude/agents/revisor.md:43`, `docs/AGENT-WORKFLOW.md:33` | Implementador y revisor vuelven a ejecutar gates globales |
| Verificación duplicada al publicar | ADR0128:26,29; `.githooks/pre-push:39–41` | Verify en dev y otra vez después de fast-forward al mismo árbol |
| Cualquier cambio no documental dispara cinco gates globales | `tools/verify.ts:154–165` | Un ajuste de color puede correr tipos/lint/formato/unit/build de todo el monorepo |
| Selección e2e binaria | `tools/verify.ts:65–73,175–178` | O toda la suite o nada; no diferencia botón local de layout global |
| Falta reconocer UI modular y kit | `tools/verify.ts:65–73` | Un TSX de app activa e2e; el mismo cambio en modules/*/ui puede saltarlo |
| “Neon relacionado” también recibe pantallas | `tools/verify.ts:77–82`; `tools/neon-test.sh:127–137` | Preparación/migración de la DB de CI antes de saber si hay tests relacionados |
| Neon full repite unitarios | `tools/verify.ts:182–184`, `tools/neon-test.sh:136–137` | `pnpm test` se ejecuta otra vez con integración habilitada |
| Alcance mezcla tarea y release | `tools/verify.ts:134–148` | Suma todo desde origin/main, modificaciones y no seguidos: incluye trabajo ajeno |
| Checkout compartido mutable | ADR0128:20–24; experiencia documentada0222 | Tipos/build/tests pueden consumir versiones distintas mientras otro agente edita |
| Hook no vincula resultados a la ref empujada | `.githooks/pre-push:14,41` | Recibe SHA, pero verifica el working tree actual |
| CI no replica todas las guardias locales | `.github/workflows/ci.yml` | No ejecuta ui-guard/check-numbers; separar responsabilidades exige corregir esto |

Se reprodujo la asimetría sin tests, con:

```sh
pnpm verify --dry-run --files apps/merchant/src/app/backoffice/settings/module-settings.tsx
pnpm verify --dry-run --files apps/merchant/src/modules/pos/ui/pos-console.tsx
```

El primero planeó todos los e2e; el segundo los omitió. Ambos planearon tipos, lint, formato, unitarios, build global y Neon relacionado de merchant. `--files` informa rutas, no demuestra que se haya cambiado un color: muestra cómo trata el selector cualquier modificación en esos archivos.

### Dónde se va el tiempo

Una verificación verde documentada0221 sumó aproximadamente14,3min: e2e277,9s + Neon468,7s fueron aproximadamente87% del total; ui-guard1,2s. Una corrida0219 con e2e rojo sumó aproximadamente16,6min. Fuentes: `docs/estado/gpt.md:24` y `/private/tmp/checkpass-0219-verify.log:3191–3201`. Son ejemplos históricos, no mediana ni promesa de rendimiento futuro.

Los165 e2e afectados de POS/Mesas pasaron en59s. La demora de0222 también incluyó rojos de selectores, permisos de ejecución, reintentos de build y snapshots para aislar trabajo paralelo. Repetí suites completas donde bastaba repetir el test fallido. No puede atribuirse todo el tiempo a verify: el encargo0222 ni siquiera lo exigía completo.

### Nuestro “e2e” tiene varias capas

1. **Tipos/lint/guardias:** restricciones estáticas. Muy útiles y generalmente baratas; no prueban cobro ni autorización.
2. **Unitarios/fronteras:** lógica pura, imports, invariantes arquitectónicas. Mantener fronteras al mover módulos.
3. **Browser de componentes:** gran parte de POS/Mesas usa UI/CSS reales, mocks HTTP y navegación Next simulada; esbuild compila un harness en runtime (`tests/e2e/support/catalog-harness-server.ts:24–59`). Comprueba interacción/DOM/payloads, no el cableado real de Next ni el servidor/DB juntos.
4. **Integración servidor/base:** Neon prueba autorización, transacciones, concurrencia y persistencia.
5. **Smoke de aplicación real:** Next + HTTP real + DB de prueba y sesión apropiada. Necesario al cambiar rutas/despachadores/cookies; puede ser un recorrido pequeño, no repetir toda la funcionalidad en browser real.
6. **Capturas visuales:** `page.screenshot` produce un artefacto para inspección; no es por sí solo una comparación ni un test. Las comparaciones `toHaveScreenshot` de kit usan baselines Mac y se omiten en CI Linux (`tests/e2e/support/ui-kit-checks.ts:489–538`). Deben seleccionarse por superficie/estado afectado.

Conservar el harness rápido de componentes es útil. Su compilación dinámica explica por qué un selector basado solamente en imports estáticos puede perder cobertura; hay que declarar o descubrir entradas de los harnesses y ampliar cuando el impacto no sea conocido.

## Matriz propuesta L0–L3

El nivel depende de **comportamiento cambiado, reversibilidad y alcance**, no solo de cantidad de líneas ni nombre del archivo.

| Nivel | Ejemplos en CheckPoint | Verificación durante el cambio | Documentación/revisión |
|---|---|---|---|
| **L0 puntual** | Color mediante variante aprobada de un botón, typo, texto no contractual, imagen local | Diff y formato/lint de archivos; tipos del paquete si cambia TS; guardia barata si corresponde. Comprobación visual puntual si el render es incierto | Sin spec, ADR, test nuevo, mutación, agente revisor ni capturas archivadas obligatorias |
| **L1 localizado** | Layout/sección de una pantalla, responsive local, corrección pequeña preservando contrato | Checks del paquete; test existente pertinente o una inspección de la superficie/viewport afectado. Sin DB si no cambia lectura/escritura | Mini plan en conversación. Presupuesto orientativo3min; agotarlo no convierte fallos en éxito |
| **L2 funcional** | Nuevo estado/flujo de un módulo, formulario, validación, navegación, contrato localizado | Tests de comportamiento/errores; integración si cambia servidor/persistencia; browser de los recorridos afectados; build si cambia imports/bundling/rutas | Spec chica; ADR solo por decisión arquitectónica. Revisión focal por riesgo, sin segundo verify global. Mutación solo para una invariante crítica/sospecha concreta |
| **L3 transversal/crítico** | Migración POS/Mesas0220 completa, aislamiento entre comercios, autorización transversal, cierre/cobro concurrente, dependencias comunes | Pruebas de dominios y fronteras afectadas, integración aislada, smoke real y un gate amplio del candidato final. Full si el impacto no puede acotarse | Spec, decisión arquitectónica si corresponde y un revisor independiente con encargo acotado; sin repetir gates globales ya válidos |

Se conserva el pisoL2 aprobado para **cambios de comportamiento** en dinero, login/sesiones, tenant y migracionesPROD. Cambiar el color del botón Cobrar no cambia el cobro; cambiar cuándo se habilita o qué envía sí. Una modificación pequeña de token compartido puede afectar muchas pantallas y subir a L1/L2. Migraciones destructivas o con riesgo de pérdida/concurrencia ameritanL3 aunque tengan pocas líneas.

L0/L1 no significan “todo vale”: se mantienen permisos del owner para publicación/migraciones, contratos, zonas y anti-PROD. El riesgo L1 de “modificar algo en DB” del ADR0129 debe aclararse: si llega a esquema/datosPROD, mínimoL2.

### Qué prueba corresponde y para qué

| Cambio | Señal que protege | Lo que no aporta por defecto |
|---|---|---|
| Variante/color aprobado local | Diff y, si hace falta, render puntual; contraste si se inventa combinación | Cobro, Neon, build de cuatro apps, nueva snapshot universal |
| Layout/responsive | Viewport afectado, overflow/foco/accesibilidad pertinente | Todas las combinaciones de dispositivo/tema si no se cambiaron |
| Validación/cálculo | Unitarios de límites/errores relevantes | Browser para cada combinación aritmética |
| Formulario/payload/estado | Component browser y casos de error/doble envío pertinentes | Integration DB si el servidor/contrato no cambió |
| Permiso o aislamiento | Integración negativa entre actores/negocios; smoke del guard pertinente | Solo ocultar un botón en un mock |
| Cierre POS/cupón/puntos | Integración de dinero, idempotencia y concurrencia; browser del flujo tocado | Un test que solo repite el objeto literal del código |
| Migración/despachador/imports | Fronteras, tipos/build e integración/smoke adecuados | Volver a probar100veces todas las opciones visuales |
| Token/kit global | Contraste, estados y muestra representativa de consumidores | Tratarlo como color local o sacar toda validación visual |

## Desarrollo, integración y publicación: tres decisiones distintas

**Desarrollo:** feedback rápido y focal sobre la tarea. La base es el comienzo de esa tarea y sus archivos/contratos, no todo el backlog desde origin/main. Tras un rojo corregido, repetir el test afectado; ampliar cuando el arreglo tenga nuevas consecuencias.

**Integración/merge local:** comprobar la combinación que se incorpora. Un fast-forward del mismo commit/árbol validado no cambia el producto y no exige volver a correrlo todo. Si se agregan commits, conflictos o dependencias relevantes, probar la combinación resultante y sus interacciones. Un lote con0220+migración0079 requiere controles amplios aunque el último commit cambie un color: el alcance del lote conserva su riesgo.

**Publicación:** actualmente el hook vuelve a ejecutar verify y CI vuelve a comprobar todo. La propuesta es que haya una sola validación local por candidato final; el hook use ese resultado o corra lo que falte. CI Linux es evidencia de otro entorno, no una repetición manual por ceremonia. Se puede conservar como red independiente y hacerla selectiva para L0/L1 cuando el selector haya demostrado cobertura. La suite completa periódica/release permite detectar huecos de selección. No se propone usar `--no-verify` como mecanismo habitual.

### Reutilizar evidencia sin construir otro gran harness

Primera versión: registro pequeño por gate con árbol de código/SHA, base comparada, versión del selector, lockfile, Node, entorno/plataforma, esquema de DB cuando aplica, comandos seleccionados y resultados/skips. Un archivo de Markdown no es suficiente para una validación automatizada del hook: el hook debe comprobar que corresponde al candidato que empuja y al entorno pertinente.

- Misma versión de código después del fast-forward: conservar resultados.
- Solo cambia documentación: actualizar formato documental; conservar pruebas de producto.
- Cambia UI local: invalidar sus comprobaciones y consumidores afectados.
- Cambia test/harness, configuración, dependencia, esquema o interacción con otra feature: invalidar la evidencia pertinente.
- Cambia plataforma/entorno relevante: la evidencia local no sustituye esa comprobación.
- Snapshot incompleto o control obligatorio omitido: no aprobar por el número de tests verdes.

Primero separar alcance de tarea/release y eliminar instrucciones duplicadas. Automatizar recibos y selección fina después, solo donde ahorre más tiempo del que añade.

## Paralelismo adecuado para CheckPoint

**Subagentes:** usar para investigación, triage o piezas independientes con contratos acotados. Un cambio de botón suele terminar antes con un agente. No delegar automáticamente todas las tareas ni hacer que cada agente corra toda la suite. Una persona/agente coordina integración y un runner ejecuta el gate final.

**Escritura paralela:** proponer worktrees/local branches o detachedHEAD desde un candidato conocido; no se pushean esas ramas, por lo que crear worktrees no exige deploy previews de Vercel. Conservar una carpeta de integración en dev y el túnel local conocido para QA del owner. Cambia el ADR0128 y necesita acuerdo antes de implementarlo.

Los worktrees aíslan archivos/índice/artefactos, pero no DB, puertos, credenciales ni endpoints externos. No ejecutar dos migraciones/suites contra la misma DB mutable a la vez. Dar puertos/artefactos propios a cada runner y serializar integraciónDB compartida o usar bases de prueba separadas. OAuth/túnel siguen en el checkout de integración; otros worktrees pueden usar unitarios/harnesses sin publicar otro dominio.

No dividir por cantidad de archivos: POS UI y servidor pueden ir separados si el contrato está listo. Dos agentes tocando ui-registry, INDEX, tokens o el mismo contrato necesitan propietario/serialización. El número de spec se reserva en un registro común, por commit, sin push de rama de trabajo.

La ventaja para este repo se fundamenta en la interferencia real0222/0223. No se afirma que worktrees sean más rápidos para todos: la experiencia comunitaria consultada muestra que algunos equipos prefieren compartir carpeta.

## Ajustes concretos y orden sugerido

1. **Una política común de niveles y verificación**, corta, referenciada por AGENTS/CLAUDE. Corregir main/pull/push antiguos. Eliminar spec/revisor universal de los templatesL2. Si hay ambigüedad material, preguntar; no consultar cada elección rutinaria.
2. **Detener repeticiones del agente:** no agregar mutaciones/builds/capturas fuera del riesgo real o el encargo. ReviewerL3 revisa de forma independiente, ejecuta sondas decisivas y usa el gate válido para el resto.
3. **Acotar Impeccable:** mantener diseño, responsive y accesibilidad cuando se diseñan superficies. ParaL0 usar una ruta mínima; no activar un workflow de rediseño/colorización global por cambiar una variante. Límite de una inspección y una confirmación de los defectos corregidos.
4. **Separar modos del runner:** tarea y candidato de integración/release. Reconocer modules/*/ui, src/ui y ui-registry. Declarar cobertura e2e por módulo/core y por entradas del harness; fallback amplio ante impacto desconocido. No usar solamente vitest-related para browser dinámico.
5. **Separar unitarios de integración:** UI pura no prepara Neon; resolver suites relacionadas antes de migrar. Mantener tests de guards reales, transacciones y anti-PROD. Platform y borrados requieren cobertura/fallback explícitos.
6. **Un gate local por candidato y reutilización en hook**, ligado a la ref empujada. Corregir CI para incluir guardia/números obligatorios. Mantener una red completa de release/periodicidad acordada, no por cada microcambio.
7. **Aislar escritura paralela y runners**; no paralelizar build/e2e sobre la misma .next. La cola globalNeon puede acotarse al job de DB, conservando exclusión donde la DB lo exige.
8. **Medir si mejoró**, antes de endurecer nuevamente la política.

Tooling/hooks/CI/kit siguen siendo zona de Claude; esta investigación no cambia esa autorización. GPT puede aportar e2e/UX/fixtures y revisión del plan. Los cambios de política se acuerdan con el owner; no se han aplicado aquí.

## Cómo evaluar el nuevo flujo

Usar cambios representativos y acotados, con tiempos anteriores como referencia cuando existan: color localL0, layout móvilL1, validación de formularioL2 y cambio de guard/cobro/módulosL3. Se pueden evaluar prompts con diffs preparados sin publicar cambios.

Registrar tiempo total/p50/p95, tiempo de comandos, cantidad de suites/rondas, arranques de navegador/build/DB, uso de agentes/tokens si disponible, rojos por setup, retries/skips y defectos encontrados después. No inventar un ahorro porcentual antes de medir.

Criterios de proceso propuestos: L0 no genera spec/mutación/suite global; L1 hace como máximo una ronda visual pertinente; arreglar un selector repite su caso; el mismo candidato no paga verify dos veces en local; el reviewer no reinicia toda la suite; las pruebas críticas de cobro/tenant/auth siguen encontrando sus regresiones.

Criterio de calidad: no ocultar errores con menos aserciones. Si el gate barato no detecta una regresión plausible del cambio, subir cobertura y registrar el motivo. Un límite de tiempo es presupuesto de feedback, nunca permiso para declarar verde un control que no corrió.
