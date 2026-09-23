import type { CatalogExtractionProvider } from "../types";
import { FakeCatalogExtractionProvider } from "./fake";
import { OpenAiCatalogExtractionProvider } from "./openai";
import { CATALOG_EXTRACTION_SCHEMA_VERSION } from "./openai-schema";

export { CATALOG_EXTRACTION_SCHEMA_VERSION };

/**
 * Spec 0090 §4 — LA RESOLUCION DEL PROVEEDOR, por configuracion de SERVIDOR.
 *
 * El navegador no elige proveedor, modelo ni costo: nada de esto sale de un cuerpo HTTP.
 * Mismo patron que `emailChannelFromEnv` / `otpChannelFromEnv`.
 *
 * **Sin proveedor o clave valida esto TIRA**, y el llamador cierra el import en `failed` con
 * `provider_unavailable` (§4). **No hay fallback silencioso**: caer al `fake` en produccion
 * le daria al merchant un menu inventado con cara de analisis real.
 */
export class ProviderUnavailableError extends Error {
  constructor(readonly detail: string) {
    super(`provider_unavailable: ${detail}`);
    this.name = "ProviderUnavailableError";
  }
}

export function catalogExtractionProviderFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): CatalogExtractionProvider {
  const id = env.CATALOG_EXTRACTION_PROVIDER ?? "fake";
  if (id === "fake") return new FakeCatalogExtractionProvider();
  if (id === "openai") {
    const apiKey = env.OPENAI_API_KEY ?? "";
    if (!apiKey) throw new ProviderUnavailableError("missing_api_key");
    return new OpenAiCatalogExtractionProvider(
      env.CATALOG_EXTRACTION_MODEL ?? "gpt-5-mini",
      apiKey,
      env.OPENAI_WEBHOOK_SECRET,
    );
  }
  throw new ProviderUnavailableError("unknown_provider");
}

/** La version de prompt configurada, que se guarda con el import para poder comparar
 * corridas cuando el prompt cambie. */
export function promptVersionFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): string {
  return env.CATALOG_EXTRACTION_PROMPT_VERSION ?? "v1";
}

/**
 * **El destino del callback NO viaja en el submit, y no es un olvido.** El adaptador `openai`
 * lo tiene configurado en el dashboard del proveedor (§Despliegue), asi que ningun adaptador
 * de hoy lo consume. El dia que exista uno que si lo pase por request, el campo vuelve **con
 * su consumidor**: codigo que no se usa hoy no va al arbol.
 */
