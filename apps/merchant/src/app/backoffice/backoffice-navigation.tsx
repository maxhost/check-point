"use client";

import Link from "next/link";
import {
  CreditCard,
  Dashboard,
  Gift,
  Group,
  HomeSimple,
  Megaphone,
  MoreHoriz,
  Package,
  Palette,
  QrCode,
  Shop,
  Xmark,
} from "iconoir-react";
import { useSelectedLayoutSegment } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { SignOutButton } from "../components/sign-out-button";

type MenuName = "business" | "loyalty" | "more";

/**
 * `delegado` NO es «el permiso existe» —los siete existen desde la spec 0086— sino **«la
 * PANTALLA ya esta gateada por permiso y no por rol»**. Staff, Locales y Catálogo ya lo están.
 * Las otras siguen con `requireOwner()`, asi que pintarle el link a un integrante con
 * ese permiso lo mandaria a un rebote: un menu que ofrece una puerta cerrada es peor que uno
 * que no la ofrece. Cuando una pantalla mas migre, se marca acá y aparece sola.
 */
const businessLinks = [
  {
    href: "/backoffice/brand",
    label: "Marca",
    icon: Palette,
    segment: "brand",
    permission: "brand",
  },
  {
    href: "/backoffice/locations",
    label: "Locales",
    icon: Shop,
    segment: "locations",
    permission: "locations",
    delegado: true,
  },
  {
    href: "/backoffice/staff",
    label: "Staff",
    icon: Group,
    segment: "staff",
    permission: "staff",
    delegado: true,
  },
  {
    href: "/backoffice/catalog",
    label: "Catálogo",
    icon: Package,
    segment: "catalog",
    permission: "catalog",
    delegado: true,
  },
];

/** Lo que ve un integrante: solo las pantallas delegadas para las que tiene permiso. */
export function delegatedLinks(permissions: string[]) {
  return businessLinks.filter(
    (item) => item.delegado && permissions.includes(item.permission),
  );
}

const loyaltyLinks = [
  {
    href: "/backoffice/loyalty",
    label: "Programa de fidelización",
    icon: Gift,
    segment: "loyalty",
  },
  {
    href: "/backoffice/marketing",
    label: "Campañas",
    icon: Megaphone,
    segment: "marketing",
  },
];

function NavLink({
  href,
  icon: Icon,
  label,
  segment,
  selectedSegment,
  onNavigate,
}: {
  href: string;
  icon: typeof HomeSimple;
  label: string;
  segment: string | null;
  selectedSegment: string | null;
  onNavigate?: () => void;
}) {
  const active = segment === selectedSegment;
  return (
    <Link
      aria-current={active ? "page" : undefined}
      className="backoffice-nav-link"
      data-active={active || undefined}
      href={href}
      onClick={onNavigate}
    >
      <Icon aria-hidden="true" width={21} height={21} strokeWidth={1.8} />
      <span>{label}</span>
    </Link>
  );
}

function SoonLink({
  icon: Icon,
  label,
}: {
  icon: typeof Group;
  label: string;
}) {
  return (
    <div className="backoffice-nav-link is-disabled" aria-disabled="true">
      <Icon aria-hidden="true" width={21} height={21} strokeWidth={1.8} />
      <span>{label}</span>
      <small>Próximamente</small>
    </div>
  );
}

