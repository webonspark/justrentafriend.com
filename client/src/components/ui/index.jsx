import { Link } from "react-router-dom";

/**
 * The pieces every page is built from.
 *
 * Small on purpose: anything that needs a navbar, modal, dropdown, tabs,
 * toast or pagination uses React Bootstrap, already repainted in
 * styles/index.css. These are the things Bootstrap has no opinion about.
 */

/* ------------------------------ button ------------------------------ */

const BTN = {
  primary: "k-btn k-btn-primary",
  outline: "k-btn k-btn-outline",
  ghost: "k-btn k-btn-ghost",
};

export function Button({
  as,
  to,
  href,
  variant = "primary",
  size,
  block,
  loading,
  disabled,
  className = "",
  children,
  ...rest
}) {
  const classes = [
    BTN[variant] || BTN.primary,
    size === "sm" ? "k-btn-sm" : size === "lg" ? "k-btn-lg" : "",
    block ? "k-btn-block" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const inside = loading ? (
    <>
      <Spinner />
      {children}
    </>
  ) : (
    children
  );

  if (to) {
    return (
      <Link to={to} className={classes} {...rest}>
        {inside}
      </Link>
    );
  }
  if (href) {
    return (
      <a href={href} className={classes} {...rest}>
        {inside}
      </a>
    );
  }

  const Tag = as || "button";
  return (
    <Tag className={classes} disabled={disabled || loading} {...rest}>
      {inside}
    </Tag>
  );
}

function Spinner() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      className="animate-spin"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/* ------------------------------ card ------------------------------ */

export function Card({ as: Tag = "div", pad = true, link, className = "", children, ...rest }) {
  return (
    <Tag
      className={[
        "k-card",
        pad ? "k-card-pad" : "",
        link ? "k-card-link" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/* ------------------------------ field ------------------------------ */

/**
 * A labelled input that knows how to be wrong.
 *
 * The error is tied to the input with aria-describedby and the input is
 * marked aria-invalid, so a screen reader hears the problem rather than
 * only seeing a red border.
 */
export function Field({
  label,
  id,
  error,
  hint,
  as = "input",
  className = "",
  children,
  ...rest
}) {
  const Tag = as;
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className="mb-4">
      <label className="k-label" htmlFor={id}>
        {label}
      </label>

      <Tag
        id={id}
        className={`k-input ${className}`}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={describedBy}
        {...rest}
      >
        {children}
      </Tag>

      {hint && !error && (
        <p className="k-hint" id={`${id}-hint`}>
          {hint}
        </p>
      )}
      {error && (
        <p className="k-wrong" id={`${id}-error`} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/* ------------------------------ badge ------------------------------ */

export function Badge({ tone = "plain", className = "", children }) {
  const tones = {
    plain: "k-badge",
    accent: "k-badge k-badge-accent",
    good: "k-badge k-badge-good",
    warn: "k-badge k-badge-warn",
  };
  return <span className={`${tones[tone] || tones.plain} ${className}`}>{children}</span>;
}

/* ------------------------------ price ------------------------------ */

/**
 * The number this whole product is about, so it is the one thing on a card
 * wearing the accent colour.
 */
export function Price({ paise, size = "lg", per = "hour", className = "" }) {
  const rupees = Number(paise) / 100;
  const text = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: rupees % 1 === 0 ? 0 : 2,
  }).format(rupees);

  const sizes = { sm: "text-base", md: "text-xl", lg: "text-2xl", xl: "text-3xl" };

  return (
    <span className={`k-price ${sizes[size] || sizes.lg} ${className}`}>
      {text}
      {per && <span className="k-price-unit"> /{per}</span>}
    </span>
  );
}

/* ------------------------------ alert ------------------------------ */

export function Alert({ tone = "bad", children, className = "" }) {
  if (!children) return null;

  const tones = {
    bad: "border-[var(--bad-line)] bg-[var(--bad-soft)] text-[var(--bad)]",
    good: "border-[var(--good-line)] bg-[var(--good-soft)] text-[var(--good)]",
    info: "border-ink-line bg-ink-high text-muted",
  };

  return (
    <div
      role={tone === "bad" ? "alert" : "status"}
      className={`mb-4 rounded-xl border px-4 py-3 text-sm ${tones[tone]} ${className}`}
    >
      {children}
    </div>
  );
}

/* ------------------------------ empty state ------------------------------ */

/**
 * An empty screen is an invitation to do something, so it always carries
 * the action that fills it.
 */
export function EmptyState({ title, body, action, icon }) {
  return (
    <div className="flex flex-col items-center py-16 text-center">
      {icon && (
        <span className="mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-ink-high text-muted">
          {icon}
        </span>
      )}
      <h3 className="mb-2">{title}</h3>
      {body && <p className="mb-6 max-w-sm text-sm text-muted">{body}</p>}
      {action}
    </div>
  );
}

/* ------------------------------ skeleton ------------------------------ */

export function Skeleton({ className = "h-4 w-full" }) {
  return <span className={`k-skeleton block ${className}`} aria-hidden="true" />;
}

/** What a profile card looks like before it has loaded. */
export function ProfileCardSkeleton() {
  return (
    <div className="k-card k-card-pad" aria-hidden="true">
      <Skeleton className="mb-4 h-40 w-full rounded-2xl" />
      <Skeleton className="mb-2 h-5 w-2/3" />
      <Skeleton className="mb-4 h-4 w-1/3" />
      <Skeleton className="h-7 w-28" />
    </div>
  );
}

/* ------------------------------ avatar ------------------------------ */

/**
 * A stand-in until real photos exist.
 *
 * The two colours come from the name, so the same person is always the same
 * shade and a grid of cards looks arranged rather than random. Generated
 * rather than shipped, so there is no placeholder image to load.
 */
export function Avatar({ name = "", size = 56, className = "" }) {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) % 360;
  }

  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

  return (
    <span
      className={`inline-grid shrink-0 place-items-center rounded-full font-bold text-white ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.34,
        /* Low saturation on purpose. Red is the only colour that shouts
           on this page, and a grid of loud avatars would drown the price. */
        background: `linear-gradient(135deg, hsl(${hash} 24% 38%), hsl(${(hash + 40) % 360} 28% 22%))`,
      }}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}
