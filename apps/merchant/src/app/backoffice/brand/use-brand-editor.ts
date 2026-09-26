"use client";
import { useEffect, useRef, useState } from "react";
import {
  brandColors,
  BrandRequestError,
  requestBrand,
  validBrandColor,
  type Brand,
} from "./brand-api";
import { useBrandLogo } from "./use-brand-logo";
import { useBrandTour } from "./brand-tour-context";

export function useBrandEditor() {
  const [brand, setBrand] = useState<Brand | null>(null);
  const [draft, setDraft] = useState<Brand | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [needsReview, setNeedsReview] = useState(false);
  const [currentBrand, setCurrentBrand] = useState<Brand | null>(null);
  const [adoptOpen, setAdoptOpen] = useState(false);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const readSequence = useRef(0);
  const logo = useBrandLogo();
  const tour = useBrandTour();
  const { stop } = tour;

  function failure(reason: unknown) {
    if (!mounted.current) return;
    setError(
      reason instanceof Error ? reason.message : "No pudimos guardar la marca.",
    );
    if (reason instanceof BrandRequestError) {
      if ([401, 403].includes(reason.status)) {
        setAccessDenied(true);
        stop();
      }
      if (reason.status === 409 || reason.uncertain) setNeedsReview(true);
    }
  }

  async function load() {
    const sequence = ++readSequence.current;
    setLoading(true);
    try {
      const data = await requestBrand();
      if (!mounted.current || sequence !== readSequence.current) return;
      setBrand(data);
      setDraft(data);
      setError(null);
      setAccessDenied(false);
    } catch (reason) {
      if (sequence === readSequence.current) failure(reason);
    } finally {
      if (mounted.current && sequence === readSequence.current)
        setLoading(false);
    }
  }
  useEffect(() => {
    mounted.current = true;
    void load();
    return () => {
      mounted.current = false;
      readSequence.current++;
    };
    // Initial read only; retries are explicit.
  }, []);

  async function save() {
    if (
      !brand ||
      !draft ||
      inFlight.current ||
      logo.pending ||
      logo.isAnalyzing ||
      accessDenied ||
      needsReview
    )
      return;
    if (
      !draft.name.trim() ||
      draft.name.trim().length > 120 ||
      !brandColors.every(([key]) => validBrandColor(draft[key]))
    ) {
      setError("Revisá el nombre y los colores de marca.");
      return;
    }
    const notify = tour.ticket();
    const snapshot = draft;
    inFlight.current = true;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const uploadId = await logo.upload();
      const saved = await requestBrand({
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: snapshot.name,
          timezone: snapshot.timezone,
          currencyCode: snapshot.currencyCode,
          brandPrimaryColor: snapshot.brandPrimaryColor,
          brandComplementaryColor: snapshot.brandComplementaryColor,
          brandAccentColor: snapshot.brandAccentColor,
          revision: brand.brandRevision,
          logoAction: logo.action,
          ...(uploadId ? { uploadId, cropped: logo.cropped } : {}),
        }),
      });
      if (!mounted.current) return;
      setBrand(saved);
      setDraft(saved);
      logo.reset();
      setNotice("Marca guardada.");
      notify({ type: "saved" });
    } catch (reason) {
      failure(reason);
    } finally {
      inFlight.current = false;
      if (mounted.current) setSaving(false);
    }
  }

  async function consult() {
    if (inFlight.current || loading || accessDenied) return;
    setLoading(true);
    const sequence = ++readSequence.current;
    try {
      const data = await requestBrand();
      if (mounted.current && sequence === readSequence.current) {
        setCurrentBrand(data);
        setNotice("Esta es la versión guardada. Tu borrador se conserva.");
      }
    } catch (reason) {
      failure(reason);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }
  function adopt() {
    if (!currentBrand || saving) return;
    setBrand(currentBrand);
    setDraft(currentBrand);
    logo.reset();
    stop();
    setCurrentBrand(null);
    setNeedsReview(false);
    setAdoptOpen(false);
    setError(null);
    setNotice("Usando la versión guardada.");
  }
  return {
    brand,
    draft,
    setDraft,
    logo,
    saving,
    loading,
    notice,
    setNotice,
    error,
    setError,
    accessDenied,
    needsReview,
    currentBrand,
    adoptOpen,
    setAdoptOpen,
    load,
    save,
    consult,
    adopt,
  };
}
