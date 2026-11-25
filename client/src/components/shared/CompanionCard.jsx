import { useState } from "react";
import { Link } from "react-router-dom";
import { FiCheckCircle, FiHeart, FiMapPin, FiStar, FiZap } from "react-icons/fi";
import { api } from "../../services/api";
import { Avatar, Badge, Price } from "../ui";

/** One Companion in a Discover grid. The heart saves them to favourites. */
export default function CompanionCard({ c, onFavorite }) {
  const [fav, setFav] = useState(Boolean(c.favorite));
  const toggle = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const next = !fav;
    setFav(next);
    try {
      await api.favorite(c.id, next);
      onFavorite?.(c.id, next);
    } catch {
      setFav(!next);
    }
  };
  return (
    <Link to={`/companions/${c.id}`} className="k-card k-card-link block overflow-hidden" style={{ padding: 0 }}>
      <div className="relative aspect-[4/3] bg-ink-high">
        {c.photo ? (
          <img src={c.photo} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="grid h-full w-full place-items-center">
            <Avatar name={c.name} size={88} />
          </div>
        )}
        <span className="absolute left-3 top-3 flex flex-wrap gap-1">
          {c.availableNow && (
            <Badge tone="accent">
              <FiZap className="mr-1 inline" size={12} /> Available now
            </Badge>
          )}
          {c.verified && (
            <Badge tone="good">
              <FiCheckCircle className="mr-1 inline" size={12} /> Verified
            </Badge>
          )}
        </span>
        <button
          type="button"
          onClick={toggle}
          aria-pressed={fav}
          aria-label={fav ? `Remove ${c.firstName} from favourites` : `Save ${c.firstName} to favourites`}
          className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full"
          style={{ background: "rgba(0,0,0,.45)", border: 0, color: fav ? "var(--rose)" : "#fff" }}
        >
          <FiHeart size={17} style={fav ? { fill: "currentColor" } : undefined} />
        </button>
      </div>
      <div className="p-4">
        <div className="mb-1 flex items-baseline justify-between gap-2">
          <h3 className="m-0 truncate text-lg">
            {c.firstName}, {c.age}
          </h3>
          <Price paise={c.pricePerHourPaise} size="md" />
        </div>
        <p className="mb-2 flex items-center gap-1 text-sm text-muted">
          <FiMapPin size={13} /> {c.area || c.city}
          {c.distanceKm !== null && c.distanceKm !== undefined && <span> · {c.distanceKm} km</span>}
        </p>
        <p className="mb-3 flex items-center gap-1 text-sm">
          <FiStar size={13} className="text-rose" />
          {c.ratingCount ? (
            <>
              <strong>{c.rating.toFixed(1)}</strong> <span className="text-muted">({c.ratingCount}) · {c.completedMeets} meets</span>
            </>
          ) : (
            <span className="text-muted">New</span>
          )}
        </p>
        <div className="flex flex-wrap gap-1">
          {c.services.slice(0, 3).map((s) => (
            <Badge key={s.id}>{s.name}</Badge>
          ))}
        </div>
      </div>
    </Link>
  );
}
