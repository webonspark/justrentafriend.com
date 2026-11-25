import { useEffect, useState } from "react";
import { FiArrowDownLeft, FiArrowUpRight, FiCopy, FiGift, FiShare2 } from "react-icons/fi";
import { api, ApiError } from "../../services/api";
import { dateOnly, dateTime, inr } from "../../lib/format";
import { Alert, Badge, Button, Card, EmptyState, Skeleton } from "../../components/ui";

/**
 * The wallet (balance + statement) and refer-a-friend.
 *
 * Wallet money comes from instant refunds, referral rewards and goodwill
 * credits, and is spent on bookings at checkout.
 */
const KIND = {
  refund: "Refund",
  referral: "Referral reward",
  payment: "Paid for a booking",
  release: "Returned from an unfinished checkout",
  admin: "Adjustment by our team",
};

export default function Wallet() {
  const [w, setW] = useState(null);
  const [r, setR] = useState(null);
  const [problem, setProblem] = useState("");
  const [copied, setCopied] = useState("");

  useEffect(() => {
    api.wallet().then(setW).catch((e) => setProblem(e instanceof ApiError ? e.message : "Could not load your wallet."));
    api.referral().then(setR).catch(() => {});
  }, []);

  const copy = async (text, what) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(""), 2000);
    } catch {
      window.prompt("Copy this:", text);
    }
  };
  const share = async () => {
    const text = `Join me on Just Rent a Friend — use my code ${r.code} and we both get ${inr(r.rewardPaise)} after your first meet.`;
    if (navigator.share) {
      try { await navigator.share({ title: "Just Rent a Friend", text, url: r.link }); } catch { /* cancelled */ }
    } else {
      copy(`${text} ${r.link}`, "message");
    }
  };

  if (problem) return <div className="k-wrap py-10"><Alert>{problem}</Alert></div>;

  return (
    <div className="k-wrap py-8 lg:py-12">
      <h1 className="mb-6 text-[2rem]">Wallet</h1>
      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <p className="mb-1 text-sm text-muted">Balance</p>
          {w ? <p className="m-0 text-4xl font-extrabold">{inr(w.balancePaise, { decimals: true })}</p> : <Skeleton className="h-10 w-40" />}
          <p className="mb-0 mt-3 text-sm text-muted">
            Use it at checkout on any booking — tick "Use my wallet". Refunds you choose to take to the wallet arrive here instantly.
            Wallet money cannot be withdrawn to a bank; if you need that, contact support.
          </p>
        </Card>

        <Card>
          <h2 className="mb-1 flex items-center gap-2 text-lg"><FiGift /> Refer a friend</h2>
          {!r ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <>
              <p className="text-sm text-muted">
                Share your code. When your friend finishes their first meet (and the 24-hour complaint window passes), you <strong>both</strong> get {inr(r.rewardPaise)} in your wallet.
              </p>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="rounded-lg border border-ink-line px-3 py-2 font-mono text-lg font-bold tracking-widest">{r.code}</span>
                <Button size="sm" variant="outline" onClick={() => copy(r.code, "code")}><FiCopy /> {copied === "code" ? "Copied" : "Copy code"}</Button>
                <Button size="sm" variant="outline" onClick={() => copy(r.link, "link")}><FiCopy /> {copied === "link" ? "Copied" : "Copy link"}</Button>
                <Button size="sm" onClick={share}><FiShare2 /> {copied === "message" ? "Copied" : "Share"}</Button>
              </div>
              {r.invited.length > 0 && (
                <ul className="m-0 list-none p-0 text-sm">
                  {r.invited.map((i, n) => (
                    <li key={n} className="flex justify-between border-t border-ink-line py-2">
                      <span>{i.name} <span className="text-muted">· joined {dateOnly(i.joinedAt)}</span></span>
                      {i.rewarded ? <Badge tone="good">Rewarded</Badge> : <Badge>Waiting for first meet</Badge>}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </Card>
      </div>

      <h2 className="mb-3 text-lg">Statement</h2>
      {!w && <Skeleton className="h-40 w-full rounded-2xl" />}
      {w && w.transactions.length === 0 && <EmptyState title="Nothing here yet" body="Refunds, referral rewards and wallet payments will show here." />}
      {w && w.transactions.length > 0 && (
        <div className="overflow-x-auto">
          <table className="table">
            <thead><tr><th>Date</th><th>What</th><th className="text-right">Amount</th><th className="text-right">Balance</th></tr></thead>
            <tbody>
              {w.transactions.map((t) => (
                <tr key={t.id}>
                  <td className="whitespace-nowrap">{dateTime(t.at)}</td>
                  <td>
                    <span className="inline-flex items-center gap-1">{t.amountPaise > 0 ? <FiArrowDownLeft /> : <FiArrowUpRight />} {KIND[t.kind] || t.kind}</span>
                    {t.note && <span className="block text-xs text-muted">{t.note}</span>}
                  </td>
                  <td className={`whitespace-nowrap text-right font-bold ${t.amountPaise > 0 ? "text-green-500" : ""}`}>{t.amountPaise > 0 ? "+ " : "− "}{inr(Math.abs(t.amountPaise), { decimals: true })}</td>
                  <td className="whitespace-nowrap text-right">{inr(t.balanceAfterPaise, { decimals: true })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
