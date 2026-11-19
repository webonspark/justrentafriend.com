import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { FiAlertTriangle, FiCheckCircle, FiMapPin, FiPhone } from "react-icons/fi";
import { api } from "../../services/api";
import { BRAND } from "../../config/brand";
import { ago, dateTime } from "../../lib/format";
import { Alert, Button, Card, Skeleton } from "../../components/ui";

/**
 * What an emergency contact sees from the SOS link: the member's latest
 * location, refreshed every 15 seconds while the alert is active.
 */
export default function SosShare() {
  const { token } = useParams();
  const [d, setD] = useState(null);
  const [problem, setProblem] = useState("");

  useEffect(() => {
    const load = () => api.sosShare(token).then(setD).catch((e) => setProblem(e.message));
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [token]);

  if (problem) return <div className="k-wrap k-narrow py-16"><Alert>{problem}</Alert></div>;
  if (!d) return <div className="k-wrap k-narrow py-16"><Skeleton className="h-64 w-full rounded-2xl" /></div>;
  const active = d.status === "active";
  const map = d.latitude != null ? `https://maps.google.com/?q=${d.latitude},${d.longitude}` : null;

  return (
    <div className="k-wrap k-narrow py-10">
      <Card>
        {active ? (
          <p className="mb-2 flex items-center gap-2 text-xl font-bold" style={{ color: "var(--bad)" }}><FiAlertTriangle /> {d.name} needs help</p>
        ) : (
          <p className="mb-2 flex items-center gap-2 text-xl font-bold" style={{ color: "var(--good)" }}><FiCheckCircle /> {d.name} has marked themselves safe</p>
        )}
        <p className="mb-4 text-sm text-muted">SOS raised on {BRAND} at {dateTime(d.createdAt)}.</p>
        {d.meetingPlace && <p className="mb-2 flex items-center gap-1"><FiMapPin /> Meeting at <strong>{d.meetingPlace.name}</strong>{d.meetingPlace.address ? `, ${d.meetingPlace.address}` : ""}</p>}
        {map ? (
          <>
            <p className="mb-4 text-sm">Last location {d.locationAt ? ago(d.locationAt) : ""}{d.accuracyM ? ` (±${d.accuracyM} m)` : ""}.</p>
            <div className="mb-4 overflow-hidden rounded-xl border border-ink-line">
              <iframe title="Live location" width="100%" height="300" loading="lazy" style={{ border: 0 }}
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${d.longitude - 0.01},${d.latitude - 0.006},${d.longitude + 0.01},${d.latitude + 0.006}&marker=${d.latitude},${d.longitude}`} />
            </div>
            <Button href={map} target="_blank" rel="noreferrer" variant="outline" className="mb-3"><FiMapPin /> Open in Google Maps</Button>
          </>
        ) : (
          <Alert tone="info">No location has been shared yet. This page refreshes automatically.</Alert>
        )}
        {active && (
          <div className="mt-2 flex flex-wrap gap-2">
            <Button href="tel:112"><FiPhone /> Call 112 (emergency)</Button>
          </div>
        )}
      </Card>
    </div>
  );
}
