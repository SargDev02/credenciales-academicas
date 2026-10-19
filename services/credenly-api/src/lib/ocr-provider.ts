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

type Worker = {
  recognize(image: Buffer): Promise<{ data: { text?: string; confidence?: number } }>;
  terminate(): Promise<unknown>;
};

export class OcrResourceError extends Error {
  constructor(readonly status: 429 | 504, readonly code: string, message: string) {
    super(message);
  }
}

export class TesseractOcrProvider implements OcrProvider {
  readonly name = "TESSERACT_LOCAL" as const;
  private active = 0;

  constructor(
    private readonly makeWorker: () => Promise<Worker> = () => createWorker("spa"),
    private readonly timeoutMs = 45_000,
    private readonly maxWorkers = 1,
  ) {}

  async recognize(image: Buffer): Promise<OcrResult> {
    // Admission happens before worker creation. There is no unbounded queue.
    if (this.active >= this.maxWorkers) {
      throw new OcrResourceError(429, "OCR_BUSY", "El procesamiento documental está ocupado. Intenta más tarde");
    }
    this.active++;
    let worker: Worker | undefined;
    let expired = false;
    let cleanup: Promise<unknown> | undefined;
    const release = () => { this.active--; };
    const terminate = () => {
      if (worker && !cleanup) {
        // Do not admit another worker until termination is acknowledged. A
        // failed termination intentionally holds capacity until process restart.
        cleanup = worker.terminate().then(release);
      }
      return cleanup;
    };
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        expired = true;
        void terminate()?.catch(() => {});
        reject(new OcrResourceError(504, "OCR_TIMEOUT", "El procesamiento documental superó el tiempo permitido"));
      }, this.timeoutMs);
    });
    const work = (async () => {
      try {
        worker = await this.makeWorker();
      } catch (error) {
        release();
        throw error;
      }
      try {
        // A slow startup must never start recognizing after its deadline.
        if (expired) throw new OcrResourceError(504, "OCR_TIMEOUT", "El procesamiento documental superó el tiempo permitido");
        const result = await worker.recognize(image);
        return {
          provider: this.name,
          text: result.data.text ?? "",
          confidence: Math.max(0, Math.min(1, (result.data.confidence ?? 0) / 100)),
        };
      } finally {
        await terminate();
      }
    })();
    try { return await Promise.race([work, deadline]); }
    finally { if (timer) clearTimeout(timer); }
  }
}

let provider: OcrProvider | undefined;

export function getOcrProvider(): OcrProvider {
  provider ??= new TesseractOcrProvider();
  return provider;
}
