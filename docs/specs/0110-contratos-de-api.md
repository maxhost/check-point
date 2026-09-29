# 0110 — Contrato de API: etapas de ciclo de vida por rubro

> Contrato para quien hace la UI (GPT). Implementa la spec 0110 / ADR 0102. Convenciones, guards y
> errores: los de `0101-contratos-de-api.md` §4; lo que no se nombra aca no cambia. **El `code` es el
> contrato; el `error` es copia.** Estado: `docs/INDEX.md`.

## 1. `GET /api/marketing/templates`

La respuesta pasa a depender del **rubro del negocio** (`category_gcid`, elegido en el alta).

```jsonc
{
  "templates": [ /* TemplateView[], como hoy, con los cambios de abajo */ ],
  "ladder": {                        // NUEVO: la escalera del rubro, para explicar las etapas
    "category": "gcid:cafe",         // "gcid:store" si el rubro no tiene fila propia
    "activeUntilDays": 14,           // fin de «activo»: los dias de #3 encendida; si esta apagada, T1
    "missedYouDays": [7, 14],        // T1, T2: lo que se puede elegir en #3
    "missedYouMessages": [14, 28],   // calendario de #3 con activeUntilDays ([] si no hay ninguno)
    "atRiskDays": [30, 51, 72],      // calendario de #4; el primero es donde empieza «en riesgo»
    "lostFromDays": 90,              // donde empieza «perdido»
    "lostDays": [91, 105, 151, 181], // calendario de #5
    "goneAfterDays": 181             // despues de este dia: irrecuperable, no recibe nada
  }
}
```

Todos los numeros son **dias desde la ultima visita** (o desde el alta si nunca compro).

Cambios en cada `TemplateView`:

| Campo | Antes | Ahora |
|---|---|---|
| `atRisk` | objeto en `at_risk` | **se va** de todas las plantillas. La UI borra su bloque «¿Quién está en riesgo?» |
| `dormantDays` de `missed_you` | `{options:[14,30], default:30}` | `{options:[T1,T2], default:T2}` del rubro (cafe `[7,14]`, def `14`) |
| `dormantDays` de `at_risk` | `{options:[14,30,45], default:14}` | `{options:[R], default:R}` — no hay eleccion; mostrarlo como dato |
| `dormantDays` de `win_back` | `{options:[60,90,180], default:90}` | `{options:[P], default:P}` — idem |
| `dormantDays` de `near_reward` | `[3,7,14]`, def 7 | solo las `< T1` del rubro (cafe `[3]`, def `3`) |
| `dormantDays` de `unclaimed_reward` | `[7,14,30]`, def 14 | solo las `< T1` (cafe: `{options:[], default:null}` → no sale suelta, solo sumada) |
| `dormantDays.default` | `number` | `number \| null` (`null` solo con `options: []`) |
| `description` de `at_risk` | habla del ritmo | «Le habla a los clientes que dejaron de venir hace un tiempo y estan por perderse.» |

## 2. `POST /api/marketing/templates/{key}/enable`

`dormantDays` se valida contra las opciones **del rubro** (§1). Nuevo:

| Caso | Respuesta |
|---|---|
| valor fuera de las opciones del rubro (#3 cafe con `30`) | `400 validation`, `fields.dormantDays` = «Los días sin venir tienen que ser 7, 14.» |
| plantilla con `options: []` y `dormantDays` presente | `400 validation`, `fields.dormantDays` = «Esta campaña no se programa por días en tu rubro.» |
| plantilla con `options: []` y sin `dormantDays` | `201` — sale solo sumada a la etapa (§3) |

El DTO `Campaign` no cambia (`dormantDays` = lo guardado).

## 3. Que hace el motor (para los textos de la UI)

- **Etapas:** cada cliente esta en una sola — *bienvenida* (tiene el regalo de bienvenida vigente sin
  usar), *activo*, *te extrañamos* (#3), *en riesgo* (#4), *perdido* (#5), *irrecuperable*. Cada
  campaña le habla SOLO a su etapa; si la etapa esta apagada, esos clientes no reciben nada.
- **Repeticion (push):** #3 cada `A` dias hasta «en riesgo» (`missedYouMessages`); #4 y #5 en los dias
  del rubro. Si se enciende tarde, sale el mensaje del tramo actual y los anteriores se saltean.
- **Proximidad:** respeta la etapa; no repite (un aviso por negocio cada 30 dias, como hoy).
- **#7/#8:** sueltos solo en *activo*. Si estan encendidas y el cliente califica, cada push de
  #3/#4/#5 lleva su texto sumado: `«mensaje de la etapa»[ · «cupon»] · «texto de #7/#8»`, p. ej.
  «Hace rato no te vemos. ¡Te esperamos! · ¡Estás a 2 sellos de tu premio!». Los resultados de #7/#8
  NO cuentan esos envios sumados.

## 4. Sin cambios

`disable`, `GET/PATCH settings`, resultados, el compositor custom (`/api/marketing/campaigns*`) y la
bienvenida (`0107-contratos-de-api.md`).
