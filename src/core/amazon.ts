import type {DataRow,Sheet,Values} from './types';
export const AMAZON_ADAPTER_VERSION='amazon-epr-v1';
const canonical=(s:string)=>s.trim().toLowerCase().replace(/[\s_-]+/g,'');
const materials=[['paper_kg','纸'],['glass_kg','玻璃'],['aluminum_kg','铝'],['steel_kg','钢'],['plastic_kg','塑料'],['wood_kg','木材'],['other_kg','其他']] as const;
export function isAmazonReport(headers:string[]){const set=new Set(headers.map(canonical));return ['unique_account_identifier','report_period_start','report_period_end','epr_category','total_units_sold','amazon_marketplace'].every(k=>set.has(canonical(k)));}
export function amazonDetailCount(sheet:Sheet){if(!sheet.amazon?.enabled)return sheet.rows.length;const columns=new Map(sheet.headers.map(k=>[canonical(k),k]));return sheet.rows.reduce((n,row)=>{const category=(row[columns.get(canonical('epr_category'))||'']||'').trim().toLowerCase();return n+(['primary packaging','secondary packaging'].includes(category)?Math.max(1,materials.filter(([k])=>row[columns.get(canonical(k))||'']?.trim()).length):1);},0);}
function date(value:string){const match=value.trim().match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:T00:00:00(?:\.000)?Z)?$/);if(!match)return '';const s=`${match[1]}-${match[2].padStart(2,'0')}-${match[3].padStart(2,'0')}`;const d=new Date(s+'T00:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().startsWith(s)?s:'';}
export function expandAmazonRow(row:DataRow,sheet:Sheet):DataRow[]{
 if(!sheet.amazon?.enabled)return [row];
 const columns=new Map(Object.keys(row.raw).map(k=>[canonical(k),k]));
 const get=(k:string)=>row.raw[columns.get(canonical(k))||'']||'';
 const start=date(get('report_period_start')),end=date(get('report_period_end'));
 const kind=get('epr_category').trim().toLowerCase();
 const packaging=['primary packaging','secondary packaging'].includes(kind),weee=kind==='eee';
 const values:Values={...row.values,customer:sheet.amazon.customer?.trim()||row.values.customer|| (get('unique_account_identifier').trim()?`报告账户：${get('unique_account_identifier').trim()}`:''),store:sheet.amazon.store?.trim()||row.values.store||(get('amazon_marketplace').trim()?`商城范围：${get('amazon_marketplace').trim()}`:''),period:start&&end?`${start}/${end}`:'',category:packaging?'packaging':weee?'weee':get('epr_category'),layer:packaging?(kind==='primary packaging'?'初级包装':'运输包装'):'',categoryDetail:[1,2,3,4].map(n=>get(`epr_subcategory${n}`)).filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i).join(' / '),sales:row.values.sales??get('total_units_sold'),name:row.values.name||get('item_name_as_in_marketplace')||get('item_name_in_english'),source:'亚马逊 EPR 报告（原报告估算状态未明确，不等于实测）',unit:'kg',weightMode:'本行总重量',weightKind:packaging?'包装重量':weee?'产品净重':''};
 const blanks=packaging?materials.filter(([key])=>!get(key).trim()).map(([key])=>columns.get(canonical(key))||key):[];
 const make=(column:string,weight:string,material:string):DataRow=>({...row,id:`${row.id}:${column}`,values:{...values,weight,material},amazon:{sourceId:row.id,version:AMAZON_ADAPTER_VERSION,weightColumn:columns.get(canonical(column))||column,confirmed:!!sheet.amazon?.confirmed,blankMaterials:blanks,originalCategory:get('epr_category')}});
 if(packaging){const populated=materials.filter(([key])=>get(key).trim());return populated.length?populated.map(([key,label])=>make(key,get(key),label)):[make('missing_material_weight','','未分类')];}
 return [make('total_reported_weight_kg',get('total_reported_weight_kg'),'不适用')];
}
