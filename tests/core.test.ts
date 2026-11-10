import { describe, expect, it } from 'vitest';
import { calculate, normalizeRows, parseNumber, parsePeriod } from '../src/core/calculation';
import { getRule } from '../src/core/rules';
import type { DataRow, Edit, Settings, Sheet, Values } from '../src/core/types';
const settings: Settings = { country: 'DE', business: 'packaging', start: '2026-01-01', end: '2026-01-31', returns: 'gross', basis: '模拟人工确认：按销售数量；不扣退货，责任范围已核对', scopeConfirmed: true, specialConfirmed: true, group: JSON.stringify(['模拟客户', '模拟店铺']), reviewed: false };
function row(values: Values = {}, id = 'sheet:2'): DataRow {
  return { id, sheetId: 'sheet', fileId: 'file', fileName: '模拟.csv', sheetName: 'Sheet1', rowNumber: 2,
    raw: { 重量: '50' }, numberFormat: 'dot', mappingConfirmed: true, duplicateFile: false,
    values: { customer: '模拟客户', store: '模拟店铺', country: 'DE', period: '2026-01', sales: '100', returns: '2', category: '包装', material: '纸', layer: '初级包装', weight: '50', unit: 'g', weightMode: '单件', weightKind: '包装重量', ...values } };
}
function run(values: Values = {}, override: Partial<Settings> = {}, edits: Edit[] = []) {
  return calculate([row(values)], { ...settings, ...override }, edits);
}
describe('透明计算', () => {
  it('100 × 50g = 5kg，公式与来源均保留', () => {
    const result = run(); expect(result.summaries[0].kg).toBe('5'); expect(result.summaries[0].quantity).toBe('100');
    expect(result.rows[0].formula).toContain('100 件 × 50 g'); expect(result.rows[0].raw).toEqual({ 重量: '50' });
    expect(result.rows[0].fileName).toBe('模拟.csv'); expect(result.rows[0].rowNumber).toBe(2);
  });
  it('已汇总5kg不再次乘100', () => { expect(run({ weight: '5', unit: 'kg', weightMode: '总重' }).summaries[0].kg).toBe('5'); });
  it('缺失重量、单位或重量含义保持未知', () => {
    for (const values of [{ weight: '' }, { unit: '' }, { weightMode: '' }, { weightKind: '含包装总重' }]) {
      const result = run(values); expect(result.rows[0].kg).toBeNull(); expect(result.counts.pending).toBe(1); expect(result.summaries).toHaveLength(0);
    }
  });
  it('g、kg、t换算保持精度', () => {
    expect(run({ weight: '0.05', unit: 'kg' }).summaries[0].kg).toBe('5');
    expect(run({ weight: '0.00005', unit: 't' }).summaries[0].kg).toBe('5');
    expect(run({ weight: '0.000000001', unit: 'g' }).summaries[0].kg).toBe('0.0000000001');
  });
  it('小数与千分位按明确区域设置转换', () => {
    expect(parseNumber('1,234.50', 'dot')).toBe('1234.5'); expect(parseNumber('1.234,50', 'comma')).toBe('1234.5');
    expect(parseNumber('1\u202f234,50', 'comma')).toBe('1234.5'); expect(parseNumber('50,5', 'comma')).toBe('50.5');
    expect(parseNumber('50,5', 'dot')).toBeNull(); expect(parseNumber('1,23,4', 'dot')).toBeNull();
    expect(parseNumber('NaN')).toBeNull(); expect(parseNumber('Infinity')).toBeNull(); expect(parseNumber('')).toBeNull();
  });
  it('退货可配置，不默认扣除且依据必填', () => {
    expect(run({}, { returns: 'gross' }).summaries[0].kg).toBe('5');
    expect(run({}, { returns: 'net' }).summaries[0].kg).toBe('4.9');
    expect(run({}, { returns: 'unconfirmed' }).rows[0].kg).toBeNull();
    expect(run({}, { basis: '' }).rows[0].kg).toBeNull();
    expect(run({ returns: '' }, { returns: 'net' }).rows[0].kg).toBeNull();
  });
  it('总重量扣退货禁止自动缩放，必须人工修订', () => {
    const result = run({ weight: '5', unit: 'kg', weightMode: '总重' }, { returns: 'net' });
    expect(result.rows[0].kg).toBeNull(); expect(result.issues.some(i => i.code === 'net-total')).toBe(true);
    const edits: Edit[] = [{ id: 'e', rowId: 'sheet:2', field: 'weight', before: '5', after: '4.9', reason: '实测扣除退货包装', at: '2026-11-10', calculationContext: { ...settings, returns: 'net', quantitySnapshot: { sales: '100', returns: '2' } } }];
    const corrected = run({ weight: '5', unit: 'kg', weightMode: '总重' }, { returns: 'net' }, edits);
    expect(corrected.rows[0].kg).toBe('4.9'); expect(corrected.rows[0].values.weight).toBe('5'); expect(corrected.rows[0].effective.weight).toBe('4.9');
    expect(corrected.counts.pending).toBe(1);
    expect(run({ weight: '5', unit: 'kg', weightMode: '总重', returns: '3' }, { returns: 'net' }, edits).rows[0].kg).toBeNull();
    expect(run({ weight: '5', unit: 'kg', weightMode: '总重' }, { returns: 'net' }, [{ ...edits[0], calculationContext: { ...settings, returns: 'gross' } }]).rows[0].kg).toBeNull();
    expect(run({ weight: '5', unit: 'kg', weightMode: '总重' }, { returns: 'net', basis: '新口径' }, edits).rows[0].kg).toBeNull();
    expect(run({ weight: '5', unit: 'kg', weightMode: '总重' }, { returns: 'net' }, [{ ...edits[0], calculationContext: undefined }]).rows[0].kg).toBeNull();
  });
  it('负数和非整数数量阻断', () => { for (const values of [{ sales: '-1' }, { sales: '0.5' }, { weight: '-5' }, { returns: '-1' }]) expect(run(values).rows[0].kg).toBeNull(); });
  it('人工修改保留原值、原因且重新计算', () => {
    const edits: Edit[] = [{ id: 'e', rowId: 'sheet:2', field: 'weight', before: '50', after: '60', reason: '模拟称量', at: '2026-11-10' }];
    const result = calculate([row()], settings, edits, [], ['sheet:2']);
    expect(result.summaries[0].kg).toBe('6'); expect(result.rows[0].raw.重量).toBe('50'); expect(result.rows[0].values.weight).toBe('50'); expect(result.rows[0].edited).toBe(true);
    expect(calculate([row()], settings, [{ ...edits[0], reason: '' }], [], ['sheet:2']).rows[0].kg).toBeNull();
  });
});
describe('隔离、异常与追溯', () => {
  it('重复文件和相同行不删除，明确确认后才纳入', () => {
    const a = row(), b = { ...row({}, 'sheet2:2'), fileId: 'file2', duplicateFile: true };
    const result = calculate([a, b], settings, []); expect(result.rows).toHaveLength(2); expect(result.counts.pending).toBe(2);
    expect(result.issues.some(i => i.code === 'duplicate-file')).toBe(true); expect(result.issues.some(i => i.code === 'duplicate-row')).toBe(true);
    expect(calculate([a, b], settings, [], [], [a.id, b.id]).summaries[0].kg).toBe('10');
    const excluded = calculate([a, b], settings, [], [b.id], [a.id]); expect(excluded.summaries[0].kg).toBe('5'); expect(excluded.rows).toHaveLength(2);
  });
  it('多个文件同期间提示重叠', () => {
    const result = calculate([row(), { ...row({ sku: '另一个产品' }, 'other:2'), fileId: 'other' }], settings, []);
    expect(result.issues.filter(i => i.code === 'period-overlap')).toHaveLength(2);
  });
  it('同SKU不同单件重量或分类提示；单位等值不冲突', () => {
    let result = calculate([row({ sku: 'A' }), row({ sku: 'A', weight: '0.05', unit: 'kg' }, 'sheet:3')], settings, []);
    expect(result.issues.some(i => i.code === 'sku-conflict')).toBe(false);
    result = calculate([row({ sku: 'A' }), row({ sku: 'A', weight: '60' }, 'sheet:3')], settings, []);
    expect(result.issues.filter(i => i.code === 'sku-conflict')).toHaveLength(2);
  });
  it('客户与店铺不混合，缺少选择或归属无法通过确认绕过', () => {
    const result = calculate([row(), row({ customer: '第二客户' }, 'sheet:3')], settings, []);
    expect(result.counts.included).toBe(1); expect(result.counts.excluded).toBe(1);
    expect(result.issues.some(i => i.code === 'mixed-identities')).toBe(true);
    expect(run({}, { group: '' }).counts.pending).toBe(1);
    expect(calculate([row({ customer: '' })], settings, [], [], ['sheet:2']).counts.included).toBe(0);
  });
  it('国家、期间、业务切换保留排除行及来源', () => {
    for (const override of [{ country: 'FR' }, { business: 'battery' }, { start: '2026-02-01', end: '2026-02-28' }]) {
      const result = run({}, override); expect(result.counts.excluded).toBe(1); expect(result.rows[0].fileName).toBe('模拟.csv'); expect(result.summaries).toHaveLength(0);
    }
    expect(run({}, { start: '2026-01-15' }).counts.pending).toBe(1);
  });
  it('商城不推断目的国，未分类不推断材料', () => {
    expect(run({ country: '', marketplace: 'amazon.de' }).rows[0].kg).toBeNull();
    const result = run({ material: '' }); expect(result.rows[0].effective.material).toBe(''); expect(result.counts.pending).toBe(1);
    expect(result.issues.some(i => i.code === 'material')).toBe(true);
  });
  it('估算、缺层级标记待确认', () => { expect(run({ estimated: '亚马逊估算', layer: '' }).issues.map(i => i.code)).toEqual(expect.arrayContaining(['estimate', 'layer'])); });
  it('映射未确认、责任范围或特殊交易未确认不能绕过', () => {
    for (const override of [{ scopeConfirmed: false }, { specialConfirmed: false }]) expect(run({}, override).rows[0].kg).toBeNull();
    expect(calculate([{ ...row(), mappingConfirmed: false }], settings, [], [], ['sheet:2']).rows[0].kg).toBeNull();
  });
  it('期间日期校验严格', () => { expect(parsePeriod('2026-02')).toEqual(['2026-02-01', '2026-02-28']); expect(parsePeriod('2026-02-30')).toBeNull(); expect(parsePeriod('2026-13')).toBeNull(); expect(parsePeriod('2026-02-01/2026-01-01')).toBeNull(); });
  it('所有国家均仅通用汇总，无机构模板和费率', () => { const rule = getRule(settings); expect(rule.configured).toBe(false); expect(rule.agency).toBeNull(); expect(rule.institutionTemplate).toBeNull(); expect(rule.feesEnabled).toBe(false); });
  it('标准化不覆盖原始记录，禁用工作表不参与', () => {
    const sheet: Sheet = { id: 's', fileId: 'f', fileName: '模拟.csv', hash: 'abc', name: '页1', headers: ['重量'], rows: [{ 重量: '50' }], rowNumbers: [7], mapping: { weight: '重量' }, confirmed: false, enabled: true, duplicate: false, numberFormat: 'dot' };
    const normalized = normalizeRows([sheet]); expect(normalized[0].id).toBe('s:7'); expect(normalized[0].values.weight).toBe('50'); expect(normalized[0].raw).toEqual({ 重量: '50' }); expect(normalizeRows([{ ...sheet, enabled: false }])).toHaveLength(0);
  });
});


