import { Link } from "react-router-dom";
import { FiCheckCircle, FiMapPin, FiStar } from "react-icons/fi";
import { Avatar, Badge, Price } from "../ui";

/** One Companion in a Discover grid. */
export default function CompanionCard({ c }) {
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
        {c.verified && (
          <span className="absolute left-3 top-3">
            <Badge tone="good">
              <FiCheckCircle className="mr-1 inline" size={12} /> Verified
            </Badge>
          </span>
        )}
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
