import { useCallback, useEffect, useMemo, useState } from "react";
import { getActiveDrugsApi } from "../services/clinicalApi";
import type { DrugDto } from "../services/clinicalApi";

/**
 * The formulary is read by three screens (the doctor's prescribing table, the
 * AI draft that seeds it, and the pharmacy queue that prices prescriptions), so
 * the request is de-duplicated at module scope: the first caller starts it and
 * the others await the same promise instead of opening a burst of identical
 * requests on mount. The result is cached for the session so a screen mounted
 * after the first fetch paints synchronously and still revalidates on mount,
 * because stock levels move while the doctor is writing.
 */
let cachedDrugs: DrugDto[] | null = null;
let inFlight: Promise<DrugDto[]> | null = null;

function loadCatalog(): Promise<DrugDto[]> {
  if (!inFlight) {
    inFlight = getActiveDrugsApi()
      .then((drugs) => {
        cachedDrugs = drugs;
        return drugs;
      })
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
}

export interface DrugCatalog {
  /** Live formulary; empty while the first request is still running. */
  drugs: DrugDto[];
  /** Index by `drugId` for joining prescription lines back to the catalog. */
  byId: Map<number, DrugDto>;
  isLoading: boolean;
  /** Renderable failure reason, or `null` while the catalog is usable. */
  error: string | null;
  /** True when the request failed and no cached list can be shown. */
  isUnavailable: boolean;
  refresh: () => void;
}

export function useDrugCatalog(): DrugCatalog {
  const [drugs, setDrugs] = useState<DrugDto[]>(() => cachedDrugs ?? []);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const refresh = useCallback(() => setReloadToken((token) => token + 1), []);

  useEffect(() => {
    let cancelled = false;

    loadCatalog().then(
      (catalog) => {
        if (cancelled) return;
        setDrugs(catalog);
        setError(null);
      },
      (cause: unknown) => {
        if (cancelled) return;
        setError(
          cause instanceof Error
            ? cause.message
            : "Không tải được danh mục thuốc từ kho.",
        );
      },
    );

    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const byId = useMemo(() => new Map(drugs.map((drug) => [drug.id, drug])), [drugs]);

  return {
    drugs,
    byId,
    // Nothing to render yet and no failure to explain: still loading.
    isLoading: drugs.length === 0 && error === null,
    error,
    isUnavailable: error !== null && drugs.length === 0,
    refresh,
  };
}
