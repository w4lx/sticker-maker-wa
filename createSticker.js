const { readFile, unlink } = require("fs/promises");
const { Readable } = require("stream");
const { spawn } = require("child_process");
const { tmpdir } = require("os");
const { resolve } = require("path");
const sharp = require("sharp");
const embedMetadata = require("./metadata");

async function createSticker(input, { ffmpeg, metadata } = {}) {
  if (!input) {
    throw new Error("An input file was not provided.");
  }

  if (!Buffer.isBuffer(input) && !(input instanceof Readable)) {
    throw new Error("You must pass a stream or buffer");
  }

  const buffer =
    input instanceof Readable ? await streamToBuffer(input) : input;

  if (!Buffer.isBuffer(buffer)) {
    throw new Error("The input file is not a valid buffer.");
  }

  const { fileTypeFromBuffer } = await import("file-type");
  const type = await fileTypeFromBuffer(buffer);

  if (type?.mime?.startsWith("image")) {
    return await processImage(buffer, metadata);
  } else if (type?.mime?.startsWith("video")) {
    if (!ffmpeg) throw new Error("The ffmpeg path is not specified.");
    return await processVideo(buffer, ffmpeg, metadata);
  } else {
    throw new Error("The file is neither a valid image nor a video.");
  }
}

async function processImage(buffer, metadata) {
  const options = {
    fit: "contain",
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  };

  const sticker = await sharp(buffer)
    .webp()
    .resize(512, 512, options)
    .toBuffer();

  return await embedMetadata(sticker, metadata);
}

async function processVideo(buffer, ffmpeg, metadata) {
  const output = resolve(tmpdir(), `${Date.now()}.webp`);

  const args = [
    "-i",
    "-",
    "-vcodec",
    "libwebp",
    "-vf",
    "scale='iw*min(300/iw,300/ih)':'ih*min(300/iw,300/ih)',format=rgba,pad=300:300:'(300-iw)/2':'(300-ih)/2':'#00000000',setsar=1,fps=10",
    "-loop",
    "0",
    "-t",
    "5",
    "-an",
    "-vsync",
    "0",
    "-s",
    "512:512",
    "-qscale:v",
    "50",
    output,
  ];

  try {
    await new Promise((resolve, reject) => {
      const ffmpegProc = spawn(ffmpeg, args);

      ffmpegProc.stdin.write(buffer);
      ffmpegProc.stdin.end();
      ffmpegProc.stdin.on("error", () => null);
      ffmpegProc.on("close", (code) => {
        if (code === 0) {
          resolve(true);
        } else {
          reject(`FFmpeg exited with code ${code}`);
        }
      });
    });

    const sticker = await readFile(output);
    return await embedMetadata(sticker, metadata);
  } finally {
    await unlink(output).catch(console.error);
  }
}

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

module.exports = createSticker;
