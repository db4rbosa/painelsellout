import { describe, expect, it } from "vitest";
import { zipSync, strToU8 } from "fflate";
import { buildSeries, matrixToRows, parseSalesNumber, parseWorkbookBuffer } from "./sales-data";
import { readSheetMatrix } from "./xlsx-fast";
import { buildAttainment } from "./targets";

const headers = ["Fiscal Year", "Fiscal Month", "Fiscal Quarter", "Account", "Line of Business", "Extended Net Price USD", "Quantity"];
const matrix = () => [headers, [2026, 1, 1, "Account", "Service", -1234.56, 2]];
const cell = (ref: string, value: string) => `<c r="${ref}" t="inlineStr"><is><t>${value}</t></is></c>`;
const workbook = (sheet: string, reordered = false) => zipSync({
  "xl/workbook.xml": strToU8(`<workbook><sheets><sheet name="First" r:id="rId${reordered ? 2 : 1}"/></sheets></workbook>`),
  "xl/_rels/workbook.xml.rels": strToU8('<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="worksheets/sheet2.xml"/></Relationships>'),
  "xl/worksheets/sheet1.xml": strToU8(reordered ? '<worksheet><sheetData><row r="1">' + cell("A1", "Wrong") + '</row></sheetData></worksheet>' : sheet),
  ...(reordered ? { "xl/worksheets/sheet2.xml": strToU8(sheet) } : {}),
});

describe("sales import integrity", () => {
  it.each([["123.45", 123.45], ["1,234.56", 1234.56], ["1.234,56", 1234.56], ["3,000,000", 3000000], ["3.000.000", 3000000], ["-123,45", -123.45], ["(1,234.56)", -1234.56]])("parses %s without changing magnitude", (raw, expected) => expect(parseSalesNumber(raw)).toBe(expected));
  it("rejects numeric errors rather than silently replacing revenue with zero", () => expect(() => parseSalesNumber("#VALUE!")).toThrow());
  it("rejects missing required columns", () => expect(() => matrixToRows([["Fiscal Month"], [1]])).toThrow("Colunas obrigatórias"));
  it("rejects invalid months", () => expect(() => matrixToRows([headers, [2026, 13, 1, "Account", "Service", 10, 1]])).toThrow("Mês fiscal"));
  it("rejects quarters inconsistent with months", () => expect(() => matrixToRows([headers, [2026, 1, 2, "Account", "Service", 10, 1]])).toThrow("Quarter incompatível"));
  it("does not combine multiple fiscal years into one annual target", () => expect(() => matrixToRows([...matrix(), [2025, 1, 1, "Account", "Service", 10, 1]])).toThrow("mais de um ano"));
  it("preserves negative sales and precision in chart series", () => {
    const rows = matrixToRows(matrix());
    expect(buildSeries(rows, "lob", "month", "revenue").data[0]?.["Service"]).toBe(-1234.56);
  });
  it("reads the first sheet in workbook order", () => {
    const sheet = '<worksheet><sheetData><row r="1">' + cell("A1", "Correct") + '</row></sheetData></worksheet>';
    expect(readSheetMatrix(workbook(sheet, true))[0]?.[0]).toBe("Correct");
  });
  it("preserves data after more than 150 empty formatted rows", () => {
    const gap = Array.from({ length: 200 }, (_, i) => `<row r="${i + 2}"><c r="A${i + 2}" s="1"/></row>`).join("");
    const sheet = '<worksheet><sheetData><row r="1">' + cell("A1", "Before") + '</row>' + gap + '<row r="202">' + cell("A202", "After") + '</row></sheetData></worksheet>';
    expect(readSheetMatrix(workbook(sheet))).toEqual([["Before"], ["After"]]);
  });
  it("decodes hex entities without double-unescaping text", () => {
    const sheet = '<worksheet><sheetData><row r="1">' + cell("A1", "&#x41;&amp;lt;") + '</row></sheetData></worksheet>';
    expect(readSheetMatrix(workbook(sheet))[0]?.[0]).toBe("A&lt;");
  });
  it("browser and buffer parser reject incomplete required data", async () => {
    const sheet = '<worksheet><sheetData><row r="1">' + cell("A1", "Fiscal Month") + '</row><row r="2"><c r="A2"><v>1</v></c></row></sheetData></worksheet>';
    const bytes = workbook(sheet);
    await expect(parseWorkbookBuffer(Uint8Array.from(bytes).buffer, "sales.xlsx")).rejects.toThrow();
  });
  it("indexed aggregation retains full negative revenue in each overlapping bucket only once", () => {
    const result = buildAttainment(matrixToRows(matrix()), { annual: 0, byBucket: { m1: [100, 0, 0, 0], m4: [100, 0, 0, 0] } }, [
      { id: "m1", name: "M1", lineOfBusiness: ["Service", " service "] },
      { id: "m4", name: "M4", lineOfBusiness: ["SERVICE"] },
    ], [1], { 1: ["Account"] });
    expect(result.buckets.map((bucket) => bucket.total.actual)).toEqual([-1234.56, -1234.56]);
  });
});