// Packs extension/ into dist/telegram-media-download-v<version>.zip.
// Uses only Node built-ins (Node 22+ for zlib.crc32).
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const source = path.join(root, "extension");
const { version } = JSON.parse(await readFile(path.join(source, "manifest.json"), "utf8"));
const output = path.join(root, "dist", `telegram-media-download-v${version}.zip`);

// The SVG is only the source for the PNG icons; it is not used at runtime.
const EXCLUDED = new Set(["icons/icon.svg"]);

const listFiles = async (dir) => {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(entries.map((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? listFiles(full) : [full];
  }));
  return files.flat();
};

// Fixed timestamp keeps the archive reproducible: 2026-01-01 00:00 in DOS format.
const DOS_TIME = 0;
const DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1;

const files = (await listFiles(source))
  .map((full) => ({ full, name: path.relative(source, full).split(path.sep).join("/") }))
  .filter(({ name }) => !EXCLUDED.has(name))
  .sort((a, b) => a.name.localeCompare(b.name));

const localParts = [];
const centralParts = [];
let offset = 0;
for (const { full, name } of files) {
  const data = await readFile(full);
  const compressed = zlib.deflateRawSync(data, { level: 9 });
  const nameBytes = Buffer.from(name, "utf8");
  const crc = zlib.crc32(data);

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);            // version needed
  local.writeUInt16LE(0x0800, 6);        // UTF-8 names
  local.writeUInt16LE(8, 8);             // deflate
  local.writeUInt16LE(DOS_TIME, 10);
  local.writeUInt16LE(DOS_DATE, 12);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(compressed.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(nameBytes.length, 26);
  localParts.push(local, nameBytes, compressed);

  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);          // version made by
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(0x0800, 8);
  central.writeUInt16LE(8, 10);
  central.writeUInt16LE(DOS_TIME, 12);
  central.writeUInt16LE(DOS_DATE, 14);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(compressed.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(nameBytes.length, 28);
  central.writeUInt32LE(offset, 42);
  centralParts.push(central, nameBytes);

  offset += local.length + nameBytes.length + compressed.length;
}

const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(files.length, 8);
end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(centralSize, 12);
end.writeUInt32LE(offset, 16);

await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, Buffer.concat([...localParts, ...centralParts, end]));
console.log(`Packed ${files.length} files into ${path.relative(root, output)}`);
