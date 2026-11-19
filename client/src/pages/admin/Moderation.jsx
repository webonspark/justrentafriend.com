import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { adminApi } from "../../services/api";
import { dateOnly, dateTime } from "../../lib/format";
import { Alert, Badge, Button, Card } from "../../components/ui";
import { AdminTable, Loader, PageHead, Select, StatusBadge, errText, useConfirm, useLoad } from "./shared";

/**
 * The moderation queues: Companions waiting to go live, identity documents
 * and selfies, photos, and reviews.
 */

/* ------------------------------ approvals ------------------------------ */

export function Approvals() {
  const [status, setStatus] = useState("pending");
  const state = useLoad(() => adminApi.get(`/approvals?status=${status}`), [status]);
  const { ask, modal } = useConfirm();
  const [problem, setProblem] = useState("");

  const decide = (row, decision) => {
    if (decision === "approve") {
      setProblem("");
      adminApi
        .post(`/approvals/${row.userId}`, { decision })
        .then(() => state.reload())
        .catch((e) => setProblem(errText(e)));
      return;
    }
    ask({
      title: `Send ${row.name}'s profile back?`,
      body: "They are told what to change. Your note is shown to them.",
      confirmLabel: "Reject",
      noteLabel: "What needs changing (shown to the Companion)",
      requireNote: true,
      onConfirm: async ({ note }) => {
        await adminApi.post(`/approvals/${row.userId}`, { decision: "reject", note });
        state.reload();
      },
    });
  };

  return (
    <>
      {modal}
      <PageHead title="Companion approvals" sub="Approve only once ID, selfie and at least one photo are approved.">
        <Select label="Status" value={status} onChange={setStatus} options={[["pending", "Waiting"], ["approved", "Approved"], ["rejected", "Rejected"], ["draft", "Not submitted"]]} />
      </PageHead>
      <Alert>{problem}</Alert>
      <Loader state={state} empty={state.data?.queue.length === 0} emptyTitle="Queue is clear">
        <div className="grid gap-4 xl:grid-cols-2">
          {state.data?.queue.map((r) => (
            <Card key={r.userId}>
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <Link to={`/admin/members/${r.userId}`} className="font-semibold">{r.name}</Link>
                  <p className="mb-0 text-xs text-muted">{r.email} · {r.age} · {r.area || "no area"} · submitted {dateOnly(r.submittedAt)}</p>
                </div>
              </div>
              <div className="mb-3 flex flex-wrap gap-2 text-xs">
                <span>KYC <StatusBadge value={r.kycStatus} /></span>
                <span>Selfie <StatusBadge value={r.selfieStatus} /> {r.selfieMatchScore !== null && `${r.selfieMatchScore}%`}</span>
              </div>
              {r.bio && <p className="mb-3 text-sm text-muted">{r.bio}</p>}
              <div className="mb-4 flex flex-wrap gap-2">
                {r.photos.map((p) => (
                  <figure key={p.id} className="mb-0 text-center">
                    <img src={p.url} alt="" className="h-20 w-20 rounded-lg object-cover" />
                    <figcaption><StatusBadge value={p.status} /></figcaption>
                  </figure>
                ))}
              </div>
              {status === "pending" && (
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => decide(r, "approve")}>Approve — go live</Button>
                  <Button size="sm" variant="outline" onClick={() => decide(r, "reject")}>Reject</Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      </Loader>
    </>
  );
}

/* ------------------------------ KYC & selfies ------------------------------ */

/** A private image (KYC, selfie): fetched with the staff token, view audited. */
function PrivateImage({ path, alt }) {
  const [url, setUrl] = useState(null);
  const [error, setError] = useState("");
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!shown) return undefined;
    let made = null;
    adminApi.fileUrl(path).then((u) => { made = u; setUrl(u); }).catch((e) => setError(errText(e)));
    return () => made && URL.revokeObjectURL(made);
  }, [path, shown]);
  if (!shown) {
    return (
      <Button size="sm" variant="outline" onClick={() => setShown(true)}>
        View {alt} (audited)
      </Button>
    );
  }
  if (error) return <p className="text-xs text-muted">{error}</p>;
  return url ? <img src={url} alt={alt} className="max-h-64 rounded-xl" /> : <p className="text-xs text-muted">Loading…</p>;
}

export function Kyc() {
  const [status, setStatus] = useState("submitted");
  const state = useLoad(() => adminApi.get(`/kyc?status=${status}`), [status]);
  const { ask, modal } = useConfirm();

  const decideDoc = (d, decision) =>
    decision === "approve"
      ? adminApi.post(`/kyc/${d.id}`, { decision }).then(() => state.reload())
      : ask({
          title: `Reject ${d.name}'s ${d.docType}?`,
          confirmLabel: "Reject",
          noteLabel: "Reason (shown to the Companion)",
          requireNote: true,
          onConfirm: async ({ note }) => {
            await adminApi.post(`/kyc/${d.id}`, { decision: "reject", reason: note });
            state.reload();
          },
        });

  const decideSelfie = (s, decision) =>
    decision === "approve"
      ? adminApi.post(`/selfie/${s.userId}`, { decision }).then(() => state.reload())
      : ask({
          title: `Reject ${s.name}'s selfie?`,
          body: "They will be asked to retake it.",
          confirmLabel: "Reject",
          onConfirm: async () => {
            await adminApi.post(`/selfie/${s.userId}`, { decision: "reject" });
            state.reload();
          },
        });

  const docs = state.data?.documents || [];
  const selfies = state.data?.selfies || [];

  return (
    <>
      {modal}
      <PageHead title="KYC & selfie checks" sub="Every look at a document is written to the audit log.">
        <Select label="Documents" value={status} onChange={setStatus} options={[["submitted", "Waiting"], ["approved", "Approved"], ["rejected", "Rejected"]]} />
      </PageHead>
      <Loader state={state}>
        <h2 className="mb-3 text-base">Identity documents</h2>
        {docs.length === 0 && <p className="mb-6 text-sm text-muted">None.</p>}
        <div className="mb-8 grid gap-4 xl:grid-cols-2">
          {docs.map((d) => (
            <Card key={d.id}>
              <p className="mb-1 font-semibold"><Link to={`/admin/members/${d.userId}`}>{d.name}</Link> · age {d.age}</p>
              <p className="mb-3 text-sm text-muted">
                <Badge>{d.docType.toUpperCase()}</Badge> {d.numberMasked} · {dateTime(d.createdAt)} · <StatusBadge value={d.status} />
              </p>
              <div className="mb-3"><PrivateImage path={`/kyc/${d.id}/file`} alt="document" /></div>
              {d.status === "submitted" && (
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => decideDoc(d, "approve")}>Approve</Button>
                  <Button size="sm" variant="outline" onClick={() => decideDoc(d, "reject")}>Reject</Button>
                </div>
              )}
            </Card>
          ))}
        </div>

        <h2 className="mb-3 text-base">Selfies waiting</h2>
        {selfies.length === 0 && <p className="text-sm text-muted">None.</p>}
        <div className="grid gap-4 xl:grid-cols-2">
          {selfies.map((s) => (
            <Card key={s.userId}>
              <p className="mb-3 font-semibold">
                <Link to={`/admin/members/${s.userId}`}>{s.name}</Link>{" "}
                <span className="text-sm text-muted">· provider match {s.matchScore ?? "—"}%</span>
              </p>
              <div className="mb-3 flex flex-wrap items-start gap-4">
                <div>
                  <p className="mb-1 text-xs text-muted">Profile photo</p>
                  {s.photoUrl ? <img src={s.photoUrl} alt="profile" className="h-40 w-40 rounded-xl object-cover" /> : <p className="text-xs text-muted">None</p>}
                </div>
                <div>
                  <p className="mb-1 text-xs text-muted">Selfie</p>
                  <PrivateImage path={`/selfie/${s.userId}/file`} alt="selfie" />
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => decideSelfie(s, "approve")}>Same person</Button>
                <Button size="sm" variant="outline" onClick={() => decideSelfie(s, "reject")}>Does not match</Button>
              </div>
            </Card>
          ))}
        </div>
      </Loader>
    </>
  );
}

