# Idea 03 — Marketplace de servicios confiables para el hogar en Cuenca

## Tesis

Un marketplace local, inicialmente web y operado de forma concierge, para contratar profesionales confiables de servicios del hogar en Cuenca: limpieza, electricidad, plomería, cerrajería y pequeños arreglos.

No es un directorio de contactos ni un clon superficial de Helpling. La propuesta es una capa de **confianza verificable**: profesionales seleccionados, precios o cotizaciones claras, pago protegido, reseñas de trabajos reales, garantía y soporte en reclamos.

## Problema

- Contratar a un desconocido para entrar a un hogar o resolver una reparación suele depender de recomendaciones informales, grupos de WhatsApp o búsquedas poco verificables.
- El deterioro de la percepción de seguridad eleva el valor de identidad, referencias, trazabilidad y respuesta ante problemas.
- Los profesionales independientes necesitan una fuente estable de trabajo y reputación portable.
- El cliente tiene incertidumbre sobre calidad, precio final, puntualidad y qué ocurre si el trabajo sale mal.

## Propuesta de valor

### Para clientes

- Encontrar un profesional adecuado sin depender de una recomendación privada.
- Conocer identidad verificada, especialidad, disponibilidad, precio/cotización y reputación basada en trabajos reales.
- Pagar y contratar desde un flujo único, con comprobante y canal de reclamo.
- Tener una garantía limitada y soporte de la plataforma si hay incumplimiento o daño cubierto.

### Para profesionales

- Conseguir demanda local sin invertir en publicidad individual constante.
- Crear historial de trabajos y reputación verificada.
- Mantener control sobre precio, zona, disponibilidad y trabajos aceptados.
- Acceder a herramientas posteriores de agenda, cobro, facturación y gestión de clientes.

## Confianza como producto

Las reseñas son necesarias pero insuficientes. El diferencial debe combinar varias capas:

| Capa | Mecanismo |
|---|---|
| Identidad | Cédula, verificación facial/foto, teléfono y datos de contacto validados |
| Oficio | Referencias, certificados o prueba práctica según la categoría |
| Transparencia | Alcance, precio o cotización, tiempo estimado y condiciones visibles antes de contratar |
| Reputación | Reseñas permitidas solo tras trabajos contratados en la plataforma |
| Pago | Registro del pago y liberación/confirmación al finalizar según el flujo elegido |
| Garantía | Rehacer el trabajo o gestionar reclamo bajo condiciones, límites y plazos explícitos |
| Soporte | Atención humana para cancelaciones, conflictos y situaciones de seguridad |

La plataforma debe evitar prometer seguridad absoluta. La verificación, garantía, privacidad, exclusiones y proceso de reclamación deben expresarse con precisión y ser operables.

## Alcance y wedge inicial

No lanzar todas las categorías: cada una tiene riesgos, frecuencia y necesidades de verificación distintas.

| Categoría | Atractivo | Riesgo/limitación |
|---|---|---|
| Limpieza | Alta repetición y agenda previsible | Operación intensiva y potencial de desintermediación |
| Pequeños arreglos | Demanda amplia y controlable | Tickets variables y cotización menos estandarizada |
| Electricidad/plomería | Urgencia, ticket y disposición a pagar mayores | Requiere verificación técnica y respuesta rápida |
| Cerrajería | Problema urgente y crítico | Máxima sensibilidad de seguridad; exige protocolos estrictos |
| Cuidado de personas | Alto valor y recurrencia posible | Alto riesgo legal, de selección, seguro y responsabilidad; fuera del MVP |

### Recomendación de MVP

Empezar con limpieza y pequeños arreglos planificados. Permite controlar proveedores, agenda, precios orientativos y calidad antes de abordar emergencias técnicas o cuidado de personas.

La expansión a electricidad/plomería y cerrajería debe ocurrir solo tras validar el sistema de verificación, soporte y resolución de conflictos.

## Experiencia base

