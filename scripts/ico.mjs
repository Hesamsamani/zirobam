// Packs PNG pictures into one Windows icon (.ico) file. Browsers and Windows read a PNG inside an .ico directly.
//
// Layout: a 6-byte header (reserved 0, type 1, count), then one 16-byte entry for each picture (width, height,
// colour count, reserved, planes, bits per pixel, size of the data, offset of the data), then the pictures.

/** @param {{ size: number, png: Buffer }[]} images pictures that are `size` by `size` pixels, 1 to 256 */
export function packIco(images) {
  if (images.length === 0) throw new Error('an icon needs at least one picture');
  const headerSize = 6 + images.length * 16;
  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = headerSize;
  images.forEach(({ size, png }, i) => {
    if (!Number.isInteger(size) || size < 1 || size > 256) throw new Error(`an icon picture is 1 to 256 pixels, not ${size}`);
    const at = 6 + i * 16;
    header[at] = size === 256 ? 0 : size; // the format writes 256 as 0
    header[at + 1] = size === 256 ? 0 : size;
    header[at + 2] = 0; // no palette
    header[at + 3] = 0;
    header.writeUInt16LE(1, at + 4); // colour planes
    header.writeUInt16LE(32, at + 6); // bits per pixel
    header.writeUInt32LE(png.length, at + 8);
    header.writeUInt32LE(offset, at + 12);
    offset += png.length;
  });
  return Buffer.concat([header, ...images.map((image) => image.png)]);
}
