"use client";

import { useEffect, useState } from "react";
import { ModuleHeader, Skeleton } from "../../components/ui";
import { Alert } from "../../../ui";
import {
  COUNTRIES,
  composeE164,
  countryByIso,
  flagEmoji,
} from "@mi-pasaporte/domain/lib/countries";

type Customer = {
  name: string;
  enrolledAt: string;
  lastVisitAt: string | null;
  balance: { kind: "points" | "stamps"; value: number } | null;
};
type CustomerList = {
  items: Customer[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};
type Filter = { kind: "all" } | { kind: "name" | "phone"; value: string };
type ApiFailure = {
  error?: string;
  code?: string;
  fields?: { q?: string; phone?: string };
};

const dateFormat = new Intl.DateTimeFormat("es", {
  day: "numeric",
  month: "short",
  year: "numeric",
});
function dateLabel(value: string | null) {
  return value ? dateFormat.format(new Date(value)) : "Nunca";
}

export function CustomersPage({
  defaultCountryIso,
}: {
  defaultCountryIso: string;
}) {
  const [mode, setMode] = useState<"name" | "phone">("name");
  const [name, setName] = useState("");
  const [localPhone, setLocalPhone] = useState("");
  const [countryIso, setCountryIso] = useState(
    countryByIso(defaultCountryIso) ? defaultCountryIso : "EC",
  );
  const [filter, setFilter] = useState<Filter>({ kind: "all" });
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<CustomerList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const nameLength = Array.from(name.trim()).length;
  const nameInvalid =
    mode === "name" && nameLength > 0 && (nameLength < 3 || nameLength > 60);

  useEffect(() => {
    if (mode !== "name") return;
    const trimmed = name.trim();
    const length = Array.from(trimmed).length;
    if (length > 0 && length < 3) {
      setFieldError("Escribe al menos 3 caracteres para buscar por nombre.");
      return;
    }
    if (length > 60) {
      setFieldError("Usa como máximo 60 caracteres.");
      return;
    }
    setFieldError(null);
    const timeout = window.setTimeout(() => {
      setPage(1);
      setFilter((current) => {
        if (!trimmed && current.kind === "all") return current;
        if (current.kind === "name" && current.value === trimmed)
          return current;
        return trimmed ? { kind: "name", value: trimmed } : { kind: "all" };
      });
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [mode, name]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ page: String(page) });
    if (filter.kind === "name") params.set("q", filter.value);
    if (filter.kind === "phone") params.set("phone", filter.value);
    setLoading(true);
    setError(null);
    fetch(`/api/customers?${params.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        const body = (await response.json()) as CustomerList & ApiFailure;
        if (!response.ok) throw body;
        return body;
      })
      .then((body) => {
        if (page > Math.max(1, body.totalPages)) {
          setPage(Math.max(1, body.totalPages));
          return;
        }
        setResult(body);
        setLoading(false);
      })
      .catch((reason: ApiFailure & { name?: string }) => {
        if (controller.signal.aborted) return;
        setError(
          reason.fields?.q ??
            reason.fields?.phone ??
            reason.error ??
            "No pudimos cargar los clientes.",
        );
        setLoading(false);
      });
    return () => controller.abort();
  }, [filter, page, retry]);

  function changeMode(next: "name" | "phone") {
    setMode(next);
    setFieldError(null);
    setPage(1);
    setFilter({ kind: "all" });
  }

  function searchPhone(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!localPhone.trim()) {
      setFieldError("Escribe un teléfono para buscar.");
      return;
    }
    const phone = composeE164(countryByIso(countryIso)?.dial ?? "", localPhone);
    if (!/^\+[1-9]\d{1,14}$/.test(phone)) {
      setFieldError("Ingresa un teléfono válido con código de país.");
      return;
    }
    setFieldError(null);
    setPage(1);
    setFilter({ kind: "phone", value: phone });
  }

  return (
    <main className="merchant-shell">
      <div className="brand-page customers-page">
        <ModuleHeader
          eyebrow="Fidelización"
          title="Clientes"
          description="Personas inscritas en los programas de fidelización de tu negocio."
          closeHref="/backoffice"
        />

        <section className="customers-search" aria-label="Buscar clientes">
          <div
            className="customers-search-tabs"
            role="group"
            aria-label="Buscar por"
          >
            <button
              type="button"
              aria-pressed={mode === "name"}
              onClick={() => changeMode("name")}
            >
              Nombre
            </button>
            <button
              type="button"
              aria-pressed={mode === "phone"}
              onClick={() => changeMode("phone")}
            >
              Teléfono
            </button>
          </div>
          {mode === "name" ? (
            <div className="customers-name-search">
              <label htmlFor="customer-name">Nombre del cliente</label>
              <input
                id="customer-name"
                type="search"
                value={name}
                maxLength={61}
                autoComplete="off"
                placeholder="Buscar por nombre o apellido"
                onChange={(event) => setName(event.target.value)}
                aria-describedby={
                  fieldError ? "customer-field-error" : undefined
                }
              />
              <p>
                Escribe al menos 3 caracteres. La búsqueda se actualiza
                automáticamente.
              </p>
            </div>
          ) : (
            <form onSubmit={searchPhone} className="customers-phone-search">
              <label htmlFor="customer-country">País</label>
              <select
                id="customer-country"
                value={countryIso}
                onChange={(event) => setCountryIso(event.target.value)}
              >
                {COUNTRIES.map((country) => (
                  <option key={country.iso2} value={country.iso2}>
                    {flagEmoji(country.iso2)} {country.name} (+{country.dial})
                  </option>
                ))}
              </select>
              <label htmlFor="customer-phone">Teléfono</label>
              <div className="customers-phone-line">
                <input
                  id="customer-phone"
                  type="tel"
                  inputMode="tel"
                  value={localPhone}
                  placeholder="Número del cliente"
                  onChange={(event) => setLocalPhone(event.target.value)}
                  aria-describedby={
                    fieldError ? "customer-field-error" : undefined
                  }
                />
                <button type="submit">Buscar</button>
              </div>
            </form>
          )}
          {fieldError && (
            <p
              className="customers-field-error"
              id="customer-field-error"
              role="status"
            >
              {fieldError}
            </p>
          )}
        </section>

        {error ? (
          <Alert kind="error" title={error}>
            <button
              type="button"
              className="customers-retry"
              onClick={() => setRetry((value) => value + 1)}
            >
              Reintentar
            </button>
          </Alert>
        ) : null}
        <section
          className="customers-list"
          aria-label="Listado de clientes"
          aria-busy={loading && !nameInvalid}
        >
          <header className="customers-list-header">
            <div>
              <h2>Listado de clientes</h2>
              <p>
                {nameInvalid
                  ? "Completa la búsqueda"
                  : result
                    ? `${result.total} ${result.total === 1 ? "cliente" : "clientes"}`
                    : "Cargando clientes…"}
              </p>
            </div>
          </header>
          {nameInvalid ? (
            <div className="customers-empty">
              <p>Escribe entre 3 y 60 caracteres para ver resultados.</p>
            </div>
          ) : null}
          {loading && !nameInvalid ? (
            <div
              className="customers-loading"
              role="status"
              aria-label="Cargando clientes"
            >
              <Skeleton height={66} />
              <Skeleton height={66} />
              <Skeleton height={66} />
            </div>
          ) : null}
          {!loading && !error && !nameInvalid && result?.items.length === 0 ? (
            <div className="customers-empty">
              <h3>Sin resultados</h3>
              <p>
                {filter.kind === "all"
                  ? "Todavía no hay clientes inscritos en los programas de fidelización."
                  : "Prueba con otra búsqueda."}
              </p>
            </div>
          ) : null}
          {!loading &&
          !error &&
          !nameInvalid &&
          result &&
          result.items.length > 0 ? (
            <>
              <div className="customers-table-wrap">
                <table className="customers-table">
                  <thead>
                    <tr>
                      <th scope="col">Cliente</th>
                      <th scope="col">Primera alta</th>
                      <th scope="col">Última visita</th>
                      <th scope="col">Saldo actual</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.items.map((customer, index) => (
                      <tr key={index}>
                        <th scope="row">{customer.name}</th>
                        <td>{dateLabel(customer.enrolledAt)}</td>
                        <td>{dateLabel(customer.lastVisitAt)}</td>
                        <td>
                          {customer.balance
                            ? `${customer.balance.value.toLocaleString("es")} ${customer.balance.kind === "points" ? "puntos" : "sellos"}`
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {result.totalPages > 1 && (
                <nav
                  className="customers-pagination"
                  aria-label="Páginas de clientes"
                >
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((value) => value - 1)}
                  >
                    Anterior
                  </button>
                  <span>
                    Página {page} de {result.totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={page >= result.totalPages}
                    onClick={() => setPage((value) => value + 1)}
                  >
                    Siguiente
                  </button>
                </nav>
              )}
            </>
          ) : null}
        </section>
      </div>
    </main>
  );
}
