import { NavLink } from "react-router-dom";
import { FiSearch, FiCalendar, FiMessageCircle, FiUser } from "react-icons/fi";
import { useAuth } from "../../context/AuthContext";

/**
 * Tab bar for phones, as the brief asks. Four places, the same four the
 * desktop bar shows, so the app has one shape wherever it is opened.
 *
 * It sits above the home indicator on iOS and never covers content, because
 * .k-page leaves room for it.
 */

const TABS = [
  { to: "/discover", label: "Discover", icon: FiSearch },
  { to: "/bookings", label: "Bookings", icon: FiCalendar },
  { to: "/messages", label: "Messages", icon: FiMessageCircle, badge: true },
  { to: "/profile", label: "Profile", icon: FiUser },
];

export default function BottomNav({ unread = 0 }) {
  const { signedIn } = useAuth();
  if (!signedIn) return null;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-ink-line bg-ink/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
      aria-label="Sections"
    >
      <div className="flex h-16">
        {TABS.map(({ to, label, icon: Icon, badge }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `relative flex flex-1 flex-col items-center justify-center gap-1 text-[0.6875rem] font-semibold transition-colors ${
                isActive ? "text-rose" : "text-muted"
              }`
            }
          >
            <span className="relative">
              <Icon size={21} aria-hidden="true" />
              {badge && unread > 0 && (
                <span className="absolute -right-2 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-rose px-1 text-[0.625rem] font-bold text-white">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </span>
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
