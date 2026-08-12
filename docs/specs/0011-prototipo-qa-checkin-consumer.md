---
spec: 0011
fecha: 2026-08-10
estado: cerrada
resumen: Prototipo local de QA para probar en un teléfono el QR, permiso de ubicación, check-in simulado y wallet guest sin backend.
disjunta: no
archivos: apps/consumer, .env.example, README.md, pruebas consumer y e2e, docs
---

# 0011 — Prototipo QA de check-in consumer v0.1

> **Nada de código empieza sin esta spec en `cerrada`.**

## Problema

La primera experiencia de Mi Pasaporte será la de una persona que descubre un QR físico
en un comercio. Antes de construir identidad, campañas, base de datos o reglas reales,
necesitamos probar en un teléfono el recorrido completo y pulir la interfaz: abrir el
QR, conceder ubicación, entender el check-in y ver valor inmediato.

## Alcance

**Entra:**

- Una pantalla de preparación QA que muestra un QR real para el local ficticio
  `Bar Demo`.
- Una URL móvil de check-in que representa el destino del QR.
- Solicitud real de geolocalización del navegador sólo después de una acción explícita
  de la persona.
- Validación visual simulada, seguida de una recompensa fija: **10 puntos**.
- Una wallet guest temporal con los 10 puntos, sellos y cupones de demostración.
- Estados de interfaz para ubicación denegada/no disponible y para error de simulación.
- Instrucciones para abrir el flujo desde un teléfono mediante una URL HTTPS temporal.

**No entra:**

- Base de datos, API de producto, autenticación, cookies de sesión, OTP, cuentas reales,
  campañas, Incentive Engine, geovalidación, límites, auditoría ni persistencia entre
  dispositivos.
- Validar coordenadas, distancia, precisión o que el teléfono esté realmente en el
  local. La ubicación sólo demuestra el permiso y la integración con el navegador.
- Crear, editar o cargar branding de comercios; el prototipo usa fixtures estáticos de
  `Bar Demo` que representan el modelo de ADR 0019.
- Deploy permanente, dominio público, proveedor de túnel, certificados permanentes o
  analytics.

## Diseño

El prototipo vive exclusivamente en `apps/consumer`. La ruta de preparación muestra un
QR que codifica la URL pública de check-in configurada para la sesión de QA. La persona
lo escanea con la cámara nativa de su teléfono y llega a la ruta de check-in.

La URL debe ser HTTPS: una dirección LAN `http://192.168.x.x` no es un contexto seguro
para `navigator.geolocation` en el teléfono. El operador proporciona una URL HTTPS
temporal —por ejemplo, mediante un túnel local— en la variable pública no secreta
`NEXT_PUBLIC_QA_ORIGIN`. El QR se oculta y explica el faltante si esa variable no apunta
a una URL HTTPS válida. Esta spec no elige ni instala un proveedor de túnel.

El flujo es:

```text
/qa
  → QR con https://<origen-qa>/check-in/demo-bar
  → teléfono abre /check-in/demo-bar
  → “Estás en Bar Demo” + [Hacer check-in]
  → solicitud real de ubicación del navegador
  → “Validando tu visita…” durante una demora simulada
  → “¡Listo! Ganaste 10 puntos” + [Ver mi pasaporte]
  → /wallet/demo: wallet guest temporal
```

La pantalla inicial no pide teléfono ni explica una cuenta guest como concepto técnico.
El nombre Mi Pasaporte aparece como la superficie que guarda los beneficios después del
resultado. El branding de `Bar Demo` se limita a logo/wordmark, color principal y portada
fixture; la jerarquía, controles y estados críticos usan los tokens de Mi Pasaporte.

### Especificación técnica

- Las páginas interactivas son Client Components porque usan `navigator.geolocation` y
  `sessionStorage`.
- La primera pulsación de **Hacer check-in** llama
  `navigator.geolocation.getCurrentPosition`. No se muestra la petición antes de ese
  gesto y no se guarda, imprime ni envía latitud, longitud, precisión ni timestamp.
- Al éxito del permiso se muestra el estado `validating` durante una duración fija y se
  escribe un fixture de recompensa en `sessionStorage`. Una nueva pulsación durante ese
  estado no inicia otra solicitud.
- La wallet sólo existe en la pestaña/sesión actual. Si falta el fixture, muestra el
  estado vacío y un enlace para volver al check-in. Borrar los datos del sitio elimina el
  demo; no existe promesa de conservar beneficios.
- Fixtures tras una validación exitosa: saldo `10 puntos` en Bar Demo; `2 de 5 sellos`
  de “Ruta de la cerveza”; cupón “2x1 en tu próxima pinta”, vigente hasta una fecha de
  demostración claramente rotulada; y un cupón no disponible/agotado para probar ese
  estado. Ningún cupón es canjeable.
