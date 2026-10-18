# 0242 CP1c.1 — QA independiente del núcleo racional dormido

Veredicto: **PASS acotado para esta entrega pura de Recipes**. Sin defectos nuevos observados. Las guardias de módulos globales continúan **FAIL por backlog demostrado**; no se declara el candidato global verde ni se certifica almacenamiento, consumidores o activación V4.

QA nuevo/contexto independiente; WT `/private/tmp/checkpass-pos-0242/pos-qa-0242`, rama `pos-qa-0242`. Candidato congelado `131408307617455437a0777e9badec596491ec60`; entrega autor `41d2aaa2ae3028b031b2ae2933d0d399cd1a553d`; código `478264f170e4b0d8b74702a0e7a2eb799d9af4b0`; base del autor `866378195898e4c216f678aa9446c61387b6ce59`. Comprobaciones ejecutadas 2026-10-18, 15:43–15:44 America/Guayaquil. El diff `478264f1..HEAD` de ambos archivos implementados está vacío; no hubo modificaciones de producto durante QA.

## Entorno e identidad

Node24.20.0, pnpm11.4.0, Vitest4.0.18. Cada comando Node precedido por `source ~/.nvm/nvm.sh && nvm use`. Dependencias del WT; sin cargar env/DB, instalar dependencias ni cambiar configuración. Hooks vigentes: `.githooks`.

SHA256 observados:

| Archivo | SHA256 |
| --- | --- |
| pnpm-lock.yaml | 4cfe18864f12af4fe3b0cd84ab477e936ecd52d96847579cc087e6e13b020821 |
| vitest.config.ts | a5ce128adf14f6a0953701dbec7b8eb00defbb361043fc99800fdf8ab57c28ea |
| apps/merchant/vitest.config.ts | 073bf307a361c779b82c9b696e3918a5a1a8cdd0e01dd4838117470d654f7e81 |
| apps/merchant/tsconfig.json | aa69450b965de9cde9d78ec8493843669979dd585801e30d19bf7515da5ad8f0 |
| packages/domain/tsconfig.json | 716d299ef0e71f9555b06529000c2db8cf7122bdd52350a29d451a75862c7861 |

## Revisión y aceptación observada

Leídos AGENTS, protocolos de paralelo/workflow/verificación, ficha y handoff, contrato0242 §4, ADR0148 §3, ambos expansores, decimal local y helpers racionales/medidas pertinentes. El commit de código toca únicamente los dos archivos previstos; API legacy intacta. Búsqueda de `expandMeasuredComposition` en merchant solo encuentra implementación y test: núcleo dormido.

- Base capturada obligatoria/versionada, validación mediante helpers existentes y compatibilidad dimensional; unit discreta. Cantidades internas numeric(14,3) positivas validadas separadamente de capturas de producto. Modo trusted explícito unit/INT32 sin cableado HTTP.
- Factor1g/base1lb100000/45359237; cantidades de receta y aportes conservan racionales reducidos sin convertirlos en ExactAmount monetario. Proyecciones Q3/Q6 no participan en la autoridad matemática.
- Consolidación por insumo dentro de una invocación/línea, chequeo de unidad, roundDiv final a ledger3; mitades lejos de cero y límite numeric(14,3) tras redondear. Residuos comparados por productos cruzados exactos y desempate recipeId/recipeRevisionId como legacy.
- Atribución cierra con ledger; racionales/procedencias persisten cuando las proyecciones son0. La razón se compara con racional, aun cuando Q6 oculta la diferencia. No produce movimientos/costo ni escribe DB.
- Casos negativos capturados: base ausente/cero/fraccionaria unit/incompatible/versionada incorrectamente; medidas/cantidades inválidas; snapshots inválidos; revisiones faltantes/ajenas; unidades incoherentes; límites captura/trusted; overflow producto y solo al redondear.
- Equivalencia legacy base1unit observada en focales y120 escenarios QA adicionales de3 recetas/2 insumos con cantidades distintas, cierre de asignaciones y permutación. Estos escenarios adicionales no sustituyen la validación mass del focal.

