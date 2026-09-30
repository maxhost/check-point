"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { mockBusinesses, type ExploreBusiness } from "./mock-businesses";

const categories = [
  "Todos",
  "Cafés",
  "Restaurantes",
  "Tiendas",
  "Bienestar",
] as const;
const previewCount = 4;

function minutesInCuenca(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Guayaquil",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(
    parts.find((part) => part.type === "minute")?.value ?? 0,
  );
  return hour * 60 + minute;
}

function isOpen(business: ExploreBusiness, now: number): boolean {
  const [openHour, openMinute] = business.hours.opens.split(":").map(Number);
  const [closeHour, closeMinute] = business.hours.closes.split(":").map(Number);
  return (
    now >= openHour * 60 + openMinute && now < closeHour * 60 + closeMinute
  );
}

export function Explorer() {
  const [category, setCategory] =
    useState<(typeof categories)[number]>("Todos");
  const [query, setQuery] = useState("");
  const [openOnly, setOpenOnly] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const update = () => setNow(minutesInCuenca(new Date()));
    update();
    const timer = window.setInterval(update, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const visible = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("es-EC");
    return mockBusinesses.filter(
      (business) =>
        (category === "Todos" || business.category === category) &&
        (!openOnly || (now !== null && isOpen(business, now))) &&
        (!term ||
          [
            business.name,
            business.category,
            business.area,
            business.description,
          ]
            .join(" ")
            .toLocaleLowerCase("es-EC")
            .includes(term)),
    );
  }, [category, query, openOnly, now]);
  const hasFilters = category !== "Todos" || query.trim() !== "" || openOnly;
  const displayed =
    hasFilters || showAll ? visible : visible.slice(0, previewCount);

  return (
    <div className="explore-tool">
      <div className="explore-controls">
        <label className="explore-search">
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
            <circle
              cx="10.8"
              cy="10.8"
              r="6.3"
              stroke="currentColor"
              strokeWidth="1.8"
            />
            <path
              d="m15.5 15.5 5 5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
          <span className="sr-only">Buscar lugares de ejemplo</span>
          <input
            type="search"
            placeholder="Busca un lugar, categoría o barrio"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <div
          className="explore-location"
          aria-label="Ciudad de exploración: Cuenca, Ecuador"
        >
          <span aria-hidden="true">⌖</span> Cuenca, Ecuador
        </div>
      </div>

      <div className="explore-filter-row">
        <div className="explore-categories" aria-label="Filtrar por categoría">
          {categories.map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={category === item}
              onClick={() => setCategory(item)}
            >
              {item}
            </button>
          ))}
        </div>
        <label className="explore-open-filter">
          <input
            type="checkbox"
            checked={openOnly}
            onChange={(event) => setOpenOnly(event.target.checked)}
            disabled={now === null}
          />
          Abierto ahora
        </label>
      </div>

      <p className="explore-count" aria-live="polite">
        {displayed.length === visible.length
          ? visible.length === 1
            ? "1 lugar de ejemplo"
            : `${visible.length} lugares de ejemplo`
          : `${displayed.length} de ${visible.length} lugares de ejemplo`}
      </p>

      {visible.length ? (
        <>
          <div className="explore-grid">
            {displayed.map((business) => (
              <article className="explore-card" key={business.id}>
                <Link
                  className="explore-card-link"
                  href={`/lugares/${business.id}`}
                  prefetch={false}
                  aria-label={`Ver ficha de ejemplo de ${business.name}`}
                >
                  <div className="explore-card-image">
                    <Image
                      src={business.image}
                      alt={business.imageAlt}
                      width={1000}
                      height={667}
                      sizes="(max-width: 359px) 90vw, (max-width: 760px) 45vw, (max-width: 1100px) 30vw, 22vw"
                      style={{ objectPosition: business.imagePosition }}
                    />
                    <span className="explore-card-demo">EJEMPLO</span>
                  </div>
                  <div className="explore-card-copy">
                    <div className="explore-card-meta">
                      <span>{business.category}</span>
                    </div>
                    <h3>{business.name}</h3>
                    <p className="explore-card-area">{business.area}</p>
                    <div className="explore-card-hours">
                      <span
                        className={
                          now !== null && isOpen(business, now) ? "is-open" : ""
                        }
                      >
                        {now === null
                          ? "Horario de ejemplo"
                          : isOpen(business, now)
                            ? "Abierto ahora"
                            : "Cerrado ahora"}
                      </span>
                      <span>
                        {business.hours.opens}–{business.hours.closes}
                      </span>
                    </div>
                    <div className="explore-card-benefit">
                      <span aria-hidden="true">✳</span>
                      <span>{business.benefit}</span>
                    </div>
                  </div>
                </Link>
              </article>
            ))}
          </div>
          {!hasFilters && visible.length > previewCount && (
            <div className="explore-more">
              <button
                type="button"
                aria-expanded={showAll}
                onClick={() => setShowAll((current) => !current)}
              >
                {showAll ? "Mostrar menos" : "Ver todas las opciones"}
                <span aria-hidden="true">{showAll ? "↑" : "→"}</span>
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="explore-empty">
          <strong>No encontramos ejemplos con esos filtros.</strong>
          <p>Prueba otra búsqueda o vuelve a ver todos los lugares.</p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setCategory("Todos");
              setOpenOnly(false);
            }}
          >
            Ver todos
          </button>
        </div>
      )}
    </div>
  );
}
