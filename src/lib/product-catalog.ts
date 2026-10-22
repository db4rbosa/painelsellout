import type { CatalogItem } from "./product-catalog.functions";

export const normalizePn = (pn: string) => pn.trim().toUpperCase();

/** Extracts PN → "DESC INGLES" pairs from a sheet matrix (first row = headers). Last duplicate wins. */
export function catalogFromMatrix(matrix: unknown[][]): CatalogItem[] {
  const headers = (matrix[0] ?? []).map((h) => String(h ?? "").trim().toUpperCase());
  const cPn = headers.indexOf("PN");
  const cDesc = headers.indexOf("DESC INGLES");
  if (cPn < 0 || cDesc < 0) throw new Error("A planilha de produtos precisa das colunas PN e DESC INGLES.");
  const map = new Map<string, CatalogItem>();
  for (let i = 1; i < matrix.length; i++) {
    const r = matrix[i];
    const pn = String(r?.[cPn] ?? "").trim();
    const description = String(r?.[cDesc] ?? "").trim();
    if (pn && description) map.set(normalizePn(pn), { pn: normalizePn(pn), description });
  }
  return [...map.values()];
}
