import { createWorker } from "tesseract.js";

export type OcrProviderName =
  | "TESSERACT_LOCAL"
  | "MOCK_DESARROLLO";

export type OcrResult = {
  provider: OcrProviderName;
  text: string;
  confidence: number;
};

export interface OcrProvider {
  readonly name: OcrProviderName;
  recognize(image: Buffer): Promise<OcrResult>;
}

export class TesseractOcrProvider implements OcrProvider {
  readonly name = "TESSERACT_LOCAL" as const;

  async recognize(image: Buffer): Promise<OcrResult> {
    const worker = await createWorker("spa");

    try {
      const result = await worker.recognize(image);
      const confidence = Math.max(
        0,
        Math.min(1, (result.data.confidence ?? 0) / 100),
      );

      return {
        provider: this.name,
        text: result.data.text ?? "",
        confidence,
      };
    } finally {
      await worker.terminate();
    }
  }
}

let provider: OcrProvider | undefined;

export function getOcrProvider(): OcrProvider {
  provider ??= new TesseractOcrProvider();
  return provider;
}