- Si el permiso se deniega, el navegador no soporta geolocalización o ocurre un error,
  se explica el problema y se ofrece **Reintentar**. Ninguno de esos estados entrega la
  recompensa.
- La simulación se implementa detrás de un módulo de cliente pequeño y explícitamente
  nombrado `demo`; las rutas no pueden presentarse como endpoints de producto ni llamar
  servicios externos.
- Se añade una dependencia de generación de QR que produzca SVG/Canvas localmente; el
  contenido exacto del QR se cubre con una prueba. No se carga una imagen desde un
  generador externo.

### Arquitectura de referencia

- ADR 0014 — QR y check-in: sólo se adopta la entrada por QR; la defensa real llega con
  la feature correspondiente.
- ADR 0017 — el demo declara explícitamente sus límites y prueba sus estados.
- ADR 0019 — branding temático acotado y primer contacto QR → guest → resultado.

## Archivos

| Archivo | Acción |
|---|---|
| `apps/consumer/src/app/qa/page.tsx` y estilos asociados | crear |
| `apps/consumer/next.config.ts` | crear con el origen LAN explícito de la sesión QA |
| `apps/consumer/src/app/check-in/demo-bar/page.tsx` y componentes/estilos demo | crear |
| `apps/consumer/src/app/wallet/demo/page.tsx` y componentes/estilos demo | crear |
| `apps/consumer/src/**/demo*.ts(x)` y pruebas unitarias | crear |
| `apps/consumer/package.json`, `pnpm-lock.yaml` | editar para el generador local de QR |
| `.env.example`, `README.md` | editar con la configuración e instrucciones QA HTTPS |
| `tests/e2e/**` | editar con el recorrido browser sin permiso real de ubicación |
| `docs/INDEX.md`, `docs/TASKS.md`, `docs/HANDOFF.md` | editar al entregar |

### Disjunta?

No. Modifica `apps/consumer`, `README.md`, `.env.example` y pruebas, superficies que
también consumirá la fundación UI y la futura Spec 0004. Se implementa sola.

### Archivos compartidos

| Qué | Quién lo deja listo | Cuándo |
|---|---|---|
| Scaffold de consumer y controles de raíz | Spec 0010 | ya disponible; PASS independiente pendiente |

## Definition of Done

- [ ] En una computadora, `/qa` muestra un QR escaneable cuyo contenido es la URL HTTPS
  configurada de `/check-in/demo-bar`.
- [ ] Al escanearlo desde la cámara de un teléfono, se abre la pantalla de Bar Demo y se
  muestra un único botón **Hacer check-in**.
- [ ] Tocar el botón solicita permiso de ubicación del sistema/navegador; no se solicita
  antes y no se persisten coordenadas.
- [ ] Al permitir la ubicación, aparece una validación simulada y luego el mensaje
  **“¡Listo! Ganaste 10 puntos”**.
- [ ] Desde el resultado se abre una wallet guest temporal que muestra los 10 puntos,
  sellos y cupones fixture definidos en esta spec.
- [ ] Ubicación denegada, no disponible o fallida no otorga puntos y permite reintentar.
- [ ] No hay backend, base de datos, API de check-in, auth, secretos ni llamadas a
  servicios de producto.
- [ ] El recorrido es usable en viewport móvil y los controles/estados son accesibles.
- [ ] Format, lint, typecheck, unit, E2E y build pasan; un revisor independiente emite
  PASS conforme a `docs/AGENT-WORKFLOW.md`.

## Plan de pruebas y verificación

- [ ] Unidad: el constructor de URL QR rechaza orígenes no HTTPS y genera exactamente
  `/check-in/demo-bar` para un origen válido.
- [ ] Unidad: éxito de geolocalización transiciona `idle → validating → rewarded` y
  persiste sólo el fixture; denegación/error no lo persiste.
- [ ] E2E: con geolocalización simulada, recorrer check-in → recompensa → wallet y
  comprobar puntos, sellos y ambos estados de cupón.
- [ ] E2E: con geolocalización denegada, comprobar el mensaje y ausencia de recompensa.
- [ ] Regresión: el health check actual de consumer permanece sin cambios.
- [ ] Comandos exactos: `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`,
  `pnpm test:e2e` y `pnpm build`.
- [ ] Verificación manual: iniciar consumer y un túnel HTTPS temporal; configurar
  `NEXT_PUBLIC_QA_ORIGIN`, escanear el QR desde iOS o Android, conceder ubicación y
  comprobar resultado y wallet en el teléfono.

## Handoff requerido

El implementador y el revisor usan el formato de `docs/AGENT-WORKFLOW.md`. La evidencia
manual no incluye coordenadas, capturas con información de ubicación ni URLs privadas de
la red local.

## Abierto

No hay bloqueos de implementación. La URL HTTPS temporal es un insumo local de QA, no
una decisión de proveedor ni una credencial del repositorio.
