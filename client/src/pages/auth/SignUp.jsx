import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FiUser, FiHeart, FiCheck } from "react-icons/fi";
import { BRAND, CITY, MINIMUM_AGE, LEGAL } from "../../config/brand";
import { api, ApiError } from "../../services/api";
import { Alert, Badge, Button, Field } from "../../components/ui";

/**
 * Joining.
 *
 * The role decides what the whole account is for, so it is the first thing
 * asked and it is shown as two real choices rather than a dropdown.
 *
 * The age check here is a courtesy that saves a round trip. The real one is
 * on the server, worked out from the date of birth — a browser can be told
 * anything.
 */

const ROLES = [
  {
    id: "user",
    icon: FiUser,
    title: "I want to meet people",
    body: "Browse who is nearby, pay for the time you book, and chat once it is confirmed.",
  },
  {
    id: "customer",
    icon: FiHeart,
    title: "I want to be listed",
    body: "Set your own price per hour, accept the bookings you want, and get paid after each one.",
  },
];

/** Years between a date and today. The same arithmetic the server does. */
function ageFrom(dateOfBirth) {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;

  const now = new Date();
  let years = now.getFullYear() - dob.getFullYear();
  const months = now.getMonth() - dob.getMonth();
  if (months < 0 || (months === 0 && now.getDate() < dob.getDate())) years -= 1;
  return years;
}

const EMPTY = {
  role: "user",
  fullName: "",
  email: "",
  mobile: "",
  dateOfBirth: "",
  password: "",
  acceptedTerms: false,
};

