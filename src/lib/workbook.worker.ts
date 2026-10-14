import { parseWorkbookBufferDetailed } from "./sales-data";

self.onmessage = async (event: MessageEvent<{ buffer: ArrayBuffer; fileName: string }>) => {
  try {
    const result = await parseWorkbookBufferDetailed(event.data.buffer, event.data.fileName);
    self.postMessage({ result });
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : "Não foi possível ler a planilha.",
    });
  }
};
