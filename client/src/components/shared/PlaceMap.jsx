import { FiExternalLink, FiMapPin } from "react-icons/fi";

/**
 * A small map with a pin, from OpenStreetMap — no API key, no tracking
 * script, nothing to pay for. "Directions" opens Google Maps at the spot.
 */
export default function PlaceMap({ latitude, longitude, name, height = 200 }) {
  if (latitude == null || longitude == null) return null;
  const lat = Number(latitude);
  const lng = Number(longitude);
  const d = 0.004;
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${lng - d}%2C${lat - d / 1.6}%2C${lng + d}%2C${lat + d / 1.6}&layer=mapnik&marker=${lat}%2C${lng}`;
  const directions = `https://www.google.com/maps/search/?api=1&query=${lat}%2C${lng}`;
  return (
    <div className="overflow-hidden rounded-xl border border-ink-line">
      <iframe title={`Map: ${name || "meeting place"}`} src={src} width="100%" height={height} style={{ border: 0, display: "block" }} loading="lazy" referrerPolicy="no-referrer" />
      <div className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
        <span className="flex items-center gap-1 truncate text-muted"><FiMapPin /> {name}</span>
        <a href={directions} target="_blank" rel="noreferrer noopener" className="flex shrink-0 items-center gap-1 underline">Directions <FiExternalLink /></a>
      </div>
    </div>
  );
}