## Comandos y resultados propios

Desde raíz del WT, con activación Node24 previa:

1. `pnpm exec vitest run apps/merchant/src/modules/recipes/server/model/expand.test.ts apps/merchant/src/modules/recipes/server/model/expand-measured.test.ts apps/merchant/src/modules/pos/financial-measures.test.ts apps/merchant/src/modules/pos/measure-contract.test.ts apps/merchant/src/modules/pos/unit-expand-compat.test.ts`: EXIT0; **125 PASS**,5 archivos,0 skips/fallos (5 legacy,21 nuevo,28+43+28 medidas). Inicio15:43:27.
2. `pnpm --filter @mi-pasaporte/merchant typecheck && pnpm --filter @mi-pasaporte/domain typecheck`: EXIT0 ambos.
3. `pnpm exec eslint apps/merchant/src/modules/recipes/server/model/expand-measured.ts apps/merchant/src/modules/recipes/server/model/expand-measured.test.ts`: EXIT0,0 warnings.
4. `pnpm exec prettier --check apps/merchant/src/modules/recipes/server/model/expand-measured.ts apps/merchant/src/modules/recipes/server/model/expand-measured.test.ts`: EXIT0.
5. `pnpm exec vitest run apps/merchant/src/modules/modules-boundary.test.ts apps/merchant/src/modules/modules-boundary-between.test.ts apps/merchant/src/modules/modules-boundary-literals.test.ts`: **EXIT1,24 PASS/2 FAIL**,0 skips. Principal10/10 PASS; between6/7; literals8/9. Se ejecutaron las tres guardias requeridas, sin sustituir por app-boundary.
6. `git diff --exit-code 478264f1 HEAD -- apps/merchant/src/modules/recipes/server/model/expand-measured.ts apps/merchant/src/modules/recipes/server/model/expand-measured.test.ts`: EXIT0.
7. `git diff --check`: EXIT0 antes del informe; formato/diff del informe verificados en cierre.
8. Runner QA adicional por stdin reproducido abajo: EXIT0, **122 escenarios PASS**, sin skips/retries de aserciones. Primer intento EXIT1 de setup por TS parameter properties en strip-only; segundo EXIT1 de setup por resolución ESM de next/server. Ninguno ejecutó las aserciones ni se contó como PASS. Ejecución final usa transform-types y resolución explícita a next/server.js, sin mocks ni editar producto; warnings experimentales y MODULE_TYPELESS_PACKAGE_JSON de Node. No son fallos del expansor.

### Backlog de guardias comprobado

- Between: `modules/expenses/server/immediate.neon.integration.test.ts → modules/stock/count.ts`.
- Literals, extras sobre excepciones esperadas: `app/backoffice/backoffice-context-controller.test.ts`3; `app/backoffice/backoffice-context-refresh.test.ts`1; `app/backoffice/onboarding/checklist-context-resource.test.ts`1; `server/analytics/evaluation/policy-simulation.test.ts`2; `server/analytics/lifecycle/index.ts`1.
- `git diff --exit-code 866378195898e4c216f678aa9446c61387b6ce59 HEAD --` los seis paths anteriores más las tres guardias: EXIT0. Son idénticos a base, no inducidos por esta entrega. Los dos offenders0242 de fixtures señalados por el handoff ya no aparecen. No se ocultaron fallos ni modificaron guardias.

### Runner independiente reproducible

No crea archivos ni servidor. El hook solo resuelve imports TS del repo y ESM de Next para cargar los módulos reales.

