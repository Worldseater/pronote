(function () {
  const DEFAULT_COLORS = [
    "#60a5fa",
    "#38bdf8",
    "#0ea5e9",
    "#0284c7",
    "#2563eb",
    "#1e40af",
    "#1e3a8a",
    "#2dd4bf",
    "#14b8a6",
    "#0d9488",
    "#06b6d4",
    "#0891b2",
    "#4ade80",
    "#22c55e",
    "#16a34a",
    "#84cc16",
    "#a3e635",
    "#facc15",
    "#eab308",
    "#fbbf24",
    "#fb923c",
    "#f97316",
    "#ea580c",
    "#f87171",
    "#ef4444",
    "#dc2626",
    "#f472b6",
    "#ec4899",
    "#db2777",
    "#e879f9",
    "#d946ef",
    "#a78bfa",
    "#8b5cf6",
    "#7c3aed",
    "#6366f1",
    "#4f46e5",
    "#94a3b8",
    "#64748b",
    "#78716c",
    "#57534e",
  ];

  function pickColor(color) {
    if (color && DEFAULT_COLORS.indexOf(color) !== -1) {
      return color;
    }
    return DEFAULT_COLORS[0];
  }

  window.PronoteColorPalette = {
    DEFAULT_COLORS: DEFAULT_COLORS,
    pickColor: pickColor,
  };
})();
