/**
 * Puertos propios de la e2e, fuera del 3000-3002 de `pnpm dev`: otros proyectos de la maquina
 * levantan su `next dev` ahi y el `webServer` de Playwright fallaba con EADDRINUSE (2026-10-05).
 */
export const e2ePorts = {
  consumer: 3100,
  merchant: 3101,
  platform: 3102,
} as const;

export const consumerURL = `http://127.0.0.1:${e2ePorts.consumer}`;
export const merchantURL = `http://127.0.0.1:${e2ePorts.merchant}`;
export const platformURL = `http://127.0.0.1:${e2ePorts.platform}`;
