"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Truck,
  CheckCircle,
  PackageSearch,
  Loader2,
  MapPin,
  CalendarClock,
  AlertTriangle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/**
 * Live Canada Post tracking card (Tracking API 2.0.0 via
 * /api/orders/[id]/tracking).
 *
 * Shows the latest scan event, expected/actual delivery dates and a link to
 * Canada Post. Handles every API state, including "label created but no scans
 * yet" (normal right after shipping) and temporary API failures with retry.
 */

interface TrackingEvent {
  dateTime: string | null;
  description: string | null;
  type: string | null;
  location: string | null;
}

interface TrackingData {
  found: boolean;
  state: "no_tracking" | "no_data" | "in_transit" | "delivered";
  orderNumber: string;
  trackingNumber?: string;
  trackingUrl?: string;
  serviceName?: string | null;
  mailedOnDate?: string | null;
  expectedDeliveryDate?: string | null;
  actualDeliveryDate?: string | null;
  attemptedDate?: string | null;
  event?: TrackingEvent;
}

interface LiveTrackingProps {
  orderNumber: string;
  /** Guest access: the email used at checkout. Omit for logged-in owners. */
  email?: string;
  /** Known tracking PIN from the order row (renders nothing when absent). */
  trackingNumber?: string | null;
}

function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return null;
  }
}

/** "20230404:133457" (Canada Post format) -> "Apr 4, 2023, 1:34 PM". */
function formatCpDateTime(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const m = raw.match(/^(\d{4})(\d{2})(\d{2}):(\d{2})(\d{2})(\d{2})$/);
  if (!m) return raw;
  const d = new Date(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    Number(m[4]),
    Number(m[5]),
    Number(m[6])
  );
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function LiveTracking({ orderNumber, email, trackingNumber }: LiveTrackingProps) {
  const [data, setData] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    // No shipment yet — nothing to look up (and the API would 404 us).
    if (!trackingNumber) return;
    setLoading(true);
    setFailed(false);
    try {
      // Logged-in users must send their Supabase token so the API recognises
      // them as the order owner; guests fall back to the ?email= pair.
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const headers: Record<string, string> = {};
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }
      const qs = email ? `?email=${encodeURIComponent(email)}` : "";
      const res = await fetch(
        `/api/orders/${encodeURIComponent(orderNumber)}/tracking${qs}`,
        { headers }
      );
      if (!res.ok) {
        setFailed(true);
        return;
      }
      const json = (await res.json()) as TrackingData;
      if (json.found) setData(json);
      else setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [orderNumber, email, trackingNumber]);

  useEffect(() => {
    load();
  }, [load]);

  if (!trackingNumber) return null;

  if (loading && !data) {
    return (
      <div className="card mb-6 flex items-center gap-3 text-sm text-foreground/60">
        <Loader2 className="w-4 h-4 animate-spin text-primary" />
        Checking live tracking…
      </div>
    );
  }

  if (failed) {
    return (
      <div className="card mb-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium">Live tracking is temporarily unavailable</p>
            <p className="text-sm text-foreground/60 mt-1">
              Canada Post tracking could not be reached. Your tracking number is safe.
            </p>
            <div className="flex flex-wrap gap-3 mt-3">
              <button
                onClick={load}
                className="btn-outline inline-flex items-center gap-2 px-4 py-2 text-sm"
              >
                Try again
              </button>
              {trackingNumber && (
                <a
                  href={`https://www.canadapost-postescanada.ca/track-reperage/en#/details/${trackingNumber}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary underline self-center"
                >
                  Track at Canada Post
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  // No shipment yet — parent pages already render their own block for this.
  if (data.state === "no_tracking") return null;

  const delivered = data.state === "delivered";
  const event = data.event;

  return (
    <div className="card mb-6">
      <div className="flex items-center gap-3 mb-4">
        {delivered ? (
          <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
            <CheckCircle className="w-5 h-5 text-green-600" />
          </div>
        ) : (
          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
            <Truck className="w-5 h-5 text-purple-600" />
          </div>
        )}
        <div>
          <h2 className="font-semibold">Package Tracking</h2>
          <p className={`text-sm ${delivered ? "text-green-600" : "text-purple-600"}`}>
            {delivered ? "Delivered" : "In transit with Canada Post"}
            {data.serviceName ? ` · ${data.serviceName}` : ""}
          </p>
        </div>
      </div>

      {event?.description ? (
        <div className="bg-muted/50 rounded-lg p-4 mb-4">
          <p className="font-medium">{event.description}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-foreground/60 mt-1">
            {formatCpDateTime(event.dateTime) && (
              <span className="inline-flex items-center gap-1">
                <CalendarClock className="w-3.5 h-3.5" />
                {formatCpDateTime(event.dateTime)}
              </span>
            )}
            {event.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                {event.location}
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-muted/50 rounded-lg p-4 mb-4 flex items-start gap-3">
          <PackageSearch className="w-5 h-5 text-foreground/40 shrink-0 mt-0.5" />
          <p className="text-sm text-foreground/60">
            The label was created and your parcel is registered with Canada Post. Tracking
            scans usually appear within 1 business day of the first drop-off.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm mb-4">
        {formatDate(data.mailedOnDate) && (
          <div>
            <p className="text-foreground/50">Shipped on</p>
            <p className="font-medium">{formatDate(data.mailedOnDate)}</p>
          </div>
        )}
        {delivered && formatDate(data.actualDeliveryDate) && (
          <div>
            <p className="text-foreground/50">Delivered on</p>
            <p className="font-medium text-green-600">{formatDate(data.actualDeliveryDate)}</p>
          </div>
        )}
        {!delivered && formatDate(data.expectedDeliveryDate) && (
          <div>
            <p className="text-foreground/50">Expected delivery</p>
            <p className="font-medium">{formatDate(data.expectedDeliveryDate)}</p>
          </div>
        )}
        {data.trackingNumber && (
          <div>
            <p className="text-foreground/50">Tracking number</p>
            <p className="font-mono font-medium">{data.trackingNumber}</p>
          </div>
        )}
      </div>

      {data.trackingUrl && (
        <a
          href={data.trackingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-outline inline-flex items-center gap-2 px-4 py-2 text-sm"
        >
          <Truck className="w-4 h-4" />
          View full history at Canada Post
        </a>
      )}
    </div>
  );
}
