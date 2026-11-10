import type { Settings } from './types';

export const countries = [
  { code: 'DE', label: '德国' }, { code: 'FR', label: '法国' },
  { code: 'ES', label: '西班牙' }, { code: 'IT', label: '意大利' },
  { code: 'AT', label: '奥地利' }, { code: 'NL', label: '荷兰' }, { code: 'PL', label: '波兰' },
];
export const businesses = [
  { code: 'packaging', label: '包装' }, { code: 'weee', label: '电子电器' }, { code: 'battery', label: '电池' },
];
export function getRule(settings: Settings) {
  return {
    id: 'generic-preparation-v1', version: '通用整理 v1.0', country: settings.country,
    business: settings.business, agency: null, declarationYear: settings.start.slice(0, 4),
    effectiveFrom: null, effectiveTo: null, verifiedAt: null, sourceLinks: [] as string[],
    configured: false, status: '仅支持通用数据整理', declarationTypes: ['通用数据整理'],
    period: '用户指定起止日期；不代表机构申报周期',
    requiredFields: ['customer', 'store', 'period', 'country', 'category', 'sales', 'weight', 'unit', 'weightMode', 'weightKind'],
    classificationMapping: {}, quantityBasis: settings.returns, weightBasis: '单件乘已确认数量；本行总重量不再乘数量',
    outputUnit: 'kg', feesEnabled: false, institutionTemplate: null,
  };
}
export function normalizeCountry(value: string | undefined) {
  const input = (value || '').trim();
  return countries.find(c => c.code === input.toUpperCase() || c.label === input)?.code || input;
}
export function normalizeBusiness(value: string | undefined) {
  const input = (value || '').trim();
  return businesses.find(c => c.code === input.toLowerCase() || c.label === input)?.code || (input.toUpperCase() === 'WEEE' ? 'weee' : input);
}
