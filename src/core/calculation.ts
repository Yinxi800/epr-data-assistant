import Decimal from 'decimal.js';
import type { Calculation, DataRow, Edit, Field, Issue, ResultRow, Settings, Sheet, Summary, Values } from './types';
import { normalizeBusiness } from './rules';
import { resolveDestination } from './country';

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
  return sheets.filter(sheet => sheet.enabled).flatMap(sheet => sheet.rows.map((raw, i) => {
    const values: Values = {};
    for (const [field, header] of Object.entries(sheet.mapping)) if (header) values[field as Field] = raw[header] ?? '';
    const rowNumber = sheet.rowNumbers[i] ?? i + 2;
    return { id: `${sheet.id}:${rowNumber}`, sheetId: sheet.id, fileId: sheet.fileId, fileName: sheet.fileName,
      sheetName: sheet.name, rowNumber, raw, values, numberFormat: sheet.numberFormat,
      mappingConfirmed: sheet.confirmed, duplicateFile: sheet.duplicate };
  }));
}
const unitFactor: Record<string, string> = { g: '0.001', kg: '1', t: '1000' };
const expectedKinds: Record<string, string[]> = { packaging: ['包装重量', 'packaging'], weee: ['产品净重', 'product'], battery: ['电池重量', 'battery'] };
const eachModes = ['单件', '单件重量', 'unit', 'per-unit'];
const totalModes = ['总重', '总重量', '本行总重量', 'total'];
const isEstimated = (s: string | undefined) => !!s?.trim() && !['否', 'false', 'no', '0', '实测', '人工实测'].includes(s.trim().toLowerCase());

