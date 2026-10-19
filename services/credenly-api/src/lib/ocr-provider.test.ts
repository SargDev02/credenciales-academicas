import test from "node:test";
import assert from "node:assert/strict";
import { TesseractOcrProvider, OcrResourceError } from "./ocr-provider";

function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; }
const result = { data: { text: "SYNTHETIC", confidence: 98 } };
const image = Buffer.from("synthetic test bytes");

test("OCR admission is bounded before creating workers and waits for termination", async () => {
  const recognized = deferred<typeof result>();
  const terminated = deferred<void>();
  let starts = 0;
  const provider = new TesseractOcrProvider(async () => {
    starts++;
    return { recognize: () => recognized.promise, terminate: () => terminated.promise };
  });
  const first = provider.recognize(image);
  await assert.rejects(provider.recognize(image), e => e instanceof OcrResourceError && e.status === 429);
  assert.equal(starts, 1);
  recognized.resolve(result);
  await Promise.resolve();
  await assert.rejects(provider.recognize(image), e => e instanceof OcrResourceError && e.status === 429);
  terminated.resolve();
  assert.deepEqual(await first, { text: "SYNTHETIC", confidence: 0.98, provider: "TESSERACT_LOCAL" });
});
test("OCR timeout terminates a running worker and returns sanitized 504", async () => {
  let terminated = 0;
  const provider = new TesseractOcrProvider(async () => ({
    recognize: () => new Promise(() => {}),
    terminate: async () => { terminated++; },
  }), 10);
  await assert.rejects(provider.recognize(image), e => e instanceof OcrResourceError && e.status === 504 && e.code === "OCR_TIMEOUT");
  assert.equal(terminated, 1);
});
test("late worker startup cannot escape the deadline or release capacity early", async () => {
  const startup = deferred<{ recognize: () => Promise<typeof result>; terminate: () => Promise<void> }>();
  const ended = deferred<void>();
  let recognized = false;
  const provider = new TesseractOcrProvider(() => startup.promise, 10);
  await assert.rejects(provider.recognize(image), e => e instanceof OcrResourceError && e.status === 504);
  await assert.rejects(provider.recognize(image), e => e instanceof OcrResourceError && e.status === 429);
  startup.resolve({ recognize: async () => { recognized = true; return result; }, terminate: () => ended.promise });
  await Promise.resolve();
  await assert.rejects(provider.recognize(image), e => e instanceof OcrResourceError && e.status === 429);
  ended.resolve();
  assert.equal(recognized, false);
});
test("worker startup failure releases capacity for a later attempt", async () => {
  let starts = 0;
  const provider = new TesseractOcrProvider(async () => {
    if (++starts === 1) throw new Error("synthetic startup failure");
    return { recognize: async () => result, terminate: async () => {} };
  });
  await assert.rejects(provider.recognize(image));
  assert.equal((await provider.recognize(image)).text, "SYNTHETIC");
});
