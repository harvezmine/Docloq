// Overwrites file content with zeros before unlinking.

import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import path from 'path';

export const secureWipe = async (filePath) => {
  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) {
      console.warn(`[SecureWipe] Not a file, skipping: ${filePath}`);
      return false;
    }

    const fileSize = stat.size;

    if (fileSize > 0) {
      const zeros = Buffer.alloc(Math.min(fileSize, 64 * 1024), 0); // 64 KB chunks
      const fd = await fs.open(filePath, 'w');
      let written = 0;
      while (written < fileSize) {
        const toWrite = Math.min(zeros.length, fileSize - written);
        await fd.write(zeros, 0, toWrite, written);
        written += toWrite;
      }
      await fd.close();
    }

    await fs.unlink(filePath);

    console.log(`[SecureWipe] Wiped: ${path.basename(filePath)}`);
    return true;
  } catch (err) {
    if (err.code === 'ENOENT') {
      // File already gone — not an error
      return true;
    }
    console.error(`[SecureWipe] Failed to wipe ${filePath}:`, err.message);
    return false;
  }
};

export const wipeDirectory = async (dirPath) => {
  const result = { filesWiped: 0, errors: [] };

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        const sub = await wipeDirectory(fullPath);
        result.filesWiped += sub.filesWiped;
        result.errors.push(...sub.errors);
      } else {
        const ok = await secureWipe(fullPath);
        if (ok) {
          result.filesWiped++;
        } else {
          result.errors.push(fullPath);
        }
      }
    }

    await fs.rmdir(dirPath);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      result.errors.push(`${dirPath}: ${err.message}`);
    }
  }

  return result;
};
