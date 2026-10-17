# Política de Analíticas

La configuración editable está en [config.ts](./config.ts). Es código versionado del producto; editarla no cambia un proceso ya iniciado ni un despliegue publicado. Recarga el servidor local para probar una modificación. Este encargo no publica ni crea un editor o almacenamiento de configuración.

`index.ts` valida, calcula una versión que depende de todo el catálogo y entrega un snapshot profundamente inmutable. `schema.ts` describe unidades y límites; `rules.ts` enumera algoritmos, parámetros y acciones soportados sin otra copia de valores iniciales. Los consumidores importan únicamente la entrada pública `@mi-pasaporte/domain/analytics/policy/index` y reciben el mismo snapshot explícito.

Este primer checkpoint A1 entrega validación, versionado, catálogo y tipos públicos. La integración del motor, ciclo persistente, simulación completa y recetas por parámetro se completan en A2; no se afirma que el HTTP integrado ya sirva el contrato v2 ni que se haya aplicado una migración de ciclo.

Desde la raíz, con Node 24:

```sh
source ~/.nvm/nvm.sh && nvm use
pnpm --filter @mi-pasaporte/merchant exec vitest run src/server/analytics/evaluation/policy.test.ts
```

Ese comando valida la configuración actual y comprueba versiones, inmutabilidad, referencias inválidas, categorías, parqueo de Marketing y ventanas derivadas. No escribe en DB. No se debe activar la regla 11: depende de una decisión y una implementación futura de Marketing.
