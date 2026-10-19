import test from "node:test";
import assert from "node:assert/strict";
import { inspectImageBounds, ImageBoundsError } from "./image-bounds";
// Container/header fixtures only: these tests do not claim successful decoding.
function png(width: number, height: number, animated = false) {
  const header = Buffer.alloc(25); Buffer.from([137,80,78,71,13,10,26,10]).copy(header); header.writeUInt32BE(13,8); header.write("IHDR",12); header.writeUInt32BE(width,16); header.writeUInt32BE(height,20);
  return Buffer.concat([header, Buffer.alloc(8), ...(animated ? [Buffer.from([0,0,0,0,97,99,84,76,0,0,0,0])] : []), Buffer.from([0,0,0,0,73,69,78,68,0,0,0,0])]);
}
function webp(width: number, height: number) {
  const image = Buffer.alloc(30); image.write("RIFF"); image.writeUInt32LE(22,4); image.write("WEBPVP8 ",8); image.writeUInt32LE(10,16); Buffer.from([0x9d,1,0x2a]).copy(image,23); image.writeUInt16LE(width,26); image.writeUInt16LE(height,28); return image;
}
function jpeg(width: number, height: number) {
  const image = Buffer.from([255,216,255,192,0,8,8,0,0,0,0,1,255,218,0,2,255,217]); image.writeUInt16BE(height,7); image.writeUInt16BE(width,9); return image;
}
test("PNG JPEG WebP metadata is checked without allocating decoded pixels", () => {
  for (const [mime,make] of [["image/png",png],["image/jpeg",jpeg],["image/webp",webp]] as const) assert.deepEqual(inspectImageBounds(make(1200,800),mime),{width:1200,height:800});
});
test("compressed dimensions are bounded independently of file byte size", () => {
  for (const [mime,make] of [["image/png",png],["image/jpeg",jpeg],["image/webp",webp]] as const) {
    for (const [width,height] of [[8000,8000],[8193,1]] as const) assert.throws(() => inspectImageBounds(make(width,height),mime), e => e instanceof ImageBoundsError && e.status === 413);
  }
});
test("MIME spoofing, truncated/oversized chunks and animated PNG are rejected", () => {
  assert.throws(() => inspectImageBounds(png(1,1),"image/jpeg"));
  assert.throws(() => inspectImageBounds(webp(1,1).subarray(0,22),"image/webp"));
  const broken = png(1,1); broken.writeUInt32BE(0xffffffff,8); assert.throws(() => inspectImageBounds(broken,"image/png"));
  assert.throws(() => inspectImageBounds(png(1,1,true),"image/png"), e => e instanceof ImageBoundsError && e.code === "ANIMATED_IMAGE_UNSUPPORTED");
  for (let length=0;length<40;length++) for(const mime of ["image/png","image/jpeg","image/webp"]) assert.throws(()=>inspectImageBounds(Buffer.alloc(length),mime),ImageBoundsError);
});

test("WebP lossless dimensions and extended animation/canvas cannot bypass bounds", () => {
  const lossless = Buffer.alloc(26); lossless.write("RIFF"); lossless.writeUInt32LE(18,4); lossless.write("WEBPVP8L",8); lossless.writeUInt32LE(5,16); lossless[20]=0x2f; lossless.writeUInt32LE(((800-1)<<14)|(1200-1),21);
  assert.deepEqual(inspectImageBounds(lossless,"image/webp"),{width:1200,height:800});
  const extended = Buffer.alloc(48); extended.write("RIFF"); extended.writeUInt32LE(40,4); extended.write("WEBPVP8X",8); extended.writeUInt32LE(10,16); extended.writeUIntLE(1199,24,3); extended.writeUIntLE(799,27,3); webp(1200,800).subarray(12).copy(extended,30);
  assert.deepEqual(inspectImageBounds(extended,"image/webp"),{width:1200,height:800});
  extended[20]=2; assert.throws(()=>inspectImageBounds(extended,"image/webp"),e=>e instanceof ImageBoundsError && e.status===415);
  extended[20]=0; extended.writeUIntLE(1200,24,3); assert.throws(()=>inspectImageBounds(extended,"image/webp"));
});
