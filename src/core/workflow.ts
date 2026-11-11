import Decimal from 'decimal.js';
import {normalizeRows,parseNumber,parsePeriod} from './calculation';
import {resolveDestination} from './country';
import {normalizeBusiness} from './rules';
import {groupLines,type ReportLine} from './report';
import type {DataRow,Field,Sheet,Values} from './types';
export interface WorkflowScope {country?:string;start?:string;end?:string;}
export interface WorkflowEdit {rowId:string;field:Field;after:string;reason:string;at:string;}
export interface WorkflowDecision {sourceId:string;action:'confirm'|'exclude';reason:string;}
export interface WorkflowManifestEntry {id:string;name:string;status:'queued'|'processing'|'success'|'failed'|'stopped';error?:string;history?:string[];}
export interface WorkflowState {sheets:Sheet[];scope:WorkflowScope;edits:WorkflowEdit[];decisions:WorkflowDecision[];manifest:WorkflowManifestEntry[];manifestConfirmed:boolean;knownGaps:string;reviewed:boolean;revision:number;}
export interface WorkflowIssue {code:string;severity:'block'|'confirm'|'info';message:string;}
export interface WorkflowLine extends ReportLine {effective:Values;issues:WorkflowIssue[];status:'included'|'pending'|'excluded';}
export interface WorkflowSource {id:string;lines:WorkflowLine[];issues:WorkflowIssue[];status:WorkflowLine['status'];reason:string;}
export interface WorkflowResult {lines:WorkflowLine[];sources:WorkflowSource[];counts:{included:number;pending:number;excluded:number};scopeError:string;canReview:boolean;canExportReviewed:boolean;}
export const emptyWorkflow=():WorkflowState=>({sheets:[],scope:{},edits:[],decisions:[],manifest:[],manifestConfirmed:false,knownGaps:'',reviewed:false,revision:1});
const factors:Record<string,string>={g:'0.001',kg:'1',t:'1000'};
const totalModes=['本行总重量','总重','总重量','total'],unitModes=['单件','单件重量','unit','per-unit'];
const unknown=(s:string|undefined)=>!s?.trim();
const materialColumns=[['paper_kg','纸'],['glass_kg','玻璃'],['aluminum_kg','铝'],['steel_kg','钢'],['plastic_kg','塑料'],['wood_kg','木材'],['other_kg','其他']] as const;
const canonicalColumn=(s:string)=>s.trim().toLowerCase().replace(/[\s_-]+/g,'');
export function workflowDetailCount(sheet:Sheet){
 if(!sheet.amazon?.enabled)return sheet.rows.length;
 const header=sheet.headers.find(h=>canonicalColumn(h)==='eprcategory')||'';
 return sheet.rows.reduce((n,row)=>n+(['primary packaging','secondary packaging'].includes(row[header]?.trim().toLowerCase())?7:1),0);
}
function normalizeWorkflowRows(sheets:Sheet[]):DataRow[]{
 const expanded=normalizeRows(sheets.map(s=>({...s,enabled:true}))),sources=new Map<string,DataRow[]>();
 for(const row of expanded){const id=row.amazon?.sourceId||row.id;const list=sources.get(id)||[];list.push(row);sources.set(id,list);}
 return [...sources.values()].flatMap(rows=>{
  const base=rows[0];if(!base.amazon||!['primary packaging','secondary packaging'].includes(base.amazon.originalCategory.trim().toLowerCase()))return rows;
  return materialColumns.map(([column,material])=>{
   const existing=rows.find(row=>canonicalColumn(row.amazon!.weightColumn)===canonicalColumn(column));if(existing)return existing;
   const rawColumn=Object.keys(base.raw).find(k=>canonicalColumn(k)===canonicalColumn(column))||column;
   return {...base,id:`${base.amazon!.sourceId}:${column}`,values:{...base.values,weight:'',material},amazon:{...base.amazon!,weightColumn:rawColumn}};
  });
 });
}

