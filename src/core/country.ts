import { normalizeCountry } from './rules';
import type { Values } from './types';

/** Resolve only explicit destination fields. Marketplace is deliberately never consulted. */
export function resolveDestination(values: Values) {
  const primary = values.country?.trim() || '';
  const name = values.countryName?.trim() || '';
  const code = normalizeCountry(primary || name);
  const auxiliaryCode = normalizeCountry(name);
  const valid = /^[A-Z]{2}$/.test(code) && !['ZZ','XX'].includes(code);
  // An unrecognized name alongside a code is also unresolved, rather than silently ignored.
  const conflict = !!primary && !!name && (!/^[A-Z]{2}$/.test(auxiliaryCode) || code !== auxiliaryCode);
  const source = primary ? 'country' : name ? 'countryName' : '';
  return { code: valid && !conflict ? code : '', source, conflict,
    missing: !primary && !name,
    message: conflict ? '目的国家代码与名称不一致或名称无法核对，请检查原始字段。'
      : !primary && !name ? '目的国家缺失；商城站点不能替代目的国家。'
      : !valid ? '目的国家无法识别，请核对国家代码或名称，不能按商城站点推断。' : '' };
}
