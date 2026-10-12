---
name: CheckPass — Club cotidiano (entrada 0208)
description: Sistema visual de acceso sin sesión, inscripción y confirmación de instalación; wallet interna fuera de alcance.
colors:
  ink: "#17382f"
  ink-hover: "#285345"
  coral: "#ed7456"
  paper: "#ffffff"
  surface: "#f5f8f6"
  muted: "#52685f"
  line: "#dce6e1"
  soft-green: "#e1ebe5"
  apple-black: "#000000"
  google-ink: "#1f1f1f"
  google-line: "#747775"
  error-ink: "#8a302a"
  error-surface: "#fff2ef"
  error-line: "#edb8ae"
typography:
  display:
    fontFamily: '"Nunito Sans", sans-serif'
    fontSize: "38px"
    fontWeight: 800
    lineHeight: 1.12
    letterSpacing: "-0.035em"
  confirmation:
    fontFamily: '"Nunito Sans", sans-serif'
    fontSize: "34px"
    fontWeight: 800
    lineHeight: 1.12
    letterSpacing: "-0.035em"
  title:
    fontFamily: '"Nunito Sans", sans-serif'
    fontSize: "23px"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  body:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "17px"
    lineHeight: 1.5
  instruction:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "14px"
    lineHeight: 1.45
  action:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "16px"
    fontWeight: 650
    lineHeight: 1.4
  provider-google:
    fontFamily: "Roboto, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.3
  provider-apple:
    fontFamily: "-apple-system, BlinkMacSystemFont, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.3
  support:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "13px"
    lineHeight: 1.55
rounded:
  control: "16px"
  error: "12px"
  seal: "22px"
  circle: "50%"
spacing:
  icon-gap: "12px"
  container-inset: "14px"
  screen-padding: "24px"
  screen-block: "28px"
  section-gap: "32px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    typography: "{typography.action}"
    rounded: "{rounded.control}"
    padding: "13px 16px"
    width: "100%"
  button-primary-hover:
    backgroundColor: "{colors.ink-hover}"
  button-apple:
    typography: "{typography.provider-apple}"
    backgroundColor: "{colors.apple-black}"
    textColor: "{colors.paper}"
    rounded: "{rounded.control}"
    padding: "12px 16px"
    width: "100%"
  button-google:
    typography: "{typography.provider-google}"
    backgroundColor: "{colors.paper}"
    textColor: "{colors.google-ink}"
    rounded: "{rounded.control}"
    padding: "12px 16px"
    width: "100%"
  button-text:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    padding: "10px 16px"
  account-card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.control}"
    padding: "14px"
  install-steps:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.control}"
  welcome-offer:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.control}"
    padding: "16px"
  error-notice:
    backgroundColor: "{colors.error-surface}"
    textColor: "{colors.error-ink}"
    rounded: "{rounded.error}"
    padding: "14px"
  pass-link:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    padding: "12px 5px"
    width: "100%"
  membership-seal:
    backgroundColor: "{colors.coral}"
    textColor: "{colors.ink}"
    rounded: "{rounded.seal}"
    size: "64px"
---

# Design System: CheckPass — Club cotidiano (entrada 0208)

## Overview

**Creative North Star: "Club cotidiano"**

Club cotidiano presenta la pertenencia con una invitación humana, titulares humanistas y controles reconocibles. El blanco deja respirar la identidad del comercio; el verde profundo organiza la lectura y el coral señala pertenencia. La densidad permite leer y actuar desde el teléfono sin que una ilustración desplace los controles.

Esta documentación describe la implementación 0208 autorizada por el owner a partir del mock 0207 aprobado: `/wallet` exclusivamente sin sesión, `/enroll/[programId]` y `/enroll/[programId]/ready`, incluidos ya miembro, programa no disponible, errores y estados de instalación. La selección es concepto 2 y paleta A. La wallet con sesión, sus pestañas, actividad y onboarding conservan el sistema incumbente y quedan fuera de esta autoridad. El contrato vigente vive en `.impeccable/surfaces/wallet-entry-0208.md`; `docs/qa/0207/mocks/` conserva la referencia aprobada, sin controles de revisión en las rutas reales.

**Key Characteristics:**

- Invitación cercana con tipografía humanista fuerte.
- Verde profundo, coral de pertenencia y superficies claras.
- Controles grandes y contenedores suavemente redondeados.
- Identidad CheckPass en SVG con su silueta C real; comercio con logo real o inicial.
- Autoridad limitada a acceso sin sesión, inscripción y confirmación reales.

## Colors

