import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FiCheck } from "react-icons/fi";
import { api, ApiError } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { dateOnly, inr } from "../../lib/format";
import { Alert, Badge, Button, Card, Skeleton } from "../../components/ui";
import Checkout from "../../components/shared/Checkout";

/**
 * Membership. Compulsory for both sides: it keeps a Companion listed and
 * unlocks search, booking and chat for a Customer. Prices include GST.
 */
export default function Membership() {
  const { user, memberActive, refreshUser, isCompanion } = useAuth();
  const [plans, setPlans] = useState(null);
  const [checkout, setCheckout] = useState(null);
  const [busy, setBusy] = useState(null);
  const [problem, setProblem] = useState("");
  const [done, setDone] = useState("");
  const navigate = useNavigate();
  const from = useLocation().state?.from?.pathname;

  useEffect(() => { api.plans().then((d) => setPlans(d.plans)).catch(() => setPlans([])); }, []);

  const buy = async (plan) => {
    setBusy(plan.id);
    setProblem("");
    try {
      setCheckout(await api.startMembership(plan.id));
    } catch (e) {
      setProblem(e instanceof ApiError ? e.message : "Could not start the payment.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="k-wrap py-8 lg:py-12">
      <h1 className="mb-2 text-[2rem]">Membership</h1>
      <p className="mb-6 text-muted">
        {isCompanion ? "Keeps your profile listed and lets you take bookings." : "Unlocks search, booking and chat."} Every booking is paid separately.
      </p>
      {memberActive ? (
        <Alert tone="good">Your membership is active until {dateOnly(user.membershipExpiresAt)}. Renewing now adds time on top.</Alert>
      ) : (
        <Alert tone="info">{user.membershipStatus === "expired" ? "Your membership has expired." : "You do not have a membership yet."} Choose a plan to continue.</Alert>
      )}
      <Alert tone="good">{done}</Alert>
      <Alert>{problem}</Alert>

      <div className="grid gap-5 md:grid-cols-3">
        {!plans && [0, 1, 2].map((i) => <Skeleton key={i} className="h-64 w-full rounded-2xl" />)}
        {(plans || []).map((p, i) => (
          <Card key={p.id} className={i === 1 ? "border-rose" : ""} style={i === 1 ? { borderColor: "var(--rose)" } : undefined}>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="m-0 text-xl">{p.name}</h2>
              {i === 1 && <Badge tone="accent">Popular</Badge>}
            </div>
            <p className="mb-1 text-3xl font-extrabold">{inr(p.totalPaise)}</p>
            <p className="mb-4 text-xs text-muted">{inr(p.pricePaise)} + {inr(p.gstPaise)} GST · {p.days} days</p>
            <p className="mb-4 text-sm">{p.blurb}</p>
            <ul className="mb-5 list-none space-y-1 p-0 text-sm">
              {(isCompanion ? ["Listed in search", "Accept bookings", "Payouts after every meet"] : ["Search and filters", "Book Companions", "In-app chat after booking"]).map((t) => (
                <li key={t} className="flex items-center gap-2"><FiCheck className="text-rose" /> {t}</li>
              ))}
            </ul>
            <Button block loading={busy === p.id} variant={i === 1 ? "primary" : "outline"} onClick={() => buy(p)}>
              {memberActive ? "Extend" : "Choose"} {p.name}
            </Button>
          </Card>
        ))}
      </div>
      {checkout && (
        <Checkout
          checkout={checkout}
          onClose={() => setCheckout(null)}
          onPaid={async (r) => {
            setCheckout(null);
            await refreshUser();
            setDone(`Payment received — invoice ${r.invoiceNo}. Your membership is active.`);
            if (from) navigate(from);
          }}
        />
      )}
    </div>
  );
}
