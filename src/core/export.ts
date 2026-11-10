import * as XLSX from 'xlsx';
import { getRule } from './rules';
import { resolveDestination } from './country';
import { calculate } from './calculation';
import Decimal from 'decimal.js';
import { fields, type Calculation, type Edit, type Field, type Settings, type Sheet } from './types';

const severityNames={block:'阻止计算',confirm:'允许汇总但需确认',info:'提示'};
const statusNames={included:'纳入',excluded:'排除',pending:'待确认'};
export function safeCsvCell(value:unknown):string {
  const text=String(value??'');
  return /^[\s\uFEFF]*[=+\-@\t\r\n]/.test(text)?`'${text}`:text;
}
function sheetFromRows(rows:Record<string,unknown>[]):XLSX.WorkSheet {
  // String cells stay explicit strings. No formula properties are created.
  const worksheet=XLSX.utils.json_to_sheet(rows.length?rows:[{'说明':'无记录'}]);
  worksheet['!cols']=Array.from({length:Object.keys(rows[0]||{}).length},()=>({wch:24}));
  if(worksheet['!ref']) worksheet['!autofilter']={ref:worksheet['!ref']};
  return worksheet;
}
export function buildWorkbook(calculation:Calculation,sheets:Sheet[],edits:Edit[],settings:Settings):XLSX.WorkBook {
  const workbook=XLSX.utils.book_new();
  const generatedAt=new Date().toISOString();
  const rule=getRule(settings);
  const summaryByRow=new Map(calculation.summaries.flatMap(summary=>summary.rowIds.map(id=>[id,summary.key] as const)));
  const rowById=new Map(calculation.rows.map(row=>[row.id,row]));
  const histories=new Map<string,Edit[]>();
  const impacts=new Map<string,{before:string|null;after:string|null;difference:string}>();
  for(const edit of edits) {
    const row=rowById.get(edit.rowId); if(!row) continue;
    const history=histories.get(edit.rowId)||[];
    const before=calculate([row],settings,history).rows[0].kg;
    const after=calculate([row],settings,[...history,edit]).rows[0].kg;
    impacts.set(edit.id,{before,after,difference:before===null||after===null?'未知：修改前或修改后无法计算':new Decimal(after).minus(before).toString()});
    histories.set(edit.rowId,[...history,edit]);
  }
  XLSX.utils.book_append_sheet(workbook,sheetFromRows(calculation.summaries.map(s=>({
    '输出类型':'通用数据汇总（非正式申报文件）','国家':s.country,'客户':s.customer,'店铺':s.store,
    '品类':s.category,'材料':s.material,'数量（精确值）':s.quantity,'重量 kg（精确值）':s.kg,
    '汇总键':s.key,'来源记录数':s.rowIds.length,'来源记录 ID':s.rowIds.join('\n').length<=32767?s.rowIds.join('\n'):'详见标准化明细：按汇总键筛选，完整来源未截断',
  }))),'数据汇总');
  XLSX.utils.book_append_sheet(workbook,sheetFromRows(calculation.rows.map(row=>{
    const values:Record<string,unknown>={'记录 ID':row.id,'汇总键':summaryByRow.get(row.id)??'未纳入汇总','状态':statusNames[row.status],'来源文件':row.fileName,
      '工作表':row.sheetName,'原始行号':row.rowNumber,'计算数量':row.quantity??'未知','计算重量 kg':row.kg??'未知',
      '识别目的国家':resolveDestination(row.effective).code||'待处理','目的国家取值字段':sheets.find(s=>s.id===row.sheetId)?.mapping[resolveDestination(row.effective).source as Field]||'未映射','计算公式及单位换算':row.formula,'人工修改':row.edited?'是':'否','异常':row.issues.map(i=>`${severityNames[i.severity]}：${i.message}`).join('\n')};
    for(const field of Object.keys(fields) as Field[]) {
      values[`原值·${fields[field]}`]=row.values[field]??'';
      values[`当前·${fields[field]}`]=row.effective[field]??'';
    }
    return values;
  })),'标准化明细');
  XLSX.utils.book_append_sheet(workbook,sheetFromRows(calculation.issues.map(issue=>{
    const row=rowById.get(issue.rowId);
    return {'记录 ID':issue.rowId,'来源文件':row?.fileName??'','工作表':row?.sheetName??'','原始行号':row?.rowNumber??'',
      '级别':severityNames[issue.severity],'检查代码':issue.code,'问题':issue.message,'记录状态':row?statusNames[row.status]:''};
  })),'异常及缺失清单');
  XLSX.utils.book_append_sheet(workbook,sheetFromRows(edits.map(edit=>{
    const row=rowById.get(edit.rowId);
    const impact=impacts.get(edit.id);
    return {'修改 ID':edit.id,'记录 ID':edit.rowId,'来源文件':row?.fileName??'','工作表':row?.sheetName??'','原始行号':row?.rowNumber??'',
      '字段':fields[edit.field],'修改前':edit.before,'修改后':edit.after,'修改原因':edit.reason,'时间':edit.at,
      '本次修改前重量 kg':impact?.before??'未知','本次修改后重量 kg':impact?.after??'未知','本次重量影响 kg':impact?.difference??'未知',
      '修改后当前数量':row?.quantity??'未知','修改后当前重量 kg':row?.kg??'未知','当前计算公式':row?.formula??''};
  })),'人工修改记录');
  const metadata:Record<string,unknown>[]=[
    {'项目':'输出性质','值':'通用数据汇总／未完成草稿，不是机构模板，不可直接正式申报'},
    {'项目':'状态','值':settings.reviewed?'人工已确认当前结果':'数据待复核'},
    {'项目':'规则版本','值':rule.version},
    {'项目':'完整规则配置','值':JSON.stringify(rule)},
    {'项目':'规则核验','值':'机构、年度、有效期、分类映射及官方来源均待配置；未核验'},
    {'项目':'生成时间 UTC','值':generatedAt},
    {'项目':'输出单位','值':'kg；内部十进制精确计算；Excel 数字字段按文本保存精确值'},
    {'项目':'国家筛选','值':settings.country==='auto'?'按报告目的国家逐行识别并分别汇总':settings.country},{'项目':'业务筛选','值':settings.business},
    {'项目':'开始期间','值':settings.start},{'项目':'结束期间','值':settings.end},
    {'项目':'客户／店铺筛选','值':settings.group||'未选择，不合并客户店铺'},
    {'项目':'退货口径','值':settings.returns},{'项目':'用户填写的计算依据','值':settings.basis},
    {'项目':'责任范围已确认','值':settings.scopeConfirmed?'是':'否'},
    {'项目':'取消／跨境／B2B/B2C 已确认','值':settings.specialConfirmed?'是':'否'},
    ...Object.entries(calculation.counts).map(([k,v])=>({'项目':`记录数·${k}`,'值':String(v)})),
    ...sheets.flatMap(sheet=>Object.entries(sheet.mapping).map(([field,header])=>({
      '项目':'字段映射','值':header,'文件':sheet.fileName,'文件 SHA256':sheet.hash,'工作表':sheet.name,
      '标准字段':fields[field as Field],'映射已确认':sheet.confirmed?'是':'否','小数格式':sheet.numberFormat==='dot'?'小数点 . / 千分位 ,':'小数点 , / 千分位 .',
      '参与计算':sheet.enabled?'是':'否','重复文件':sheet.duplicate?'是':'否',
    }))),
  ];
  XLSX.utils.book_append_sheet(workbook,sheetFromRows(metadata),'字段映射及计算口径');
  const rawRows=sheets.flatMap(sheet=>sheet.rows.map((raw,index)=>({'文件':sheet.fileName,'文件 SHA256':sheet.hash,
    '工作表':sheet.name,'原始行号':sheet.rowNumbers[index],...Object.fromEntries(Object.entries(raw).map(([column,value])=>[`原始列·${column}`,value]))})));
  XLSX.utils.book_append_sheet(workbook,sheetFromRows(rawRows),'原始数据');
  return workbook;
}
export function exportFileName(settings:Settings,extension:string,reportCountries:string[]=[]):string {
  const business=({packaging:'包装',weee:'电子电器',battery:'电池'} as Record<string,string>)[settings.business]||settings.business;
  const date=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(new Date());
  const country=settings.country==='auto'?([...new Set(reportCountries)].sort().join('-')||'国家待定'):settings.country;
  return `EPR_通用整理_${country}_${business}_${settings.start||'期间待定'}_${settings.end||'期间待定'}_${date}.${extension}`.replace(/[\\/:*?"<>|]/g,'-');
}
export function downloadBlob(blob:Blob,name:string):void {
  const url=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=url;anchor.download=name;
  document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export async function downloadExcel(calculation:Calculation,sheets:Sheet[],edits:Edit[],settings:Settings):Promise<void> {
  const bytes=await new Promise<ArrayBuffer>((resolve,reject)=>{
    const worker=new Worker(new URL('./export.worker.ts',import.meta.url),{type:'module'});
    const timeout=setTimeout(()=>{worker.terminate();reject(new Error('Excel 导出超过 60 秒，已停止。请减少本次导出的文件数量后重试。'));},60000);
    const finish=()=>{clearTimeout(timeout);worker.terminate();};
    worker.onmessage=(event:MessageEvent<{bytes?:ArrayBuffer;error?:string}>)=>{
      finish();
      if(event.data.error) reject(new Error(event.data.error));
      else if(event.data.bytes) resolve(event.data.bytes);
      else reject(new Error('导出结果为空，请重试。'));
    };
    worker.onerror=()=>{finish();reject(new Error('Excel 导出失败，请减少数据量后重试。当前会话数据仍保留。'));};
    worker.onmessageerror=()=>{finish();reject(new Error('无法接收 Excel 导出结果，请重试。'));};
    try {worker.postMessage({calculation,sheets,edits,settings});}
    catch(error) {finish();reject(error instanceof Error?error:new Error('无法准备导出数据。'));}
  });
  downloadBlob(new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),exportFileName(settings,'xlsx',calculation.rows.map(r=>resolveDestination(r.effective).code).filter(Boolean)));
}
export function buildIssuesCsv(calculation:Calculation):string {
  const rowById=new Map(calculation.rows.map(row=>[row.id,row]));
  const rows:unknown[][]=[['记录 ID','文件','工作表','行号','级别','代码','问题','状态'],...calculation.issues.map(issue=>{
    const row=rowById.get(issue.rowId);
    return [issue.rowId,row?.fileName,row?.sheetName,row?.rowNumber,severityNames[issue.severity],issue.code,issue.message,row?statusNames[row.status]:''];
  })];
  return '\uFEFF'+rows.map(row=>row.map(v=>'"'+safeCsvCell(v).replace(/"/g,'""')+'"').join(',')).join('\r\n');
}
export function downloadIssuesCsv(calculation:Calculation,settings:Settings):void {
  downloadBlob(new Blob([buildIssuesCsv(calculation)],{type:'text/csv;charset=utf-8'}),exportFileName(settings,'csv',calculation.rows.map(r=>resolveDestination(r.effective).code).filter(Boolean)).replace('通用整理','问题清单'));
}
