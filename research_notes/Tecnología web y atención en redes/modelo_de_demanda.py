#!/usr/bin/env python3
"""Modelo de demanda de avisos de reactivacion por consumidor en una red de comercios.

Cruza la escalera por rubro (research_notes/ciclo-de-vida-por-rubro/CONSOLIDADO.md, 2026-09-29)
con supuestos de comportamiento del consumidor y la compara con el cupo de Google Wallet
(3 avisos/pase/24 h, 1 reservado al timbre general => 2 para reactivacion).

Solo stdlib (el entorno no tiene numpy). Semilla fija: la salida es reproducible.
Uso:  python3 modelo_de_demanda.py            (corre todo e imprime tablas markdown)
      python3 modelo_de_demanda.py --rapido   (menos consumidores, para probar)

Modelo (todo en dias enteros):
  * El consumidor tiene N MEMBRESIAS vivas (comercios de la red donde tiene el pase y que todavia
    no pasaron a «irrecuperable»). Cada membresia es un «slot» que recorre un ciclo:
      fase ACTIVA (duracion A) -> ultima visita -> ESCALERA de mensajes del rubro
      -> irrecuperable (dia Irrecup) -> el slot se recicla con un comercio nuevo (rubro al azar).
  * Regla del encargo: un cliente activo (que visita con regularidad) NO recibe push.
    Variante «huecos»: en la fase activa las visitas tienen huecos gamma; si un hueco supera T
    el «Te extranamos» dispara igual (lo que haria el motor real por dias desde la ultima visita).
  * Duracion de la fase activa:
      - modo «conductual»: con prob p1 el cliente es one-and-done (A=0); si no, A ~ Exponencial
        con hazard mensual h (churn de clientes regulares).
      - modo «L fijo»: A ~ Exponencial con media elegida para que la fraccion estacionaria de
        membresias en escalera sea L (sensibilidad «share de comercios en lapso»).
  * Mensajes de la escalera (dias desde la ultima visita):
      Te extranamos en k*T mientras k*T < R  (T = T1 o T2),
      luego los de En riesgo y los de Perdido tal cual la tabla. Despues, nada.
  * Supuesto de techo: nadie vuelve por un mensaje (la escalera corre entera). Es cota superior
    de la demanda; declarado en las notas.
  * Cola: cupo c avisos/dia (1 o 2), politica FIFO o prioridad, vencimiento E dias,
    y opcion «reemplazo»: un mensaje nuevo del mismo comercio pisa al pendiente.
"""
import math
import random
import sys
from collections import defaultdict

SEED = 20260929
RAPIDO = "--rapido" in sys.argv
N_CONSUMIDORES = 400 if RAPIDO else 3000
VENTANA = 180          # dias medidos [0, 180)
BURN = 1500            # dias de calentamiento para llegar al regimen estacionario
COLA_PRE = 60          # la cola arranca 60 dias antes de la ventana
COLA_POST = 90         # y sigue 90 dias despues para medir la demora de lo pedido en la ventana

# ---------------------------------------------------------------------------------------------
# Tabla de CONSOLIDADO.md: rubro -> (T1, T2, R, [mensajes en riesgo], [mensajes perdido], irrecup)
# ---------------------------------------------------------------------------------------------
TABLA = {
    "cafeteria":     (7, 14, 30, [30, 51, 72], [91, 105, 151, 181], 181),
    "panaderia":     (8, 15, 30, [30, 51], [61, 70, 101, 121], 121),
    "almacen":       (7, 14, 30, [30, 51], [61, 70, 101, 121], 121),
    "restaurante":   (14, 30, 45, [45, 77], [91, 105, 151, 181], 181),
    "pizzeria":      (14, 21, 30, [30, 51, 72], [91, 105, 151, 181], 181),
    "bar":           (14, 21, 45, [45, 77], [91, 105, 151, 181], 181),
    "heladeria":     (10, 21, 45, [45, 77, 109], [121, 140, 201, 241], 241),
    "salon_belleza": (45, 60, 90, [90, 153], [181, 209, 301, 361], 361),
    "barberia":      (35, 49, 84, [84], [121, 140, 201, 241], 241),
    "unas":          (21, 28, 45, [45, 77], [91, 105, 151, 181], 181),
    "gimnasio":      (8, 14, 21, [21, 36], [46, 60, 120, 181], 181),
    "farmacia":      (21, 35, 45, [45, 77], [91, 105, 151, 181], 181),
    "ropa":          (45, 60, 120, [120, 204], [241, 278, 401, 481], 481),
    "mascotas":      (21, 35, 45, [45, 77], [91, 105, 151, 181], 181),
    "lavado_autos":  (21, 30, 45, [45, 77], [91, 105, 151, 181], 181),
}

