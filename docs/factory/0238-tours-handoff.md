# 0238 — B2b tours: intención y persistencia acotadas

Base asignada `6b8dd441`, task backoffice-0238-server y recurso harness:0238-client-tours. Solo paths nuevos reservados de onboarding/cinco controllers y este handoff; sin cambios en provider/controller/request-owner/API/Inbox/shared-state/índices. Sin DB, app, browser, push ni PROD. Artefactos de comprobación: `/private/tmp/checkpass-0238/client-tours/`.

## Cambio y contrato

`startOnboardingTour` conserva el booleano persist de las definiciones vigentes y recibe `persistProgress(status):Promise<boolean>`. True entrega onSaved y señal END existente; false descarta una intención retirada, sin onSaved ni error operativo; rechazo mantiene onSaveError y el estado visible de retry existente. Ya no importa ni llama API por su cuenta. Persistente sin callback falla cerrado sin POST; persist:false funciona sin contexto/callback y sin POST. No cambia copy, estilo, kit, controles ni secuencia del driver.

`captureOnboardingTourIntent` copia scopeKey/epoch por valor al inicio, antes de RAF/start. isCurrent consulta el ticket checklist vigente y compara SOLO scope/epoch: generación distinta por foco/lectura no invalida la intención. Cada intención solo se consume una vez. Antes del POST invalida checklist sincrónicamente y llama al transporte existente recordOnboardingTour con scopeKey capturado; ningún getter tardío ni retag al contexto nuevo. No añade GET, store, caché, listeners ni navegación propia.

Respuesta409 de contexto solo retira si la intención aún corresponde a la identidad/época actual. No replay. Si cambió mientras estaba en vuelo, tanto éxito/error/409 se descartan sin alterar presentación ni retirar la época nueva. Error operativo vigente se conserva como fallo, sin navegación: un retry por click captura otra intención antes del nuevo POST. La cabecera vinculada a sesión detecta también un nuevo login de la misma cuenta cuando backend responde409; no promete detección inmediata mediante el reporter legacy.

`useOnboardingTourIntent` usa únicamente las APIs públicas captureTicket/invalidate/retire del contexto. El callback es estable mientras esas funciones no cambien; no se reinician orientaciones porque cambie generación/estado de una lectura. Ausente provider devuelve null para persistencia, sin fallback a POST legacy; ayudas locales siguen posibles.

Cinco orientaciones adoptadas: catalog/brand/program capturan antes del RAF y comprueban vigencia dentro de él antes de tocar URL/iniciar driver; staff/locations capturan antes del inicio directo. Los tres retries catalog/brand/program capturan una intención nueva por click. Ayudas persist:false conservan su flujo. Eventos END existentes siguen siendo señales: ningún fetch/refresh propio; conexión del checklist owner queda para B tras integrar este checkpoint. Los helpers/callers adicionales no reciben adopción implícita.

## Evidencia y límites

- Dos suites propias22/22 PASS iniciales; regresión final siete suites **56/56 PASS**, cero skips (`unit-first.log`, `unit-regression.log`, `unit-final.log`). Se preservan assertions de completed/skipped, dispose, error y ayudas del driver; el doble de persistencia se inyecta explícitamente y se retiró el mock API obsoleto del test del driver.
- Trece casos del helper: ausencia/retirada, cambio scope/epoch, copia frente a ticket mutable, cambio antes de callback RAF, nuevo login antes de save, generación checklist distinta, invalidación previa al POST,409 con retiro único/sin replay, retry explícito y resultados en vuelo de época anterior. El caso RAF ejecuta un callback diferido controlado y el driver real de integración va doblado; no se afirma ejecución browser/React real de los cinco controllers.
- API onboarding9, definiciones staff8/locations7 y estados catalog7/brand3 pasan sin cambios de sus oráculos. La prueba del transporte con scope de S1 permanece en onboarding-api.test.ts; no se modifica su contrato.
- Merchant TSC, ESLint focal, Prettier, UI guard contra6b8dd441 y diff-check: EXIT0. Primer lint encontró parámetro unused en el doble propio; eliminado, log `lint-first.log` preservado. Primer TSC y primera batería unitaria ya pasaron; sin skips/retries ocultos.
- Skill Impeccable leída desde `.agents/skills/impeccable` del checkout principal porque el WT no contiene ese archivo ignorado. Contexto ya cargado por coordinación, sin repetir launcher; se aplicaron harden/craft-floor a rendimiento/errores/casos de sesión. No cambios visuales, por lo que no hay capturas ni afirmación de QA visual.

Falta QA independiente e integración con el checklist owner de B. La validación browser de RAF/unmount, aparición del retry y coordinación real de END/POST/checklist sigue siendo evidencia de combinación; no se certifica aquí ni se reemplaza con tests de mocks. Fuente y worktree se entregan limpios con commit local; no factorydeliver desde worker.
