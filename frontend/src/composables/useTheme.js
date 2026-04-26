import { ref } from "vue";

const THEME_KEY = "ui_theme";
const theme = ref(localStorage.getItem(THEME_KEY) || "light");

function applyTheme(nextTheme) {
  const finalTheme = nextTheme === "dark" ? "dark" : "light";
  theme.value = finalTheme;
  localStorage.setItem(THEME_KEY, finalTheme);
  document.documentElement.setAttribute("data-theme", finalTheme);
  if (finalTheme === "dark") {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}

function toggleTheme() {
  applyTheme(theme.value === "dark" ? "light" : "dark");
}

function initTheme() {
  applyTheme(theme.value);
}

export function useTheme() {
  return { theme, initTheme, toggleTheme, applyTheme };
}
