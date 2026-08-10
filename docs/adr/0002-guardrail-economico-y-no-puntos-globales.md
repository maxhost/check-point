---
fecha: 2026-08-09
resumen: Las campañas se protegen con coste y margen por local; no habrá puntos ni oportunidades transferibles entre comercios en V1.
---

# ADR 0002 — Economía de premios y propiedad por local

## Contexto

Un descuento configurado sin coste, precio, inventario o condiciones puede destruir margen. Además, transferir oportunidades entre bares haría que un local subsidie consumo en otro, rompiendo el incentivo de participar.

## Decisión

Cada producto de campaña registra precio de venta y coste unitario. Cada premio registra su coste para el local, valor para el cliente, cupo, vigencia y condiciones. El wizard calcula margen bruto por venta, coste esperado por oportunidad y margen bruto estimado de la acción objetivo; no permite activar una configuración cuyo premio pueda generar margen bruto negativo bajo las reglas declaradas.

Oportunidades, cupones y cualquier saldo llevan siempre `merchant_id`. Solo una regla explícita futura podrá crear un beneficio compartido; esa capacidad no se incluye en V1.

## Consecuencias

- La recomendación inicial se basa en reglas transparentes, no en IA predictiva.
- Los datos de coste son responsabilidad del local y se muestran como estimaciones, no como contabilidad.
- La validación de cada cupón comprueba el local propietario en el servidor.
