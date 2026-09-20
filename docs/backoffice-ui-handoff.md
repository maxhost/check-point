# Handoff — rediseño UI/UX del backoffice

Actualizado: 19 de septiembre de 2026.

## Pedido y alcance acordado

Se está rediseñando el shell del backoffice de CheckPass para pequeños negocios:
navegación, jerarquía, portada y accesos entre áreas. No se rediseñan todavía los
interiores de Marca, Locales, Catálogo, Suscripción, Fidelización, Mostrador ni
Campañas.

La experiencia debe sentirse clara, cercana y bien terminada. No debe parecer un
ERP corporativo, una grilla Bootstrap, un dashboard comprado ni una interfaz
genérica de prototipo. La sensación buscada es: **«mi negocio está bien cuidado y
yo entiendo qué hacer»**.

Requisitos acordados:

- Mobile first y escritorio funcional.
- Reutilizar los colores y tokens del wizard.
- Fondo blanco cálido/verdoso, no blanco puro.
- Navegación intuitiva y agrupada por intención.
- Mostrador siempre accesible, con tratamiento destacado en el menú, pero sin ser
  la acción principal del producto ni del Inicio.
- Inicio será en el futuro un dashboard de estadísticas reales.
- Mientras no existan esas estadísticas, no inventar métricas ni llenar la página
  con esqueletos engañosos.

## Arquitectura de información acordada

```text
Inicio

MI NEGOCIO
  Marca
  Locales
  Staff
  Catálogo

FIDELIZACIÓN
  Programa de fidelización
  Campañas

CUENTA
  Suscripción
  Cerrar sesión

[ Abrir mostrador ]
```

Mostrador es una herramienta operativa persistente. En escritorio vive como botón
separado al pie de la sidebar. En móvil ocupa el centro de la navegación inferior.

Staff forma parte de la arquitectura, pero su pantalla real fue eliminada del repo.
Por eso se muestra deshabilitado y marcado como **Próximamente**; no se creó una
ruta o capacidad ficticia.

## Implementación realizada

### Shell compartido

Se agregó `apps/merchant/src/app/backoffice/layout.tsx`.

- Envuelve todas las rutas `/backoffice/*`.
- Usa `requireBackofficeSession()` y conserva los guards existentes.
- Entrega nombre del negocio y rol a la navegación.
- Un owner ve toda la arquitectura.
- Un staff ve una navegación reducida al espacio de atención/Mostrador y cierre de
  sesión, sin enlaces owner.

### Navegación responsive

Se agregó `apps/merchant/src/app/backoffice/backoffice-navigation.tsx`.

Es un Client Component porque necesita el segmento activo y el estado de los
paneles móviles.

En escritorio:

- Sidebar persistente.
- Destino activo visible mediante `aria-current` y estilo propio.
- Grupos Mi negocio, Fidelización y Cuenta.
- Botón independiente “Abrir mostrador”.
- Nombre del negocio y wordmark de CheckPass.

En móvil:

- Barra inferior con Inicio, Negocio, Mostrador, Fidelización y Más.
- Negocio, Fidelización y Más abren bottom sheets contextuales.
- Los paneles enfocan el botón de cierre al abrir, cierran con Escape y bloquean el
  scroll del fondo.
- Se reservan safe areas y espacio inferior para no tapar contenido.
- Para staff, la barra se reduce a un único acceso de Mostrador.

### Inicio preparado para dashboard

Se reemplazó la grilla anterior de tarjetas en
`apps/merchant/src/app/backoffice/page.tsx`.

La portada ahora contiene:

- Saludo con el primer nombre del usuario y nombre del negocio.
- Acceso compacto a plan/estado de suscripción usando las allow-lists existentes
  `planLabel()` y `statusLabel()`.
- Bloque editorial “Tu negocio, de un vistazo” que explica honestamente que las
  estadísticas llegarán después.
- Sección Mi negocio con Marca, Locales, Staff y Catálogo.
- Sección Fidelización con Programa y Campañas.
- Composición variada, sin una cuadrícula de tarjetas idénticas.

