import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { FiCalendar, FiMapPin } from "react-icons/fi";
import { api, ApiError } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { STATUS, dateTime, inr } from "../../lib/format";
import { Alert, Avatar, Badge, Button, Card, EmptyState, Skeleton } from "../../components/ui";

/** Booking history for both sides: requests, upcoming, past. */
const TABS = [
  ["requests", "Requests"],
  ["upcoming", "Upcoming"],
  ["past", "Past"],
];

export default function Bookings() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "upcoming";
  const { isCompanion } = useAuth();
  const [rows, setRows] = useState(null);
  const [problem, setProblem] = useState("");

  useEffect(() => {
    setRows(null);
    api.bookings(tab).then((d) => setRows(d.bookings)).catch((e) => setProblem(e instanceof ApiError ? e.message : "Could not load bookings."));
  }, [tab]);

  return (
    <div className="k-wrap py-8 lg:py-12">
      <h1 className="mb-6 text-[2rem]">Bookings</h1>
      <div className="mb-6 flex gap-2">
        {TABS.map(([id, label]) => (
          <Button key={id} size="sm" variant={tab === id ? "primary" : "outline"} onClick={() => setParams({ tab: id })}>{label}</Button>
        ))}
      </div>
      <Alert>{problem}</Alert>
      {!rows && !problem && <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}</div>}
      {rows && rows.length === 0 && (
        <EmptyState
          icon={<FiCalendar size={22} />}
          title={tab === "requests" ? "No open requests" : tab === "upcoming" ? "Nothing booked yet" : "No past bookings"}
          body={isCompanion ? "New requests appear here — you will get a notification too." : "Find someone to spend time with."}
          action={!isCompanion && <Button to="/discover">Discover Companions</Button>}
        />
      )}
      {rows && rows.length > 0 && (
        <div className="space-y-3">
          {rows.map((b) => {
            const other = b.side === "customer" ? b.companion : b.customer;
            const st = STATUS[b.status] || { label: b.status, tone: "plain" };
            return (
              <Link key={b.id} to={`/bookings/${b.id}`} className="block">
                <Card link className="flex items-center gap-4">
                  {other.photo ? <img src={other.photo} alt="" className="h-14 w-14 rounded-full object-cover" /> : <Avatar name={other.name} size={56} />}
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <strong className="truncate">{other.name}</strong>
                      <Badge tone={st.tone}>{st.label}</Badge>
                    </div>
                    <p className="m-0 text-sm text-muted">{dateTime(b.startAt)} · {b.hours} h · {b.service?.name}</p>
                    <p className="m-0 flex items-center gap-1 text-sm text-muted"><FiMapPin size={12} /> {b.meetingPlace.name}</p>
                  </div>
                  <div className="text-right">
                    <strong>{inr(b.side === "companion" ? b.payoutPaise : b.amountPaise)}</strong>
                    <p className="m-0 text-xs text-muted">{b.side === "companion" ? "you receive" : "total"}</p>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
