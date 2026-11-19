import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Tab, Tabs } from "react-bootstrap";
import { FiMapPin } from "react-icons/fi";
import { adminApi } from "../../services/api";
import { ago, dateTime } from "../../lib/format";
import { Alert, Button, Card } from "../../components/ui";
import { AdminTable, Loader, PageHead, Select, StatusBadge, errText, useConfirm, useLoad } from "./shared";
import { ChatModal } from "./BookingsAdmin";

/** Reports, flagged chat messages, and live SOS alerts. */

const ACTIONS = [["none", "No action on the account"], ["warned", "Warn"], ["suspended", "Suspend"], ["banned", "Ban"]];

export function Reports() {
  const [status, setStatus] = useState("");
  const reports = useLoad(() => adminApi.get(`/reports${status ? `?status=${status}` : ""}`), [status]);
  const flagged = useLoad(() => adminApi.get("/messages/flagged"));
  const { ask, modal } = useConfirm();
  const [chat, setChat] = useState(null);
  const [problem, setProblem] = useState("");

  const handle = (r, next) =>
    ask({
      title: next === "dismissed" ? `Dismiss report #${r.id}?` : `Action report #${r.id}`,
      body: `Against ${r.reported?.name}. Reason: ${r.reason.replace(/_/g, " ")}.`,
      confirmLabel: next === "dismissed" ? "Dismiss" : "Save decision",
      requireNote: true,
      noteLabel: "Outcome (kept on the report; warnings are shown to the member)",
      fields:
        next === "actioned"
          ? [{ name: "action", label: "Account action", as: "select", children: ACTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>), initial: "none" }]
          : [],
      onConfirm: async ({ note, action }) => {
        await adminApi.post(`/reports/${r.id}`, { status: next, action: action || "none", outcome: note });
        reports.reload();
      },
    });

  const markReviewing = (r) => adminApi.post(`/reports/${r.id}`, { status: "reviewing" }).then(() => reports.reload());

  const readChat = async (conversationId) => {
    setProblem("");
    try {
      setChat(await adminApi.get(`/conversations/${conversationId}`));
    } catch (e) {
      setProblem(errText(e));
    }
  };

  const clear = (m) => adminApi.post(`/messages/${m.id}/clear`).then(() => flagged.reload());

  return (
    <>
      {modal}
      <PageHead title="Reports & chat review" sub="Urgent reports (solicitation, underage, harassment) are listed first." />
      <Alert>{problem}</Alert>
      <Tabs defaultActiveKey="reports" className="mb-4">
        <Tab eventKey="reports" title="Reports">
          <div className="mb-3">
            <Select label="Status" value={status} onChange={setStatus} options={[["", "Open & reviewing"], ["open", "Open"], ["reviewing", "Reviewing"], ["actioned", "Actioned"], ["dismissed", "Dismissed"]]} />
          </div>
          <Loader state={reports} empty={reports.data?.reports.length === 0} emptyTitle="No reports here">
            <div className="grid gap-3">
              {reports.data?.reports.map((r) => (
                <Card key={r.id}>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <StatusBadge value={r.priority} />
                    <StatusBadge value={r.status} />
                    <strong className="capitalize">{r.reason.replace(/_/g, " ")}</strong>
                    <span className="text-xs text-muted">#{r.id} · {dateTime(r.createdAt)}</span>
                  </div>
                  <p className="mb-2 text-sm">
                    <Link to={`/admin/members/${r.reporter?.id}`}>{r.reporter?.name}</Link> reported{" "}
                    <Link to={`/admin/members/${r.reported?.id}`}>{r.reported?.name}</Link> <StatusBadge value={r.reported?.status} />
                    {r.bookingId && <> · <Link to={`/admin/bookings/${r.bookingId}`}>booking #{r.bookingId}</Link></>}
                  </p>
                  {r.details && <p className="mb-2 text-sm text-muted">{r.details}</p>}
                  {r.outcome && <p className="mb-2 text-sm">Outcome: {r.outcome}</p>}
                  {["open", "reviewing"].includes(r.status) && (
                    <div className="flex flex-wrap gap-2">
                      {r.status === "open" && <Button size="sm" variant="ghost" onClick={() => markReviewing(r)}>Mark reviewing</Button>}
                      <Button size="sm" onClick={() => handle(r, "actioned")}>Take action</Button>
                      <Button size="sm" variant="outline" onClick={() => handle(r, "dismissed")}>Dismiss</Button>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          </Loader>
        </Tab>
        <Tab eventKey="flagged" title="Flagged messages">
          <Loader state={flagged} empty={flagged.data?.messages.length === 0} emptyTitle="No flagged messages">
            <AdminTable>
              <thead>
                <tr><th>Sender</th><th>Message (original)</th><th>Why</th><th>When</th><th /></tr>
              </thead>
              <tbody>
                {flagged.data?.messages.map((m) => (
                  <tr key={m.id}>
                    <td><Link to={`/admin/members/${m.sender?.id}`}>{m.sender?.name}</Link></td>
                    <td className="max-w-sm">{m.body}</td>
                    <td className="text-xs">{m.flagReason}</td>
                    <td>{dateTime(m.createdAt)}</td>
                    <td className="whitespace-nowrap">
                      <Button size="sm" variant="outline" onClick={() => readChat(m.conversationId)}>Read chat</Button>{" "}
                      <Button size="sm" variant="ghost" onClick={() => clear(m)}>Clear flag</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </AdminTable>
          </Loader>
        </Tab>
      </Tabs>
      <ChatModal chat={chat} onClose={() => setChat(null)} />
    </>
  );
}

export function Sos() {
  const [status, setStatus] = useState("active");
  const state = useLoad(() => adminApi.get(`/sos?status=${status}`), [status]);
  const { ask, modal } = useConfirm();

  // Live: refresh every 20 seconds while this page is open.
  useEffect(() => {
    const t = setInterval(() => state.reload(), 20000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const resolve = (a) =>
    ask({
      title: `Resolve SOS #${a.id}?`,
      body: "Only once you have confirmed the member is safe.",
      confirmLabel: "Resolve",
      requireNote: true,
      noteLabel: "What happened",
      onConfirm: async ({ note }) => {
        await adminApi.post(`/sos/${a.id}/resolve`, { note });
        state.reload();
      },
    });

  return (
    <>
      {modal}
      <PageHead title="SOS alerts" sub="Refreshes every 20 seconds. Call the member first; if unreachable, call 112.">
        <Select label="Status" value={status} onChange={setStatus} options={[["active", "Active"], ["resolved", "Resolved"]]} />
      </PageHead>
      <Loader state={state} empty={state.data?.alerts.length === 0} emptyTitle={status === "active" ? "No active alerts" : "None"}>
        <div className="grid gap-4 xl:grid-cols-2">
          {state.data?.alerts.map((a) => (
            <Card key={a.id} style={a.status === "active" ? { borderColor: "var(--rose)" } : undefined}>
              <div className="mb-2 flex items-center gap-2">
                <StatusBadge value={a.status === "active" ? "urgent" : "resolved"} />
                <strong>SOS #{a.id}</strong>
                <span className="text-xs text-muted">{ago(a.createdAt)}</span>
              </div>
              <p className="mb-1 text-sm">
                <Link to={`/admin/members/${a.user?.id}`}>{a.user?.name}</Link> · <a href={`tel:${a.user?.mobile}`}>{a.user?.mobile}</a>
              </p>
              <p className="mb-1 text-sm text-muted">Emergency contact: {a.user?.emergencyContact || "none set"}</p>
              {a.bookingId && (
                <p className="mb-1 text-sm">
                  <Link to={`/admin/bookings/${a.bookingId}`}>Booking #{a.bookingId}</Link> · {a.meetingPlace}
                </p>
              )}
              {a.latitude !== null ? (
                <p className="mb-3 text-sm">
                  <a href={`https://maps.google.com/?q=${a.latitude},${a.longitude}`} target="_blank" rel="noreferrer">
                    <FiMapPin /> Open location
                  </a>{" "}
                  <span className="text-xs text-muted">updated {a.locationAt ? ago(a.locationAt) : "—"}</span>
                </p>
              ) : (
                <p className="mb-3 text-sm text-muted">No location shared.</p>
              )}
              {a.resolvedNote && <p className="mb-2 text-sm">Resolved: {a.resolvedNote}</p>}
              {a.status === "active" && <Button size="sm" onClick={() => resolve(a)}>Mark resolved</Button>}
            </Card>
          ))}
        </div>
      </Loader>
    </>
  );
}
