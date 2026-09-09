---
adr: 0057
fecha: 2026-09-08
estado: aceptada
resumen: El re-enroll sin OTP se acepta temporalmente y queda agendado para una futura recuperación por OTP. Se descartan juegos; la evolución se centra en geofencing, fidelización, analítica y campañas segmentadas con push. La carga de imágenes informa su análisis y ofrece cámara en móvil.
---

# 0057 — Marketing segmentado y carga de imágenes móvil

## Decisiones

1. El re-enroll de un teléfono existente conserva la cuenta y abre su sesión, tal como hoy.
   Se acepta temporalmente; antes de ampliar ese flujo se introduce OTP para probar la
   posesión del teléfono. No se cambia ahora.
2. Juegos, ruleta y raspadita salen del roadmap. La siguiente capa de marketing es
   geofencing/check-in, segmentación por comportamiento (por ejemplo, N días sin visita),
   cupón exclusivo y push al Wallet.
3. El catálogo de premios de fidelización existente sigue siendo la vía de canje del
   programa; un catálogo genérico de beneficios solo revive junto con campañas.
4. Mientras el navegador analiza la imagen elegida, la UI muestra una señal no bloqueante.
   En móvil las tres superficies de imagen ofrecen también una captura con la cámara trasera.

## Consecuencias

- La spec 0001 queda informativa/deprecada; 0005 y 0006 se deprecan por solaparse o
  contradecir esta dirección. 0003, 0007, 0008 y 0009 siguen como roadmap, con 0008 diferida
  y 0009 pendiente de rediseño dentro de campañas.
- La cámara es una opción explícita además de galería, no un supuesto del selector nativo.
