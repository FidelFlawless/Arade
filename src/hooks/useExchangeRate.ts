"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface ExchangeRateResult {
  rate: number | null;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  convertCadToUsd: (cad: number) => number | null;
}

export function useExchangeRate(): ExchangeRateResult {
  const [rate, setRate] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const fetchedRef = useRef(false);

  const fetchRate = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("https://open.er-api.com/v6/latest/CAD");
      if (!res.ok) throw new Error("Failed to fetch exchange rate");
      const data = await res.json();
      if (data.rates?.USD) {
        setRate(data.rates.USD);
        setLastUpdated(new Date());
      } else {
        throw new Error("USD rate not found in response");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Exchange rate error");
      setRate(0.74);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!fetchedRef.current) {
      fetchedRef.current = true;
      fetchRate();
    }
  }, [fetchRate]);

  const convertCadToUsd = useCallback(
    (cad: number): number | null => {
      if (rate === null || isNaN(cad)) return null;
      return Number((cad * rate).toFixed(2));
    },
    [rate]
  );

  return { rate, loading, error, lastUpdated, convertCadToUsd };
}
