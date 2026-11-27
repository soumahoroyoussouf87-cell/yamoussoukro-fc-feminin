import type { Shape } from "@/lib/training/diagram";

/** Rendu React des formes calculées par lib/training/diagram (même géométrie que les exports). */
export function ShapeEl({ s }: { s: Shape }) {
  switch (s.k) {
    case "rect": return <rect x={s.x} y={s.y} width={s.w} height={s.h} rx={s.rx} fill={s.fill ?? "none"} stroke={s.stroke} strokeWidth={s.sw} strokeDasharray={s.dash} opacity={s.opacity} />;
    case "circle": return <circle cx={s.cx} cy={s.cy} r={s.r} fill={s.fill ?? "none"} stroke={s.stroke} strokeWidth={s.sw} opacity={s.opacity} />;
    case "ellipse": return <ellipse cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} fill={s.fill ?? "none"} stroke={s.stroke} strokeWidth={s.sw} strokeDasharray={s.dash} opacity={s.opacity} />;
    case "line": return <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={s.stroke} strokeWidth={s.sw} strokeDasharray={s.dash} opacity={s.opacity} strokeLinecap="round" />;
    case "path": return <path d={s.d} fill={s.fill ?? "none"} stroke={s.stroke} strokeWidth={s.sw} strokeDasharray={s.dash} opacity={s.opacity} strokeLinecap="round" strokeLinejoin="round" />;
    case "polygon": return <polygon points={s.points} fill={s.fill} stroke={s.stroke} strokeWidth={s.sw} />;
    case "text":
      return <text x={s.x} y={s.y} fontSize={s.size} fill={s.fill} fontWeight={s.weight ?? 400} textAnchor={s.anchor ?? "start"} fontFamily="Inter, Arial, sans-serif" style={{ userSelect: "none" }}>{s.text}</text>;
  }
}

export function Shapes({ shapes }: { shapes: Shape[] }) {
  return <>{shapes.map((s, i) => <ShapeEl key={i} s={s} />)}</>;
}
