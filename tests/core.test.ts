import { describe, expect, it } from 'vitest';
import { normalizeRows, parseNumber, parsePeriod } from '../src/core/calculation';
import type { Sheet } from '../src/core/types';
import {buildParsedReport} from '../src/core/report';
import {parseBuffer} from '../src/core/parser';
describe('数字、期间与来源', () => {
  it('小数与千分位按明确区域设置转换', () => {
    expect(parseNumber('1,234.50', 'dot')).toBe('1234.5'); expect(parseNumber('1.234,50', 'comma')).toBe('1234.5');
    expect(parseNumber('1\u202f234,50', 'comma')).toBe('1234.5'); expect(parseNumber('50,5', 'comma')).toBe('50.5');
    expect(parseNumber('50,5', 'dot')).toBeNull(); expect(parseNumber('1,23,4', 'dot')).toBeNull();
    expect(parseNumber('NaN')).toBeNull(); expect(parseNumber('Infinity')).toBeNull(); expect(parseNumber('')).toBeNull();
  });
  it('期间日期校验严格', () => { expect(parsePeriod('2026-02')).toEqual(['2026-02-01', '2026-02-28']); expect(parsePeriod('2026-02-30')).toBeNull(); expect(parsePeriod('2026-13')).toBeNull(); expect(parsePeriod('2026-02-01/2026-01-01')).toBeNull(); });
  it('标准化不覆盖原始记录，禁用工作表不参与', () => {
    const sheet: Sheet = { id: 's', fileId: 'f', fileName: '模拟.csv', hash: 'abc', name: '页1', headers: ['重量'], rows: [{ 重量: '50' }], rowNumbers: [7], mapping: { weight: '重量' }, confirmed: false, enabled: true, duplicate: false, numberFormat: 'dot' };
    const normalized = normalizeRows([sheet]); expect(normalized[0].id).toBe('s:7'); expect(normalized[0].values.weight).toBe('50'); expect(normalized[0].raw).toEqual({ 重量: '50' }); expect(normalizeRows([{ ...sheet, enabled: false }])).toHaveLength(0);
  });
});

function report(weight: string, unit = 'g', mode = '单件', sales = '100') {
  const csv = `SKU,销售数量,重量,重量单位,重量含义,报告期间,EPR品类
A,${sales},${weight},${unit},${mode},2026-01,包装`;
  return buildParsedReport(parseBuffer(new TextEncoder().encode(csv).buffer, 'data.csv', 'file', 'hash'));
}
it('单件、总重及精细单位换算保留准确值', () => {
  expect(report('50').products[0].kg).toBe('5');
  expect(report('5', 'kg', '总重').products[0].kg).toBe('5');
  expect(report('0.05', 'kg').products[0].kg).toBe('5');
  expect(report('0.00005', 't').products[0].kg).toBe('5');
  expect(report('0.000000001').products[0].kg).toBe('0.0000000001');
});
it('空白与负重量、未知单位或口径保持未知', () => {
  for (const result of [report(''), report('-5'), report('50', ''), report('50', 'g', '')]) expect(result.products[0].kg).toBeNull();
  for (const sales of ['-1', '0.5', '']) {
    const result = report('50', 'g', '单件', sales);
    expect(result.lines[0].quantity).toBeNull();
    expect(result.products[0].kg).toBeNull();
  }
});
it('两万条相同原始行完整保留并汇总', () => {
  const csv = 'SKU,销售数量,重量,重量单位,重量含义,报告期间,EPR品类\n' + Array.from({length: 20_000}, () => 'A,100,50,g,单件,2026-01,包装').join('\n');
  const sheets = parseBuffer(new TextEncoder().encode(csv).buffer, 'data.csv', 'file', 'hash');
  const result = buildParsedReport(sheets);
  expect(result.sourceCount).toBe(20_000);
  expect(result.lines).toHaveLength(20_000);
  expect(result.products[0].kg).toBe('100000');
  expect(result.lines[0].notes.join()).toContain('内容相同');
});
