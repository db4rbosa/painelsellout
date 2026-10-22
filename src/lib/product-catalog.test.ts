import { describe, expect, it } from "vitest";
import { catalogFromMatrix } from "./product-catalog";

describe("catalogFromMatrix", () => {
  it("maps PN to DESC INGLES, normalizing case and skipping blanks", () => {
    const items = catalogFromMatrix([
      ["COD IT", "PN", "DESC PORTUGUES", "DESC INGLES"],
      [1, " ct45-x ", "Leitor", "Scanner"],
      [2, "", "x", "y"],
      [3, "AB1", "z", ""],
    ]);
    expect(items).toEqual([{ pn: "CT45-X", description: "Scanner" }]);
  });

  it("rejects sheets without the required columns", () => {
    expect(() => catalogFromMatrix([["PN"]])).toThrow();
  });
});
