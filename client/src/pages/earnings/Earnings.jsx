import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { FiAlertCircle } from "react-icons/fi";
import { api, ApiError } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { dateOnly, inr } from "../../lib/format";
import { Alert, Badge, Button, Card, EmptyState, Skeleton } from "../../components/ui";

/** The Companion's payout dashboard. */
export default function Earnings() {
  const { isCompanion } = useAuth();
  const [d, setD] = useState(null);
  const [problem, setProblem] = useState("");
  useEffect(() => {
    if (isCompanion) api.earnings().then(setD).catch((e) => setProblem(e instanceof ApiError ? e.message : "Could not load earnings."));
  }, [isCompanion]);
  if (!isCompanion) return <Navigate to="/bookings" replace />;
  if (problem) return <div className="k-wrap py-10"><Alert>{problem}</Alert></div>;
  if (!d) return <div className="k-wrap py-10"><Skeleton className="h-64 w-full rounded-2xl" /></div>;

  const tiles = [
    ["Paid to you", d.totals.paidPaise],
    ["This month", d.totals.thisMonthPaise],
    ["Held for upcoming meets", d.totals.inEscrowPaise],
    ["Waiting / on hold", d.totals.onHoldPaise],
  ];
  const tone = { paid: "good", on_hold: "warn", failed: "warn", pending: "plain", approved: "plain" };

  return (
    <div className="k-wrap py-8 lg:py-12">
      <h1 className="mb-6 text-[2rem]">Earnings</h1>
      {(!d.payoutAccount || d.kycStatus !== "approved") && (
        <Alert tone="info">
          <FiAlertCircle className="mr-1 inline" />
          {!d.payoutAccount ? "Add a UPI ID or bank account" : "Your ID check must be approved"} before payouts can be sent. <a href="/profile" className="underline">Go to my profile</a>
        </Alert>
      )}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map(([label, v]) => (
          <Card key={label}>
            <p className="mb-1 text-sm text-muted">{label}</p>
            <p className="m-0 text-2xl font-extrabold">{inr(v)}</p>
          </Card>
        ))}
      </div>
      <p className="mb-2 text-sm text-muted">
        Payouts go to {d.payoutAccount ? (d.payoutAccount.method === "upi" ? d.payoutAccount.upiId : `A/C ••••${d.payoutAccount.accountLast4}`) : "—"}. After each meet there is a 24-hour complaint window; if nothing is raised, the payout is released to you.
      </p>
      <h2 className="mb-3 mt-6 text-lg">Payouts</h2>
      {d.payouts.length === 0 ? (
        <EmptyState title="No payouts yet" body="Completed meets appear here." action={<Button to="/bookings" variant="outline">My bookings</Button>} />
      ) : (
        <div className="overflow-x-auto">
          <table className="table">
            <thead><tr><th>Booking</th><th>Meet</th><th>Booking total</th><th>Fee</th><th>You receive</th><th>Status</th><th>Reference</th></tr></thead>
            <tbody>
              {d.payouts.map((p) => (
                <tr key={p.id}>
                  <td><a href={`/bookings/${p.bookingId}`}>#{p.bookingId}</a></td>
                  <td>{p.booking ? `${dateOnly(p.booking.startAt)} · ${p.booking.hours} h` : "—"}</td>
                  <td>{p.booking ? inr(p.booking.amountPaise) : "—"}</td>
                  <td>{p.booking ? `− ${inr(p.booking.commissionPaise)}` : "—"}</td>
                  <td><strong>{inr(p.amountPaise)}</strong></td>
                  <td><Badge tone={tone[p.status]}>{p.status.replace("_", " ")}</Badge>{p.note && <span className="block text-xs text-muted">{p.note}</span>}</td>
                  <td className="text-xs">{p.reference || "—"}{p.paidAt && <span className="block text-muted">{dateOnly(p.paidAt)}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
