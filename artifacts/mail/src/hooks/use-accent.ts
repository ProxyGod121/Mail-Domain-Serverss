import { useEffect, useState } from "react";

export type AccentColor = "indigo" | "blue" | "green" | "rose" | "orange" | "purple";

const STORAGE_KEY = "mp-accent";

export const ACCENT_COLORS: { id: AccentColor; label: string; hsl: string }[] = [
  { id: "indigo", label: "Indigo", hsl: "243 75% 59%" },
  { id: "blue", label: "Blue", hsl: "217 91% 60%" },
  { id: "green", label: "Green", hsl: "142 71% 45%" },
  { id: "rose", label: "Rose", hsl: "346 77% 57%" },
  { id: "orange", label: "Orange", hsl: "25 95% 55%" },
  { id: "purple", label: "Purple", hsl: "270 75% 60%" },
];

function applyAccent(accent: AccentColor) {
  const color = ACCENT_COLORS.find((c) => c.id === accent) ?? ACCENT_COLORS[0];
  const root = document.documentElement;
  root.style.setProperty("--primary", color.hsl);
  root.style.setProperty("--accent", color.hsl);
  root.style.setProperty("--ring", color.hsl);
  root.style.setProperty("--sidebar-primary", color.hsl);
  root.style.setProperty("--sidebar-ring", color.hsl);
}

export function useAccent() {
  const [accent, setAccentState] = useState<AccentColor>(() => {
    return (localStorage.getItem(STORAGE_KEY) as AccentColor) ?? "indigo";
  });

  useEffect(() => {
    applyAccent(accent);
  }, [accent]);

  const setAccent = (color: AccentColor) => {
    localStorage.setItem(STORAGE_KEY, color);
    setAccentState(color);
  };

  return { accent, setAccent };
}
