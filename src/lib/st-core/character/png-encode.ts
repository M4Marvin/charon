import { crc32 } from "crc";

interface PngChunk {
  name: string;
  data: Uint8Array;
}

/**
 * Encode an array of PNG chunks into a valid PNG file.
 * Based on https://github.com/hughsk/png-chunks-encode (MIT)
 */
export function encodePngChunks(chunks: PngChunk[]): Uint8Array {
  const uint8 = new Uint8Array(4);
  const int32 = new Int32Array(uint8.buffer);
  const uint32 = new Uint32Array(uint8.buffer);

  let totalSize = 8; // PNG signature
  let idx = totalSize;

  for (const chunk of chunks) {
    totalSize += chunk.data.length + 12;
  }

  const output = new Uint8Array(totalSize);

  // PNG Signature: 89 50 4E 47 0D 0A 1A 0A
  output[0] = 0x89;
  output[1] = 0x50;
  output[2] = 0x4e;
  output[3] = 0x47;
  output[4] = 0x0d;
  output[5] = 0x0a;
  output[6] = 0x1a;
  output[7] = 0x0a;

  for (const chunk of chunks) {
    const { name, data } = chunk;
    const size = data.length;
    const nameChars = [
      name.charCodeAt(0),
      name.charCodeAt(1),
      name.charCodeAt(2),
      name.charCodeAt(3),
    ];

    // Chunk length (big-endian)
    uint32[0] = size;
    output[idx++] = uint8[3];
    output[idx++] = uint8[2];
    output[idx++] = uint8[1];
    output[idx++] = uint8[0];

    // Chunk type
    output[idx++] = nameChars[0];
    output[idx++] = nameChars[1];
    output[idx++] = nameChars[2];
    output[idx++] = nameChars[3];

    // Chunk data
    for (let j = 0; j < size; ) output[idx++] = data[j++];

    // CRC32 of type + data (cumulative)
    const typeBuf = Buffer.from(nameChars);
    const typeCrc = crc32(typeBuf);
    const crc = crc32(Buffer.from(data), typeCrc);
    int32[0] = crc;
    output[idx++] = uint8[3];
    output[idx++] = uint8[2];
    output[idx++] = uint8[1];
    output[idx++] = uint8[0];
  }

  return output;
}
