"use client";
import { useEffect, useState } from "react";
import { themeKey } from "../lib/theme.mjs";
import Icon from "./Icon";

type Theme = "dark" | "light";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    function readTheme() {
      setTheme(
        document.documentElement.dataset.theme === "light" ? "light" : "dark",
      );
    }
    function syncTheme(event: StorageEvent) {
      if (event.key !== themeKey) return;
      document.documentElement.dataset.theme =
        event.newValue === "light" ? "light" : "dark";
      readTheme();
    }
    readTheme();
    window.addEventListener("storage", syncTheme);
    return () => window.removeEventListener("storage", syncTheme);
  }, []);

  function choose(next: Theme) {
    document.documentElement.dataset.theme = next;
    setTheme(next);
    try {
      localStorage.setItem(themeKey, next);
    } catch {}
  }

  return (
    <div className="themeSwitch" role="group" aria-label="Color theme">
      <button
        type="button"
        aria-label="Light mode"
        title="Light mode"
        aria-pressed={theme === "light"}
        onClick={() => choose("light")}
      >
        <Icon name="sun" />
      </button>
      <button
        type="button"
        aria-label="Dark mode"
        title="Dark mode"
        aria-pressed={theme === "dark"}
        onClick={() => choose("dark")}
      >
        <Icon name="moon" />
      </button>
    </div>
  );
}
