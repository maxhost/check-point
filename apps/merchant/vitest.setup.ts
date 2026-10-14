/**
 * Spec 0224 §4 — `AI_PROVIDER` es OBLIGATORIA (sin ella el servicio de IA contesta `unconfigured`).
 * En las suites se fija SIEMPRE el falso y se borra la clave de OpenAI, pise lo que pise el shell:
 * ninguna suite llama a OpenAI ni cae en `unconfigured` por accidente. Los tests que miden la
 * configuracion le pasan su propio `env` a `aiProviderFromEnv`.
 */
process.env.AI_PROVIDER = "fake";
delete process.env.OPENAI_API_KEY;
