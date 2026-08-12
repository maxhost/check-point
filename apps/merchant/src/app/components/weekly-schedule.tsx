"use client";

export type TimeRange = { start: string; end: string };
export type WeeklySchedule = Record<string, TimeRange[]>;

const weekdays = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
] as const;

const defaultRange = (): TimeRange => ({ start: "15:00", end: "17:00" });

export function validateWeeklySchedule(schedule: WeeklySchedule) {
  const ranges = Object.values(schedule).flat();
  if (ranges.length === 0) {
    return "Selecciona al menos un día y una franja horaria.";
  }

  for (const [day, dayRanges] of Object.entries(schedule)) {
    const sorted = [...dayRanges].sort((a, b) =>
      a.start.localeCompare(b.start),
    );
    for (let index = 0; index < sorted.length; index += 1) {
      const current = sorted[index];
      if (!current.start || !current.end || current.start >= current.end) {
        return `Revisa el horario de ${day}: la hora de inicio debe ser anterior al fin.`;
      }
      if (index > 0 && sorted[index - 1].end > current.start) {
        return `Las franjas de ${day} no pueden superponerse.`;
      }
    }
  }

  return null;
}

export function WeeklySchedulePicker({
  value,
  onChange,
  error,
  timezone = "America/Guayaquil",
}: {
  value: WeeklySchedule;
  onChange: (next: WeeklySchedule) => void;
  error?: string | null;
  timezone?: string;
}) {
  const setDayActive = (day: string, active: boolean) => {
    const next = { ...value };
    if (active) next[day] = value[day]?.length ? value[day] : [defaultRange()];
    else delete next[day];
    onChange(next);
  };

  const updateRange = (
    day: string,
    index: number,
    field: keyof TimeRange,
    nextValue: string,
  ) => {
    onChange({
      ...value,
      [day]: value[day].map((range, rangeIndex) =>
        rangeIndex === index ? { ...range, [field]: nextValue } : range,
      ),
    });
  };

  const addRange = (day: string) =>
    onChange({ ...value, [day]: [...value[day], defaultRange()] });

  const removeRange = (day: string, index: number) => {
    const nextRanges = value[day].filter(
      (_, rangeIndex) => rangeIndex !== index,
    );
    if (nextRanges.length === 0) {
      setDayActive(day, false);
      return;
    }
    onChange({ ...value, [day]: nextRanges });
  };

  return (
    <fieldset className="weekly-schedule" aria-describedby="schedule-help">
      <legend>Horarios de la campaña</legend>
      <p id="schedule-help" className="field-help">
        Elige los días y franjas en los que se puede ejecutar. Zona horaria:{" "}
        {timezone}.
      </p>
      <div className="weekday-list">
        {weekdays.map((day) => {
          const ranges = value[day] ?? [];
          const active = ranges.length > 0;
          return (
            <div className="weekday-row" key={day}>
              <label className="weekday-toggle">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(event) => setDayActive(day, event.target.checked)}
                />
                <span>{day}</span>
              </label>
              {active && (
                <div className="time-ranges">
                  {ranges.map((range, index) => (
                    <div className="time-range" key={`${day}-${index}`}>
                      <label>
                        <span className="sr-only">
                          Inicio del horario de {day}
                        </span>
                        <input
                          type="time"
                          value={range.start}
                          onChange={(event) =>
                            updateRange(day, index, "start", event.target.value)
                          }
                        />
                      </label>
                      <span aria-hidden="true">a</span>
                      <label>
                        <span className="sr-only">
                          Fin del horario de {day}
                        </span>
                        <input
                          type="time"
                          value={range.end}
                          onChange={(event) =>
                            updateRange(day, index, "end", event.target.value)
                          }
                        />
                      </label>
                      <button
                        className="text-button"
                        type="button"
                        onClick={() => removeRange(day, index)}
                      >
                        Quitar
                      </button>
                    </div>
                  ))}
                  <button
                    className="text-button add-range"
                    type="button"
                    onClick={() => addRange(day)}
                  >
                    + Añadir franja
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}
