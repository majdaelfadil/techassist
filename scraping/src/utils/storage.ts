import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { logger } from './logger';

export function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function appendJsonl<T>(filePath: string, record: T): void {
  ensureDir(path.dirname(filePath));
  fs.appendFileSync(filePath, JSON.stringify(record) + '\n', 'utf-8');
}

export function appendJsonlBatch<T>(filePath: string, records: T[]): void {
  if (records.length === 0) return;
  ensureDir(path.dirname(filePath));
  const lines = records.map(r => JSON.stringify(r)).join('\n') + '\n';
  fs.appendFileSync(filePath, lines, 'utf-8');
}

export async function readJsonlStream<T>(
  filePath: string,
  onRecord: (record: T, index: number) => Promise<void> | void
): Promise<number> {
  if (!fs.existsSync(filePath)) return 0;

  const rl = readline.createInterface({
    input: fs.createReadStream(filePath, { encoding: 'utf-8' }),
    crlfDelay: Infinity,
  });

  let index = 0;
  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const record = JSON.parse(trimmed) as T;
      await onRecord(record, index++);
    } catch {
      logger.debug(`Skipping malformed line at index ${index}`);
    }
  }
  return index;
}

export async function readAllJsonl<T>(filePath: string): Promise<T[]> {
  const records: T[] = [];
  await readJsonlStream<T>(filePath, (r) => { records.push(r); });
  return records;
}

export function writeJsonl<T>(filePath: string, records: T[]): void {
  ensureDir(path.dirname(filePath));
  const content = records.map(r => JSON.stringify(r)).join('\n') + (records.length > 0 ? '\n' : '');
  fs.writeFileSync(filePath, content, 'utf-8');
}

export function countLines(filePath: string): number {
  if (!fs.existsSync(filePath)) return 0;
  const content = fs.readFileSync(filePath, 'utf-8');
  return content.split('\n').filter(l => l.trim()).length;
}

export function loadProgress<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
  } catch {
    return null;
  }
}

export function saveProgress<T>(filePath: string, data: T): void {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

export function getExistingIds(filePath: string): Set<string> {
  const ids = new Set<string>();
  if (!fs.existsSync(filePath)) return ids;

  const content = fs.readFileSync(filePath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const record = JSON.parse(trimmed) as { id?: string; url?: string };
      if (record.id) ids.add(record.id);
      if (record.url) ids.add(record.url);
    } catch {
      // skip
    }
  }
  return ids;
}
