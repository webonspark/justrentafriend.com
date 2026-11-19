import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Offcanvas } from "react-bootstrap";
import { FiFilter, FiNavigation, FiSearch, FiX } from "react-icons/fi";
import { api, ApiError } from "../../services/api";
import { CITY } from "../../config/brand";
import { isoDate } from "../../lib/format";
import { Alert, Button, EmptyState, Field, ProfileCardSkeleton } from "../../components/ui";
import CompanionCard from "../../components/shared/CompanionCard";

/**
 * Search and discovery.
 *
 * Filters live in the URL, so a search can be shared, bookmarked and
 * survives the back button. "Near me" asks the browser for a location once
 * and sends it with the search; it is never stored.
 */

const SORTS = [
  ["rating", "Top rated"],
  ["price_asc", "Price: low to high"],
  ["price_desc", "Price: high to low"],
  ["distance", "Nearest"],
  ["newest", "Newest"],
];

const FILTER_KEYS = ["q", "area", "minPrice", "maxPrice", "gender", "minAge", "maxAge", "language", "minRating", "date", "verified", "maxKm"];

export default function Discover() {
  const [params, setParams] = useSearchParams();
  const [catalog, setCatalog] = useState(null);
  const [areas, setAreas] = useState([]);
  const [data, setData] = useState(null);
  const [problem, setProblem] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [locating, setLocating] = useState(false);

  const query = useMemo(() => Object.fromEntries(params.entries()), [params]);

  useEffect(() => {
    api.catalog().then(setCatalog).catch(() => {});
    api.areas().then((d) => setAreas(d.areas)).catch(() => {});
  }, []);

  useEffect(() => {
    setData(null);
    setProblem("");
    /* Prices are typed in rupees and searched in paise. */
    const q = { ...query, city: CITY };
    if (q.minPrice) q.minPrice = Number(q.minPrice) * 100;
    if (q.maxPrice) q.maxPrice = Number(q.maxPrice) * 100;
    api
      .discover(q)
      .then(setData)
      .catch((e) => setProblem(e instanceof ApiError ? e.message : "Could not load Companions."));
  }, [query]);

  const set = (key, value) => {
    const next = new URLSearchParams(params);
    if (value === "" || value === null || value === undefined || value === false) next.delete(key);
    else next.set(key, value);
    next.delete("page");
    setParams(next, { replace: true });
  };

  const nearMe = () => {
    if (!navigator.geolocation) return setProblem("Your browser cannot share a location.");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = new URLSearchParams(params);
        next.set("lat", pos.coords.latitude.toFixed(4));
        next.set("lng", pos.coords.longitude.toFixed(4));
        next.set("sort", "distance");
        setParams(next, { replace: true });
        setLocating(false);
      },
      () => {
        setProblem("Location permission was refused. Pick an area instead.");
        setLocating(false);
      },
      { timeout: 10000 }
    );
  };

  const active = FILTER_KEYS.filter((k) => query[k]).length;
  const clearAll = () => setParams(new URLSearchParams(query.sort ? { sort: query.sort } : {}), { replace: true });

  const filters = (
    <Filters query={query} set={set} catalog={catalog} areas={areas} onNearMe={nearMe} locating={locating} />
  );

  return (
    <div className="k-wrap py-8 lg:py-12">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="mb-1 text-[2rem]">Discover</h1>
          <p className="m-0 text-muted">Verified Companions in {CITY}. Public places, platonic time.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              className="k-input pl-9"
              placeholder="Search by name"
              defaultValue={query.q || ""}
              onKeyDown={(e) => e.key === "Enter" && set("q", e.currentTarget.value.trim())}
              aria-label="Search by name"
            />
          </div>
          <select className="k-input w-auto" value={query.sort || ""} onChange={(e) => set("sort", e.target.value)} aria-label="Sort">
            <option value="">Best match</option>
            {SORTS.map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
          <Button variant="outline" className="lg:hidden" onClick={() => setShowFilters(true)}>
            <FiFilter /> Filters{active ? ` (${active})` : ""}
          </Button>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
        <aside className="hidden lg:block">
          <div className="sticky top-24">
            {filters}
            {active > 0 && (
              <Button variant="ghost" size="sm" onClick={clearAll}>
                <FiX /> Clear filters
              </Button>
            )}
          </div>
        </aside>

        <section>
          <Alert>{problem}</Alert>
          {data && (
            <p className="mb-4 text-sm text-muted">
              {data.total} {data.total === 1 ? "Companion" : "Companions"}
              {data.measuredFrom && " · distance from your location"}
            </p>
          )}
          {!data && !problem && (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <ProfileCardSkeleton key={i} />
              ))}
            </div>
          )}
          {data && data.results.length === 0 && (
            <EmptyState
              icon={<FiSearch size={22} />}
              title="Nobody matches those filters"
              body="Try a wider price range, another date or fewer filters."
              action={<Button variant="outline" onClick={clearAll}>Clear filters</Button>}
            />
          )}
          {data && data.results.length > 0 && (
            <>
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {data.results.map((c) => (
                  <CompanionCard key={c.id} c={c} />
                ))}
              </div>
              {data.pages > 1 && (
                <div className="mt-8 flex justify-center gap-2">
                  {Array.from({ length: data.pages }).map((_, i) => (
                    <Button
                      key={i}
                      size="sm"
                      variant={data.page === i + 1 ? "primary" : "outline"}
                      onClick={() => {
                        const next = new URLSearchParams(params);
                        next.set("page", String(i + 1));
                        setParams(next);
                        window.scrollTo(0, 0);
                      }}
                    >
                      {i + 1}
                    </Button>
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      </div>

      <Offcanvas show={showFilters} onHide={() => setShowFilters(false)} placement="end">
        <Offcanvas.Header closeButton>
          <Offcanvas.Title>Filters</Offcanvas.Title>
        </Offcanvas.Header>
        <Offcanvas.Body>
          {filters}
          <div className="flex gap-2">
            <Button variant="outline" onClick={clearAll}>Clear</Button>
            <Button onClick={() => setShowFilters(false)}>Show results</Button>
          </div>
        </Offcanvas.Body>
      </Offcanvas>
    </div>
  );
}

function Filters({ query, set, catalog, areas, onNearMe, locating }) {
  const sel = (key, label, options, placeholder = "Any") => (
    <div className="mb-4">
      <label className="k-label" htmlFor={`f-${key}`}>{label}</label>
      <select id={`f-${key}`} className="k-input" value={query[key] || ""} onChange={(e) => set(key, e.target.value)}>
        <option value="">{placeholder}</option>
        {options.map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>
    </div>
  );

  return (
    <div>
      <div className="mb-4">
        <Button variant="outline" size="sm" block loading={locating} onClick={onNearMe}>
          <FiNavigation /> {query.lat ? "Location set" : "Near me"}
        </Button>
        {query.lat && (
          <select className="k-input mt-2" value={query.maxKm || ""} onChange={(e) => set("maxKm", e.target.value)} aria-label="Distance">
            <option value="">Any distance</option>
            {[2, 5, 10, 20].map((k) => (
              <option key={k} value={k}>Within {k} km</option>
            ))}
          </select>
        )}
      </div>
      {sel("area", "Area", areas.map((a) => [a.name, a.count ? `${a.name} (${a.count})` : a.name]), "All areas")}
      <div className="mb-4">
        <span className="k-label">Price per hour (₹)</span>
        <div className="flex gap-2">
          <input className="k-input" type="number" min="0" placeholder="Min" defaultValue={query.minPrice || ""} onBlur={(e) => set("minPrice", e.target.value)} aria-label="Minimum price" />
          <input className="k-input" type="number" min="0" placeholder="Max" defaultValue={query.maxPrice || ""} onBlur={(e) => set("maxPrice", e.target.value)} aria-label="Maximum price" />
        </div>
      </div>
      {sel("gender", "Gender", [["female", "Women"], ["male", "Men"], ["other", "Non-binary / other"]])}
      <div className="mb-4">
        <span className="k-label">Age</span>
        <div className="flex gap-2">
          <input className="k-input" type="number" min="18" max="99" placeholder="18" defaultValue={query.minAge || ""} onBlur={(e) => set("minAge", e.target.value)} aria-label="Minimum age" />
          <input className="k-input" type="number" min="18" max="99" placeholder="60" defaultValue={query.maxAge || ""} onBlur={(e) => set("maxAge", e.target.value)} aria-label="Maximum age" />
        </div>
      </div>
      {sel("language", "Language", (catalog?.languages || []).map((l) => [l, l]))}
      {sel("minRating", "Rating", [["4.5", "4.5 and up"], ["4", "4 and up"], ["3", "3 and up"]])}
      <Field label="Available on" id="f-date" type="date" min={isoDate()} value={query.date || ""} onChange={(e) => set("date", e.target.value)} />
      <label className="mb-5 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={query.verified === "1"} onChange={(e) => set("verified", e.target.checked ? "1" : "")} />
        Verified only
      </label>
    </div>
  );
}
