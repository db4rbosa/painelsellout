import { DIMENSIONS, type DimensionKey } from "./sales-data";

const removed = new Set<string>(["billTo", "shipTo", "state", "city"]);
export const CHART_DIMENSIONS = DIMENSIONS.filter((dimension) => !removed.has(dimension.key));
export const chartGrouping = (value: DimensionKey | "none"): DimensionKey | "none" =>
  value === "none" || CHART_DIMENSIONS.some((dimension) => dimension.key === value) ? value : "lob";