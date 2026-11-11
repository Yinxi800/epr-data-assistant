const countries = [
  { code: 'DE', label: '德国' }, { code: 'FR', label: '法国' },
  { code: 'ES', label: '西班牙' }, { code: 'IT', label: '意大利' },
  { code: 'AT', label: '奥地利' }, { code: 'NL', label: '荷兰' }, { code: 'PL', label: '波兰' },
];
const businesses = [
  { code: 'packaging', label: '包装' }, { code: 'weee', label: '电子电器' }, { code: 'battery', label: '电池' },
];
const countryNames: Record<string,string> = {
  germany:'DE', deutschland:'DE', france:'FR', spain:'ES', españa:'ES',
  italy:'IT', italia:'IT', austria:'AT', österreich:'AT', netherlands:'NL', nederland:'NL', poland:'PL', polska:'PL',
};
export function normalizeCountry(value: string | undefined) {
  const input = (value || '').trim();
  return countries.find(c => c.code === input.toUpperCase() || c.label === input)?.code
    || countryNames[input.toLowerCase()] || (/^[a-z]{2}$/i.test(input) ? input.toUpperCase() : input);
}
export function normalizeBusiness(value: string | undefined) {
  const input = (value || '').trim();
  return businesses.find(c => c.code === input.toLowerCase() || c.label === input)?.code || (input.toUpperCase() === 'WEEE' ? 'weee' : input);
}
