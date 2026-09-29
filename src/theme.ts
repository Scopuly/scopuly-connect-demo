import { useEffect, useRef, useState } from "react";

export type Theme = "light" | "dark";
const STORAGE_KEY = "scopuly-connect-lab:theme";

function savedTheme(): Theme | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === "light" || saved === "dark" ? saved : null;
  } catch {
    return null;
  }
}

export function useTheme() {
  const explicitlyChosen = useRef(false);
  const [theme, setTheme] = useState<Theme>(
    () =>
      savedTheme() ??
      (window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"),
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "dark" ? "#070811" : "#f6f7fc");
  }, [theme]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const followSystem = (event: MediaQueryListEvent) => {
      if (!explicitlyChosen.current && !savedTheme())
        setTheme(event.matches ? "dark" : "light");
    };
    media.addEventListener("change", followSystem);
    return () => media.removeEventListener("change", followSystem);
  }, []);

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    explicitlyChosen.current = true;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* Theme still works when storage is unavailable. */
    }
    setTheme(next);
  };
  return { theme, toggleTheme };
}
