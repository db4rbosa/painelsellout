import { parseWorkbookBuffer } from "./sales-data";

self.onmessage = async (event: MessageEvent<{ buffer: ArrayBuffer; fileName: string }>) => {
  try {
    const result = await parseWorkbookBuffer(event.data.buffer, event.data.fileName);
    self.postMessage({ rows: result.rows, warnings: result.warnings });
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : "Não foi possível ler a planilha.",
    });
  }
};
