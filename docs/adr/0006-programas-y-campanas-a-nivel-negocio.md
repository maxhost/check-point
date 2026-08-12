---
fecha: 2026-08-10
resumen: El programa de fidelización pertenece al negocio y se hereda en locales; las campañas pertenecen al negocio, se asignan a N locales y un evento es un tipo de campaña.
---

# ADR 0006 — Programas y campañas a nivel negocio

## Contexto

Una cadena necesita administrar reglas y campañas sin reconstruirlas para cada sucursal. Al mismo tiempo, una promoción puede aplicar solo a algunos locales. Un evento no es una entidad aislada: reúne objetivo, vigencia, audiencia, beneficios, juego y distribución.

## Decisión

- El programa de fidelización permanente se configura a nivel de negocio. Todos sus
  locales lo heredan en V1. ADR 0020 define que puede no existir o haber exactamente un
  programa activo, su modalidad y versiones.
- Una campaña se crea a nivel de negocio y se asigna a uno, varios o todos sus locales.
- Un evento es un tipo de campaña, no una entidad independiente. Puede contener reserva, reglas de puntos, cupones, juego y distribución como componentes de la misma campaña.
- La aparición ordinaria del negocio en categorías incluidas es parte de la suscripción. Una ubicación destacada, resaltada o dentro de una ruta es un componente de distribución de campaña potencialmente pagado; precio, inventario, duración, cobro y publicación se definirán en una spec posterior de monetización/distribución.
- La plataforma conserva capacidad de moderar, ocultar o suspender contenido público; no significa aprobación manual de cada campaña ordinaria.

## Consecuencias

- El modelo debe distinguir `business_id` propietario de campaña y conjunto de `location_id` donde se activa.
- Una campaña "Aniversario" puede contener objetivos secundarios y varias reglas, pero conserva un objetivo principal para medición.
- No se implementa cobro ni promoción destacada en V1 hasta cerrar sus reglas comerciales.
