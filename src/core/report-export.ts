import * as XLSX from 'xlsx';
import {downloadBlob} from './export';
import {businessLabel,classificationLabel,reportWeightLabel,type ParsedReport,type ReportFilter,type ReportGroup} from './report';
import type {Sheet} from './types';
function summary(g:ReportGroup){return {'文件':g.fileName,'客户或报告账户':g.customer,'店铺或商城范围':g.store,'产品名称':g.productName,'ASIN或SKU':g.productId,'EPR类别':businessLabel(g.business),'原报告子分类':g.classification,'细分类（中文参考）':classificationLabel(g.classification),'包装层级':g.layer,'履约渠道':g.channel,'目的国家':g.country,'原始期间':g.period,'报告数量（勿跨类别层级累加）':g.quantity??'未知','已填重量合计 kg':g.kg??'未知','重量明细 kg':g.materials.map(m=>`${reportWeightLabel(m.name,g.business)}: ${m.kg??'未知'}`).join('; '),'重量范围':g.partial?'部分材料或重量未提供，仅合计已知项':'已填项合计','来源文件行号':[...new Set(g.lines.map(l=>l.row.rowNumber))].join(', '),'待核对':g.notes.join('\n')};}
export function buildReportWorkbook(report:ParsedReport,sheets:Sheet[],filter:ReportFilter){
 const wb=XLSX.utils.book_new();const add=(name:string,rows:Record<string,unknown>[])=>{const sheet=XLSX.utils.json_to_sheet(rows.length?rows:[{'说明':'无记录'}]);sheet['!cols']=Array.from({length:Object.keys(rows[0]||{}).length},()=>({wch:24}));if(sheet['!ref'])sheet['!autofilter']={ref:sheet['!ref']};XLSX.utils.book_append_sheet(wb,sheet,name);};
 add('按产品分类',report.products.map(summary));add('按分类材料',report.categories.flatMap(g=>g.materials.map(m=>({...summary(g),'产品名称':'','材料':m.name,'材料已填重量 kg':m.kg??'未知'}))));
 const ids=new Set(report.lines.map(l=>l.sourceId));add('原始报告',sheets.flatMap(s=>s.rows.flatMap((raw,i)=>ids.has(`${s.id}:${s.rowNumbers[i]??i+2}`)?[{'文件':s.fileName,'工作表':s.name,'原始行号':s.rowNumbers[i]??i+2,...raw}]:[])));
 add('解析说明',[{'项目':'性质','说明':'本文件用于核对和整理报告，不是正式申报文件。数值来自原报告，未另行扣除退货；是否需要申报，请按适用规则核对。'},{'项目':'数量','说明':'同一行有多种材料时，数量只计一次。不同类别、包装层级和文件的数量不能直接相加。'},{'项目':'产品','说明':'按 ASIN 或 SKU 区分产品。无法对应产品的数据单独列出。'},{'项目':'重量','说明':'亚马逊报告使用已汇总的 kg 重量，不再乘数量。其他格式需写明单位、单件或总重量才计算。空白不按 0 计算，小计只含已填重量。'},{'项目':'筛选','说明':JSON.stringify(filter)},{'项目':'来源','说明':'原始报告表保留当前筛选内的原始行；全部计算在本地，不上传文件。'}]);return wb;
}
export async function downloadReport(report:ParsedReport,sheets:Sheet[],filter:ReportFilter){
 const bytes=await new Promise<ArrayBuffer>((resolve,reject)=>{const worker=new Worker(new URL('./report-export.worker.ts',import.meta.url),{type:'module'});const timer=setTimeout(()=>{worker.terminate();reject(Error('生成 Excel 超时，请重试；文件较大时可分批添加报告后下载。'));},60000);const finish=()=>{clearTimeout(timer);worker.terminate();};worker.onmessage=e=>{finish();e.data.error?reject(Error(e.data.error)):resolve(e.data.bytes);};worker.onerror=()=>{finish();reject(Error('导出失败，报告仍保留在当前页面。'));};worker.postMessage({report,sheets,filter});});
 const date=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(new Date());downloadBlob(new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),`EPR_报告解析_${date}.xlsx`);
}