```text
Necesidad -> landing web/WhatsApp -> solicitud con fotos y alcance
-> profesional seleccionado o cotización -> confirmación de precio/hora
-> servicio -> confirmación -> pago/comprobante -> reseña y garantía
```

El primer producto puede operar detrás de una landing y WhatsApp. La tecnología debe automatizar un flujo que ya funciona, no ocultar que aún no existe oferta, verificación o operación de calidad.

## Modelo de monetización

### Principio

El usuario paga por un servicio real que necesita, no una membresía para usar la plataforma. Esto reduce el problema de conseguir usuarios de pago comparado con redes sociales, fidelización o dating.

### Fuentes de ingreso

| Producto | Cliente | Modelo |
|---|---|---|
| Intermediación | Profesional/cliente según la categoría | Comisión sobre trabajo completado; hipótesis inicial: 10–20% |
| Urgencias | Cliente | Fee por atención prioritaria/mismo día |
| Planes B2B | Edificios, Airbnb, oficinas y administradores | Fee mensual, paquetes de mantenimiento o comisión por orden |
| Herramientas Pro posteriores | Profesionales con recurrencia | Suscripción por agenda, cobros, analítica o mayor visibilidad, solo tras probar valor |

El valor que mantiene las transacciones dentro de la plataforma es la garantía, el soporte, el historial verificable y el pago documentado. Si solo intercambia contactos, cliente y proveedor se moverán a WhatsApp tras la primera visita.

## Métricas a validar

### Mercado y operación

- Tiempo desde solicitud hasta profesional asignado/cotización aceptada.
- Conversión solicitud -> servicio completado.
- Cancelaciones, no-shows y reclamaciones por categoría.
- Puntuación de calidad y porcentaje de trabajos bajo garantía.
- Repetición a 30, 60 y 90 días.

### Economía

- Ticket promedio, comisión neta y margen de contribución por categoría.
- Coste de adquisición por cliente y profesional activo.
- Tasa de desintermediación tras el primer servicio.
- Ingreso y margen por cliente recurrente.
- Utilización e ingresos por profesional activo.

## Riesgos e incógnitas

- **Operación primero:** reclutamiento, validación, asignación, calidad y soporte son el producto más difícil; no la app.
- **Responsabilidad:** daños, robos, accidentes y trabajos defectuosos requieren términos, seguros/garantías y protocolos adecuados.
- **Desintermediación:** los contactos pueden cerrar trabajos fuera de la plataforma si ésta no conserva valor tangible.
- **Precios:** cotizaciones poco estandarizadas pueden afectar conversión y confianza.
- **Oferta inicial:** pocos buenos profesionales generan baja disponibilidad; pocos trabajos hacen que proveedores abandonen.
- **Datos personales:** se procesarán cédulas, direcciones, fotos, teléfonos y reseñas; requiere minimización, consentimiento, seguridad y atención de derechos de datos.
- **Categorías sensibles:** cuidado de personas y cerrajería no deben añadirse sin controles y operación especializados.

## MVP sugerido

Piloto en zonas acotadas de Cuenca con 10–20 profesionales preseleccionados:

1. Landing web con solicitud guiada y WhatsApp operativo.
2. Verificación manual de identidad, oficio y referencias.
3. Dos categorías: limpieza y pequeños arreglos planificados.
4. Asignación/cotización humana, con confirmación escrita de alcance y precio.
5. Registro de servicio, pago, reseña y canal de reclamo.
6. Política de garantía limitada y protocolo claro antes de prometer cobertura amplia.

El primer objetivo no es automatizar: es confirmar que clientes repiten, que proveedores aceptan una comisión y que la operación logra calidad consistente.

## Criterio de comparación con las otras ideas

Evaluar frente a las demás opciones en: claridad del pagador, urgencia del problema, frecuencia/repetición, coste de adquisición, dependencia de efectos de red, necesidad de operación humana, responsabilidad/riesgo, margen, velocidad de validación y potencial de expansión geográfica/categorial.
