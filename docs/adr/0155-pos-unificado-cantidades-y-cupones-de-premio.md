---
adr: 0155
fecha: 2026-10-18
estado: aceptada para especificación; pendiente de implementación y QA
resumen: POS único con modalidades de venta, medidas exactas, autorización por petición y retiro de Mostrador; PWA y canje directo de premios fuera de esta entrega.
---

# 0155 — POS unificado y cantidades medidas

Implementa decisiones del owner de [spec0242](../specs/0242-pos-unificado-y-venta-por-peso.md). Base leída5f9cb2b2; reserva documentalec454681. No cambia producto en esta etapa.

## Contexto

POS actual cubre órdenes abiertas/cerradas/anuladas, pagos, cupones, stock durable, comisiones e impresión. Mostrador duplica operación y condiciona su inicio a QR. Catálogo y eventos usan cantidades enteras; una tarifa por gramo puede exigir más de2decimales. Cambiar solo la UI corrompería dinero, cupones, recetas y métricas. La carga0238 ya ofrece contexto por petición y seed, que POS todavía no adopta completamente.

## Decisiones

1. **Un espacio operativo POS.** Tipo `table|pickup|delivery|counter` separado de etiqueta y mesa. La operación actual se conserva: confirmar guarda abierta, cerrar cobra. Mostrador inmediato usa el mismo dominio de órdenes/cierre, sin segunda contabilidad. Los datos viejos reciben tipo `legacy` cuando no existe evidencia para inferirlo; tableId real permite `table`.
2. **Contratos de medida exactos y versionados.** Cantidad decimal string, modo unit/mass, unidad capturada, unidad tarifaria y precio preciso se congelan por línea. Productos actuales quedan unit; no inferir masa de nombre ni unidad de insumo. kg/lb/g son unidades de masa, sin tara/balanza conectada. Libra internacional=453,59237g exactos. Cálculo racional/BigInt; total monetario conserva normalización/reparto de minorUnit vigente. La maqueta usa números JS solo como simulación.
3. **Evolución de toda la cadena.** POS y core.order_item, financial input, cupones, publisher y consumidores se actualizan juntos. `sale.closed` actual llega a V3; la nueva medida usa **V4**, conservando replay V1/V2/V3. No cambiar semántica de un payload ya publicado ni poner gramos en un entero de piezas. La base de una composición medida debe ser explícita y congelada; core sigue sin conocer módulos. El proveedor de composición declara validación genérica de cambio de medida de recurso, inyectada por el ensamblado; se añade ese punto de enganche explícito sin importar Recetas en catálogo/core.
4. **Autorización con datos compartidos, no permisos cacheados.** Reusar ADR0154/spec0238 y Better Auth. Contexto aislado por Request/RSC; nueva petición vuelve a autenticar/autorizar. POS adopta scope de intención antes del dominio; UUID/cuerpo/scope de una operación incierta no se cambian al reintentar. Caché de datos es local, scope+local y monotónica, sin TTL/storage. No modificar atributos/duración de cookies ni añadir cookieCache como optimización de esta entrega.
5. **Retiro de Mostrador por sustitución comprobada.** Pantalla, navegación, defaults y APIs legacy dejan de ofrecer venta/acreditación/canje. El dominio compartido se conserva donde POS lo utiliza. `counter` sigue como clave de compatibilidad de Clientes durante esta transición, con copy Clientes, hasta una migración independiente; no borrarlo ni ampliar otros permisos. El plan migra venta a pos solo en comercios con módulo activo y entrega inventario de excepciones antes de cortar.
6. **Fidelización acotada.** POS consume cupones existentes y conserva reglas/acreditación/total0. El texto de reglas se muestra para revisión humana; no se interpreta con IA ni se convierten reglas en código. No hay exclusiones nuevas por pedido con masa. Owner excluye PWA/emisión de cupones de premio y **suspende el canje directo de saldo por ahora**; conservar registros/saldos y retirar sus writers operativos. No crear campañas ficticias ni otro canje en POS.
7. **Extensión futura, sin implementar industrias anticipadamente.** Agenda/SPA/taller/odontología/veterinaria/GYM permanecen diseño exploratorio. `saleType` no se usa como rubro ni como agenda. Los contratos dejan lugar a referencia de origen futura sin crear citas/tablas/estados que hoy no tienen consumidor.

## Consecuencias y alternativas descartadas

- Un cambio transversal L3 exige negativos monetarios/tenant, migración protegida, replay/eventos y QA de combinación, además de browser.
- Conservar `quantity:number` fraccional o usar entero de gramos sin discriminador rompería consumidores. Versionar evita interpretaciones silenciosas por clientes viejos.
- Eliminar toda carpeta counter sin extraer componentes/dominio rompería POS, Clientes y accesos staff.
- Devolver permisos desde cookie/provider como autoridad reduciría viajes a costa de revocación y seguridad. Se eliminan consultas redundantes, no controles.
- La nueva UI no tiene que copiar CSS ni librerías del laboratorio: usa kit/tokens existentes. Carencias del kit se asignan expresamente antes de implementarlas.
- No se adjudica al POS la mejora histórica49→18SQL de0238. M0 y M1 propios prueban rendimiento; el plan fija gates antes de medir.

Contratos detallados: [0242 HTTP/medidas](../specs/0242-contratos-pos-y-medidas.md). Plan y retiro: [0242 plan](../factory/0242-plan-implementacion.md). Este ADR sustituye la operación de canje de ADR0053/0054 solo en su disponibilidad futura; no reinterpreta sus registros históricos ni autoriza borrar auditoría. Respeta ADR0138/0139/0144/0145/0148/0154.
