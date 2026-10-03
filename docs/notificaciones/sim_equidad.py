"""Simulacion sintetica: que pasa con cada definicion de «justo» en la Venta cruzada.

Red inventada: 12 comercios en 6 rubros sobre 3x3 km, popularidad (tasa base de canje) muy desigual,
cupos distintos. 400 clientes con afinidades por rubro. 3000 compras en un mes. En cada compra en A
se elige UNA oferta entre los elegibles (otro rubro, <= 2 km, cupo) segun la politica.
Exito = canje. Promedio de 30 semillas. Los numeros dependen de los supuestos: sirven para comparar
politicas entre si, no para predecir la red real.
"""
import math
import random
import statistics

import sys
N_BIZ, N_CONS, SEEDS, EPS = 12, 400, 30, 0.2
N_BUYS = int(sys.argv[1])
CUPOS_CHICOS = sys.argv[2] == "chicos"


def world(rng):
    biz = []
    for i in range(N_BIZ):
        biz.append(
            dict(
                x=rng.uniform(0, 3), y=rng.uniform(0, 3), cat=i % 6,
                # popularidad muy desigual: 3 estrellas, el resto chico
                base=0.30 if i < 3 else rng.uniform(0.04, 0.12),
                cupo=rng.choice([20, 40, 80, 150]) if CUPOS_CHICOS else 10_000,
            )
        )
    cons = []
    for _ in range(N_CONS):
        aff = [rng.lognormvariate(0, 0.7) for _ in range(6)]
        m = sum(aff) / 6
        cons.append(dict(x=rng.uniform(0, 3), y=rng.uniform(0, 3), aff=[a / m for a in aff]))
    return biz, cons


def dist(a, b):
    return math.hypot(a["x"] - b["x"], a["y"] - b["y"])


def run(policy, seed):
    rng = random.Random(seed)
    biz, cons = world(rng)
    rng = random.Random(seed * 7919 + hash(policy) % 1000)
    issued = [0] * N_BIZ
    redeemed = [0] * N_BIZ
    fair = [0.0] * N_BIZ  # parte justa acumulada por oportunidad
    seen = set()  # (cliente, comercio) que ya canjeo: «cliente nuevo» solo la primera vez
    for _ in range(N_BUYS):
        c = rng.randrange(N_CONS)
        cl = cons[c]
        # compra en A: un comercio cercano al cliente
        w = [math.exp(-dist(cl, b)) * b["base"] * 10 for b in biz]
        a = rng.choices(range(N_BIZ), weights=w)[0]
        elig = [
            i for i, b in enumerate(biz)
            if b["cat"] != biz[a]["cat"] and dist(biz[a], b) <= 2 and issued[i] < b["cupo"]
        ]
        if not elig:
            continue
        k = len(elig)
        for i in elig:
            fair[i] += 1 / k
        close = {i: math.exp(-dist(biz[a], biz[i])) for i in elig}
        merit = {i: (1 + redeemed[i]) / (10 + issued[i]) for i in elig}  # achicada a 10 %
        if policy == "A: la mas cercana":
            pick = max(elig, key=lambda i: close[i])
        elif policy == "Gana el mejor (Thompson)":
            pick = max(elig, key=lambda i: rng.betavariate(1 + redeemed[i], 9 + issued[i] - redeemed[i]))
        else:
            wt = {}
            for i in elig:
                behind = min(2, max(0.5, (1 + fair[i]) / (1 + issued[i])))
                if policy == "H1: igual por oportunidad":
                    wt[i] = close[i] * behind
                elif policy == "H2: segun su cupo":
                    share = biz[i]["cupo"] / sum(biz[j]["cupo"] for j in elig)
                    target = fair[i] * share * k
                    wt[i] = close[i] * min(2, max(0.5, (1 + target) / (1 + issued[i])))
                elif policy == "H3: segun sus canjes":
                    wt[i] = close[i] * merit[i]
                elif policy == "H4: H1 + bono al que no tiene clientes nuevos":
                    bonus = 1.5 if redeemed[i] == 0 else 1.0
                    wt[i] = close[i] * behind * bonus
            tot = sum(wt.values())
            p = {i: EPS / k + (1 - EPS) * wt[i] / tot for i in elig}
            pick = rng.choices(elig, weights=[p[i] for i in elig])[0]
        issued[pick] += 1
        b = biz[pick]
        pr = min(0.95, b["base"] * cl["aff"][b["cat"]] * (0.6 + 0.4 * close[pick]))
        if rng.random() < pr:
            redeemed[pick] += 1
            seen.add((c, pick))
    return issued, redeemed


def gini(x):
    m = sum(x) / len(x)
    if m == 0:
        return 0.0
    return sum(abs(a - b) for a in x for b in x) / (2 * len(x) ** 2 * m)


POLICIES = [
    "A: la mas cercana",
    "Gana el mejor (Thompson)",
    "H1: igual por oportunidad",
    "H2: segun su cupo",
    "H3: segun sus canjes",
    "H4: H1 + bono al que no tiene clientes nuevos",
]
print(f"{'politica':48} canjes  gini_envios  gini_canjes  comercios>=3canjes  peor_comercio  estrellas%canjes")
for pol in POLICIES:
    rows = []
    for s in range(SEEDS):
        iss, red = run(pol, s)
        small = red[3:]
        rows.append((
            sum(red), gini(iss), gini(red), sum(1 for r in red if r >= 3),
            min(small), 100 * sum(red[:3]) / max(1, sum(red)),
        ))
    avg = [statistics.mean(r[j] for r in rows) for j in range(6)]
    print(f"{pol:48} {avg[0]:6.0f}  {avg[1]:11.2f}  {avg[2]:11.2f}  {avg[3]:18.1f}  {avg[4]:13.1f}  {avg[5]:15.0f}")
