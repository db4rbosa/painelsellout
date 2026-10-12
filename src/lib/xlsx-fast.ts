import { Unzip, UnzipInflate, unzipSync } from "fflate";

const colIndex = (ref: string): number => {
  let n = 0;
  for (let i = 0; i < ref.length; i++) n = n * 26 + (ref.charCodeAt(i) - 64);
  return n - 1;
};

const unescapeXml = (s: string): string =>
  s.replace(/&(#x[\da-f]+|#\d+|lt|gt|quot|apos|amp);/gi, (entity, code: string) => {
    if (code.startsWith("#")) {
      const value = code[1]?.toLowerCase() === "x" ? parseInt(code.slice(2), 16) : Number(code.slice(1));
      return value >= 0 && value <= 0x10ffff ? String.fromCodePoint(value) : entity;
    }
    return ({ lt: "<", gt: ">", quot: '"', apos: "'", amp: "&" } as Record<string, string>)[code] ?? entity;
  });

const attributes = (tag: string) => Object.fromEntries(
  [...tag.matchAll(/([\w:]+)\s*=\s*["']([^"']*)["']/g)].map((match) => [match[1], unescapeXml(match[2] ?? "")]),
);

function workbookMetadata(bytes: Uint8Array) {
  const files = unzipSync(bytes, { filter: (file) =>
    ["xl/sharedStrings.xml", "xl/workbook.xml", "xl/_rels/workbook.xml.rels"].includes(file.name),
  });
  const decode = (name: string) => new TextDecoder().decode(files[name]);
  const first = /<sheet\s[^>]*\/?\s*>/.exec(decode("xl/workbook.xml"))?.[0];
  if (!first) throw new Error("A planilha não contém abas.");
  const id = attributes(first)["r:id"];
  const relation = [...decode("xl/_rels/workbook.xml.rels").matchAll(/<Relationship\s[^>]*\/?\s*>/g)]
    .map((match) => attributes(match[0])).find((item) => item.Id === id);
  if (!relation?.Target || relation.TargetMode === "External") throw new Error("A primeira aba não pôde ser localizada.");
  const parts: string[] = [];
  for (const part of (relation.Target.startsWith("/") ? relation.Target.slice(1) : `xl/${relation.Target}`).split("/")) {
    if (part === "..") parts.pop();
    else if (part && part !== ".") parts.push(part);
  }
  const strings: string[] = [];
  for (const si of decode("xl/sharedStrings.xml").matchAll(/<si\b[^>]*>(.*?)<\/si>/gs)) {
    let text = "";
    for (const t of (si[1] ?? "").matchAll(/<t\b[^>]*>(.*?)<\/t>/gs)) text += t[1] ?? "";
    strings.push(unescapeXml(text));
  }
  return { sheetPath: parts.join("/"), strings };
}

const CELL_RE = /<c\s[^>]*?r="([A-Z]+)\d+"([^>]*?)(?:\/>|>(.*?)<\/c>)/gs;
function parseRow(xml: string, strings: string[]): unknown[] {
  const cells: unknown[] = [];
  CELL_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = CELL_RE.exec(xml))) {
    const inner = match[3];
    const ref = match[1];
    if (!inner || !ref) continue;
    const type = /t="([^"]+)"/.exec(match[2] ?? "")?.[1];
    let value: unknown;
    if (type === "inlineStr") {
      let text = "";
      for (const t of inner.matchAll(/<t\b[^>]*>(.*?)<\/t>/gs)) text += t[1] ?? "";
      value = unescapeXml(text);
    } else {
      const raw = /<v\b[^>]*>(.*?)<\/v>/s.exec(inner)?.[1];
      if (raw === undefined) {
        if (/<f\b/.test(inner)) throw new Error("Há fórmulas sem resultado salvo. Abra e salve a planilha no Excel antes de importar.");
        continue;
      }
      if (type === "e") throw new Error("Há células com erro na planilha. Corrija-as antes de importar.");
      if (type === "s") {
        value = strings[Number(raw)];
        if (value === undefined) throw new Error("Referência de texto inválida na planilha.");
      } else if (type === "str") value = unescapeXml(raw);
      else if (type === "b") value = raw === "1";
      else value = Number.isFinite(Number(raw)) ? Number(raw) : unescapeXml(raw);
    }
    cells[colIndex(ref)] = value;
  }
  return cells;
}

/** Lê a primeira aba na ordem do Excel, sem descartar dados após intervalos vazios. */
export function readSheetMatrix(bytes: Uint8Array): unknown[][] {
  const { sheetPath, strings } = workbookMetadata(bytes);
  const decoder = new TextDecoder();
  const matrix: unknown[][] = [];
  let buffer = "";
  let found = false;
  let finished = false;
  let failure: Error | undefined;
  const unzipper = new Unzip((file) => {
    if (file.name !== sheetPath) return;
    found = true;
    file.ondata = (error, chunk, final) => {
      if (error) { failure = error; return; }
      buffer += decoder.decode(chunk, { stream: !final });
      const rows = /<row\b[^>]*(?:\/>|>[\s\S]*?<\/row>)/g;
      let match: RegExpExecArray | null;
      let consumed = 0;
      while ((match = rows.exec(buffer))) {
        consumed = rows.lastIndex;
        // Empty formatting rows cost no cell parsing and consume no matrix memory.
        if (!/<(?:v|t|f)\b/.test(match[0])) continue;
        const cells = parseRow(match[0], strings);
        if (cells.some((cell) => cell !== "" && cell !== undefined)) matrix.push(cells);
      }
      buffer = buffer.slice(consumed);
      if (final) finished = /<\/worksheet>/.test(buffer);
    };
    file.start();
  });
  unzipper.register(UnzipInflate);
  const chunkSize = 1 << 16;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const end = Math.min(offset + chunkSize, bytes.length);
    unzipper.push(bytes.subarray(offset, end), end === bytes.length);
    if (failure) throw failure;
  }
  if (!found || !finished) throw new Error("A planilha está incompleta ou corrompida.");
  return matrix;
}