export default function SignUp() {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const set = (key) => (e) => {
    const value = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((p) => ({ ...p, [key]: undefined }));
  };

  const age = useMemo(() => ageFrom(form.dateOfBirth), [form.dateOfBirth]);
  const tooYoung = age !== null && age < MINIMUM_AGE;

  const strength = useMemo(() => checkPassword(form.password), [form.password]);

  const submit = async (e) => {
    e.preventDefault();
    setProblem("");

    if (tooYoung) {
      setErrors({ dateOfBirth: `You must be ${MINIMUM_AGE} or over to join.` });
      return;
    }

    setBusy(true);
    try {
      const result = await api.register(form);
      // The code goes to their email; the next screen asks for it.
      navigate("/verify", {
        state: { email: form.email, devCode: result.devCode },
        replace: true,
      });
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fieldErrors);
        setProblem(Object.keys(err.fieldErrors).length ? "" : err.message);
      } else {
        setProblem("Something went wrong. Try again.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="k-wrap py-12 lg:py-20">
      <div className="mx-auto w-full max-w-lg">
        <h1 className="mb-3 text-[2rem] sm:text-[2.5rem]">Join {BRAND}</h1>
        <p className="mb-9 text-muted">
          Open in {CITY}, for adults {MINIMUM_AGE} and over.
        </p>

        <Alert>{problem}</Alert>

        <form onSubmit={submit} noValidate>
          <fieldset className="mb-7 border-0 p-0">
            <legend className="k-label mb-3">What brings you here?</legend>

            <div className="grid gap-3 sm:grid-cols-2">
              {ROLES.map((role) => (
                <RoleCard
                  key={role.id}
                  role={role}
                  chosen={form.role === role.id}
                  onPick={() => setForm((f) => ({ ...f, role: role.id }))}
                />
              ))}
            </div>
          </fieldset>

          <Field
            label="Full name"
            id="fullName"
            value={form.fullName}
            onChange={set("fullName")}
            error={errors.fullName}
            autoComplete="name"
            required
          />

          <Field
            label="Email"
            id="email"
            type="email"
            value={form.email}
            onChange={set("email")}
            error={errors.email}
            hint="We send a code here to confirm it is yours."
            autoComplete="email"
            required
          />

          <Field
            label="Mobile"
            id="mobile"
            type="tel"
            value={form.mobile}
            onChange={set("mobile")}
            error={errors.mobile}
            placeholder="98765 43210"
            hint="India only for now. We add +91 if you leave it off."
            autoComplete="tel"
            required
          />

          <Field
            label="Date of birth"
            id="dateOfBirth"
            type="date"
            value={form.dateOfBirth}
            onChange={set("dateOfBirth")}
            error={errors.dateOfBirth || (tooYoung ? `You must be ${MINIMUM_AGE} or over to join.` : "")}
            hint={
              age !== null && !tooYoung
                ? `That makes you ${age}.`
                : `${BRAND} is for adults ${MINIMUM_AGE} and over.`
            }
            max={new Date().toISOString().slice(0, 10)}
            required
          />

          <Field
            label="Password"
            id="password"
            type="password"
            value={form.password}
            onChange={set("password")}
            error={errors.password}
            autoComplete="new-password"
            required
          />
          <PasswordMeter checks={strength} />

          <label className="mb-6 mt-7 flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={form.acceptedTerms}
              onChange={set("acceptedTerms")}
              className="mt-1 h-4 w-4 shrink-0 accent-rose"
              required
            />
            <span className="text-sm leading-relaxed text-muted">
              I am {MINIMUM_AGE} or over, and I accept the{" "}
              <Link to={LEGAL.terms} className="text-rose underline">
                Terms
              </Link>
              ,{" "}
              <Link to={LEGAL.privacy} className="text-rose underline">
                Privacy policy
              </Link>{" "}
              and{" "}
              <Link to={LEGAL.guidelines} className="text-rose underline">
                Community guidelines
              </Link>
              . I understand bookings are for social time only.
            </span>
          </label>
          {errors.acceptedTerms && (
            <p className="k-wrong -mt-4 mb-5" role="alert">
              {errors.acceptedTerms}
            </p>
          )}

          <Button type="submit" size="lg" block loading={busy} disabled={tooYoung}>
            {busy ? "Creating your account" : "Create my account"}
          </Button>
        </form>

        <p className="mt-7 text-center text-sm text-muted">
          Already a member?{" "}
          <Link to="/login" className="font-semibold text-rose">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}

function RoleCard({ role, chosen, onPick }) {
  const { icon: Icon, title, body } = role;

  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={chosen}
      className={`relative rounded-card border p-4 text-left transition-all ${
        chosen
          ? "border-rose bg-rose-soft shadow-glow"
          : "border-ink-line bg-ink-raised hover:border-faint"
      }`}
    >
      <span
        className={`mb-3 grid h-9 w-9 place-items-center rounded-xl ${
          chosen ? "bg-rose text-white" : "bg-ink-high text-muted"
        }`}
      >
        <Icon size={17} aria-hidden="true" />
      </span>
      <span className="block text-sm font-bold text-paper">{title}</span>
      <span className="mt-1 block text-xs leading-relaxed text-muted">{body}</span>

      {chosen && (
        <span className="absolute right-3 top-3 grid h-5 w-5 place-items-center rounded-full bg-rose text-white">
          <FiCheck size={12} aria-hidden="true" />
        </span>
      )}
    </button>
  );
}

/** The same four rules the server enforces, shown as you type. */
function checkPassword(value = "") {
  return [
    { label: "8 characters or more", ok: value.length >= 8 },
    { label: "a capital letter", ok: /[A-Z]/.test(value) },
    { label: "a lower-case letter", ok: /[a-z]/.test(value) },
    { label: "a number", ok: /\d/.test(value) },
  ];
}

function PasswordMeter({ checks }) {
  const met = checks.filter((c) => c.ok).length;

  return (
    <div className="-mt-2 mb-2">
      <div className="mb-2 flex gap-1" aria-hidden="true">
        {checks.map((c, i) => (
          <span
            key={c.label}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i < met ? "bg-rose" : "bg-ink-line"
            }`}
          />
        ))}
      </div>
      <p className="text-xs text-muted">
        Needs {checks.filter((c) => !c.ok).map((c) => c.label).join(", ") || "nothing else — good to go."}
      </p>
    </div>
  );
}
