import Decimal from 'decimal.js';
import {expandAmazonRow} from './amazon';
import type { DataRow, Field, Sheet, Values } from './types';

Decimal.set({ precision: 40 });
/** Locale is explicitly selected per sheet; ambiguous punctuation is never auto-detected. */
export function parseNumber(value: string | undefined, format: 'dot' | 'comma' = 'dot'): string | null {
  if (value == null || !value.trim()) return null;
  let input = value.trim().replace(/[\u00a0\u202f]/g, ' ');
  const decimal = format === 'dot' ? '.' : ',';
  const thousands = format === 'dot' ? ',' : '.';
  const esc = (s: string) => s === '.' ? '\\.' : s;
  const plain = new RegExp(`^[+-]?\\d+(?:${esc(decimal)}\\d+)?$`);
  const grouped = new RegExp(`^[+-]?\\d{1,3}(?:${esc(thousands)}\\d{3})+(?:${esc(decimal)}\\d+)?$`);
  const spaced = new RegExp(`^[+-]?\\d{1,3}(?: \\d{3})+(?:${esc(decimal)}\\d+)?$`);
  if (!plain.test(input) && !grouped.test(input) && !spaced.test(input)) return null;
  input = input.split(thousands).join('').replace(/ /g, '').replace(decimal, '.');
  try { const n = new Decimal(input); return n.isFinite() ? n.toFixed() : null; } catch { return null; }
}
function validDate(s: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === s;
}
export function parsePeriod(value: string | undefined): [string, string] | null {
  const s = (value || '').trim();
  if (/^\d{4}-\d{2}$/.test(s)) {
    const [year, month] = s.split('-').map(Number);
    if (month < 1 || month > 12 || year < 1000) return null;
    return [s + '-01', new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10)];
  }
  const parts = s.split('/');
  if (parts.length === 1 && validDate(parts[0])) return [parts[0], parts[0]];
  if (parts.length === 2 && parts.every(validDate) && parts[0] <= parts[1]) return [parts[0], parts[1]];
  return null;
}
export function normalizeRows(sheets: Sheet[]): DataRow[] {
  return sheets.filter(sheet => sheet.enabled).flatMap(sheet => sheet.rows.flatMap((raw, i) => {
    const values: Values = {};
    for (const [field, header] of Object.entries(sheet.mapping)) if (header) values[field as Field] = raw[header] ?? '';
    const rowNumber = sheet.rowNumbers[i] ?? i + 2;
    return expandAmazonRow({ id: `${sheet.id}:${rowNumber}`, sheetId: sheet.id, fileId: sheet.fileId, fileName: sheet.fileName,
      sheetName: sheet.name, rowNumber, raw, values, numberFormat: sheet.numberFormat,
      mappingConfirmed: sheet.confirmed, duplicateFile: sheet.duplicate },sheet);
  }));
}
