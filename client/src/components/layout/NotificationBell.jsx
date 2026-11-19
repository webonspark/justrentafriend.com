import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FiBell } from "react-icons/fi";
import { api } from "../../services/api";
import { getSocket } from "../../lib/socket";

/**
 * The bell in the top bar, with a live unread count. New notifications
 * arrive over the socket; a slow poll covers a dropped connection.
 */
export default function NotificationBell() {
  const [unread, setUnread] = useState(0);

  const load = useCallback(() => {
    api.notifications().then((d) => setUnread(d.unread)).catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 60000);
    const socket = getSocket();
    const bump = () => setUnread((n) => n + 1);
    socket?.on("notification", bump);
    window.addEventListener("notifications:read", load);
    return () => {
      clearInterval(timer);
      socket?.off("notification", bump);
      window.removeEventListener("notifications:read", load);
    };
  }, [load]);

  return (
    <Link to="/notifications" className="k-btn k-btn-ghost relative" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}>
      <FiBell size={18} />
      {unread > 0 && (
        <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-rose px-1 text-[0.625rem] font-bold text-white">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}
