# Comparación de ideas — objetivo inicial: $1.000 mensuales en Cuenca

Fecha: 2026-08-08

## Criterio y alcance

Se comparan tres ideas por su capacidad de generar **$1.000 USD mensuales de ingreso bruto recurrente o recurrentemente repetible** en Cuenca. Esto no equivale a utilidad: se deben descontar adquisición, operación, soporte, premios, pagos y garantías según el modelo.

Las puntuaciones son una hipótesis de ejecución local, no una predicción de mercado. Se privilegia el acceso disponible a dos bares para el piloto de Mi Pasaporte.

| Idea | Resumen | Pagador inicial |
|---|---|---|
| 01 — Mi Pasaporte | Wallet de fidelización gamificada y verificada por compra para bares/comercios | Bar o comercio: $20/mes por local (hipótesis) |
| 02 — Humbly | Planes por actividad dentro de comunidades verificadas | Partner B2B: gimnasio, universidad, coworking, club o evento |
| 03 — Servicios confiables | Marketplace gestionado de profesionales para el hogar | Comisión por servicio y planes B2B |

## Comparación cualitativa

Escala: 1 = desfavorable, 5 = favorable para alcanzar el objetivo inicial.

| Criterio | 01 Mi Pasaporte | 02 Humbly | 03 Servicios confiables |
|---|---:|---:|---:|
| Claridad del pagador | 4 | 2 | 5 |
| Canal de adquisición inicial disponible | 5 | 2 | 2 |
| Tiempo para primera transacción/ingreso | 4 | 2 | 3 |
| Dependencia de liquidez/efecto red | 3 | 1 | 3 |
| Complejidad operativa | 3 | 2 | 1 |
| Riesgo de seguridad/responsabilidad | 4 | 2 | 1 |
| Complejidad de producto para MVP | 4 | 3 | 3 |
| Potencial de recurrencia | 4 | 3 | 4 |
| Viabilidad de llegar a $1.000 con foco local | 4 | 2 | 3 |
| **Total orientativo** | **34/45** | **19/45** | **25/45** |

## Economía para alcanzar $1.000 mensuales

### 01 — Mi Pasaporte

Con precio de $20/mes por local:

```text
50 locales activos x $20/mes = $1.000 MRR
```