No se agregó Mostrador dentro del contenido del Inicio porque su acceso ya es
persistente. No se añadieron datos falsos ni consultas nuevas para analíticas.

### Estilos

Los estilos nuevos están en `apps/merchant/src/app/globals.css`, a partir del
comentario `Backoffice shell — mobile first`.

- Reutilizan variables de `src/ui/tokens.css`.
- Mantienen soporte claro/oscuro ya definido por los tokens.
- Breakpoint principal de shell: 960 px.
- Breakpoint de composición del Inicio: 680 px.
- Controles táctiles de 44 px o más.
- Foco visible global dentro del backoffice.
- Fondo con gradiente radial discreto y canvas del sistema.

### Plan persistido

El plan y los criterios de aceptación están en
`docs/backoffice-ui-plan.md`.

## Archivos de este trabajo

Nuevos:

- `apps/merchant/src/app/backoffice/layout.tsx`
- `apps/merchant/src/app/backoffice/backoffice-navigation.tsx`
- `docs/backoffice-ui-plan.md`
- `docs/backoffice-ui-handoff.md`

Modificados:

- `apps/merchant/src/app/backoffice/page.tsx`
- `apps/merchant/src/app/globals.css`

## Cambios ajenos que deben preservarse

El árbol ya estaba sucio antes de este trabajo. No descartar ni sobrescribir:

- `.claude/skills/gotchas-del-repo/SKILL.md`
- `docs/PARQUEADO.md`

No se modificaron esos archivos durante esta tarea.

## Validaciones realizadas

Pasaron:

```text
pnpm --filter @mi-pasaporte/merchant typecheck
pnpm exec eslint apps/merchant/src/app/backoffice/page.tsx \
  apps/merchant/src/app/backoffice/layout.tsx \
  apps/merchant/src/app/backoffice/backoffice-navigation.tsx
pnpm exec prettier --check <archivos tocados>
pnpm --filter @mi-pasaporte/merchant check:design-contrast
git diff --check
```

Resultados:

- TypeScript: PASS.
- ESLint: PASS.
- Prettier: PASS.
- Contraste: 38/38 combinaciones PASS.
- Whitespace del diff: PASS.
- Tres suites Neon relacionadas se cargaron correctamente, pero sus 16 pruebas se
  saltaron porque el entorno no tenía la integración habilitada.

Build:

- `next build` con Turbopack no puede completarse en el sandbox: PostCSS intenta
  crear un proceso que abre un puerto y recibe `Operation not permitted`.
- `next build --webpack` sí compiló correctamente assets y TypeScript.
- Luego falló en el prerender de `/` y `/_global-error` con
  `Cannot read properties of null (reading 'useContext')`. Es una falla global del
  entorno/rutas raíz, no un diagnóstico en los archivos nuevos del backoffice.
- El entorno usa Node 22.22.2, mientras el repo exige Node `>=24.20.0 <25`.

## Decisiones que no deben revertirse al retomar

- No convertir Mostrador en hero o CTA principal del Inicio.
- No esconder Mostrador dentro de “Más”.
- No crear una ruta falsa de Staff.
- No presentar estadísticas ficticias.
- No volver a una grilla homogénea de ocho tarjetas.
- No hacer que staff vea navegación de owner.
- No tocar los interiores de las secciones como parte de este arco.
- Mantener plan y status mediante las funciones compartidas de billing; no volver a
  ternarios locales.

## Próximo paso recomendado

1. Ejecutar la app con Node 24 y una sesión owner real.
2. Hacer QA visual en 320, 390, 768, 1024 y 1440 px.
3. Verificar especialmente la cámara/escáner de Mostrador con la barra persistente
   en un dispositivo móvil.
4. Ajustar ritmo, tamaños o copy a partir de esa revisión visual, sin ampliar el
   alcance a los interiores.
5. Cuando exista un contrato de analíticas, reemplazar el bloque editorial del
   Inicio con estadísticas reales manteniendo la jerarquía actual.

## Estado al hacer clear

La implementación está completa en el working tree, no committeada. El siguiente
agente debe empezar leyendo este handoff y `docs/backoffice-ui-plan.md`, revisar
`git status` y preservar los cambios ajenos listados arriba.