export function BackofficeNavigation({
  businessName,
  isOwner,
  permissions,
}: {
  businessName: string;
  isOwner: boolean;
  permissions: string[];
}) {
  const segment = useSelectedLayoutSegment();
  const delegados = delegatedLinks(permissions);
  const [openMenu, setOpenMenu] = useState<MenuName | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const closeMenu = () => setOpenMenu(null);
  const toggleMenu = (menu: MenuName) =>
    setOpenMenu((current) => (current === menu ? null : menu));

  useEffect(() => {
    if (!openMenu) return;
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenMenu(null);
    };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    closeButtonRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [openMenu]);

  return (
    <>
      <aside className="backoffice-sidebar">
        <div className="backoffice-wordmark">
          <span aria-hidden="true">C</span>
          <div>
            <strong>CheckPass</strong>
            <small title={businessName}>{businessName}</small>
          </div>
        </div>

        {isOwner ? (
          <nav
            aria-label="Navegación principal"
            className="backoffice-desktop-nav"
          >
            <NavLink
              href="/backoffice"
              icon={HomeSimple}
              label="Inicio"
              segment={null}
              selectedSegment={segment}
            />
            <div className="backoffice-nav-group">
              <p>Mi negocio</p>
              {businessLinks.map((item) =>
                item.href ? (
                  <NavLink
                    {...item}
                    href={item.href}
                    key={item.label}
                    selectedSegment={segment}
                  />
                ) : (
                  <SoonLink
                    icon={item.icon}
                    key={item.label}
                    label={item.label}
                  />
                ),
              )}
            </div>
            <div className="backoffice-nav-group">
              <p>Fidelización</p>
              {loyaltyLinks.map((item) => (
                <NavLink {...item} key={item.label} selectedSegment={segment} />
              ))}
            </div>
            <div className="backoffice-nav-group">
              <p>Cuenta</p>
              <NavLink
                href="/backoffice/subscription"
                icon={CreditCard}
                label="Suscripción"
                segment="subscription"
                selectedSegment={segment}
              />
            </div>
          </nav>
        ) : delegados.length > 0 ? (
          <nav
            aria-label="Navegación principal"
            className="backoffice-desktop-nav"
          >
            <div className="backoffice-nav-group">
              <p>Administración</p>
              {delegados.map((item) => (
                <NavLink {...item} key={item.label} selectedSegment={segment} />
              ))}
            </div>
          </nav>
        ) : (
          <p className="staff-nav-note">Espacio de atención</p>
        )}

        <div className="backoffice-sidebar-footer">
          {permissions.includes("counter") && (
            <Link
              aria-current={segment === "counter" ? "page" : undefined}
              className="counter-access"
              href="/backoffice/counter"
            >
              <QrCode aria-hidden="true" width={22} height={22} />
              <span>Abrir mostrador</span>
            </Link>
          )}
          <SignOutButton />
        </div>
      </aside>

      <nav
        aria-label="Navegación principal"
        className="backoffice-mobile-nav"
        data-owner={isOwner || undefined}
      >
        {(isOwner || delegados.length > 0) && (
          <>
            {isOwner && (
              <NavLink
                href="/backoffice"
                icon={HomeSimple}
                label="Inicio"
                segment={null}
                selectedSegment={segment}
                onNavigate={closeMenu}
              />
            )}
            {isOwner ? (
              <button
                aria-controls="backoffice-mobile-menu"
                aria-expanded={openMenu === "business"}
                className="mobile-nav-trigger"
                data-active={
                  businessLinks.some((item) => item.segment === segment) ||
                  undefined
                }
                onClick={() => toggleMenu("business")}
                type="button"
              >
                <Dashboard aria-hidden="true" width={22} height={22} />
                <span>Negocio</span>
              </button>
            ) : (
              delegados.map((item) => (
                <NavLink {...item} key={item.label} selectedSegment={segment} />
              ))
            )}
          </>
        )}
        {permissions.includes("counter") && (
          <Link
            aria-current={segment === "counter" ? "page" : undefined}
            className="mobile-counter-access"
            href="/backoffice/counter"
            onClick={closeMenu}
          >
            <span>
              <QrCode aria-hidden="true" width={24} height={24} />
            </span>
            Mostrador
          </Link>
        )}
        {isOwner && (
          <>
            <button
              aria-controls="backoffice-mobile-menu"
              aria-expanded={openMenu === "loyalty"}
              className="mobile-nav-trigger"
              data-active={
                loyaltyLinks.some((item) => item.segment === segment) ||
                undefined
              }
              onClick={() => toggleMenu("loyalty")}
              type="button"
            >
              <Gift aria-hidden="true" width={22} height={22} />
              <span>Fidelización</span>
            </button>
            <button
              aria-controls="backoffice-mobile-menu"
              aria-expanded={openMenu === "more"}
              className="mobile-nav-trigger"
              data-active={segment === "subscription" || undefined}
              onClick={() => toggleMenu("more")}
              type="button"
            >
              <MoreHoriz aria-hidden="true" width={22} height={22} />
              <span>Más</span>
            </button>
          </>
        )}
      </nav>

      {openMenu && isOwner && (
        <div className="mobile-menu-layer">
          <button
            aria-label="Cerrar menú"
            className="mobile-menu-scrim"
            onClick={closeMenu}
            type="button"
          />
          <section
            aria-label="Menú"
            aria-modal="true"
            className="mobile-menu-sheet"
            id="backoffice-mobile-menu"
            role="dialog"
          >
            <header>
              <div>
                <p>
                  {openMenu === "business"
                    ? "Mi negocio"
                    : openMenu === "loyalty"
                      ? "Fidelización"
                      : "Cuenta"}
                </p>
                <small>{businessName}</small>
              </div>
              <button
                aria-label="Cerrar menú"
                onClick={closeMenu}
                ref={closeButtonRef}
                type="button"
              >
                <Xmark aria-hidden="true" width={24} height={24} />
              </button>
            </header>
            <div className="mobile-menu-links">
              {openMenu === "business" &&
                businessLinks.map((item) =>
                  item.href ? (
                    <NavLink
                      {...item}
                      href={item.href}
                      key={item.label}
                      onNavigate={closeMenu}
                      selectedSegment={segment}
                    />
                  ) : (
                    <SoonLink
                      icon={item.icon}
                      key={item.label}
                      label={item.label}
                    />
                  ),
                )}
              {openMenu === "loyalty" &&
                loyaltyLinks.map((item) => (
                  <NavLink
                    {...item}
                    key={item.label}
                    onNavigate={closeMenu}
                    selectedSegment={segment}
                  />
                ))}
              {openMenu === "more" && (
                <>
                  <NavLink
                    href="/backoffice/subscription"
                    icon={CreditCard}
                    label="Suscripción"
                    segment="subscription"
                    selectedSegment={segment}
                    onNavigate={closeMenu}
                  />
                  <SignOutButton />
                </>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