La paleta A combina verde profundo para lectura y acción con coral para pertenencia sobre blanco y capas claras.

### Primary

- **Verde profundo** (`ink`): titulares, texto principal, CTA y marca; `ink-hover` aclara el CTA al pasar el puntero.

### Secondary

- **Coral de pertenencia** (`coral`): sello de confirmación y contorno de la identidad real del comercio.

### Tertiary

- **Rojo de recuperación**, **fondo de error** y **borde de error**: avisos de autenticación, inscripción e instalación con rol alert; separados del coral de pertenencia.

### Neutral

- **Blanco** (`paper`): fondo de las pantallas y texto inverso.
- **Claro vegetal** (`surface`): cuenta activa e instrucciones de instalación.
- **Verde de lectura secundaria** (`muted`): explicaciones y notas de ayuda.
- **Línea suave** (`line`): división entre pasos y sección de instalación.
- **Verde de apoyo** (`soft-green`): avatar y círculos numerados.
- **Negro Apple**, **tinta Google** y **borde Google**: tratamientos propios de los proveedores, separados de la paleta CheckPass. El símbolo Google conserva sus cuatro colores originales.

**The Pertenencia Rule.** El coral señala pertenencia; el CTA principal conserva el verde profundo.

## Typography

**Display Font:** Nunito Sans, con fallback sans-serif. Archivo variable autohospedado `apps/consumer/public/fonts/nunito-sans.ttf` (servido como `/fonts/nunito-sans.ttf`, licencia OFL incluida), pesos disponibles 200–900 y carga `swap`.

**Body Font:** -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif.

**Provider Fonts:** Google conserva su tipografía de marca `Roboto, system-ui, sans-serif`; Apple conserva `-apple-system, BlinkMacSystemFont, system-ui, sans-serif`. Son excepciones incumbentes específicas de proveedores, no fuentes para el cuerpo general ni los titulares. Roboto no se añade como asset en esta tarea; se conserva la declaración existente y su fallback.

**Character:** Nunito Sans aporta una voz humanista fuerte a los titulares; el sistema sans mantiene familiaridad y lectura práctica en controles e instrucciones.

### Hierarchy

- **Display:** invitación principal, fuerte (800), tamaño (38px), interlínea (1.12) y tracking (-0.035em).
- **Confirmation:** título de pertenencia, mismo carácter y tamaño (34px).
- **Title:** propuesta de instalación, fuerte (800), tamaño (23px), interlínea (1.2) y tracking (-0.02em).
- **Body:** explicación de entrada (17px), interlínea (1.5); instalación usa un cuerpo menor (15px) e interlínea (1.55).
- **Instruction:** pasos de instalación (14px), interlínea (1.45).
- **Action:** CTA (16px), peso (650), interlínea (1.4); proveedores usan peso (600) e interlínea (1.3).
- **Support:** ayuda tras proveedores (13px), interlínea (1.55); nota de instalación (12px).

**The Titular Humanista Rule.** Nunito Sans pertenece a titulares; el sistema sans pertenece al cuerpo y controles generales. Google y Apple conservan sus stacks de marca específicos.

## Layout

Las rutas reales usan una columna flexible centrada con ancho máximo (390px), padding lateral (24px) y separación de bloques (32px). La página cubre como mínimo (100dvh), con padding superior (28px) e inferior `max(28px, env(safe-area-inset-bottom))`. El contenido mide como mínimo `min(770px, calc(100dvh - 56px))`; el pie de marca aprovecha el espacio restante. Identidad, invitación y acción conservan el orden de lectura. Nombres y palabras largas pueden reorganizar el contenido.

Hasta (360px), el titular de entrada se reduce a (34px), el de confirmación a (30px) y los proveedores a texto (15px) y gap (9px). En escritorio la misma columna permanece centrada; no hay cuadrícula, marco de teléfono ni selectores del prototipo.

## Elevation & Depth

Las superficies de aplicación no usan sombras. El blanco, el claro vegetal y las líneas suaves separan contenidos; el contraste y el espacio identifican acciones. Oferta, estado instalado y ayuda manual usan la misma capa tonal, sin elevación adicional.

**The Plano Rule.** Cuenta e instrucciones separan contenido mediante tono y divisores, sin sombras.

## Shapes

Controles, cuenta e instrucciones comparten esquinas suaves (16px). El avatar, la identidad del comercio y los números son circulares. El sello coral es una pieza redondeada (22px) con giro (-8 grados); el check compensa el giro. El icono CheckPass conserva la silueta C consumer con trazo blanco sobre verde, representada en SVG; no se inventa una nueva marca. El comercio muestra su logo real contenido dentro de un círculo (80px), con padding (10px) y fondo blanco; si falta logo, usa la inicial real del nombre en verde con texto blanco (36px, peso 700). En ambos casos conserva el contorno coral (2px) separado (4px).

