# Configuración — activar Imprimir tickets

**Superado por aclaración del owner:** impresión siempre activa. El toggle
solo muestra/oculta opciones y no persiste activación. No se necesita ampliar
API/DB. Implementación definida en spec0186; propuesta inferior descartada.

Pedido del owner: en Configuración, activar/desactivar Imprimir tickets con un
toggle; al activarlo mostrar las opciones del ticket y guardar los ajustes en
DB. La activación debe tener efecto real sobre la impresión del POS.

## Contrato existente comprobado

`GET/PUT /api/merchant/business/ticket` y `GET /api/pos/ticket` exponen solo
`{ showBusinessName, showTable }`. `core.ticket_settings` tiene esas dos columnas
y business_id/updated_at. No existe un booleano de activación. false/false
significa ticket básico, no impresión desactivada (contrato 0184).

## Ampliación propuesta para Claude

Mantener las rutas y permisos actuales. Añadir `printingEnabled: boolean` al
DTO de lectura owner/POS y persistirlo por comercio en DB. La elección de
default y compatibilidad del PUT necesita cerrar la spec con quien implemente
el backend; no se asume que la ausencia de una fila equivale a desactivado.

La activación no borra showBusinessName/showTable. Desactivar y volver a activar
conserva las opciones anteriores. Guardado devuelve la configuración persistida;
errores y restricciones de propietario conservan el contrato actual. El backend
debe definir explícitamente cómo trata clientes anteriores que mandan solamente
los dos booleanos, para evitar alterar printingEnabled de forma accidental.

## UI preparada como alcance, pendiente del contrato

- Configuración exclusiva del owner: toggle Imprimir tickets y, cuando esté
  activo, Mostrar nombre del comercio y Mostrar mesa. Mismos componentes del
  kit, sin tocar kit ni módulo de impresión.
- Leer del GET; guardar por PUT y confirmar solo después del éxito con el
  ConfirmationToast compartido. Fallo conserva el estado previamente guardado
  y permite reintentar. Bloquear cambios concurrentes durante el guardado.
- POS consume el booleano al precargar su GET y respeta la desactivación.
  Sin configuración cargada no debe asumir que la impresión está habilitada.
- Impresora/papel por dispositivo y QR siguen fuera de este pedido.

## Verificación necesaria

Persistencia/aislamiento por comercio y permisos en tests del backend. Navegador:
activar revela opciones; guardar y recargar conserva estado; desactivar conserva
opciones; fallo no muestra éxito; POS respeta el booleano. Typecheck, lint y guard
del merchant, más captura móvil/escritorio.

No hay implementación de este cambio todavía. AGENTS.md y
docs/TRABAJO-EN-PARALELO.md §5 reservan API/DB a Claude. Pendiente respuesta del
owner: ampliación por Claude o autorización expresa a GPT para esa zona.