/* ------------------------------ photos ------------------------------ */

export function Photos() {
  const [status, setStatus] = useState("pending");
  const state = useLoad(() => adminApi.get(`/photos?status=${status}`), [status]);
  const { ask, modal } = useConfirm();

  const approve = (p) => adminApi.post(`/photos/${p.id}`, { decision: "approve" }).then(() => state.reload());
  const reject = (p) =>
    ask({
      title: "Reject this photo?",
      confirmLabel: "Reject",
      noteLabel: "Reason (shown to the member)",
      requireNote: true,
      onConfirm: async ({ note }) => {
        await adminApi.post(`/photos/${p.id}`, { decision: "reject", reason: note });
        state.reload();
      },
    });

  return (
    <>
      {modal}
      <PageHead title="Photo moderation" sub="No nudity, no minors, no contact details, must show the member's face.">
        <Select label="Status" value={status} onChange={setStatus} options={[["pending", "Waiting"], ["approved", "Approved"], ["rejected", "Rejected"]]} />
      </PageHead>
      <Loader state={state} empty={state.data?.photos.length === 0} emptyTitle="No photos here">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {state.data?.photos.map((p) => (
            <Card key={p.id} pad={false} className="overflow-hidden">
              <a href={p.url} target="_blank" rel="noreferrer">
                <img src={p.thumbUrl} alt="" className="aspect-square w-full object-cover" />
              </a>
              <div className="p-3">
                <p className="mb-2 truncate text-xs">
                  <Link to={`/admin/members/${p.owner?.id}`}>{p.owner?.name}</Link> · {p.owner?.role}
                </p>
                {status === "pending" && (
                  <div className="flex gap-1">
                    <Button size="sm" onClick={() => approve(p)}>Approve</Button>
                    <Button size="sm" variant="outline" onClick={() => reject(p)}>Reject</Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      </Loader>
    </>
  );
}

/* ------------------------------ reviews ------------------------------ */

export function Reviews() {
  const state = useLoad(() => adminApi.get("/reviews"));
  const toggle = (r) => adminApi.post(`/reviews/${r.id}/visibility`, { hidden: !r.isHidden }).then(() => state.reload());

  return (
    <>
      <PageHead title="Reviews" sub="Hiding a review removes it from the profile and the rating." />
      <Loader state={state} empty={state.data?.reviews.length === 0} emptyTitle="No reviews yet">
        <AdminTable>
          <thead>
            <tr><th>Booking</th><th>From → to</th><th>Rating</th><th>Comment</th><th>Date</th><th /></tr>
          </thead>
          <tbody>
            {state.data?.reviews.map((r) => (
              <tr key={r.id} style={r.isHidden ? { opacity: 0.55 } : undefined}>
                <td><Link to={`/admin/bookings/${r.bookingId}`}>#{r.bookingId}</Link></td>
                <td>{r.author} → <Link to={`/admin/members/${r.subjectId}`}>{r.subject}</Link></td>
                <td>{"★".repeat(r.rating)}</td>
                <td className="max-w-xs">{r.comment || "—"}</td>
                <td>{dateOnly(r.createdAt)}</td>
                <td>
                  <Button size="sm" variant="outline" onClick={() => toggle(r)}>{r.isHidden ? "Show" : "Hide"}</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </AdminTable>
      </Loader>
    </>
  );
}
