import type {Sheet} from './types';
export interface ImportManifestEntry {id:string;name:string;status:'queued'|'processing'|'success'|'failed'|'stopped';error?:string;history?:string[];}
const canonicalColumn=(s:string)=>s.trim().toLowerCase().replace(/[\s_-]+/g,'');
export function importDetailCount(sheet:Sheet){
 if(!sheet.amazon?.enabled)return sheet.rows.length;
 const header=sheet.headers.find(h=>canonicalColumn(h)==='eprcategory')||'';
 return sheet.rows.reduce((n,row)=>n+(['primary packaging','secondary packaging'].includes(row[header]?.trim().toLowerCase())?7:1),0);
}
