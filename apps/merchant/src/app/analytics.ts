export type AnalyticsSector = "bar_restaurant" | "hotel" | "retail";
export type DataQuality =
  | "observed"
  | "configured_estimate"
  | "transactional"
  | "unavailable";
export type Metric = {
  label: string;
  value: string;
  detail: string;
  quality: DataQuality;
};
export type AnalyticsFixture = {
  label: string;
  kpis: Metric[];
  trend: { label: string; value: number }[];
  funnel: { label: string; value: number }[];
  heatmap: { day: string; slots: { label: string; value: number }[] }[];
  lens: { title: string; description: string; metrics: Metric[] };
};

export const qualityLabel: Record<DataQuality, string> = {
  observed: "Dato observado",
  configured_estimate: "Estimación configurada",
  transactional: "Dato transaccional",
  unavailable: "No disponible",
};

const heatmap = (rows: number[][]) =>
  ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((day, index) => ({
    day,
    slots: ["Mañana", "Tarde", "Noche"].map((label, slot) => ({
      label,
      value: rows[index][slot],
    })),
  }));

export const analyticsFixtures: Record<AnalyticsSector, AnalyticsFixture> = {
  bar_restaurant: {
    label: "Bar / Restaurante",
    kpis: [
      {
        label: "Visitas validadas",
        value: "248",
        detail: "+18% vs. periodo anterior",
        quality: "observed",
      },
      {
        label: "Clientes únicos",
        value: "182",
        detail: "64 nuevos clientes",
        quality: "observed",
      },
      {
        label: "Retorno a 30 días",
        value: "31%",
        detail: "56 personas volvieron",
        quality: "observed",
      },
      {
        label: "Canjes",
        value: "38",
        detail: "15% de beneficios emitidos",
        quality: "observed",
      },
    ],
    trend: ["L", "M", "X", "J", "V", "S", "D"].map((label, index) => ({
      label,
      value: [18, 23, 31, 27, 44, 59, 46][index],
    })),
    funnel: [
      { label: "Elegibles", value: 320 },
      { label: "Visitas válidas", value: 248 },
      { label: "Beneficios emitidos", value: 248 },
      { label: "Canjes", value: 38 },
    ],
    heatmap: heatmap([
      [8, 14, 24],
      [7, 17, 31],
      [9, 18, 42],
      [8, 16, 39],
      [10, 28, 82],
      [12, 35, 100],
      [11, 22, 67],
    ]),
    lens: {
      title: "Demanda por franja",
      description:
        "Sábados 19:00–22:00 concentra la mayor actividad. Usa este dato para programar campañas de demanda.",
      metrics: [
        {
          label: "Franja más activa",
          value: "Sáb · 19–22 h",
          detail: "100 visitas",
          quality: "observed",
        },
        {
          label: "Check-ins rechazados",
          value: "6",
          detail: "4 fuera de horario · 2 repetidos",
          quality: "observed",
        },
      ],
    },
  },
  hotel: {
    label: "Hotel",
    kpis: [
      {
        label: "Estadías iniciadas",
        value: "96",
        detail: "+12% vs. periodo anterior",
        quality: "observed",
      },
      {
        label: "Huéspedes únicos",
        value: "81",
        detail: "29 nuevos huéspedes",
        quality: "observed",
      },
      {
        label: "Huéspedes recurrentes",
        value: "22%",
        detail: "18 personas regresaron",
        quality: "observed",
      },
      {
        label: "Canjes de servicios",
        value: "14",
        detail: "Beneficios utilizados",
        quality: "observed",
      },
    ],
    trend: ["L", "M", "X", "J", "V", "S", "D"].map((label, index) => ({
      label,
      value: [11, 14, 12, 15, 17, 16, 11][index],
    })),
    funnel: [
      { label: "Elegibles", value: 124 },
      { label: "Estadías validadas", value: 96 },
      { label: "Beneficios emitidos", value: 70 },
      { label: "Canjes", value: 14 },
    ],
    heatmap: heatmap([
      [32, 18, 9],
      [40, 19, 10],
      [36, 21, 11],
      [48, 24, 14],
      [78, 35, 19],
      [65, 28, 17],
      [44, 22, 12],
    ]),
    lens: {
      title: "Estadías y servicios",
      description:
        "El lente hotelero mide actividad acreditada; no muestra ocupación sin inventario de habitaciones conectado.",
      metrics: [
        {
          label: "Servicio más usado",
          value: "Desayuno",
          detail: "9 canjes",
          quality: "observed",
        },
        {
          label: "Ocupación",
          value: "No disponible",
          detail: "Conecta inventario para medirla",
          quality: "unavailable",
        },
      ],
    },
  },
  retail: {
    label: "Retail",
    kpis: [
      {
        label: "Compras acreditadas",
        value: "143",
        detail: "+9% vs. periodo anterior",
        quality: "transactional",
      },
      {
        label: "Clientes únicos",
        value: "119",
        detail: "41 nuevos clientes",
        quality: "observed",
      },
      {
        label: "Recompra a 30 días",
        value: "27%",
        detail: "32 personas volvieron",
        quality: "observed",
      },
      {
        label: "Canjes",
        value: "21",
        detail: "Descuentos usados",
        quality: "observed",
      },
    ],
    trend: ["L", "M", "X", "J", "V", "S", "D"].map((label, index) => ({
      label,
      value: [14, 19, 17, 23, 26, 25, 19][index],
    })),
    funnel: [
      { label: "Elegibles", value: 190 },
      { label: "Compras acreditadas", value: 143 },
      { label: "Beneficios emitidos", value: 95 },
      { label: "Canjes", value: 21 },
    ],
    heatmap: heatmap([
      [14, 28, 9],
      [16, 34, 11],
      [15, 30, 10],
      [18, 47, 14],
      [22, 69, 18],
      [19, 76, 15],
      [16, 51, 12],
    ]),
    lens: {
      title: "Compra y categoría",
      description:
        "Retail tiene ventas acreditadas en este fixture; por eso puede mostrar señales transaccionales, no ROI causal.",
      metrics: [
        {
          label: "Venta acreditada",
          value: "USD 2.860",
          detail: "143 compras · dato transaccional",
          quality: "transactional",
        },
        {
          label: "Categoría destacada",
          value: "Accesorios",
          detail: "38 compras acreditadas",
          quality: "transactional",
        },
      ],
    },
  },
};

export function isValidFixture(fixture: AnalyticsFixture) {
  return fixture.funnel.every(
    (step, index) =>
      index === 0 || step.value <= fixture.funnel[index - 1].value,
  );
}
