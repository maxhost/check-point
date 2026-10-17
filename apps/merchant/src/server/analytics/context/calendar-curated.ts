/** Curated sources checked 2026-10-17. Dates without an official source are never inferred. */
export const CALENDAR_SOURCES = {
  law: "https://www.asambleanacional.gob.ec/es/noticia/47479-en-vigencia-ley-que-regula-los-feriados-se-aplicara",
  national:
    "https://www.turismo.gob.ec/wp-content/uploads/2022/12/CALENDARIO-FERIADOS-2023-2025-06-12-2022-.pdf",
  decimos:
    "https://www.trabajo.gob.ec/29-cual-es-el-plazo-y-como-se-debe-realizar-la-solicitud-para-la-acumulacion-del-pago-de-la-decima-tercera-y-decima-cuarta-remuneracion/",
  quincena:
    "https://www.trabajo.gob.ec/wp-content/uploads/2024/01/CODIGO_DEL_TRABAJO-CT.pdf",
  cuenca: "https://www.cuenca.gob.ec/node/118",
  quito:
    "https://www.quitoinforma.gob.ec/2024/12/06/quito-renace-con-unidad-obras-y-desarrollo-economico-resalta-alcalde-pabel-munoz-en-la-sesion-solemne-por-los-490-anos-de-fundacion/",
  guayaquil:
    "https://www.guayaquil.gob.ec/miles-guayaquilenos-unieron-sesion-conmemorativa-fundacion-ciudad/",
  schoolSierra2026:
    "https://educacion.gob.ec/wp-content/uploads/downloads/2026/08/cronograma-sierra-amazonia-2026-2027.pdf",
  schoolSierra:
    "https://educacion.gob.ec/wp-content/uploads/downloads/2025/08/cronograma-sierra-amazonia-2025-2026.pdf",
  schoolCosta2026:
    "https://educacion.gob.ec/wp-content/uploads/downloads/2026/04/Cronograma-escolar-Costa-Galapagos-2026-2027.pdf",
  schoolCosta:
    "https://educacion.gob.ec/wp-content/uploads/downloads/2025/04/Volvemos-al-aula.pdf",
  january2026:
    "https://esacc.corteconstitucional.gob.ec/storage/api/v1/10_DWL_FL/eyJjYXJwZXRhIjoicm8iLCJ1dWlkIjoiYjk5ZGQ3ODUtNWNkYS00YmIzLTg5Y2MtMmNhMmU0MGM4YjIxLnBkZiJ9",
};
export const LOCAL_HOLIDAYS = [
  {
    monthDay: "04-12",
    region: "Azuay",
    city: "Cuenca",
    name: "Fundación de Cuenca",
    sourceUrl: CALENDAR_SOURCES.cuenca,
  },
  {
    monthDay: "07-25",
    region: "Guayas",
    city: "Guayaquil",
    name: "Fundación de Guayaquil",
    sourceUrl: CALENDAR_SOURCES.guayaquil,
  },
  {
    monthDay: "12-06",
    region: "Pichincha",
    city: "Quito",
    name: "Fundación de Quito",
    sourceUrl: CALENDAR_SOURCES.quito,
  },
];
// The ministry issues school dates per academic year; there is no recurring date rule.
export const SCHOOL_STARTS = [
  {
    day: "2026-09-01",
    zones: ["sierra", "amazonia"],
    sourceUrl: CALENDAR_SOURCES.schoolSierra2026,
  },
  {
    day: "2026-05-04",
    zones: ["costa", "galapagos"],
    sourceUrl: CALENDAR_SOURCES.schoolCosta2026,
  },
  {
    day: "2025-09-01",
    zones: ["sierra", "amazonia"],
    sourceUrl: CALENDAR_SOURCES.schoolSierra,
  },
  {
    day: "2025-05-05",
    zones: ["costa", "galapagos"],
    sourceUrl: CALENDAR_SOURCES.schoolCosta,
  },
];
