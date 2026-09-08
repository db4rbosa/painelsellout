import { Unzip, UnzipInflate, unzipSync } from "fflate";

/**
 * Leitor rápido de .xlsx pensado para planilhas com centenas de milhares de
 * linhas vazias (apenas formatadas). Descomprime a planilha em pedaços e para
 * assim que os dados reais terminam, em vez de processar o arquivo inteiro.
 */

const EMPTY_ROW_LIMIT = 150;

const colIndex = (ref: string): number => {
  let n = 0;
  for (let i = 0; i < ref.length; i++) n = n * 26 + (ref.charCodeAt(i) - 64);
  return n - 1;
};

const unescapeXml = (s: string): string =>
  s.includes("&")
    ? s
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
        .replace(/&amp;/g, "&")
    : s;

function readSharedStrings(bytes: Uint8Array): string[] {
  const files = unzipSync(bytes, { filter: (f) => f.name === "xl/sharedStrings.xml" });
  const raw = files["xl/sharedStrings.xml"];
  if (!raw) return [];
  const xml = new TextDecoder().decode(raw);
  const out: string[] = [];
  for (const si of xml.matchAll(/<si>(.*?)<\/si>/gs)) {
    let s = "";
    for (const t of si[1]!.matchAll(/<t[^>]*>(.*?)<\/t>/gs)) s += t[1]!;
    out.push(unescapeXml(s));
  }
  return out;
}

function firstSheetPath(bytes: Uint8Array): string {
  const names: string[] = [];
  unzipSync(bytes, {
    filter: (f) => {
      if (/^xl\/worksheets\/[^/]+\.xml$/.test(f.name)) names.push(f.name);
      return false;
    },
  });
  names.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  return names[0] ?? "xl/worksheets/sheet1.xml";
}

const CELL_RE = /<c\s[^>]*?r="([A-Z]+)\d+"([^>]*?)(?:\/>|>(.*?)<\/c>)/gs;

function parseRow(xml: string, strings: string[]): { cells: unknown[]; hasValue: boolean } {
  const cells: unknown[] = [];
  let hasValue = false;
  CELL_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = CELL_RE.exec(xml))) {
    const inner = m[3];
    if (!inner) continue;
    const type = /t="([^"]+)"/.exec(m[2] ?? "")?.[1];
    let value: unknown;
    if (type === "inlineStr") {
      let s = "";
      for (const t of inner.matchAll(/<t[^>]*>(.*?)<\/t>/gs)) s += t[1]!;
      value = unescapeXml(s);
    } else {
      const v = /<v[^>]*>(.*?)<\/v>/s.exec(inner)?.[1];
      if (v === undefined) continue;
      if (type === "s") value = strings[Number(v)] ?? "";
      else if (type === "str" || type === "e") value = unescapeXml(v);
      else {
        const n = Number(v);
        value = Number.isFinite(n) ? n : unescapeXml(v);
      }
    }
    if (value !== "" && value !== undefined) hasValue = true;
    cells[colIndex(m[1]!)] = value;
  }
  return { cells, hasValue };
}

/** Retorna a matriz de células da primeira aba, truncada onde os dados terminam. */
export function readSheetMatrix(bytes: Uint8Array): unknown[][] {
  const strings = readSharedStrings(bytes);
  const sheetPath = firstSheetPath(bytes);
  const decoder = new TextDecoder();

  const matrix: unknown[][] = [];
  let buffer = "";
  let emptyStreak = 0;
  let done = false;

  const unzipper = new Unzip((file) => {
    if (file.name !== sheetPath) return;
    file.ondata = (_err, chunk, final) => {
      if (done) return;
      buffer += decoder.decode(chunk, { stream: !final });
      let i: number;
      while ((i = buffer.indexOf("</row>")) !== -1) {
        const rowXml = buffer.slice(0, i);
        buffer = buffer.slice(i + 6);
        const { cells, hasValue } = parseRow(rowXml, strings);
        if (hasValue) {
          emptyStreak = 0;
          matrix.push(cells);
        } else if (matrix.length) {
          emptyStreak++;
          if (emptyStreak > EMPTY_ROW_LIMIT) {
            done = true;
            return;
          }
          matrix.push(cells);
        }
      }
    };
    file.start();
  });
  unzipper.register(UnzipInflate);

  const CHUNK = 1 << 22;
  for (let offset = 0; offset < bytes.length && !done; offset += CHUNK) {
    const end = Math.min(offset + CHUNK, bytes.length);
    unzipper.push(bytes.subarray(offset, end), end === bytes.length);
  }

  while (matrix.length && matrix[matrix.length - 1]!.every((c) => c === "" || c === undefined))
    matrix.pop();

  return matrix;
}
