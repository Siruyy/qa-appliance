/** Shared chart styling constants for the Industrial Slate theme */

export const gridStyle = {
  strokeDasharray: "3 3",
  stroke: "var(--border)",
  strokeOpacity: 0.5,
} as const;

export const axisTickStyle = {
  fontSize: 11,
  fill: "var(--muted-foreground)",
} as const;

export const axisLineStyle = {
  stroke: "var(--border)",
  strokeOpacity: 0.3,
} as const;

export const barRadius = [4, 4, 0, 0] as [number, number, number, number];

export const animationProps = {
  animationBegin: 0,
  animationDuration: 600,
  animationEasing: "ease-out" as const,
};

export const chartColors = {
  primary: "var(--chart-1)",
  secondary: "var(--chart-2)",
  tertiary: "var(--chart-3)",
  danger: "var(--chart-4)",
  info: "var(--chart-5)",
} as const;
