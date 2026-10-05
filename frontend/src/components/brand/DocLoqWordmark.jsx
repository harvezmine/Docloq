// "DocLoq" wordmark, custom geometric monoline letterforms drawn as paths, not set
// in a webfont, so the logo can never shift or FOUT depending on font loading.
//
// Single uniform color (currentColor) so it sits as one word next to the mark.
// Character comes from the construction rather than color: monoline strokes on a
// strict circular grid matching the shield, and a q whose descender ends in a key
// bit, tying the name to the lock idea.

export default function DocLoqWordmark({ className = "h-5 w-auto" }) {
  return (
    <svg
      viewBox="0 0 125 36"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="4.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label="DocLoq"
    >
      {/* D */}
      <path d="M5 26V6h5a10 10 0 0 1 0 20H5Z" />
      {/* o */}
      <circle cx="36" cy="19" r="7" />
      {/* c */}
      <path d="M60 14.4a7 7 0 1 0 0 9.2" />
      {/* L */}
      <path d="M68 6v20h12" />
      {/* o */}
      <circle cx="91" cy="19" r="7" />
      {/* q, bowl, then a descender that ends in a key bit */}
      <circle cx="109" cy="19" r="7" />
      <path d="M116 19v12h4" />
    </svg>
  );
}
