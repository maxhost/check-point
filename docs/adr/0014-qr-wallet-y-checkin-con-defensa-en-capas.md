---
fecha: 2026-08-10
resumen: QR opacos y revocables, canjes atómicos y geolocalización puntual reducen fraude sin prometer presencia infalible.
estado: propuesta
---

# ADR 0014 — QR, Wallet y check-in con defensa en capas

## Propuesta

Separar QR de local, QR de cuenta y QR de cupón. El QR de cuenta puede estar directamente en Apple Wallet y Google Wallet, pero contiene un token opaco revocable y no un dato personal. El QR de cupón se consume una sola vez en una transacción del servidor.

El QR de local inicia check-in y la PWA solicita geolocalización puntual. El servidor evalúa distancia, precisión, tiempo y frecuencia. No se rastrea ubicación en segundo plano.

## Consecuencias

- Un pass no se vuelve fuente de verdad ni expone teléfono o ID interno.
- Una fotografía de QR no basta normalmente para completar check-in.
- No existe garantía absoluta contra ubicación simulada desde un navegador; es reducción de fraude, no prueba criptográfica de presencia.

## Estado

Propuesta pendiente de validación del fundador.

