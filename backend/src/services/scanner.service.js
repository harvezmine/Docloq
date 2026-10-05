// No-ops clean when SCANNER_ENABLED=false; otherwise scans via a ClamAV daemon over TCP.

import fs from 'fs/promises';
import net from 'net';
import uploadConfig from '../config/upload.config.js';

const { enabled, clamavHost, clamavPort } = uploadConfig.scanner;

/** Scans a buffer via ClamAV's INSTREAM command (clamd TCP protocol). */
const clamavScan = (buffer) => {
  return new Promise((resolve, reject) => {
    const client = new net.Socket();
    let response = '';
    const timeout = 30_000;

    client.setTimeout(timeout);

    client.connect(clamavPort, clamavHost, () => {
      client.write('zINSTREAM\0');

      // Send data in chunks (max 2 KB each for safety, though clamd allows more)
      const CHUNK_SIZE = 2048;
      for (let i = 0; i < buffer.length; i += CHUNK_SIZE) {
        const chunk = buffer.subarray(i, i + CHUNK_SIZE);
        // 4-byte big-endian length prefix + chunk
        const sizeHeader = Buffer.alloc(4);
        sizeHeader.writeUInt32BE(chunk.length, 0);
        client.write(sizeHeader);
        client.write(chunk);
      }

      // End stream with zero-length chunk
      const endHeader = Buffer.alloc(4);
      endHeader.writeUInt32BE(0, 0);
      client.write(endHeader);
    });

    client.on('data', (data) => {
      response += data.toString();
    });

    client.on('end', () => {
      // ClamAV replies "stream: OK\0" or "stream: <name> FOUND\0" (null-terminated).
      const trimmed = response.replace(/\0/g, '').trim();
      if (trimmed.endsWith('OK')) {
        resolve({ isClean: true, threatName: null });
      } else {
        const match = trimmed.match(/stream:\s*(.+)\s+FOUND/);
        resolve({
          isClean: false,
          threatName: match ? match[1] : 'UNKNOWN',
        });
      }
    });

    client.on('error', (err) => {
      reject(new Error(`ClamAV connection error: ${err.message}`));
    });

    client.on('timeout', () => {
      client.destroy();
      reject(new Error('ClamAV scan timed out'));
    });
  });
};

export const scanFile = async (filePath) => {
  const start = Date.now();

  if (!enabled) {
    console.warn('[Scanner] Scanning disabled (SCANNER_ENABLED=false). Skipping scan.');
    return {
      isClean: true,
      threatName: null,
      scanTime: Date.now() - start,
      skipped: true,
    };
  }

  try {
    const buffer = await fs.readFile(filePath);
    const result = await clamavScan(buffer);
    return {
      ...result,
      scanTime: Date.now() - start,
      skipped: false,
    };
  } catch (err) {
    console.error('[Scanner] Scan failed:', err.message);
    // If ClamAV is unreachable, fail open with a warning in dev, fail closed in prod
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Malware scan failed — cannot proceed in production without scan.');
    }
    console.warn('[Scanner] ClamAV unreachable — allowing file in development mode.');
    return {
      isClean: true,
      threatName: null,
      scanTime: Date.now() - start,
      skipped: true,
      error: err.message,
    };
  }
};

/** Scans a buffer directly, without writing to disk first (unlike scanFile). */
export const scanBuffer = async (buffer) => {
  const start = Date.now();

  if (!enabled) {
    console.warn('[Scanner] Scanning disabled. Skipping.');
    return { isClean: true, threatName: null, scanTime: Date.now() - start, skipped: true };
  }

  try {
    const result = await clamavScan(buffer);
    return { ...result, scanTime: Date.now() - start, skipped: false };
  } catch (err) {
    console.error('[Scanner] Buffer scan failed:', err.message);
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Malware scan failed.');
    }
    return { isClean: true, threatName: null, scanTime: Date.now() - start, skipped: true, error: err.message };
  }
};
