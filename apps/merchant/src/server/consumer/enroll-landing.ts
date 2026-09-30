import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@mi-pasaporte/db";
import { businesses, loyaltyPrograms } from "@mi-pasaporte/db/schema";
import type { CouponKind } from "../marketing/reward-input";
import type { WelcomeRedeemFrom } from "../marketing/templates";
import { capAllows, localMonthStart } from "../marketing/welcome-rules";
import {
  countMonthGifts,
  loadWelcomeCampaign,
} from "../marketing/welcome-store";
import { pgErrorCode } from "./core";

export type EnrollLanding = {
  programId: string;
  /** Public business id — used to build the public logo URL. */
  businessId: string;
  businessName: string;
  /** Business country (ISO-2) — the form's default selection. May be null/empty. */
  countryCode: string | null;
  brandPrimaryColor: string;
  brandComplementaryColor: string;
  brandAccentColor: string;
  logoVersion: number;
  /** Whether the business has a published logo. Derived from `logoObjectKey`;
   * the internal R2 key is NEVER serialized to the client. */
  hasLogo: boolean;
  /** Spec 0107: the welcome gift to announce, or `null` (nothing to show). */
  welcomeOffer: WelcomeOffer | null;
};

/**
 * THE OFFER OF «BIENVENIDA» ON THE ENROLL PAGE (spec 0107 §6 / ADR 0099 §5 — the ONLY place
 * it is announced). `null` when the business has no ELIGIBLE welcome campaign (the same
 * read the issuer uses, `welcome-store.ts`) or the month's cap is already reached — the page
 * must not promise a gift the issuer would refuse. Never the cost, the cap or an id.
 */
export type WelcomeOffer = {
  message: string;
  label: string;
  kind: CouponKind;
  rule: string | null;
  validDays: number;
  redeemFrom: WelcomeRedeemFrom;
};

async function welcomeOfferFor(
  businessId: string,
  now: Date,
): Promise<WelcomeOffer | null> {
  const campaign = await loadWelcomeCampaign(getDb(), businessId, now);
  if (!campaign) return null;
  const given = await countMonthGifts(
    getDb(),
    businessId,
    localMonthStart(now, campaign.timeZone),
  );
  if (!capAllows(given, campaign.monthlyCap)) return null;
  return {
    message: campaign.message,
    label: campaign.couponLabel,
    kind: campaign.reward.kind ?? "free_product",
    rule: campaign.reward.rule,
    validDays: campaign.validDays,
    redeemFrom: campaign.redeemFrom,
  };
}

/** Public landing info for a program that admits enrollment, or null (unavailable). */
export async function getEnrollLanding(
  programId: string,
  now: Date = new Date(),
): Promise<EnrollLanding | null> {
  try {
    const [row] = await getDb()
      .select({
        programId: loyaltyPrograms.id,
        businessId: businesses.id,
        businessName: businesses.name,
        countryCode: businesses.countryCode,
        brandPrimaryColor: businesses.brandPrimaryColor,
        brandComplementaryColor: businesses.brandComplementaryColor,
        brandAccentColor: businesses.brandAccentColor,
        logoVersion: businesses.logoVersion,
        // Selected only to derive `hasLogo`; the internal R2 key is stripped below
        // and never leaves the server (anti-leak rule, CLAUDE.md).
        logoObjectKey: businesses.logoObjectKey,
      })
      .from(loyaltyPrograms)
      .innerJoin(businesses, eq(businesses.id, loyaltyPrograms.businessId))
      .where(
        and(
          eq(loyaltyPrograms.id, programId),
          inArray(loyaltyPrograms.status, ["active", "closing"]),
          // EL EJE `status` DEL NEGOCIO EN LA LANDING (spec 0072, decisión del owner del
          // 2026-09-17: «si la persona llegara a escanear el QR para sumarse al programa, la
          // landing diría "Este Programa ya no está disponible"»).
          //
          // Va acá y no en la pantalla porque **es una propiedad de API**: `getEnrollLanding`
          // vive en el servidor y la página sólo renderiza lo que esta función devuelve. Y el
          // mensaje que el owner pidió **ya existe**: la rama `!landing` de
          // `app/(consumer)/enroll/[programId]/page.tsx` dice exactamente «Este programa no está
          // disponible». Devolver `null` la alcanza, así que esto cierra el caso con **cero
          // `.tsx`** (ADR 0070 §16) en vez de pedir una pantalla nueva.
          //
          // `!= 'active'` y no `in ('suspended','closed')`: fail-CLOSED, la misma polaridad que
          // `businessStatusFailure`. Un cuarto estado que nadie le enseñó a este guard tiene que
          // ocultar el formulario, no mostrarlo.
          eq(businesses.status, "active"),
        ),
      )
      .limit(1);
    if (!row) return null;
    const { logoObjectKey, ...rest } = row;
    return {
      ...rest,
      hasLogo: logoObjectKey != null,
      welcomeOffer: await welcomeOfferFor(row.businessId, now),
    };
  } catch (error) {
    if (pgErrorCode(error) === "22P02") return null;
    throw error;
  }
}
