/** Terrain vertical (attaque en haut). Coordonnées en % : x gauche→droite, y haut→bas. */
export function PitchMarkings() {
  return (
    <svg viewBox="0 0 68 105" className="absolute inset-0 size-full" aria-hidden preserveAspectRatio="none">
      <rect x="0" y="0" width="68" height="105" fill="#0f6b3a" />
      {Array.from({ length: 7 }, (_, i) => <rect key={i} x="0" y={i * 15} width="68" height="7.5" fill="#127a43" />)}
      <g fill="none" stroke="rgba(255,255,255,.8)" strokeWidth="0.35">
        <rect x="2" y="2" width="64" height="101" />
        <line x1="2" y1="52.5" x2="66" y2="52.5" />
        <circle cx="34" cy="52.5" r="9.15" />
        <rect x="13.85" y="2" width="40.3" height="16.5" />
        <rect x="24.85" y="2" width="18.3" height="5.5" />
        <rect x="13.85" y="86.5" width="40.3" height="16.5" />
        <rect x="24.85" y="97.5" width="18.3" height="5.5" />
        <path d="M26.7 18.5 A9.15 9.15 0 0 0 41.3 18.5" />
        <path d="M26.7 86.5 A9.15 9.15 0 0 1 41.3 86.5" />
      </g>
      <circle cx="34" cy="52.5" r="0.5" fill="#fff" />
    </svg>
  );
}
