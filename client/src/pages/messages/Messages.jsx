import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { FiArrowLeft, FiFlag, FiLock, FiMessageCircle, FiSend } from "react-icons/fi";
import { api, ApiError } from "../../services/api";
import { getSocket } from "../../lib/socket";
import { ago, dateTime, timeOnly } from "../../lib/format";
import { Alert, Avatar, Badge, Button, EmptyState, Skeleton } from "../../components/ui";
import ReportModal from "../../components/shared/ReportModal";

/**
 * Chat. A conversation exists only for a confirmed booking. Messages arrive
 * live over the socket; contact details are masked by the server before the
 * other side sees them.
 */
export default function Messages() {
  const { id } = useParams();
  const [list, setList] = useState(null);

  const loadList = useCallback(() => {
    api.conversations().then((d) => setList(d.conversations)).catch(() => setList([]));
  }, []);

  useEffect(() => {
    loadList();
    const s = getSocket();
    s?.on("message", loadList);
    return () => s?.off("message", loadList);
  }, [loadList]);

  return (
    <div className="k-wrap py-6 lg:py-10">
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <aside className={id ? "hidden lg:block" : ""}>
          <h1 className="mb-4 text-[1.75rem]">Messages</h1>
          {!list && <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div>}
          {list && list.length === 0 && (
            <EmptyState icon={<FiMessageCircle size={22} />} title="No chats yet" body="Chat opens once a booking is confirmed and paid." action={<Button to="/bookings" variant="outline">My bookings</Button>} />
          )}
          <div className="space-y-1">
            {(list || []).map((c) => (
              <Link
                key={c.id}
                to={`/messages/${c.id}`}
                className={`flex items-center gap-3 rounded-xl p-3 ${String(c.id) === id ? "bg-ink-high" : "hover:bg-ink-raised"}`}
              >
                {c.other?.photo ? <img src={c.other.photo} alt="" className="h-11 w-11 rounded-full object-cover" /> : <Avatar name={c.other?.name || "?"} size={44} />}
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between gap-2">
                    <strong className="truncate text-sm">{c.other?.name}</strong>
                    {c.lastMessage && <span className="shrink-0 text-xs text-muted">{ago(c.lastMessage.createdAt)}</span>}
                  </div>
                  <p className="m-0 truncate text-xs text-muted">{c.lastMessage ? c.lastMessage.body : `Booking #${c.booking?.id}`}</p>
                </div>
                {c.unread > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-rose px-1 text-xs font-bold text-white">{c.unread}</span>}
              </Link>
            ))}
          </div>
        </aside>
        <section className={id ? "" : "hidden lg:block"}>
          {id ? <Thread id={id} onRead={loadList} /> : <EmptyState icon={<FiMessageCircle size={22} />} title="Pick a conversation" />}
        </section>
      </div>
    </div>
  );
}

function Thread({ id, onRead }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const [notice, setNotice] = useState("");
  const [reporting, setReporting] = useState(null);
  const bottom = useRef(null);

  const load = useCallback(() => {
    api.messages(id).then((d) => {
      setData(d);
      api.markRead(id).then(onRead).catch(() => {});
    }).catch((e) => setProblem(e instanceof ApiError ? e.message : "Could not load this chat."));
  }, [id, onRead]);

  useEffect(() => {
    setData(null);
    setProblem("");
    setNotice("");
    load();
    const s = getSocket();
    const onMessage = (p) => {
      if (String(p.conversationId) !== String(id)) return;
      setData((d) => (d ? { ...d, messages: [...d.messages, p.message] } : d));
      api.markRead(id).catch(() => {});
    };
    s?.on("message", onMessage);
    return () => s?.off("message", onMessage);
  }, [id, load]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [data?.messages?.length]);

  const send = async (e) => {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setBusy(true);
    setProblem("");
    try {
      const r = await api.sendMessage(id, body);
      setData((d) => ({ ...d, messages: [...d.messages, r.message] }));
      setText("");
      setNotice(r.notice || "");
    } catch (err) {
      setProblem(err instanceof ApiError ? err.message : "Could not send.");
    } finally {
      setBusy(false);
    }
  };

  if (problem && !data) return <Alert>{problem}</Alert>;
  if (!data) return <Skeleton className="h-[60vh] w-full rounded-2xl" />;
  const { conversation: c, messages } = data;
  const afterMeet = c.booking?.status === "completed" && c.booking?.completedAt && Date.now() < new Date(c.booking.completedAt).getTime() + 24 * 3600e3;
  const open = !c.isClosed && (["confirmed", "in_progress", "disputed"].includes(c.booking?.status) || afterMeet);

  return (
    <div className="flex h-[calc(100vh-180px)] min-h-[420px] flex-col rounded-panel border border-ink-line bg-ink-raised">
      <header className="flex items-center gap-3 border-b border-ink-line p-4">
        <button type="button" className="k-btn k-btn-ghost lg:hidden" onClick={() => navigate("/messages")} aria-label="Back"><FiArrowLeft /></button>
        <div className="flex-1">
          <strong>{c.other.name}</strong>
          <p className="m-0 text-xs text-muted">
            <Link to={`/bookings/${c.booking.id}`}>Booking #{c.booking.id}</Link> · {dateTime(c.booking.startAt)} · {c.booking.meetingPlaceName}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setReporting({})}><FiFlag /> Report</Button>
      </header>

      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        <p className="mx-auto mb-4 max-w-md text-center text-xs text-muted">
          <FiLock className="inline" size={11} /> Keep chat and payments on the platform. Phone numbers, emails and social handles are hidden automatically. Platonic meetings only.
        </p>
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.mine ? "justify-end" : "justify-start"}`}>
            <div className={`group max-w-[78%] rounded-2xl px-4 py-2 text-sm ${m.mine ? "bg-rose text-white" : "bg-ink-high"}`}>
              <p className="m-0 whitespace-pre-wrap break-words">{m.body}</p>
              <p className={`m-0 mt-1 flex items-center gap-2 text-[0.6875rem] ${m.mine ? "text-white/80" : "text-muted"}`}>
                {timeOnly(m.createdAt)}
                {m.mine && m.readAt && " · Read"}
                {m.wasFiltered && <Badge>filtered</Badge>}
                {!m.mine && (
                  <button type="button" className="opacity-0 group-hover:opacity-100" style={{ background: "none", border: 0, color: "inherit" }} onClick={() => setReporting({ messageId: m.id })} aria-label="Report this message">
                    <FiFlag size={11} />
                  </button>
                )}
              </p>
            </div>
          </div>
        ))}
        <div ref={bottom} />
      </div>

      <div className="border-t border-ink-line p-3">
        <Alert tone="info">{notice}</Alert>
        <Alert>{problem}</Alert>
        {open ? (
          <form onSubmit={send} className="flex gap-2">
            <input className="k-input flex-1" value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a message" maxLength={2000} aria-label="Message" />
            <Button type="submit" loading={busy} aria-label="Send"><FiSend /></Button>
          </form>
        ) : (
          <p className="m-0 text-center text-sm text-muted">This chat is closed. It opens only while a booking is confirmed.</p>
        )}
      </div>
      <ReportModal
        show={Boolean(reporting)}
        onHide={() => setReporting(null)}
        reportedId={c.other.id}
        name={c.other.name.split(" ")[0]}
        bookingId={c.booking.id}
        messageId={reporting?.messageId}
      />
    </div>
  );
}
