# Idea 02 — Humbly: planes por actividad en comunidades verificadas

## Tesis

Humbly es una web app/PWA para conocer personas a través de planes concretos —entrenar, caminar, ir al cine, club de lectura, música en vivo o tomar un café— dentro de una comunidad o territorio acotado y verificable.

No es una app de citas ni una red social de perfiles. Su unidad principal es el **plan**: una intención con actividad, fecha, hora y lugar. Las citas son una intención opcional, no la propuesta central.

La idea de "dating dentro de un gimnasio" queda como un posible vertical o canal de lanzamiento, no como definición del producto.

## Problema

- Las apps de citas generan fatiga: perfiles infinitos, chat sin encuentro y presión romántica desde el inicio.
- Encontrar compañía para una actividad concreta suele requerir grupos dispersos, amistades existentes o coordinación manual.
- Las comunidades físicas (gimnasios, coworkings, universidades, clubes y barrios) quieren aumentar participación, conexión y retención, pero no tienen una herramienta simple para ello.
- Descargar una app nueva para probar una actividad añade fricción y reduce la conversión.

## Propuesta de valor

### Para usuarios

- Encontrar personas para hacer algo específico, no navegar perfiles indefinidamente.
- Entrar desde enlace o QR en una web móvil, sin descarga obligatoria.
- Elegir intención: amistad, actividad, networking o cita abierta.
- Conocer personas mediante una experiencia compartida y pública, con menor presión que una cita uno a uno.

### Para comunidades y partners

- Activar su comunidad con planes y encuentros recurrentes.
- Aumentar asistencia, participación y potencialmente retención.
- Ofrecer un beneficio social a miembros sin crear ni moderar tecnología propia.
- Obtener métricas agregadas de planes creados, confirmados, asistidos y repetidos.

## Experiencia base

```text
QR/enlace de la comunidad -> web app -> registro ligero y verificación de pertenencia
-> explorar o crear un plan -> personas se unen -> grupo temporal y chat
-> encuentro en lugar público -> valoración/seguimiento mutuo opcional
```

Ejemplo:

> “Quiero ir a una clase de yoga el jueves a las 19:00.”
>
> Personas compatibles se unen; se crea un grupo temporal para coordinar y el chat queda disponible solo si existe continuidad mutua tras el encuentro.

## Alcance inicial recomendado

No lanzar como marketplace abierto de todas las actividades de una ciudad. La combinación de actividad, horario, zona, idioma e intención fragmenta demasiado la liquidez.

Lanzar en una comunidad con distribución existente:

- Cadena local de gimnasios, CrossFit, escalada, boxeo o running club.
- Coworking, universidad, edificio residencial o club privado.
- Distrito urbano, evento o festival con programación definida.

Categorías iniciales limitadas: entrenar, caminar/running, café, cine y actividades culturales. La prioridad es generar suficientes planes y participantes en un contexto pequeño antes de expandir oferta o geografía.

## Principios de seguridad y privacidad

- Participación voluntaria y comunidad verificada; el partner no entrega una lista de miembros.
- No mostrar presencia en tiempo real, ubicación precisa ni horarios habituales de otras personas.
- Encuentros iniciales en espacios públicos o actividades organizadas.
- Intención explícita y controles para no mezclar amistad con citas sin consentimiento.
- Chat sólo para participantes de un plan y mecanismos de match/continuidad mutua cuando corresponda.
- Bloqueo, reporte, moderación, verificación de perfiles y reglas claras desde el MVP.

## Modelo de monetización

### Principio

No cobrar una suscripción anual al usuario en el lanzamiento. Una red nueva necesita densidad: cobrar antes de demostrar que existen planes y personas relevantes reduce la oferta y empeora el cold start.

El modelo inicial es **B2B2C**: usuarios entran gratis; el partner que necesita activar una comunidad o llenar una experiencia paga.

### Fuentes de ingreso

| Producto | Cliente | Qué compra | Modelo |
|---|---|---|---|
| Activación de comunidad | Gimnasio, coworking, universidad, club, edificio o distrito | Comunidad privada, onboarding y planes/encuentros | Fee de implementación + mensual o campaña |
| Evento/plan patrocinado | Venue, marca u organizador | Convocatoria, confirmación de asistentes y experiencia de marca | Fee por evento/campaña o por asistente confirmado |
| Premium posterior | Usuario | Prioridad, acceso a planes especiales, filtros o créditos | Suscripción o créditos, sólo tras validar liquidez |

El caso de gimnasio se vende como "entrena acompañado, crea comunidad y mejora participación/retención", no como una app para que miembros se citen.

## Métricas a validar

### Liquidez y usuario

- Porcentaje de nuevos usuarios que se une o crea un plan.
- Tiempo hasta el primer plan confirmado.
- Tasa de planes que alcanza el mínimo de participantes.
- Asistencia efectiva y tasa de no-show.
- Repetición a 7 y 30 días.
- Número de contactos o grupos que continúan después del plan.

### Partner e ingresos

- Coste por participante confirmado/asistente.
- Asistencia incremental a actividades u horarios objetivo.
- Renovación de partners y repetición de campañas.
- Ingreso por comunidad activa y margen por evento.
- Señal de valor para el partner: participación, NPS y, cuando sea posible, retención.

## Riesgos e incógnitas

- **Cold start y fragmentación:** incluso dentro de una comunidad, los planes deben tener densidad suficiente.
- **Seguridad y moderación:** al involucrar extraños y citas opcionales, es una capacidad esencial y costosa, no un añadido.
- **Operación:** al inicio la calidad del encuentro puede requerir curación manual, anfitriones o partners activos.
- **Disposición B2B a pagar:** el valor debe conectarse con asistencia, retención o activación medible; "hacer comunidad" por sí solo puede no cerrar una venta.
- **Dependencia del partner:** la adquisición inicial depende de acceso a una comunidad existente.
- **Fricción de reenganche web:** la PWA reduce entrada, pero hay que probar que notificaciones, email, WhatsApp o calendario sostengan la recurrencia.

## MVP sugerido

Piloto con un partner y una sola comunidad:

1. Landing web con acceso por QR/enlace y registro ligero.
2. Verificación simple de pertenencia (invitación, código o email institucional).
3. Catálogo limitado de planes curados y creación de planes con plantilla.
4. Confirmación de asistencia y chat temporal por plan.
5. Reporte/bloqueo, normas y soporte operativo manual.
6. Panel simple para el partner: registros, planes, confirmaciones y asistencia.

Ejecutar primero tres a cuatro encuentros de forma concierge, sin construir una plataforma completa. El objetivo es vender al partner y comprobar asistencia/repetición, no optimizar tiempo dentro de la aplicación.

## Criterio de comparación con las otras ideas

Evaluar frente a las demás opciones en: claridad del pagador, coste y canal de adquisición, densidad mínima para funcionar, necesidad de operación humana, retención, margen, riesgo de seguridad, complejidad regulatoria, velocidad de MVP y defensabilidad.