export function buildWorkflow(state:WorkflowState):WorkflowResult {
 const {scope}=state;const validStart=!scope.start||/^\d{4}-\d{2}-\d{2}$/.test(scope.start)&&!!parsePeriod(scope.start),validEnd=!scope.end||/^\d{4}-\d{2}-\d{2}$/.test(scope.end)&&!!parsePeriod(scope.end);
 const scopeError=!validStart||!validEnd?'日期无效，请使用有效日期。':!!scope.start!==!!scope.end?'请同时填写开始与结束日期。':scope.start&&scope.end&&scope.start>scope.end?'开始日期晚于结束日期。':'';
 const sourceMap=new Map<string,WorkflowSource>();
 const editsById=new Map<string,{edit:WorkflowEdit;index:number}[]>();state.edits.forEach((edit,index)=>{const list=editsById.get(edit.rowId)||[];list.push({edit,index});editsById.set(edit.rowId,list);});
 const decisionsById=new Map(state.decisions.filter(d=>d.reason.trim()).map(d=>[d.sourceId,d]));
 const originals=normalizeWorkflowRows(state.sheets);
 const rawMatches=new Map<string,string[]>();
 for(const row of originals){const id=row.amazon?.sourceId||row.id;const key=JSON.stringify(Object.entries(row.raw).sort(([a],[b])=>a.localeCompare(b)));const list=rawMatches.get(key)||[];if(!list.includes(id))list.push(id);rawMatches.set(key,list);}
 const duplicateSources=new Set([...rawMatches.values()].filter(ids=>ids.length>1).flat());
 const lines:WorkflowLine[]=originals.map(row=>{
  const sourceId=row.amazon?.sourceId||row.id,v={...row.values};
  const changes=row.id===sourceId?(editsById.get(row.id)||[]):[...(editsById.get(row.id)||[]),...(editsById.get(sourceId)||[])].sort((a,b)=>a.index-b.index);
  for(const {edit:e} of changes)if(e.reason.trim())v[e.field]=e.after;
  const issues:WorkflowIssue[]=[];const add=(code:string,severity:WorkflowIssue['severity'],message:string)=>issues.push({code,severity,message});
  const country=resolveDestination(v);if(!country.code||country.message)add('country','block',country.message||'目的国家缺失，不能由商城或整理范围推定。');
  const period=parsePeriod(v.period);if(!period)add('period','block','报告期间缺失或无效，请查看来源后修正。');
  const quantity=parseNumber(v.sales,row.numberFormat),weight=parseNumber(v.weight,row.numberFormat),unit=factors[v.unit?.trim().toLowerCase()||''];
  const validQuantity=quantity!==null&&new Decimal(quantity).gte(0)&&new Decimal(quantity).isInteger();
  if(!validQuantity)add('quantity','block','数量缺失或格式异常，未知值不会补零。');
  let kg:string|null=null;const mode=v.weightMode?.trim().toLowerCase()||'';
  if(weight===null||new Decimal(weight).isNegative())add('weight','block','重量缺失或异常，未知值不会补零。');
  if(!unit)add('unit','block','重量单位不明确，请填写有依据的 g、kg 或 t。');
  if(!totalModes.includes(mode)&&!unitModes.includes(mode))add('weight-mode','block','重量含义不明，请核对是单件重量还是本行总重。');
  if(weight!==null&&new Decimal(weight).gte(0)&&unit){if(totalModes.includes(mode))kg=new Decimal(weight).times(unit).toFixed();else if(unitModes.includes(mode)&&validQuantity)kg=new Decimal(weight).times(unit).times(quantity!).toFixed();}
  const sheet=state.sheets.find(s=>s.id===row.sheetId)!;
  if(!row.amazon&&!sheet.confirmed)add('mapping','block','字段映射尚未核对，请确认来源列与数字格式。');
  if(sheet.encodingNeedsReview&&!sheet.confirmed)add('encoding','block','文本编码待核对，请检查原始文字或重新导入。');

  const business=normalizeBusiness(v.category);if(!['weee','packaging','battery'].includes(business))add('category','block','类别未识别，请依据原始报告修正。');
  if(row.duplicateFile)add('duplicate-file','confirm','文件内容重复，需明确排除副本或说明独立计入依据。');
  else if(duplicateSources.has(sourceId))add('duplicate-row','confirm','原始行内容相同，需核对是否为独立记录。');
  if(v.estimated?.trim()&&!['否','false','no','0','实测','人工实测'].includes(v.estimated.trim().toLowerCase()))add('estimated','confirm','原报告标记为估算，请记录使用依据。');
  if(!unknown(v.returns)&&parseNumber(v.returns,row.numberFormat)!=='0')add('returns','confirm','存在退货数据；当前未扣退货，请确认本次整理口径并记录依据。');
  if(unknown(v.name))add('name','info','产品名称未提供；保留标识与来源。');
  let outside=false,reason='';
  if(scope.country&&scope.country!=='all'&&country.code&&country.code!==scope.country&&!issues.some(i=>i.code==='country')){outside=true;reason='目的国家在本次整理范围外';}
  if(period&&scope.start&&scope.end&&!scopeError){if(period[1]<scope.start||period[0]>scope.end){outside=true;reason='报告期间在本次整理范围外';}else if(period[0]<scope.start||period[1]>scope.end)add('period-overlap','block','原报告期间跨越本次范围；保留整行原值，不按天数分摊。');}
  const asin=v.asin?.trim()||'',sku=v.sku?.trim()||'';
  const summary=row.amazon?.originalCategory.trim().toLowerCase()==='secondary packaging'&&!/^[a-z0-9]{10}$/i.test(asin);
  const productId=asin&&!/^(n\/?a|unknown|not applicable|-)$/i.test(asin)&&!summary?asin:sku;
  if(summary&&asin)add('summary-product','info','报告汇总标识不是标准产品 ASIN，未分配到具体产品。');
  const line:WorkflowLine={row,sourceId,productId,productName:v.name?.trim()||(productId?'未提供产品名称':'未分配到产品'),business,classification:v.categoryDetail?.trim()||'',layer:v.layer||'',country:country.code||'待核对',period:v.period||'未提供',quantity:validQuantity?quantity:null,kg,material:v.material||'未分类',notes:issues.map(i=>i.message),effective:v,issues,status:outside?'excluded':'included'};
  const source=sourceMap.get(sourceId)||{id:sourceId,lines:[],issues:[],status:'included',reason};source.lines.push(line);sourceMap.set(sourceId,source);return line;
 });
 const sources=[...sourceMap.values()];
 for(const source of sources){
  const unresolvedMaterials=source.lines.filter(l=>l.row.amazon&&['primary packaging','secondary packaging'].includes(l.row.amazon.originalCategory.trim().toLowerCase())&&l.kg===null).map(l=>l.row.amazon!.weightColumn);
  for(const line of source.lines){if(line.row.amazon){line.row={...line.row,amazon:{...line.row.amazon,blankMaterials:unresolvedMaterials}};if(unresolvedMaterials.length){line.issues.push({code:'blank-materials',severity:'block',message:`材料重量尚未确认：${unresolvedMaterials.join('、')}；仅有已知项小计，不能确认为完整重量。`});line.notes=line.issues.map(i=>i.message);}}}
  source.issues=[...new Map(source.lines.flatMap(l=>l.issues).map(i=>[i.code+'|'+i.message,i])).values()];
  const decision=decisionsById.get(source.id);
  const allOutside=source.lines.every(l=>l.status==='excluded');
  if(decision?.action==='exclude'){source.status='excluded';source.reason=decision.reason;}
  else if(allOutside){source.status='excluded';}
  else {const unresolved=source.issues.some(i=>i.severity==='block'||i.severity==='confirm'&&decision?.action!=='confirm');source.status=unresolved?'pending':'included';source.reason=decision?.reason||'';}
  for(const line of source.lines)line.status=source.status;
 }
 const counts={included:sources.filter(s=>s.status==='included').length,pending:sources.filter(s=>s.status==='pending').length,excluded:sources.filter(s=>s.status==='excluded').length};
 const completeManifest=state.manifest.length>0&&state.manifest.every(f=>f.status==='success');
 const canReview=!scopeError&&counts.included>0&&counts.pending===0&&completeManifest&&state.manifestConfirmed&&!state.knownGaps.trim();
 return {lines,sources,counts,scopeError,canReview,canExportReviewed:canReview&&state.reviewed};
}

export function groupWorkflowLines(lines:WorkflowLine[],byProduct:boolean){return groupLines(lines.map(line=>({...line,row:{...line.row,values:line.effective}})),byProduct);}
