import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FiBell } from "react-icons/fi";
import { api } from "../../services/api";
import { ago } from "../../lib/format";
import { Button, EmptyState, Skeleton } from "../../components/ui";

/** Everything we have told this member, newest first. */
export default function Notifications() {
  const [rows, setRows] = useState(null);
  const load = () => api.notifications().then((d) => setRows(d.notifications)).catch(() => setRows([]));
  useEffect(() => { load(); }, []);

  const readAll = async () => {
    await api.readAllNotifications();
    window.dispatchEvent(new Event("notifications:read"));
    load();
  };
  const readOne = (n) => {
    if (!n.readAt) api.readNotification(n.id).then(() => window.dispatchEvent(new Event("notifications:read"))).catch(() => {});
  };

  return (
    <div className="k-wrap k-narrow py-8 lg:py-12">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="m-0 text-[2rem]">Notifications</h1>
        {rows?.some((n) => !n.readAt) && <Button size="sm" variant="ghost" onClick={readAll}>Mark all read</Button>}
      </div>
      {!rows && <Skeleton className="h-40 w-full rounded-2xl" />}
      {rows && rows.length === 0 && <EmptyState icon={<FiBell size={22} />} title="Nothing yet" body="Booking requests, confirmations, reminders and payments show up here." />}
      <div className="space-y-2">
        {(rows || []).map((n) => {
          const inner = (
            <div className={`rounded-xl border p-4 ${n.readAt ? "border-ink-line" : "border-rose bg-rose-soft"}`}>
              <div className="flex justify-between gap-3">
                <strong className="text-sm">{n.title}</strong>
                <span className="shrink-0 text-xs text-muted">{ago(n.createdAt)}</span>
              </div>
              {n.body && <p className="m-0 mt-1 text-sm text-muted">{n.body}</p>}
            </div>
          );
          return n.link ? <Link key={n.id} to={n.link} onClick={() => readOne(n)} className="block">{inner}</Link> : <div key={n.id} onClick={() => readOne(n)}>{inner}</div>;
        })}
      </div>
    </div>
  );
}
