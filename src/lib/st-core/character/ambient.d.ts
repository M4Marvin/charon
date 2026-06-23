declare module "png-chunks-extract" {
  interface PngChunk {
    name: string;
    data: Uint8Array;
  }
  export default function extract(image: Uint8Array): PngChunk[];
}

declare module "png-chunk-text" {
  interface DecodedText {
    keyword: string;
    text: string;
  }
  export function decode(data: Uint8Array): DecodedText;
  export function encode(keyword: string, text: string): { name: string; data: Uint8Array };
}