export function calculate(input: DataRow[], settings: Settings, edits: Edit[], excludedIds: string[] = [], acknowledgedIds: string[] = []): Calculation {
  const excluded = new Set(excludedIds), acknowledged = new Set(acknowledgedIds);
  const rowEdits = new Map<string, Edit[]>();
  for (const edit of edits) {
    const list = rowEdits.get(edit.rowId);
    if (list) list.push(edit); else rowEdits.set(edit.rowId, [edit]);
  }
  const selectedStart = parsePeriod(settings.start)?.[0], selectedEnd = parsePeriod(settings.end)?.[1];
  const validSelection = !!selectedStart && !!selectedEnd && selectedStart <= selectedEnd;
  const rows: ResultRow[] = input.map(row => {
    const effective = { ...row.values };
    const changes = rowEdits.get(row.id) || [];
    for (const edit of changes) effective[edit.field] = edit.after;
    const issues: Issue[] = [];
    const add = (severity: Issue['severity'], code: string, message: string) => issues.push({ rowId: row.id, severity, code, message });
    const destination = resolveDestination(effective);
    const country = destination.code, category = normalizeBusiness(effective.category);
    const countryRecognized = !!country;
    const categoryRecognized = ['packaging', 'weee', 'battery'].includes(category);
    const period = parsePeriod(effective.period);
    const group = JSON.stringify([effective.customer?.trim() || '', effective.store?.trim() || '']);
    let outOfScope = false;
    if (excluded.has(row.id)) { outOfScope = true; add('info', 'manual-exclusion', '人工排除；原始记录保留。'); }
    if (settings.country !== 'auto' && countryRecognized && country !== settings.country) { outOfScope = true; add('info', 'country-filter', `目的国家 ${country} 与所选国家不同，已排除。`); }
    if (categoryRecognized && category !== settings.business) { outOfScope = true; add('info', 'category-filter', `品类 ${category} 与所选业务不同，已排除。`); }
    if (settings.group && group !== settings.group && effective.customer && effective.store) { outOfScope = true; add('info', 'group-filter', '客户/店铺与当前数据组不同，已排除。'); }
    if (period && validSelection && (period[1] < selectedStart! || period[0] > selectedEnd!)) { outOfScope = true; add('info', 'period-filter', '报告期间与当前选择不重叠，已排除。'); }
    if (!validSelection) add('block', 'selection-period', '请选择有效的起止期间。');
    if (!row.mappingConfirmed) add('block', 'mapping', '字段映射尚未人工确认。');
    if (!effective.customer?.trim() || !effective.store?.trim()) add('block', 'identity', '客户或店铺缺失，不能判断数据归属。');
    if (!settings.group) add('block', 'group', '请先选择一个客户/店铺数据组，不自动混合。');
    if (destination.message) add('block', destination.conflict ? 'country-conflict' : destination.missing ? 'country' : 'country-invalid', destination.message);
    if (!categoryRecognized) add('block', 'category', 'EPR品类缺失或无法识别；请明确为包装、电子电器或电池。');
    if (!period) add('block', 'period', '期间缺失或格式不明；请使用 YYYY-MM 或 YYYY-MM-DD/YYYY-MM-DD。');
    else if (validSelection && !outOfScope && (period[0] < selectedStart! || period[1] > selectedEnd!)) add('block', 'partial-period', '记录期间跨越所选范围，无法按比例拆分；请提供准确期间数据。');
    if (!settings.scopeConfirmed) add('block', 'scope', '请确认包装层级与履约渠道的责任范围。');
    if (!settings.specialConfirmed) add('block', 'special', '请确认取消订单、跨境流转及B2B/B2C的处理口径。');
    if (settings.returns === 'unconfirmed' || !settings.basis.trim()) add('block', 'quantity-basis', '请明确退货是否扣除，并记录适用依据或人工确认原因。');
    if (row.duplicateFile) add('confirm', 'duplicate-file', '文件内容与已导入报告一致；请排除重复文件或确认确需保留。');
    const sales = parseNumber(effective.sales, row.numberFormat);
    const returns = parseNumber(effective.returns, row.numberFormat);
    const weight = parseNumber(effective.weight, row.numberFormat);
    const cancelled = parseNumber(effective.cancelled, row.numberFormat);
    if (sales === null) add('block', 'sales', '销售数量缺失或数字格式不明。');
    else if (new Decimal(sales).isNegative() || !new Decimal(sales).isInteger()) add('block', 'sales-invalid', '销售数量为负数或非整数，请核实。');
    if (effective.returns?.trim() && returns === null) add('block', 'returns-invalid', '退货数量格式不明。');
    if (returns !== null && (new Decimal(returns).isNegative() || !new Decimal(returns).isInteger())) add('block', 'returns-invalid', '退货数量为负数或非整数，请核实。');
    if (settings.returns === 'net' && returns === null) add('block', 'returns-missing', '扣除退货时必须提供明确退货数量，空值不等于零。');
    if (effective.cancelled?.trim() && (cancelled === null || new Decimal(cancelled).isNegative() || !new Decimal(cancelled).isInteger())) add('block', 'cancelled', '取消数量格式不明、为负数或非整数。');
    if (weight === null) add('block', 'weight', '重量缺失或数字格式不明；结果为未知，不补零。');
    else if (new Decimal(weight).isNegative()) add('block', 'negative-weight', '重量为负数，请核实。');
    else if (new Decimal(weight).isZero()) add('confirm', 'zero-weight', '重量为零，请核实是否为明确测量结果。');
    const unit = effective.unit?.trim().toLowerCase() || '';
    if (!unitFactor[unit]) add('block', 'unit', '重量单位缺失或不支持；需明确为 g、kg 或 t。');
    const mode = effective.weightMode?.trim().toLowerCase() || '';
    const perUnit = eachModes.includes(mode), total = totalModes.includes(mode);
    if (!perUnit && !total) add('block', 'weight-mode', '重量含义未确认：请选择单件重量或本行总重量。');
    if (!(expectedKinds[settings.business] || []).includes(effective.weightKind?.trim().toLowerCase() || '')) add('block', 'weight-kind', '重量类型与当前业务不符或缺失；净重、包装重、电池重和含包装总重不能混用。');
    if (settings.business === 'packaging' && (!effective.material?.trim() || ['未分类', '未知', '待补充'].includes(effective.material.trim()))) add('confirm', 'material', '包装材料未分类；不会根据产品名称或ASIN推断。');
    if (!effective.layer?.trim() && settings.business === 'packaging') add('confirm', 'layer', '包装层级待补充，请核实初级包装与运输包装。');
    if (isEstimated(effective.estimated)) add('confirm', 'estimate', '包含估算数据，请核实来源及是否适用于本次整理。');
    if (changes.length) add('confirm', 'edited', '存在人工修改，请查看原值、修改原因及计算影响。');
    if (changes.some(e => !e.reason.trim())) add('block', 'edit-reason', '人工修改缺少原因。');
    let quantity: string | null = null, kg: string | null = null, formula = '未知：存在未确认的计算输入';
    if (sales !== null && settings.returns !== 'unconfirmed' && settings.basis.trim()) {
      if (settings.returns === 'gross') quantity = sales;
      else if (returns !== null) quantity = new Decimal(sales).minus(returns).toFixed();
      if (quantity !== null && new Decimal(quantity).isNegative()) add('block', 'negative-quantity', '扣退货后数量为负，请核实口径与数据。');
    }
    const latestWeightEdit = changes.filter(e => e.field === 'weight').at(-1);
    const editContext = latestWeightEdit?.calculationContext;
    const currentNetCorrection = latestWeightEdit?.reason.trim() && editContext &&
      editContext.quantitySnapshot?.sales === (effective.sales || '') &&
      editContext.quantitySnapshot?.returns === (effective.returns || '') &&
      (['returns', 'basis', 'start', 'end', 'country', 'business', 'group'] as const).every(key => editContext[key] === settings[key]);
    if (total && settings.returns === 'net' && returns !== null && new Decimal(returns).gt(0) && !currentNetCorrection) add('block', 'net-total', '本行总重量不能按退货数量自动缩放；请在当前扣退货口径和期间下人工核实并修正重量，填写原因。历史口径下的修改不能代替本次确认。');
    if (!issues.some(i => i.severity === 'block') && weight !== null && unitFactor[unit] && quantity !== null) {
      const baseKg = new Decimal(weight).times(unitFactor[unit]);
      kg = (perUnit ? baseKg.times(quantity) : baseKg).toFixed();
      formula = perUnit ? `${quantity} 件 × ${weight} ${unit}/件 × ${unitFactor[unit]} kg/${unit} = ${kg} kg` : `${weight} ${unit} × ${unitFactor[unit]} kg/${unit} = ${kg} kg（本行总重量，不再乘数量 ${quantity}）`;
    }
    return { ...row, effective, quantity, kg, formula, issues, status: outOfScope ? 'excluded' : 'pending', edited: changes.length > 0 };
  });
  const fingerprints = new Map<string, ResultRow[]>(), skuGroups = new Map<string, ResultRow[]>();
  for (const row of rows) {
    const fingerprint = JSON.stringify(Object.entries(row.effective).sort(([a], [b]) => a.localeCompare(b)));
    const matches = fingerprints.get(fingerprint);
    if (matches) matches.push(row); else fingerprints.set(fingerprint, [row]);
    if (row.effective.sku?.trim()) {
      const key = JSON.stringify([row.effective.customer, row.effective.store, row.effective.sku]);
      const matches = skuGroups.get(key);
      if (matches) matches.push(row); else skuGroups.set(key, [row]);
    }
  }
  const issue = (row: ResultRow, code: string, message: string) => row.issues.push({ rowId: row.id, code, message, severity: 'confirm' });
  for (const group of fingerprints.values()) if (group.length > 1) for (const row of group) issue(row, 'duplicate-row', '疑似重复记录；相同行也可能是合法交易，未自动删除。');
  for (const group of skuGroups.values()) {
    const signatures = new Set(group.map(r => {
      const w = parseNumber(r.effective.weight, r.numberFormat), u = r.effective.unit?.trim().toLowerCase() || '';
      const perUnit = eachModes.includes(r.effective.weightMode?.trim().toLowerCase() || '');
      const normalized = perUnit && w !== null && unitFactor[u] ? new Decimal(w).times(unitFactor[u]).toFixed() : '';
      return JSON.stringify([normalizeBusiness(r.effective.category), r.effective.material?.trim() || '', r.effective.layer?.trim() || '', r.effective.weightKind?.trim() || '', normalized]);
    }));
    if (signatures.size > 1) for (const row of group) issue(row, 'sku-conflict', '同一SKU的重量、材料或分类存在差异，请核实包装层级及报告口径。');
  }
  // Merge ranges within each file, then binary-search other files' ranges.
  // This avoids quadratic comparisons for many overlapping ranges in one report.
  type Interval = { range: [string, string]; rows: ResultRow[] };
  const intervalGroups = new Map<string, Map<string, Map<string, Interval>>>();
  const identityGroups = new Set<string>();
  for (const row of rows) {
    const group = JSON.stringify([row.effective.customer?.trim() || '', row.effective.store?.trim() || '']);
    if (row.effective.customer?.trim() && row.effective.store?.trim()) identityGroups.add(group);
    const range = parsePeriod(row.effective.period); if (!range) continue;
    let files = intervalGroups.get(group);
    if (!files) { files = new Map(); intervalGroups.set(group, files); }
    let intervals = files.get(row.fileId);
    if (!intervals) { intervals = new Map(); files.set(row.fileId, intervals); }
    const key = JSON.stringify(range), existing = intervals.get(key);
    if (existing) existing.rows.push(row); else intervals.set(key, { range, rows: [row] });
  }
  const overlaps = new Set<string>();
  for (const files of intervalGroups.values()) {
    if (files.size < 2) continue;
    const merged = new Map<string, [string, string][]>();
    for (const [file, intervals] of files) {
      const sorted = [...intervals.values()].map(i => i.range).sort((a, b) => a[0].localeCompare(b[0]));
      const ranges: [string, string][] = [];
      for (const range of sorted) {
        const last = ranges.at(-1);
        if (last && range[0] <= last[1]) { if (range[1] > last[1]) last[1] = range[1]; }
        else ranges.push([...range]);
      }
      merged.set(file, ranges);
    }
    for (const [file, intervals] of files) for (const interval of intervals.values()) {
      let overlap = false;
      for (const [otherFile, ranges] of merged) {
        if (otherFile === file) continue;
        let lo = 0, hi = ranges.length;
        while (lo < hi) {
          const mid = (lo + hi) >>> 1;
          if (ranges[mid][0] <= interval.range[1]) lo = mid + 1; else hi = mid;
        }
        if (lo > 0 && ranges[lo - 1][1] >= interval.range[0]) { overlap = true; break; }
      }
      if (overlap) for (const row of interval.rows) overlaps.add(row.id);
    }
  }
  for (const row of rows) {
    if (overlaps.has(row.id)) issue(row, 'period-overlap', '同一客户/店铺的多个文件期间重叠，请确认是否分批、重复或不同责任范围。');
    if (identityGroups.size > 1) row.issues.push({ rowId: row.id, severity: 'info', code: 'mixed-identities', message: `检测到 ${identityGroups.size} 个客户/店铺数据组；仅纳入当前选择的数据组，其余记录保留并排除，未自动合并。` });
  }
  const summaries = new Map<string, Summary>();
  for (const row of rows) {
    if (row.status === 'excluded') continue;
    row.status = row.issues.some(i => i.severity === 'block') || (row.issues.some(i => i.severity === 'confirm') && !acknowledged.has(row.id)) ? 'pending' : 'included';
    if (row.status !== 'included' || row.kg === null || row.quantity === null) continue;
    const v = row.effective, country = resolveDestination(v).code, category = normalizeBusiness(v.category);
    const material = v.material?.trim() || '未分类', customer = v.customer || '', store = v.store || '';
    const key = JSON.stringify([country, customer, store, category, material]);
    const summary = summaries.get(key) || { key, country, customer, store, category, material, quantity: '0', kg: '0', rowIds: [] };
    summary.quantity = new Decimal(summary.quantity).plus(row.quantity).toFixed();
    summary.kg = new Decimal(summary.kg).plus(row.kg).toFixed(); summary.rowIds.push(row.id); summaries.set(key, summary);
  }
  return { rows, issues: rows.flatMap(r => r.issues), summaries: [...summaries.values()], counts: { imported: rows.length, included: rows.filter(r => r.status === 'included').length, excluded: rows.filter(r => r.status === 'excluded').length, pending: rows.filter(r => r.status === 'pending').length } };
}