describe('20,000行性能与安全边界', () => {
  it('重复行分组保持线性追加，合法重复行完整保留', () => {
    const input = Array.from({ length: 20_000 }, (_, i) => row({ sku: 'SAME' }, `sheet:${i + 2}`));
    const started = performance.now();
    const result = calculate(input, settings, []);
    const elapsed = performance.now() - started;
    console.log(`20k identical rows: ${elapsed.toFixed(0)} ms`);
    expect(result.rows).toHaveLength(20_000);
    expect(result.counts.pending).toBe(20_000);
    expect(result.issues.filter(i => i.code === 'duplicate-row')).toHaveLength(20_000);
    expect(elapsed).toBeLessThan(6000);
  });
  it('同文件20k重叠期间不做平方级两两比较', () => {
    const input = Array.from({ length: 20_000 }, (_, i) => {
      const start = new Date(Date.UTC(2000, 0, i + 1)).toISOString().slice(0, 10);
      return row({ sku: `SKU-${i}`, period: `${start}/2099-12-31` }, `sheet:${i + 2}`);
    });
    const started = performance.now();
    const result = calculate(input, { ...settings, start: '2000-01-01', end: '2099-12-31' }, []);
    const elapsed = performance.now() - started;
    console.log(`20k distinct overlapping ranges, one file: ${elapsed.toFixed(0)} ms`);
    expect(result.counts.included).toBe(20_000);
    expect(result.issues.some(i => i.code === 'period-overlap')).toBe(false);
    expect(result.summaries[0].kg).toBe('100000');
    expect(elapsed).toBeLessThan(6000);
  });
});
