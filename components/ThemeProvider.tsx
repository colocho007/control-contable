"use client";

import { useEffect } from "react";

const THEME_KEY = "controlplus_theme";
type Theme = "dark" | "light";

function applyTheme(theme: Theme) {
  document.documentElement.classList.remove("dark", "light");
  document.documentElement.classList.add(theme);
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

export default function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    const savedTheme = window.localStorage.getItem(THEME_KEY);
    applyTheme(savedTheme === "light" ? "light" : "dark");
  }, []);

  return <>{children}</>;
}
