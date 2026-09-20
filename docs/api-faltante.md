# API faltante para la UI

> **⚠️ DESACTUALIZADO EN PARTE (2026-09-20).** Despues de este documento se implemento y desplego
> el arco de specs **0077–0081**, que **cambia la API que la UI consume** — entre otras cosas
> **`POST /api/onboarding/program` fue BORRADO**. El delta esta en
> **`docs/ui-delta-arco-0076.md`**, y es lo primero que hay que leer. Lo de aca sigue vigente salvo
> donde el delta diga lo contrario.

Actualizado: 18 de septiembre de 2026 — **revisado contra el árbol por el equipo del API**. Los tres huecos reportados fueron reproducidos uno por uno; el veredicto de cada uno está marcado abajo.

## Alcance construido

La interfaz implementada usa únicamente las rutas documentadas en los contratos 0069, 0072 y 0074. El alcance contratado permite completar un wizard de **sellos**, pero apareció una necesidad de producto adicional que la API actual no cubre.

~~`GET /api/onboarding/state` está contratado por 0074 pero todavía no existe en el árbol actual.~~

**✅ RESUELTO el 18 de septiembre de 2026 — la ruta EXISTE.** La spec 0074 está `implementada`, con PASS de revisor independiente: `apps/merchant/src/app/api/onboarding/state/route.ts`, verificada contra la base con tests de integración Neon (211 archivos / 1634 tests, 0 failed).

**Qué hacer en la UI:** retirar el fallback de desarrollo. Hoy `onboarding-api.ts` hace `if (process.env.NODE_ENV !== "production") return readDevelopmentState()`, así que en desarrollo **nunca** llama a la ruta real; con esa línea puesta, la ruta nueva no se ejercita ni una vez fuera de producción. Se puede borrar `dev-onboarding-state.ts` entero.

**La forma de la respuesta no cambia:** se verificó que el tipo `OnboardingState` de `contracts.ts` coincide campo por campo con el contrato (`authenticated` / `business` / `program` / `stampImage`). No hay que tocar el tipo.

**Y dos rutas MÁS que la misma spec entregó, por si le sirven a la UI:**

- `GET /api/merchant/session` — contexto de sesión: rol, negocio, `slug`, `status`, `suspensionReason`, `currencyCode`, `timezone`. **Contesta 200 siempre**, también sin sesión (`{"authenticated": false}`); nunca 401 ni 403, para que la pantalla de cuenta suspendida se pueda renderizar.
- `GET /api/billing/state` — plan y suscripción. **Este sí** pasa por el gate del owner y emite los cinco `code` de la 0072, más **503** (`unavailable` / `subscription_unavailable`).

**Un invariante del contrato que conviene no aprender por las malas:** `suspensionReason` llega para el owner por **rol**, no por estado, y la columna no tiene ningún CHECK que la ate al `status`. Un negocio reactivado puede venir `status: "active"` **con el motivo viejo todavía escrito**. La UI decide por `status`, **nunca** por la presencia de `suspensionReason`. Y un **503 no es «no tenés plan»**: es «no lo pudimos leer» — no degradar a mostrar `free`.

## Selector del tipo de programa en el wizard

**Pantalla:** paso 3 del alta.

**Necesidad:** el merchant debe poder elegir entre un programa de puntos, sellos o cashback antes de configurar sus reglas.

**Por qué no alcanza la API actual:** `POST /api/onboarding/program` recibe únicamente `target` y un premio `custom`; el servidor fija `kind: "stamps"`, las cláusulas, la acumulación y el sello inicial. El contrato no acepta un tipo elegido por el cliente ni define campos, defaults, validaciones o errores para puntos y cashback.

**Contrato que falta:** una creación de programa durante onboarding que declare los tipos soportados y, para cada uno, su entrada mínima, defaults, validación, respuesta y códigos de error. No se propone aquí una ruta ni un cuerpo concretos: esa decisión pertenece al contrato de API.

**Estado de UI:** bloqueado. No se muestran opciones falsas o deshabilitadas porque hoy no podrían completar el alta contra la API real. El paso 3 conserva solo sellos hasta que exista el contrato.

**⚠️ VEREDICTO DEL EQUIPO DEL API (18/09/2026): la decisión de UI fue CORRECTA, pero esto no es un hueco de API — es alcance de producto que un ADR ya cerró.**