# Mezcla de rubros de las membresias de un consumidor urbano. SUPUESTO (no hay fuente):
MEZCLA_BASE = {
    "cafeteria": .15, "panaderia": .12, "almacen": .08, "restaurante": .15, "pizzeria": .07,
    "bar": .04, "heladeria": .06, "salon_belleza": .05, "barberia": .05, "unas": .04,
    "gimnasio": .05, "farmacia": .06, "ropa": .04, "mascotas": .02, "lavado_autos": .02,
}
# Mezcla sesgada a rubros de ciclo corto (peor caso de frecuencia). SUPUESTO:
MEZCLA_FRECUENTE = {
    "cafeteria": .25, "panaderia": .20, "almacen": .15, "restaurante": .10, "pizzeria": .05,
    "bar": .03, "heladeria": .05, "salon_belleza": .02, "barberia": .03, "unas": .02,
    "gimnasio": .07, "farmacia": .02, "ropa": .01, "mascotas": .00, "lavado_autos": .00,
}

EXTR, RIESGO, PERDIDO = 0, 1, 2
NOMBRE_ETAPA = {EXTR: "te_extranamos", RIESGO: "en_riesgo", PERDIDO: "perdido"}


def escalera(rubro, usar_t2):
    """Lista de (dia_desde_ultima_visita, etapa)."""
    t1, t2, r, riesgo, perdido, _ = TABLA[rubro]
    t = t2 if usar_t2 else t1
    msgs = [(k * t, EXTR) for k in range(1, 1000) if k * t < r]
    msgs += [(d, RIESGO) for d in riesgo]
    msgs += [(d, PERDIDO) for d in perdido]
    return msgs


def elegir(rng, mezcla):
    x = rng.random()
    acc = 0.0
    for k, w in mezcla.items():
        acc += w
        if x < acc:
            return k
    return k


def generar_mensajes(rng, n, cfg):
    """Mensajes (dia, id_membresia, etapa, dias_desde_visita) de un consumidor, y fraccion de
    dias-membresia en escalera dentro de la ventana."""
    msgs = []
    usar_t2 = cfg["t2"]
    fin = VENTANA + COLA_POST
    dias_en_escalera = 0
    mid = 0
    for _slot in range(n):
        # arranque desfasado al azar para no sincronizar los slots
        t = -BURN - rng.randrange(0, 400)
        while t < fin:
            rubro = elegir(rng, cfg["mezcla"])
            t1, t2, r, _, _, irrec = TABLA[rubro]
            umbral = t2 if usar_t2 else t1
            mid += 1
            # --- fase activa
            if cfg["modo"] == "conductual":
                if rng.random() < cfg["p1"]:
                    a = 0
                else:
                    a = int(rng.expovariate(cfg["h"] / 30.0))
            else:  # L fijo: media de A tal que irrec/(A+irrec) = L
                media = irrec * (1 - cfg["L"]) / cfg["L"]
                a = int(rng.expovariate(1.0 / media)) if media > 0 else 0
            ultima = t + a
            if cfg["huecos"] and a > 0:
                # visitas con huecos gamma(k=2) de media cfg["huecos"]*T; mensajes si hueco > T
                media_h = cfg["huecos"] * umbral
                extr = [d for d, et in escalera(rubro, usar_t2) if et == EXTR]
                v = t
                while True:
                    g = max(1, int(round(rng.gammavariate(2.0, media_h / 2.0))))
                    if v + g >= ultima or v >= fin:
                        break
                    if g > extr[0] and v + g >= -COLA_PRE:
                        for d in extr:
                            if d < g and -COLA_PRE <= v + d < fin:
                                msgs.append((v + d, mid, EXTR, d))
                    v += g
            # --- escalera tras la ultima visita
            for d, et in escalera(rubro, usar_t2):
                dia = ultima + d
                if -COLA_PRE <= dia < fin:
                    msgs.append((dia, mid, et, d))
            # fraccion en escalera dentro de la ventana
            lo, hi = max(ultima, 0), min(ultima + irrec, VENTANA)
            if hi > lo:
                dias_en_escalera += hi - lo
            t = ultima + irrec  # el slot se libera cuando la membresia es irrecuperable
    return msgs, dias_en_escalera / (n * VENTANA)


