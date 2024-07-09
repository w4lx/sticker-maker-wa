declare module "sticker-maker-wa" {
  export function createSticker(
    input: Buffer | import("stream").Readable,
    options?: StickerOptions
  ): Promise<Buffer>;

  interface StickerOptions {
    ffmpeg?: string;
    metadata?: {
      packname: string;
      author: string | undefined;
      categories: string[] | undefined;
    };
  }
}