- El **ADR 0070 §1** define la pantalla 3 del wizard como «cada cuántos sellos · qué premio», con el prellenado «Sellos, premio en texto libre», y lista explícitamente lo que queda **fuera** del wizard. O sea: el wizard es de sellos **por decisión**, no por falta de contrato.
- Medido en el dominio: `loyalty-program/validation.ts:12` habilita **`points` y `stamps`**. **`cashback` y `tiers` existen en el CHECK del esquema pero NO en el código.** Ofrecer cashback no es escribir un contrato: es trabajo de dominio nuevo.
- Y lo que **sí** existe y quizá no se sabía: `PUT /api/loyalty-program` ya acepta el `kind`, el `configuration.unitName` (el nombre de la unidad), premios de tipo `catalog_product` / `custom` / `discount`, y `DELETE` + `PATCH {action:'cancel-close'}` ordenan y cancelan el cierre del programa. **La administración del programa ya está casi entera**; lo que le falta es contrato escrito y `code` estables en sus errores.

**Está en manos del owner** decidir si el wizard ofrece elegir el tipo. Hasta entonces, sellos es lo correcto.

## Simulador económico del programa

El cálculo de costo del premio frente a facturación estimada funciona localmente y no necesita API mientras sea orientativo, opcional y no persista datos. Si el producto decide guardar estos valores, reutilizarlos en puntos/cashback o compararlos con resultados reales, hará falta contratar su persistencia y lectura; eso queda fuera del simulador actual.

## El QR final está detrás del gate de email

**Pantalla:** resultado final del wizard, inmediatamente después de crear el programa en el paso 3.

**Necesidad:** mostrar y permitir descargar/compartir el QR en el momento en que termina el alta. Es la entrega de valor del wizard y debe estar disponible antes de salir del flujo.

**Conflicto actual:** el alta está diseñada para ejecutarse antes de verificar el correo. `POST /api/merchant/auth/start` abre una sesión para una cuenta nueva con `emailVerified: false`; negocio y programa pueden crearse en ese estado. Sin embargo, `GET /api/loyalty-program/qr` usa `requireApiOwner`, incluido el gate `email_not_verified`, y responde `403` al intentar mostrar el resultado del wizard. En una cuenta nueva, por construcción, todavía no hubo oportunidad normal de consumir el enlace de verificación cuando se llega a esta pantalla.

**Por qué la UI no puede resolverlo:** el QR contiene el `programId` resuelto por el servidor y la UI no debe construirlo ni enviar IDs. Esperar la verificación rompe la promesa de mostrar el QR al finalizar; inferir o fabricar la URL rompería el contrato de seguridad.

**Cambio de API/contrato necesario:** permitir que el owner con la sesión de onboarding obtenga el QR de su propio programa sin el gate de email, conservando sesión, ownership y resolución server-side del programa. Alternativamente, el endpoint de creación podría devolver un artefacto final contratado, pero esa decisión corresponde al API. No se inventa aquí una solución concreta.

**Estado temporal de UI:** el programa permanece visible como creado, se explica que falta verificar el email y se permite enviar el enlace y reintentar. Esto evita perder el resultado del alta, pero no satisface el objetivo original de mostrar el QR inmediatamente.

**✅ VEREDICTO DEL EQUIPO DEL API (18/09/2026): el reporte es CORRECTO, y era un incumplimiento nuestro, no una decisión abierta.** El **ADR 0070 §11** ya decía, con palabras del owner, que la verificación de email bloquea «todo lo que venga **DESPUÉS** del wizard» — y la pantalla del QR **es** la cuarta del wizard (ADR 0070 §1). La spec 0072 aplicó el gate a 10 superficies y se llevó una del wizard adentro.

**Arreglo en curso: spec `0075-el-qr-del-wizard-no-lleva-el-gate-de-email.md`, `cerrada` y pendiente de implementar.** `GET /api/loyalty-program/qr` va a dejar de emitir `email_not_verified` y **conserva** los otros tres pasos del gate (401 `unauthorized`, 403 `not_owner`, y `business_suspended`/`business_closed`).

**Un hallazgo que puede ahorrar trabajo en la UI:** gatear «sólo durante el onboarding» **no es implementable** — no existe ninguna columna de paso de onboarding (el ADR 0070 la prohíbe) y el único otro proxy sería `emailVerified === false`, que es circular. Por eso la ruta pierde ese paso siempre. **No hay que mandar ninguna señal de «vengo del wizard»**: no existiría manera de confiar en ella.

**Mientras tanto, el manejo actual del 403 está bien** y no hay que tirarlo: sigue siendo el camino correcto para las otras superficies que **sí** conservan el gate.
