// DocLoq brand mark: a shield with three document lines knocked out of it.
// Concept generated with gpt-image-1, redrawn as vector, the raster output carried
// a glow halo and its detail bars were white-on-white (invisible at sidebar size).
//
// The mark stands on its own (no tile behind it), so by default it is filled with the
// solid brand color (--brand-600), which re-colors with the user's accent and falls
// back to cobalt outside the authenticated shell. Pass variant="current" to fill with
// currentColor instead.

export default function DocLoqMark({ className = "w-6 h-6", variant = "brand" }) {
  const fill = variant === "current" ? "currentColor" : "var(--brand-600)";

  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill={fill}
        fillRule="evenodd"
        clipRule="evenodd"
        d="M11.63 2.09a1 1 0 0 1 .74 0l7 2.8A1 1 0 0 1 20 5.82v5.4c0 4.98-3.08 9.1-7.62 10.94a1 1 0 0 1-.76 0C7.08 20.32 4 16.2 4 11.22v-5.4a1 1 0 0 1 .63-.93l7-2.8ZM8.6 8.4a.9.9 0 0 0 0 1.8h6.8a.9.9 0 0 0 0-1.8H8.6Zm0 3.5a.9.9 0 0 0 0 1.8h5.1a.9.9 0 0 0 0-1.8H8.6Zm0 3.5a.9.9 0 0 0 0 1.8h3.4a.9.9 0 0 0 0-1.8H8.6Z"
      />
    </svg>
  );
}
