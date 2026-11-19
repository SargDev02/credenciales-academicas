import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { chromiumLaunchOptions } from "../../../tests/helpers/browser.mjs";
import { inspectImageBounds } from "../src/lib/image-bounds";
import { TesseractOcrProvider } from "../src/lib/ocr-provider";

// Opt-in operator check. Synthetic pixels only; no Auth/DB/env or real documents.
// Tesseract may download its language model on first run. Never commit traineddata.
const browser = await chromium.launch(chromiumLaunchOptions);
let image: Buffer;
try {
  const page = await browser.newPage({ viewport: { width: 900, height: 280 } });
  await page.setContent('<html lang="es"><body style="margin:0;padding:40px;background:white;color:black;font:40px Arial"><p>PRUEBA SINTETICA OCR LOCAL</p><p>123456789</p></body></html>');
  image = await page.screenshot({ type: "png" });
} finally { await browser.close(); }
assert.deepEqual(inspectImageBounds(image, "image/png"), { width: 900, height: 280 });
const result = await new TesseractOcrProvider().recognize(image);
assert.equal(result.provider, "TESSERACT_LOCAL");
assert.ok(result.text.toUpperCase().includes("PRUEBA"), "Synthetic text not recognized");
assert.ok(result.confidence >= 0 && result.confidence <= 1);
console.log(JSON.stringify({ localOcr: "PASS", provider: result.provider, imagePreflight: "PASS", dimensions: [900, 280], databaseWrites: 0, authenticIdentityClaim: false }));