def simular_cola(msgs, cupo, politica, vence, reemplazo):
    """Devuelve lista de (dia_programado, demora | None si vencio | 'R' si fue reemplazado)
    para los mensajes programados dentro de la ventana."""
    por_dia = defaultdict(list)
    for i, m in enumerate(msgs):
        por_dia[m[0]].append((i, m))
    pendiente = {}      # i -> mensaje
    ultimo_de = {}      # id_membresia -> i pendiente
    res = {}
    for dia in range(-COLA_PRE, VENTANA + COLA_POST):
        for i, m in por_dia.get(dia, []):
            if reemplazo and m[1] in ultimo_de:
                j = ultimo_de[m[1]]
                if j in pendiente:
                    res[j] = "R"
                    del pendiente[j]
            pendiente[i] = m
            ultimo_de[m[1]] = i
        # vencidos
        if vence is not None:
            for i in [i for i, m in pendiente.items() if dia - m[0] > vence]:
                res[i] = None
                del pendiente[i]
        if not pendiente:
            continue
        if politica == "fifo":
            clave = lambda im: (im[1][0], im[0])
        elif politica == "riesgo_primero":   # el mas cerca de perderse
            clave = lambda im: (-im[1][2], -im[1][3], im[1][0], im[0])
        else:                                 # facil_primero: el mas reciente
            clave = lambda im: (im[1][2], im[1][3], im[1][0], im[0])
        for i, m in sorted(pendiente.items(), key=clave)[:cupo]:
            res[i] = dia - m[0]
            del pendiente[i]
    out = []
    for i, m in enumerate(msgs):
        if 0 <= m[0] < VENTANA:
            out.append((m[0], res.get(i, "PEND")))
    return out


def pct(xs, q):
    if not xs:
        return float("nan")
    xs = sorted(xs)
    return xs[min(len(xs) - 1, int(q * len(xs)))]


