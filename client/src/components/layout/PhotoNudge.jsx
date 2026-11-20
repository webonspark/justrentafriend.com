import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { FiCamera, FiX } from "react-icons/fi";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../services/api";

const DISMISS_KEY = "photoNudgeDismissedAt";
const SNOOZE_MS = 3 * 24 * 3600e3; // ask again after three days

function dismissedRecently() {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY));
    return at > 0 && Date.now() - at < SNOOZE_MS;
  } catch {
    return false;
  }
}

/**
 * A gentle prompt for signed-in members who have no profile photo yet.
 * Profiles with a real photo get more replies and bookings, so it says so —
 * and links straight to where photos are added. Dismissible for three days.
 */
export default function PhotoNudge() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [needsPhoto, setNeedsPhoto] = useState(false);
  const [hidden, setHidden] = useState(dismissedRecently);

  const onProfile = pathname.startsWith("/profile");

  useEffect(() => {
    if (!user || hidden || onProfile) return;
    let alive = true;
    api
      .myProfile()
      .then((me) => {
        const usable = (me.photos || []).filter((p) => p.moderationStatus !== "rejected");
        if (alive) setNeedsPhoto(usable.length === 0);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
    // Re-check when they come back from the profile page after uploading.
  }, [user, hidden, onProfile]);

  if (!user || hidden || onProfile || !needsPhoto) return null;

  const isCompanion = user.role === "companion";
  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* private mode: just hide for now */
    }
    setHidden(true);
  };

  return (
    <div className="border-b border-ink-line bg-ink-raised">
      <div className="k-wrap flex items-center gap-3 py-3 text-sm">
        <FiCamera className="shrink-0 text-rose" size={18} aria-hidden="true" />
        <p className="m-0 flex-1">
          <strong>Add a profile photo.</strong>{" "}
          {isCompanion
            ? "Profiles with a clear photo get far more booking requests — and you need one to go live."
            : "Companions are more likely to accept requests from members with a photo."}{" "}
          <Link to="/profile" className="font-semibold">Add photo →</Link>
        </p>
        <button type="button" className="k-btn k-btn-ghost k-btn-sm" onClick={dismiss} aria-label="Hide this for now">
          <FiX />
        </button>
      </div>
    </div>
  );
}
