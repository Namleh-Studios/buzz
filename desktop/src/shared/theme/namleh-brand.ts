export const NAMLEH_LIGHT_ACCENT = "#145ff2";
export const NAMLEH_DARK_ACCENT = "#3aa8ff";

export function namlehAccentForTheme(themeName: string): string | null {
  if (themeName === "buzz") return NAMLEH_LIGHT_ACCENT;
  if (themeName === "buzz-dark") return NAMLEH_DARK_ACCENT;
  return null;
}
