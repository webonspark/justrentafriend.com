import { FiEye, FiX } from "react-icons/fi";
import { endSupportView, useAuth } from "../../context/AuthContext";

/** Shown on every page while staff are viewing a member's account. */
export default function SupportViewBanner() {
  const { supportView, user } = useAuth();
  if (!supportView || !user) return null;
  const until = new Date(supportView.expiresAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  return (
    <div role="status" className="sticky top-0 z-50 border-b" style={{ background: "#f59e0b", color: "#1a1a1a", borderColor: "#b45309" }}>
      <div className="k-wrap flex flex-wrap items-center gap-3 py-2 text-sm">
        <FiEye aria-hidden="true" />
        <p className="m-0 flex-1">
          <strong>Support view</strong> — you are seeing <strong>{user.fullName}</strong>'s account as they see it. Read-only: nothing can be changed. Ends at {until}.
        </p>
        <button type="button" className="k-btn k-btn-sm" style={{ background: "#1a1a1a", color: "#fff" }} onClick={endSupportView}>
          <FiX /> Exit view
        </button>
      </div>
    </div>
  );
}