```sh
source ~/.nvm/nvm.sh && nvm use && node --experimental-transform-types --input-type=module <<'NODE'
import {registerHooks} from 'node:module';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const root=process.cwd();
registerHooks({resolve(s,c,next){if(s==='next/server')return next('next/server.js',c);if(s.startsWith('@mi-pasaporte/domain/'))return next(pathToFileURL(root+'/packages/domain/src/'+s.slice('@mi-pasaporte/domain/'.length)+'.ts').href,c);try{return next(s,c)}catch(e){if(s.startsWith('.')&&!s.endsWith('.ts'))return next(s+'.ts',c);throw e}}});
const {expandMeasuredComposition:expand}=await import('./apps/merchant/src/modules/recipes/server/model/expand-measured.ts');
const {expandComposition:legacy}=await import('./apps/merchant/src/modules/recipes/server/model/expand.ts');
const measure={kind:'unit',quantityUnit:'unit',priceUnit:'unit',conversionVersion:'mass-si-1'};
const basis={basisQuantity:'1',basisUnit:'unit',conversionVersion:'mass-si-1'};
const q=n=>String(n/1000n)+'.'+String(n%1000n).padStart(3,'0');
let checks=0;
for(let i=1;i<=120;i++){
 const components=['a','b','c'].map((recipeId,j)=>({recipeId,recipeRevisionId:recipeId+'-rev',quantity:q(BigInt((i*37+j*233)%2900+1)),position:j}));
 const revisions=components.map((c,j)=>({id:c.recipeRevisionId,recipeId:c.recipeId,name:c.recipeId,lines:[{itemId:'one',itemName:'one',unit:'g',quantity:q(BigInt((i*91+j*151)%2700+1))},{itemId:'two',itemName:'two',unit:'ml',quantity:q(BigInt((i*17+j*39)%1900+1))}]}));
 const sold=i%13+1,actual=expand(components,revisions,{quantity:String(sold),measure},basis),expected=legacy(components,revisions,sold);
 assert.deepEqual(actual.sources.map(({recipeQuantityRatio,exactQuantityRatio,...rest})=>rest),expected.sources);
 assert.deepEqual(actual.ingredients.map(({exactQuantityRatio,roundingReason,...rest})=>rest),expected.ingredients);
 for(const ingredient of actual.ingredients){
 const scaled=x=>BigInt(x.replace('.',''));
 assert.equal(actual.sources.filter(s=>s.itemId===ingredient.itemId).reduce((sum,s)=>sum+scaled(s.allocatedQuantity),0n),scaled(ingredient.quantity));
 }
 const reverse=expand([...components].reverse(),revisions,{quantity:String(sold),measure},basis);
 assert.deepEqual(actual.sources.map(s=>[s.recipeId,s.itemId,s.allocatedQuantity]).sort(),reverse.sources.map(s=>[s.recipeId,s.itemId,s.allocatedQuantity]).sort());checks++;
}
for(const bad of [[],[{id:'a-rev',recipeId:'a',name:'a',lines:[]},{id:'a-rev',recipeId:'a',name:'a',lines:[]}]]){
 assert.throws(()=>expand([{recipeId:'a',recipeRevisionId:'a-rev',quantity:'1',position:0}],bad,{quantity:'1',measure},basis));checks++;
}
console.log('QA independent assertions: '+checks+' scenarios PASS; 120 legacy/multi-item/allocation/permutation cases + missing/duplicate revision negatives');
NODE
```

## Límites y cierre

No DB/Neon, migración, build, browser, servidor, integración, factory deliver/accept, refs principales, push ni PROD. La calidad de quantity storage y cualquier futura persistencia/base/consumidores requieren su QA independiente; este informe certifica solo CP1c.1 puro sobre el SHA indicado.

Todos los checks finalizaron. `lsof -a -d cwd +D /private/tmp/checkpass-pos-0242/pos-qa-0242 -F pc` mostró únicamente dos procesos transitorios lsof (EXIT1 de la consulta), sin proceso persistente observado. Único path escrito por QA: este informe. Commit propio documental, sin cambios de producto.