## Components

### Buttons

Acciones claras, grandes y familiares. El CTA verde ocupa el ancho completo, con altura mínima (52px), padding (13px 16px), borde verde y texto blanco. Hover cambia a `ink-hover`; foco visible usa contorno verde (3px) separado (4px). Durante inscripción o apertura del prompt, el botón bloquea interacción, expone aria-busy, cambia su texto y conserva cursor de espera con opacidad (0.65).

Los proveedores conservan sus identidades: Apple negro y Google blanco con borde propio, altura fijada (52px), padding (12px 16px), icono (24px por la regla compartida de página) y gap (12px). Son enlaces reales al inicio del proveedor; conservan programId y loc cuando corresponden. Hover aplica brillo (0.96). En iPhone Apple aparece primero; en dispositivos no iOS Google aparece primero.

La acción de cambio de cuenta es texto subrayado, altura mínima (44px) y padding (10px 16px). El enlace real al pase usa texto con flecha, altura mínima (48px) y subrayado al pasar el puntero. No hay transiciones de hover ni estados active específicos en el código observado.

### Cards / Containers

Cuenta activa: fondo claro vegetal, padding (14px), gap (12px), avatar circular (42px) y nombre legible. Instrucciones: mismo fondo y esquina, filas con padding (16px 14px), mínimo (73px), divisores suaves y números circulares (26px). La oferta de bienvenida usa fondo claro vegetal, padding (16px), margen superior (24px), título del sistema (17px, interlínea 1.3) y descripción (13px, interlínea 1.55). Solo aparece con welcomeOffer real y conserva disponibilidad y activación de avisos. El estado instalado y las instrucciones manuales usan padding (16px), esquinas (16px), texto (14px) e interlínea (1.55). No se documentan chips, inputs ni navegación de wallet interna porque quedan fuera de este alcance.

### Errors

Avisos de recuperación con role alert: texto rojo, fondo claro de error, borde (1px), esquinas (12px), padding (14px), margen superior (16px), texto (14px) e interlínea (1.5). El mensaje corresponde al fallo real y acompaña la acción de recuperación; no se usa el sello de pertenencia para errores.

### Membership Seal

El sello coral mide (64px), aloja check verde (34px) y comunica inscripción confirmada. Con movimiento permitido entra durante (500ms), curva `cubic-bezier(.16,1,.3,1)`, desde giro (-20 grados) y escala (0.9) hasta giro (-8 grados) y escala (1). Si el usuario prefiere menos movimiento, queda estático.

## Do's and Don'ts

La confirmación distingue preparación, iOS, Android con prompt o ayuda manual, otros dispositivos y standalone/instalado. La instalación mantiene mensajes de fallo y ayuda de recuperación, el enlace a `/wallet` y la nota posterior de avisos. La inscripción confirmada no equivale a instalación confirmada.

### Do:

- **Do** mantener esta autoridad visual dentro de `/wallet` sin sesión y las rutas de inscripción y confirmación.
- **Do** usar Nunito Sans local en titulares, sans del sistema en cuerpo y controles generales y los stacks de marca existentes en proveedores.
- **Do** conservar la silueta C consumer de CheckPass en SVG.
- **Do** usar controles principales de altura mínima 52px y foco visible de 3px con separación de 4px.
- **Do** permitir que nombres largos reorganicen el texto y respetar movimiento reducido.

### Don't:

- **Don't** extender este sistema a las pestañas, actividad u onboarding de la wallet sin autorización posterior.
- **Don't** incorporar los controles, campos, navegación, marco o toast del mock de revisión en las rutas reales.
- **Don't** reemplazar la marca por hojas, letras tipográficas o una identidad inventada.
- **Don't** confundir la confirmación de inscripción con la instalación del acceso al inicio.

No canonizado ni reparado: el sistema incumbente de la wallet interna queda fuera de este registro y no se audita su drift. El antiguo display del sistema no es una regla heredable; los stacks de marca de Google y Apple sí son excepciones deliberadas. Evidencia: `consumer-entry.module.css`, `entry-brand.tsx`, `entry-icons.tsx`, `provider-buttons.tsx`, `wallet/page.tsx` y los componentes reales de inscripción, oferta y confirmación en `enroll/[programId]/`. El mock 0207 conserva valor de referencia aprobada; este registro no sustituye el veredicto visual del reviewer.