def demanda(cfg, n, rng):
    """Estadisticas de demanda (sin cupo)."""
    tot_dias = 0
    hist = defaultdict(int)
    semanas = []
    consumidores_con_pico = 0
    fr_lapso = []
    todos = []
    for _ in range(N_CONSUMIDORES):
        msgs, fl = generar_mensajes(rng, n, cfg)
        fr_lapso.append(fl)
        todos.append(msgs)
        cnt = defaultdict(int)
        for m in msgs:
            if 0 <= m[0] < VENTANA:
                cnt[m[0]] += 1
        pico = False
        for d in range(VENTANA):
            hist[cnt[d]] += 1
            if cnt[d] > 2:
                pico = True
        consumidores_con_pico += pico
        for w in range(VENTANA // 7):
            semanas.append(sum(cnt[d] for d in range(7 * w, 7 * w + 7)))
        tot_dias += VENTANA
    total = sum(k * v for k, v in hist.items())
    return {
        "media_dia": total / tot_dias,
        "media_semana": sum(semanas) / len(semanas),
        "p95_semana": pct(semanas, .95),
        "p0": hist[0] / tot_dias,
        "p1": hist[1] / tot_dias,
        "p2": hist[2] / tot_dias,
        "p_mas2": sum(v for k, v in hist.items() if k > 2) / tot_dias,
        "p_mas1": sum(v for k, v in hist.items() if k > 1) / tot_dias,
        "max_dia": max(k for k, v in hist.items() if v),
        "cons_pico": consumidores_con_pico / N_CONSUMIDORES,
        "lapso": sum(fr_lapso) / len(fr_lapso),
    }, todos


def cola_stats(todos, cupo, politica, vence, reemplazo):
    dem, venc, reem, pend, n = [], 0, 0, 0, 0
    for msgs in todos:
        for _dia, r in simular_cola(msgs, cupo, politica, vence, reemplazo):
            n += 1
            if r is None:
                venc += 1
            elif r == "R":
                reem += 1
            elif r == "PEND":
                pend += 1
            else:
                dem.append(r)
    return {
        "entregados": len(dem) / n if n else 0,
        "demora_media": sum(dem) / len(dem) if dem else float("nan"),
        "demora_p90": pct(dem, .90),
        "demora_max": max(dem) if dem else 0,
        "p_con_demora": sum(1 for x in dem if x > 0) / len(dem) if dem else 0,
        "vencidos": venc / n if n else 0,
        "reemplazados": reem / n if n else 0,
        "pendientes": pend / n if n else 0,
    }


def fila(*xs):
    return "| " + " | ".join(str(x) for x in xs) + " |"


def main():
    rng = random.Random(SEED)
    f2 = lambda x: f"{x:.2f}"
    fp = lambda x: f"{100 * x:.1f}%"

    print("## 0. Mensajes por episodio de lapso completo (determinista, de la tabla)\n")
    print(fila("rubro", "msgs T1", "msgs T2", "de ellos Te extranamos T1/T2", "dias hasta el ultimo"))
    print(fila(*["---"] * 5))
    for r in TABLA:
        e1, e2 = escalera(r, False), escalera(r, True)
        n1 = sum(1 for d, e in e1 if e == EXTR)
        n2 = sum(1 for d, e in e2 if e == EXTR)
        print(fila(r, len(e1), len(e2), f"{n1}/{n2}", TABLA[r][5]))
    for nom, mz in (("MEZCLA_BASE", MEZCLA_BASE), ("MEZCLA_FRECUENTE", MEZCLA_FRECUENTE)):
        m1 = sum(w * len(escalera(r, False)) for r, w in mz.items())
        m2 = sum(w * len(escalera(r, True)) for r, w in mz.items())
        print(f"\nPromedio ponderado {nom}: {m1:.2f} msgs/episodio con T1, {m2:.2f} con T2.")

    base = {"modo": "conductual", "p1": 0.5, "h": 0.04, "huecos": 0, "t2": False,
            "mezcla": MEZCLA_BASE}

    escenarios = []
    for n in (5, 10, 20):
        for t2 in (False, True):
            escenarios.append((f"conductual p1=0.5 h=4%/mes", n, dict(base, t2=t2)))
    for n in (5, 10, 20):
        for L in (0.2, 0.4, 0.6):
            escenarios.append((f"L fijo={L}", n, dict(base, modo="L", L=L)))
    for n in (10, 20):
        escenarios.append(("conductual + huecos (media 0.5T)", n, dict(base, huecos=0.5)))
        escenarios.append(("conductual MEZCLA_FRECUENTE", n, dict(base, mezcla=MEZCLA_FRECUENTE)))
        escenarios.append(("conductual p1=0.6 h=8%/mes", n, dict(base, p1=0.6, h=0.08)))
        escenarios.append(("conductual p1=0.4 h=2%/mes", n, dict(base, p1=0.4, h=0.02)))
        escenarios.append(("PEOR: frecuente+huecos+p1=.6 h=8%", n,
                           dict(base, p1=0.6, h=0.08, huecos=0.5, mezcla=MEZCLA_FRECUENTE)))

    print("\n## 1. Demanda sin cupo (por consumidor, ventana de 180 dias)\n")
    print(fila("escenario", "N", "T", "% membresias en escalera", "avisos/dia", "avisos/semana",
               "p95 semana", "P(0)", "P(1)", "P(2)", "P(>2)", "P(>=2)", "max dia",
               "% consumidores con algun dia >2"))
    print(fila(*["---"] * 14))
    guardados = {}
    for nom, n, cfg in escenarios:
        d, todos = demanda(cfg, n, rng)
        guardados[(nom, n, cfg["t2"])] = todos
        print(fila(nom, n, "T2" if cfg["t2"] else "T1", fp(d["lapso"]), f2(d["media_dia"]),
                   f2(d["media_semana"]), d["p95_semana"], fp(d["p0"]), fp(d["p1"]), fp(d["p2"]),
                   fp(d["p_mas2"]), fp(d["p_mas1"]), d["max_dia"], fp(d["cons_pico"])))

    print("\n## 2. Con cupo diario: demora, vencidos y reemplazos\n")
    print("(Escenarios conductuales base; demora en dias entre el dia programado y el de salida.)\n")
    print(fila("escenario", "N", "T", "cupo", "politica", "vence (d)", "reemplazo",
               "entregados", "vencidos", "reemplazados", "% con demora>0", "demora media",
               "p90", "max"))
    print(fila(*["---"] * 14))
    politicas = [
        (2, "fifo", None, False), (1, "fifo", None, False),
        (1, "riesgo_primero", None, False), (1, "facil_primero", None, False),
        (1, "fifo", 0, False), (1, "fifo", 3, False), (1, "fifo", 7, False),
        (1, "fifo", None, True), (1, "riesgo_primero", 3, True),
        (2, "fifo", 0, False),
    ]
    claves = [("conductual p1=0.5 h=4%/mes", n, t2) for n in (5, 10, 20) for t2 in (False, True)]
    claves += [("PEOR: frecuente+huecos+p1=.6 h=8%", 20, False)]
    for clave in claves:
        todos = guardados[clave]
        for cupo, pol, vence, reem in politicas:
            if clave[1] == 5 and (pol != "fifo" or reem):
                continue
            s = cola_stats(todos, cupo, pol, vence, reem)
            print(fila(clave[0], clave[1], "T2" if clave[2] else "T1", cupo, pol,
                       "nunca" if vence is None else vence, "si" if reem else "no",
                       fp(s["entregados"]), fp(s["vencidos"]), fp(s["reemplazados"]),
                       fp(s["p_con_demora"]), f2(s["demora_media"]), s["demora_p90"],
                       s["demora_max"]))

    # por etapa: que se pierde con cupo 1 y vencimiento 0 (mismo dia), segun politica
    print("\n## 3. Que etapa pierde cuando el cupo es 1 y el mensaje vence el mismo dia (N=20, T1)\n")
    todos = guardados[("conductual p1=0.5 h=4%/mes", 20, False)]
    print(fila("politica", "te_extranamos perdidos", "en_riesgo perdidos", "perdido perdidos"))
    print(fila(*["---"] * 4))
    for pol in ("fifo", "riesgo_primero", "facil_primero"):
        por = defaultdict(lambda: [0, 0])
        for msgs in todos:
            res = simular_cola(msgs, 1, pol, 0, False)
            etapas = [m[2] for m in msgs if 0 <= m[0] < VENTANA]
            for (_d, r), et in zip(res, etapas):
                por[et][1] += 1
                if r is None:
                    por[et][0] += 1
        print(fila(pol, *[fp(por[e][0] / por[e][1]) if por[e][1] else "-"
                          for e in (EXTR, RIESGO, PERDIDO)]))


if __name__ == "__main__":
    main()
