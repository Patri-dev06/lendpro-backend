export const tokenColors = {
  primary: "var(--primary-glow)",
  success: "var(--success)",
  warning: "var(--warning)",
  destructive: "var(--destructive)",
  purple: "var(--purple)",
  info: "var(--info)",
  muted: "var(--muted-foreground)",
};

export function tooltipStyle() {
  return {
    contentStyle: {
      background: "var(--card)",
      border: "1px solid var(--border)",
      borderRadius: 12,
      fontSize: 12,
      boxShadow: "0 6px 20px -8px rgb(0 0 0 / 0.15)",
    },
    labelStyle: { color: "var(--foreground)", fontWeight: 600 },
  };
}
