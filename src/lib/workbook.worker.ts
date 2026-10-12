import { parseWorkbookBuffer } from "./sales-data";

self.onmessage = async (event: MessageEvent<{ buffer: ArrayBuffer; fileName: string }>) => {
  try {
    const rows = await parseWorkbookBuffer(event.data.buffer, event.data.fileName);
    self.postMessage({ rows });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : "Não foi possível ler a planilha." });
  }
};