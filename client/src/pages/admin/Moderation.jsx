import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Modal } from "react-bootstrap";
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

/**
 * Photo moderation, one person at a time: a list of people with photos in
 * the chosen state; clicking one opens all of their photos to approve or
 * reject one by one.
 */
export function Photos() {
  const [status, setStatus] = useState("pending");
  const state = useLoad(() => adminApi.get(`/photos/people?status=${status}`), [status]);
  const [openId, setOpenId] = useState(null);
  const people = state.data?.people || [];

  const next = () => {
    const i = people.findIndex((p) => p.userId === openId);
    const after = people.slice(i + 1).find((p) => p.userId !== openId);
    setOpenId(after ? after.userId : null);
  };

  return (
    <>
      <PageHead title="Photo moderation" sub="Click a person to see all their photos. No nudity, no minors, no contact details, must show the member's face.">
        <Select label="Status" value={status} onChange={setStatus} options={[["pending", "Waiting"], ["approved", "Approved"], ["rejected", "Rejected"]]} />
      </PageHead>
      <Loader state={state} empty={people.length === 0} emptyTitle={status === "pending" ? "No photos waiting" : "No one here"}>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {people.map((p) => (
            <button
              key={p.userId}
              type="button"
              onClick={() => setOpenId(p.userId)}
              className="k-card k-card-link flex items-center gap-3 text-left"
            >
              <img src={p.cover} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{p.name}</span>
                <span className="block truncate text-xs text-muted">{p.role}{p.area ? ` · ${p.area}` : ""}</span>
                <span className="block text-xs text-muted">Since {dateOnly(p.firstAt)}</span>
              </span>
              <Badge tone={status === "pending" ? "warn" : "plain"}>
                {p.count} {status === "pending" ? "waiting" : status}
              </Badge>
            </button>
          ))}
        </div>
      </Loader>
      {openId && (
        <PersonPhotos
          userId={openId}
          hasNext={people.findIndex((p) => p.userId === openId) < people.length - 1}
          onNext={next}
          onClose={() => setOpenId(null)}
          onChanged={() => state.reload()}
        />
      )}
    </>
  );
}

/** One person's photos, in a pop-up, to approve or reject one by one. */
function PersonPhotos({ userId, hasNext, onNext, onClose, onChanged }) {
  const state = useLoad(() => adminApi.get(`/photos/people/${userId}`), [userId]);
  const [busy, setBusy] = useState(null);
  const [rejecting, setRejecting] = useState(null); // photo id
  const [reason, setReason] = useState("");
  const [problem, setProblem] = useState("");

  const decide = async (photo, decision, why) => {
    setBusy(photo.id);
    setProblem("");
    try {
      await adminApi.post(`/photos/${photo.id}`, decision === "approve" ? { decision } : { decision, reason: why });
      setRejecting(null);
      setReason("");
      await state.reload();
      onChanged();
    } catch (e) {
      setProblem(errText(e));
    } finally {
      setBusy(null);
    }
  };

  const approveAll = async () => {
    const waiting = (state.data?.photos || []).filter((p) => p.status === "pending");
    setBusy("all");
    setProblem("");
    try {
      for (const p of waiting) await adminApi.post(`/photos/${p.id}`, { decision: "approve" });
      await state.reload();
      onChanged();
    } catch (e) {
      setProblem(errText(e));
    } finally {
      setBusy(null);
    }
  };

  const person = state.data?.person;
  const photos = state.data?.photos || [];
  const waiting = photos.filter((p) => p.status === "pending").length;

  return (
    <Modal show onHide={busy ? undefined : onClose} size="xl" centered scrollable>
      <Modal.Header closeButton={!busy}>
        <Modal.Title>
          {person ? (
            <>
              {person.name} <span className="text-base font-normal text-muted">· {person.role}{person.age ? `, ${person.age}` : ""}{person.area ? ` · ${person.area}` : ""}</span>
            </>
          ) : "Photos"}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Loader state={state} empty={photos.length === 0} emptyTitle="No photos">
          {person && (
            <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
              {person.profileStatus && <span>Profile <StatusBadge value={person.profileStatus} /></span>}
              {person.role === "companion" && <span>KYC <StatusBadge value={person.kycStatus} /></span>}
              {person.role === "companion" && person.selfieStatus && <span>Selfie <StatusBadge value={person.selfieStatus} /></span>}
              <Link to={`/admin/members/${person.userId}`} className="ml-auto" onClick={onClose}>Open member →</Link>
            </div>
          )}
          {person?.bio && <p className="mb-4 text-sm text-muted">{person.bio}</p>}
          <Alert>{problem}</Alert>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {photos.map((p) => (
              <Card key={p.id} pad={false} className="overflow-hidden">
                <a href={p.url} target="_blank" rel="noreferrer" title="Open full size">
                  <img src={p.url} alt="" className="aspect-[4/5] w-full object-cover" />
                </a>
                <div className="space-y-2 p-3">
                  <div className="flex items-center gap-2 text-xs">
                    <StatusBadge value={p.status} />
                    {p.isPrimary && <Badge tone="accent">Main photo</Badge>}
                    <span className="ml-auto text-muted">{dateOnly(p.createdAt)}</span>
                  </div>
                  {p.status === "rejected" && p.rejectionReason && <p className="m-0 text-xs text-muted">Reason: {p.rejectionReason}</p>}

                  {rejecting === p.id ? (
                    <div className="space-y-2">
                      <input
                        className="k-input"
                        autoFocus
                        placeholder="Reason (shown to the member)"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        aria-label="Reason for rejecting"
                      />
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" loading={busy === p.id} disabled={!reason.trim()} onClick={() => decide(p, "reject", reason.trim())}>Confirm reject</Button>
                        <Button size="sm" variant="ghost" onClick={() => { setRejecting(null); setReason(""); }}>Back</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-1">
                      {p.status !== "approved" && <Button size="sm" loading={busy === p.id} disabled={Boolean(busy)} onClick={() => decide(p, "approve")}>Approve</Button>}
                      {p.status !== "rejected" && <Button size="sm" variant="outline" disabled={Boolean(busy)} onClick={() => { setRejecting(p.id); setReason(""); }}>Reject</Button>}
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </Loader>
      </Modal.Body>
      <Modal.Footer>
        <span className="mr-auto text-sm text-muted">{waiting ? `${waiting} waiting` : "Nothing waiting for this person"}</span>
        {waiting > 1 && <Button variant="outline" loading={busy === "all"} disabled={Boolean(busy)} onClick={approveAll}>Approve all {waiting} waiting</Button>}
        {hasNext ? <Button disabled={Boolean(busy)} onClick={onNext}>Next person →</Button> : <Button variant="ghost" onClick={onClose}>Done</Button>}
      </Modal.Footer>
    </Modal>
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
