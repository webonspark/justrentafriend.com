import { useEffect, useState } from "react";
import { FiFileText } from "react-icons/fi";
import { api } from "../../services/api";
import { dateTime, inr } from "../../lib/format";
import { Alert, Badge, Button, EmptyState, Skeleton } from "../../components/ui";

/** Every payment made, with its GST invoice. */
export default function PaymentsHistory() {
  const [rows, setRows] = useState(null);
  const [problem, setProblem] = useState("");
  useEffect(() => { api.myPayments().then((d) => setRows(d.payments)).catch(() => setRows([])); }, []);

  /* The invoice needs the access token, so it is fetched and shown in a new tab. */
  const open = async (id) => {
    const tab = window.open("", "_blank");
    try {
      const html = await api.invoice(id);
      tab.document.open();
      tab.document.write(html);
      tab.document.close();
    } catch {
      tab?.close();
      setProblem("Could not open the invoice.");
    }
  };

  return (
    <div className="k-wrap py-8 lg:py-12">
      <h1 className="mb-6 text-[2rem]">Payments &amp; invoices</h1>
      <Alert>{problem}</Alert>
      {!rows && <Skeleton className="h-40 w-full rounded-2xl" />}
      {rows && rows.length === 0 && <EmptyState icon={<FiFileText size={22} />} title="No payments yet" />}
      {rows && rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="table">
            <thead><tr><th>Date</th><th>For</th><th>Amount</th><th>GST</th><th>Total</th><th>Refunded</th><th>Invoice</th></tr></thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td>{dateTime(p.paidAt)}</td>
                  <td>{p.purpose === "membership" ? "Membership" : <a href={`/bookings/${p.bookingId}`}>Booking #{p.bookingId}</a>}</td>
                  <td>{inr(p.amountPaise)}</td>
                  <td>{inr(p.gstPaise)}</td>
                  <td><strong>{inr(p.totalPaise)}</strong></td>
                  <td>{p.refundedPaise ? <Badge tone="good">{inr(p.refundedPaise)}</Badge> : "—"}</td>
                  <td><Button size="sm" variant="ghost" onClick={() => open(p.id)}>{p.invoiceNo}</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
