import { useEffect, useState } from "react";
import { FiHeart } from "react-icons/fi";
import { api, ApiError } from "../../services/api";
import { dateOnly } from "../../lib/format";
import { Alert, Button, EmptyState, ProfileCardSkeleton } from "../../components/ui";
import CompanionCard from "../../components/shared/CompanionCard";

/** Saved Companions — the quickest way to book someone again. */
export default function Favorites() {
  const [list, setList] = useState(null);
  const [problem, setProblem] = useState("");
  useEffect(() => {
    api.favorites().then((d) => setList(d.favorites)).catch((e) => setProblem(e instanceof ApiError ? e.message : "Could not load your favourites."));
  }, []);

  return (
    <div className="k-wrap py-8 lg:py-12">
      <h1 className="mb-1 text-[2rem]">Favourites</h1>
      <p className="mb-6 text-muted">Companions you saved. Tap one to book again.</p>
      <Alert>{problem}</Alert>
      {!list && !problem && (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => <ProfileCardSkeleton key={i} />)}
        </div>
      )}
      {list && list.length === 0 && (
        <EmptyState icon={<FiHeart size={22} />} title="No favourites yet" body="Tap the heart on any Companion to save them here." action={<Button to="/discover" variant="outline">Discover</Button>} />
      )}
      {list && list.length > 0 && (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((c) => (
            <div key={c.id}>
              <CompanionCard c={c} onFavorite={(id, on) => !on && setList((l) => l.filter((x) => x.id !== id))} />
              <p className="mb-0 mt-2 text-xs text-muted">
                {c.lastMetAt ? `Last met ${dateOnly(c.lastMetAt)}` : "Not met yet"}
                {!c.bookable && " · not taking bookings right now"}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
