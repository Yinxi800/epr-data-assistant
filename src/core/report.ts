import Decimal from 'decimal.js';
import {amazonMaterialLabel} from './amazon';
import {normalizeRows,parseNumber,parsePeriod} from './calculation';
import {resolveDestination} from './country';
import {normalizeBusiness} from './rules';
import type {DataRow,Sheet} from './types';
export interface ReportLine {row:DataRow;sourceId:string;productId:string;productName:string;business:string;classification:string;layer:string;country:string;period:string;quantity:string|null;kg:string|null;material:string;notes:string[];}
export interface ReportGroup {channel:string;key:string;fileName:string;customer:string;store:string;productId:string;productName:string;business:string;classification:string;layer:string;country:string;period:string;quantity:string|null;kg:string|null;partial:boolean;materials:{name:string;kg:string|null}[];sourceIds:string[];lines:ReportLine[];notes:string[];}
export interface ReportFilter {search?:string;business?:string;country?:string;product?:string;material?:string;layer?:string;classification?:string;file?:string;start?:string;end?:string;}
export interface ParsedReport {lines:ReportLine[];products:ReportGroup[];categories:ReportGroup[];sourceCount:number;productCount:number;unassignedCount:number;issueSourceCount:number;unknownPeriodCount:number;crossPeriodCount:number;}
const unitFactor:Record<string,string>={g:'0.001',kg:'1',t:'1000'};
export const businessLabel=(code:string)=>({packaging:'包装',weee:'电子电器',battery:'电池'}[code]||code||'分类未提供');
const classificationTranslations:Record<string,string>={
 'SMALL EQUIPMENT EXCEPT PHOTOVOLTAIC PANEL':'小型设备（光伏板除外）',
 'SMALL EQUIPMENT':'小型设备',
 'LARGE EQUIPMENT':'大型设备',
 'TEMPERATURE EXCHANGE EQUIPMENT':'温度交换设备',
};
export function classificationLabel(value:string):string{return value.split(' / ').map(v=>classificationTranslations[v.trim().toUpperCase()]||v).join(' / ');}
export const reportWeightLabel=(name:string,business:string)=>name!=='不适用'?name:business==='weee'?'产品报告重量':business==='battery'?'电池报告重量':'报告重量';
export function reportLines(sheets:Sheet[]):ReportLine[]{const output=normalizeRows(sheets).map(row=>{
 const v=row.values,notes:string[]=[];const sourceId=row.amazon?.sourceId||row.id;const country=resolveDestination(v);if(country.message)notes.push(country.message);
 const quantity=parseNumber(v.sales,row.numberFormat);if(quantity===null||new Decimal(quantity).isNegative()||!new Decimal(quantity).isInteger())notes.push('数量缺失或格式异常');
 const weight=parseNumber(v.weight,row.numberFormat),factor=unitFactor[v.unit?.trim().toLowerCase()||''];let kg:string|null=null;
 if(weight===null||new Decimal(weight).isNegative())notes.push('重量未填写或格式有误');
 else if(!factor)notes.push('重量单位无法识别，暂不换算');
 else if(['本行总重量','总重','总重量','total'].includes(v.weightMode?.trim().toLowerCase()||''))kg=new Decimal(weight).times(factor).toFixed();
 else if(['单件','单件重量','unit','per-unit'].includes(v.weightMode?.trim().toLowerCase()||'')&&quantity!==null&&new Decimal(quantity).gte(0)&&new Decimal(quantity).isInteger())kg=new Decimal(weight).times(factor).times(quantity).toFixed();
 else notes.push('未写明是单件还是总重量，暂不计算');
 if(!parsePeriod(v.period))notes.push('日期未填写或无法识别');
 if(row.duplicateFile)notes.push('此文件已添加过，请核对是否重复统计');
 if(row.amazon?.blankMaterials.length)notes.push(`以下材料未填重量：${row.amazon.blankMaterials.join('、')}；小计仅含已填重量`);
 const business=normalizeBusiness(v.category);if(!['weee','packaging','battery'].includes(business))notes.push('无法识别分类，仍显示报告原文');
 if(!row.amazon&&!row.mappingConfirmed)notes.push('各列由工具自动识别，请与原报告核对');
 if(v.estimated?.trim()&&!['否','false','no','0','实测','人工实测'].includes(v.estimated.trim().toLowerCase()))notes.push('报告标注为估算值');
 const asin=v.asin?.trim()||'',sku=v.sku?.trim()||'';
 const summaryIdentifier=row.amazon?.originalCategory.trim().toLowerCase()==='secondary packaging'&&!/^[a-z0-9]{10}$/i.test(asin);
 const usableAsin=asin&&!/^(n\/?a|unknown|not applicable|-)$/i.test(asin)&&!summaryIdentifier?asin:'';
 const productId=usableAsin||sku;
 if(summaryIdentifier&&asin)notes.push(`原报告标识“${asin}”不是标准格式的 ASIN，已保留原值`);
 return {row,sourceId,productId,productName:v.name?.trim()||(productId?'未提供产品名称':'无法对应产品'),business,classification:v.categoryDetail?.trim()||'',layer:v.layer||'',country:country.code||'待核对',period:v.period||'未提供',quantity:notes.includes('数量缺失或格式异常')?null:quantity,kg,material:v.material||'未分类',notes};
});const seen=new Set<string>(),fingerprints=new Map<string,string[]>();for(const line of output){if(seen.has(line.sourceId))continue;seen.add(line.sourceId);const key=JSON.stringify(Object.entries(line.row.raw).sort(([a],[b])=>a.localeCompare(b)));const matches=fingerprints.get(key);if(matches)matches.push(line.sourceId);else fingerprints.set(key,[line.sourceId]);}const duplicates=new Set([...fingerprints.values()].filter(ids=>ids.length>1).flat());for(const line of output)if(duplicates.has(line.sourceId))line.notes.push('有内容相同的报告行，已全部保留，请核对是否需要重复统计');return output;}
export function groupLines(lines:ReportLine[],byProduct:boolean,byClassification=true,byMaterial=false):ReportGroup[]{
 const groups=new Map<string,ReportGroup>();
 for(const line of lines){const v=line.row.values;const key=JSON.stringify([line.row.fileId,v.customer||'',v.store||'',line.country,line.period,line.business,byClassification?line.classification:'',line.layer,v.channel||'',...(byMaterial?[line.material]:[]),...(byProduct?[line.productId||line.sourceId,v.sku||'']:[])]);
 const group=groups.get(key)||{channel:v.channel||'',key,fileName:line.row.fileName,customer:v.customer||'未提供',store:v.store||'未提供',productId:byProduct?line.productId:'',productName:byProduct?line.productName:'',business:line.business,classification:byClassification?line.classification:'',layer:line.layer,country:line.country,period:line.period,quantity:null,kg:null,partial:false,materials:[],sourceIds:[],lines:[],notes:[]};group.lines.push(line);groups.set(key,group);}
 for(const group of groups.values()){
  const sources=new Map<string,ReportLine[]>(),materials=new Map<string,{total:Decimal;known:boolean;missing:boolean}>();let total=new Decimal(0),known=false;
  for(const line of group.lines){sources.set(line.sourceId,[...(sources.get(line.sourceId)||[]),line]);const material=materials.get(line.material)||{total:new Decimal(0),known:false,missing:false};if(line.kg===null){material.missing=true;group.partial=true;}else{known=true;total=total.plus(line.kg);material.known=true;material.total=material.total.plus(line.kg);}materials.set(line.material,material);if(!byMaterial&&line.row.amazon?.blankMaterials.length)group.partial=true;}
  let quantity=new Decimal(0),quantityKnown=true;for(const siblings of sources.values()){const q=new Set(siblings.map(s=>s.quantity));if(q.size!==1||siblings[0].quantity===null){quantityKnown=false;continue;}quantity=quantity.plus(siblings[0].quantity);}
  const ambiguousGeneric=group.lines.some(l=>!l.row.amazon)&&materials.size>1&&sources.size>1;
  group.quantity=quantityKnown&&!ambiguousGeneric?quantity.toFixed():null;group.kg=known?total.toFixed():null;group.sourceIds=[...sources.keys()];group.materials=[...materials].map(([name,m])=>({name,kg:m.known?m.total.toFixed():null}));group.notes=[...new Set(group.lines.flatMap(l=>l.notes))];if(ambiguousGeneric)group.notes.push('不同材料行的数量可能重复，暂不合计产品数量');
 }
 return [...groups.values()];
}
// Totals span products while keeping each source subclass and scope separate.
export function reportTotals(lines:ReportLine[]):ReportGroup[]{return groupLines(lines,false);}
export function reportMaterialTotals(lines:ReportLine[]):ReportGroup[]{
 const materialLines=lines.filter(l=>l.material!=='不适用'&&l.row.amazon?.weightColumn!=='missing_material_weight');
 const sources=new Map(lines.map(l=>[l.sourceId,l]));
 for(const line of sources.values())for(const column of line.row.amazon?.blankMaterials||[]){
  const material=amazonMaterialLabel(column);
  materialLines.push({...line,material,kg:null,notes:[...line.notes,`${material}重量未填写` ]});
 }
 const order=['纸','塑料','玻璃','铝','钢','木材','其他'];const rank=(name:string)=>order.includes(name)?order.indexOf(name):99;
 return groupLines(materialLines,false,true,true).sort((a,b)=>rank(a.materials[0].name)-rank(b.materials[0].name)||a.materials[0].name.localeCompare(b.materials[0].name,'zh-CN')||a.layer.localeCompare(b.layer));
}
export function buildParsedReport(sheets:Sheet[],filter:ReportFilter={}):ParsedReport {
 const query=filter.search?.trim().toLowerCase()||'';
 const dateActive=!!(filter.start||filter.end),unknownPeriods=new Set<string>(),crossPeriods=new Set<string>();
 const invalidDate=!!((filter.start&&!/^\d{4}-\d{2}-\d{2}$/.test(filter.start))||(filter.end&&!/^\d{4}-\d{2}-\d{2}$/.test(filter.end))||(filter.start&&!parsePeriod(filter.start))||(filter.end&&!parsePeriod(filter.end))||(filter.start&&filter.end&&filter.start>filter.end));
 const all=reportLines(sheets);const lines=all.filter(l=>{
 if(invalidDate)return false;
 if(filter.business&&filter.business!=='all'&&l.business!==(filter.business==='__missing__'?'':filter.business))return false;
 if(filter.country&&filter.country!=='all'&&l.country!==filter.country)return false;
 if(filter.product&&filter.product!=='all'&&(l.productId||'__missing__')!==filter.product)return false;
 if(filter.material&&filter.material!=='all'&&l.material!==filter.material)return false;
 if(filter.layer&&filter.layer!=='all'&&(l.layer||'__missing__')!==filter.layer)return false;
 if(filter.classification&&filter.classification!=='all'&&(l.classification||'__missing__')!==filter.classification)return false;
 if(filter.file&&filter.file!=='all'&&l.row.fileId!==filter.file)return false;
 if(query&&!`${l.productId} ${l.productName} ${l.row.values.sku||''} ${l.classification} ${l.row.fileName}`.toLowerCase().includes(query))return false;
 const period=parsePeriod(l.period);
 if(dateActive){
  if(!period){unknownPeriods.add(l.sourceId);return false;}
  if((filter.start&&period[1]<filter.start)||(filter.end&&period[0]>filter.end))return false;
  if((filter.start&&period[0]<filter.start)||(filter.end&&period[1]>filter.end))crossPeriods.add(l.sourceId);
 }
 return true;}).map(l=>crossPeriods.has(l.sourceId)?{...l,notes:[...l.notes,'此行包含所选日期以外的数据，按整行计入，未按天拆分']}:l);
 const sources=new Set(lines.map(l=>l.sourceId));const productIds=new Set(lines.filter(l=>l.productId).map(l=>JSON.stringify([l.row.values.customer,l.row.values.store,l.productId])));
 return {lines,unknownPeriodCount:unknownPeriods.size,crossPeriodCount:crossPeriods.size,products:groupLines(lines,true).sort((a,b)=>(a.productId?'0'+a.productId:'1').localeCompare(b.productId?'0'+b.productId:'1')||a.business.localeCompare(b.business)),categories:groupLines(lines,false),sourceCount:sources.size,productCount:productIds.size,unassignedCount:new Set(lines.filter(l=>!l.productId).map(l=>l.sourceId)).size,issueSourceCount:new Set(lines.filter(l=>l.notes.length).map(l=>l.sourceId)).size};
}
