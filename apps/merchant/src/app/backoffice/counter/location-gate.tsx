import type { CounterLocation } from "./types";

/** Location gate shown before scanning when the business has >1 location. */
export function LocationGate({
  locations,
  onPick,
}: {
  locations: CounterLocation[];
  onPick: (id: string) => void;
}) {
  return (
    <section className="counter-panel">
      <h2>¿En qué local estás?</h2>
      <p className="counter-hint">
        Elige el local para registrar las ventas ahí.
      </p>
      <div className="counter-locations">
        {locations.map((loc) => (
          <button key={loc.id} type="button" onClick={() => onPick(loc.id)}>
            {loc.name}
          </button>
        ))}
      </div>
    </section>
  );
}
