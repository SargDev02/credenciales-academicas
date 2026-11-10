// Metadata preflight, not an image decoder or an authenticity check.
// PNG: W3C PNG-3; JPEG: ITU T.81 SOF; WebP: Google's RIFF specification.
export class ImageBoundsError extends Error {
  constructor(readonly status: 400 | 413 | 415, readonly code: string, message: string) { super(message); }
}
function invalid(): never { throw new ImageBoundsError(400, "INVALID_IMAGE_HEADERS", "La imagen no tiene una estructura admitida"); }
function dimensions(width: number, height: number) {
  if (!width || !height) invalid();
  if (width > 8192 || height > 8192 || width * height > 16_000_000) throw new ImageBoundsError(413, "IMAGE_DIMENSIONS_TOO_LARGE", "La imagen supera 16 megapíxeles o 8192 píxeles por lado");
  return { width, height };
}
function animated(): never { throw new ImageBoundsError(415, "ANIMATED_IMAGE_UNSUPPORTED", "Usa una imagen fija del documento"); }
function png(image: Buffer) {
  if (image.length < 33 || !image.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) || image.readUInt32BE(8) !== 13 || image.toString("ascii", 12, 16) !== "IHDR") invalid();
  const size = dimensions(image.readUInt32BE(16), image.readUInt32BE(20));
  let offset = 8, chunks = 0;
  while (offset + 12 <= image.length && ++chunks <= 10000) {
    const length = image.readUInt32BE(offset), type = image.toString("ascii", offset + 4, offset + 8);
    if (offset + 12 + length > image.length) invalid();
    if (type === "IHDR" && offset !== 8) invalid();
    if (type === "acTL" || type === "fcTL" || type === "fdAT") animated();
    offset += 12 + length;
    if (type === "IEND") { if (length || offset !== image.length) invalid(); return size; }
  }
  return invalid();
}
function jpeg(image: Buffer) {
  if (image.length < 4 || image.readUInt16BE(0) !== 0xffd8 || image.readUInt16BE(image.length - 2) !== 0xffd9) invalid();
  let offset = 2, segments = 0;
  let size: { width: number; height: number } | undefined;
  const sof = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
  while (offset + 3 < image.length && ++segments <= 10000) {
    if (image[offset++] !== 0xff) invalid();
    while (image[offset] === 0xff) offset++;
    const marker = image[offset++];
    if (marker === undefined || offset + 2 > image.length) invalid();
    const length = image.readUInt16BE(offset);
    if (length < 2 || offset + length > image.length) invalid();
    if (marker === 0xda) { if (!size) invalid(); return size; }
    if (sof.has(marker)) {
      if (size || length < 8) invalid();
      size = dimensions(image.readUInt16BE(offset + 5), image.readUInt16BE(offset + 3));
    }
    offset += length;
  }
  return invalid();
}
function webp(image: Buffer) {
  if (image.length < 20 || image.toString("ascii", 0, 4) !== "RIFF" || image.toString("ascii", 8, 12) !== "WEBP" || image.readUInt32LE(4) + 8 !== image.length) invalid();
  let offset = 12, chunks = 0;
  let canvas: { width: number; height: number } | undefined;
  let frame: { width: number; height: number } | undefined;
  while (offset + 8 <= image.length && ++chunks <= 10000) {
    const type = image.toString("ascii", offset, offset + 4), length = image.readUInt32LE(offset + 4), data = offset + 8;
    if (data + length + (length % 2) > image.length) invalid();
    if (type === "ANIM" || type === "ANMF") animated();
    if (type === "VP8X") {
      if (canvas || offset !== 12 || length !== 10) invalid();
      if (image.readUInt8(data) & 2) animated();
      canvas = dimensions(image.readUIntLE(data + 4, 3) + 1, image.readUIntLE(data + 7, 3) + 1);
    }
    if (type === "VP8 " || type === "VP8L") {
      if (frame) invalid();
      if (type === "VP8 ") {
        if (length < 10 || image.toString("hex", data + 3, data + 6) !== "9d012a") invalid();
        frame = dimensions(image.readUInt16LE(data + 6) & 0x3fff, image.readUInt16LE(data + 8) & 0x3fff);
      } else {
        if (length < 5 || image[data] !== 0x2f) invalid();
        const packed = image.readUInt32LE(data + 1);
        if (packed >>> 29) invalid();
        frame = dimensions((packed & 0x3fff) + 1, ((packed >>> 14) & 0x3fff) + 1);
      }
    }
    offset = data + length + (length % 2);
  }
  if (!frame || offset !== image.length || (canvas && (canvas.width !== frame.width || canvas.height !== frame.height))) invalid();
  return frame;
}
export function inspectImageBounds(image: Buffer, mime: string) {
  if (mime === "image/png") return png(image);
  if (mime === "image/jpeg") return jpeg(image);
  if (mime === "image/webp") return webp(image);
  throw new ImageBoundsError(415, "UNSUPPORTED_DOCUMENT_TYPE", "Usa una imagen JPEG, PNG o WEBP");
}