El número no es trivial, pero tiene una ruta clara y repetible. Cuenca cuenta con una base relevante de negocios de alojamiento/comida; una referencia histórica identificó 2.557 negocios del sector en la ciudad, aunque este dato no debe tomarse como conteo actual ni como mercado directamente vendible. La meta de 50 requiere capturar una pequeña fracción y ampliar, después de bares, a cafés, restaurantes y retail ligero. [Referencia histórica](https://www.abacademies.org/articles/The-Importance-of-Small-and-Medium-Enterprises-in-the-City-of-Cuenca-Ecuador-1528-2635-22-2-179.pdf)

La principal ventaja es que existen dos bares accesibles para iniciar. Eso permite validar el flujo real, obtener casos de uso y practicar venta local antes de intentar escalar.

Riesgo económico: $20 de ARPA deja poco margen para instalación, diseño y soporte manual. La operación tiene que estandarizarse; planes Pro, instalación y campañas de marca aumentan el ingreso por cliente posteriormente.

### 02 — Humbly

Podría alcanzar $1.000 con pocos clientes B2B si cada comunidad paga, por ejemplo, $250–500/mes o por eventos. Sin embargo, no existe aún una prueba de disposición de pago ni un partner de distribución confirmado.

El obstáculo principal no es construir la web: es obtener al mismo tiempo suficientes participantes, planes y seguridad para que la comunidad se perciba activa. Si se cobra a usuarios, la liquidez empeora; si se cobra a partners, el ciclo de venta y la justificación de retorno/retención son más largos.

Conclusión económica: puede tener una buena oportunidad a largo plazo, pero es la ruta menos predecible para los primeros $1.000 mensuales.

### 03 — Servicios confiables para el hogar

La necesidad y el pagador son claros: se cobra una comisión al completar un servicio. Para visualizar el umbral:

```text
Comisión de 20% -> se requieren $5.000 mensuales de volumen transaccionado
Ticket medio de $50 -> 100 trabajos/mes -> ~3,3 trabajos por día

Comisión de 15% -> se requieren $6.667 mensuales de volumen transaccionado
Ticket medio de $50 -> ~134 trabajos/mes -> ~4,5 trabajos por día
```

Es posible en teoría, pero no es MRR de bajo mantenimiento: requiere oferta de calidad, asignación, soporte, resolución de conflictos, control de desintermediación y adquisición continua. Además, ya opera EcuaCasa en Cuenca como directorio de profesionales verificados con contacto directo por WhatsApp; competir exige ofrecer garantía, pago y calidad realmente superiores, no solo perfiles y reseñas. [EcuaCasa](https://ecuacasa.com/)

Conclusión económica: puede llegar a $1.000 de ingresos más rápido que Humbly si hay demanda y proveedores, pero tiene el mayor coste operativo y de responsabilidad por dólar ingresado.

## Recomendación provisional

### Prioridad: 01 — Mi Pasaporte

Es la mejor opción para buscar los primeros $1.000 mensuales en Cuenca, por cinco razones:

1. Tiene un pagador definido y un precio simple de probar.
2. Ya hay dos bares disponibles como partners de diseño y canal inicial.
3. Se puede validar como web/PWA con operación ligera, sin integración POS ni hardware complejo.
4. Un comercio puede recibir valor individual antes de que exista una gran red de usuarios o locales.
5. Puede escalar desde $20/mes por local hacia planes Pro, instalación y campañas de marcas/eventos.

No se recomienda competir inicialmente con programas de puntos genéricos ni vender una "ruleta". La hipótesis a demostrar es: **una campaña de Mi Pasaporte incrementa una acción rentable y medible para el bar** (por ejemplo, cerveza -> comida, segunda bebida, asistencia en hora valle o retorno).

### Secundaria: 03 — Servicios confiables

Tiene un problema más urgente y una monetización transaccional natural, pero se recomienda mantenerla como segunda apuesta hasta contar con una ventaja operativa real: proveedores preseleccionados, proceso de garantía/resolución y acceso a demanda. Sin esos activos, el producto compite contra directorios existentes y coordinación por WhatsApp.

### Postergar: 02 — Humbly

La necesidad social es atractiva, pero su producto depende de liquidez, moderación y una venta B2B todavía incierta. Conviene retomarla si aparece un partner que aporte una comunidad cautiva y pague por un piloto; no como próximo proyecto independiente.

## Plan de validación de Mi Pasaporte

### Meta de 30 días

- Lanzar el flujo real en los dos bares: check-in, QR personal, acreditación de compra, oportunidad, juego, cupón y canje.
- Definir una acción rentable por bar: por ejemplo, aumentar venta de comida a quienes compran cerveza.
- Medir línea base y resultado de al menos una campaña por bar.
- Documentar fricción del bartender y tiempo por operación.
- Acordar una renovación pagada de $20/mes si el piloto entrega evidencia de valor.

### Puertas de decisión

| Señal | Decisión |
|---|---|
| El personal completa la validación sin afectar el servicio; usuarios juegan/canjean; ambos bares pagan o renuevan | Vender a 3–8 locales similares |
| Los clientes escanean pero no se validan compras ni se usan premios | Simplificar flujo antes de vender más |
| Se usan cupones, pero no hay aumento de consumo/retorno | Rediseñar incentivos y medición; no escalar aún |
| Los bares no ven valor a $20 aun con uso | Cambiar propuesta/precio o detener la idea antes de invertir más |

### Escalera de ingresos sugerida

| Hito | Locales activos a $20 | MRR base |
|---|---:|---:|
| Prueba | 2 | $40 |
| Primer caso de uso repetible | 10 | $200 |
| Validación comercial | 25 | $500 |
| Objetivo | 50 | $1.000 |

Los ingresos por instalación, Pro o campañas pueden acortar esta ruta, pero no deben ser necesarios para demostrar que la suscripción base se renueva.
