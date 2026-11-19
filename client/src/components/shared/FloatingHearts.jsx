import "../../styles/home.css";

/** Hearts drifting up the background. Positions are fixed per heart, so the page does not jump on re-render. */
export default function FloatingHearts({ count = 18 }) {
  const colours = ["var(--pink)", "var(--rose)", "var(--blush)", "#ffffff", "var(--pink-deep)"];
  const hearts = Array.from({ length: count }, (_, i) => {
    const seed = (i * 37) % 100;
    return {
      left: `${(i * 53) % 100}%`,
      size: 14 + ((i * 7) % 26),
      dur: `${10 + ((i * 3) % 9)}s`,
      delay: `${-((i * 1.7) % 14)}s`,
      rot: `${(seed % 40) - 20}deg`,
      alpha: 0.35 + ((i * 13) % 50) / 100,
      top: `${(i * 29) % 90}%`,
      colour: colours[i % colours.length],
    };
  });
  return (
    <div className="h-hearts" aria-hidden="true">
      {hearts.map((h, i) => (
        <span
          key={i}
          className="h-heart"
          style={{ left: h.left, "--dur": h.dur, "--delay": h.delay, "--rot": h.rot, "--alpha": h.alpha, "--top": h.top }}
        >
          <svg width={h.size} height={h.size} viewBox="0 0 24 24" fill={h.colour}>
            <path d="M12 21s-7.5-4.6-10-9.3C.3 8.4 2.1 4.5 5.8 4.1 8 3.9 9.8 5 12 7.3 14.2 5 16 3.9 18.2 4.1c3.7.4 5.5 4.3 3.8 7.6C19.5 16.4 12 21 12 21z" />
          </svg>
        </span>
      ))}
    </div>
  );
}

