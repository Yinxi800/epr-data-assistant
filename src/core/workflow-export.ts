import * as XLSX from 'xlsx';
import {downloadBlob} from './export';
import {fields} from './types';
import {buildWorkflow,groupWorkflowLines,workflowDetailCount,type WorkflowState} from './workflow';
export type WorkflowExportMode='draft'|'reviewed'|'issues';
export function buildWorkflowWorkbook(state:WorkflowState,mode:WorkflowExportMode='draft'){
 const result=buildWorkflow(state);const sourceReasons=new Map(result.sources.map(s=>[s.id,s.reason]));
 if(mode==='reviewed'&&!result.canExportReviewed)throw Error('当前版本尚未完成复核，不能导出已复核结果。可导出待核对草稿。');
 if(mode!=='issues'&&(state.manifest.some(f=>f.status==='processing'||f.status==='queued')||result.scopeError))throw Error(result.scopeError||'仍有文件正在处理，请等待完成或停止后导出稳定版本。');
 const wb=XLSX.utils.book_new();const add=(name:string,rows:Record<string,unknown>[])=>{const sheet=XLSX.utils.json_to_sheet(rows.length?rows:[{'说明':'无记录'}]);sheet['!cols']=Object.keys(rows[0]||{说明:''}).map(()=>({wch:24}));if(sheet['!ref'])sheet['!autofilter']={ref:sheet['!ref']};XLSX.utils.book_append_sheet(wb,sheet,name);};
 const label=mode==='reviewed'?'已复核通用整理':mode==='issues'?'问题清单':'待核对草稿';
 add('说明',[{项目:'文件性质',内容:label},{项目:'版本',内容:state.revision},{项目:'边界',内容:'通用数据整理，不是正式申报文件；未推定各国机构规则。'},{项目:'范围',内容:JSON.stringify(state.scope)},{项目:'导出范围',内容:'本次任务全部来源与处理记录；界面搜索、分页不改变导出范围。范围外记录在明细标为已排除，不计入可核对汇总。'},{项目:'缺失值',内容:'未知不补零；原报告数值仅供核对，待核对记录不计入可核对汇总。'},{项目:'批次清单',内容:state.manifestConfirmed?'已人工确认':'尚未确认'},{项目:'已知缺报',内容:state.knownGaps||'未登记；这不代表系统已确认完整'},{项目:'数量与重量',内容:'按原始行、类别、材料及包装层级保留；不跨类别或层级推算总销量。单件乘数量，总重不再乘数量；未自动扣退货或按天分摊。'},{项目:'任务数据',内容:'来源仅在当前页面内存中；已发起下载不代表已确认保存成功。'}]);
 add('文件清单',state.manifest.map(f=>({'文件':f.name,'状态':f.status,'错误':f.error||'','历次处理记录':(f.history||[]).join('\n')})));
 add('问题清单',result.sources.flatMap(s=>s.issues.map(i=>({'来源ID':s.id,'文件':s.lines[0]?.row.fileName,'原始行号':s.lines[0]?.row.rowNumber,'状态':s.status,'严重程度':i.severity,'问题':i.message,'处理依据':s.reason}))));
 if(mode==='issues')return wb;
 add('字段与转换',state.sheets.map(s=>({'文件':s.fileName,'工作表':s.name,'文件哈希':s.hash,'字段映射':JSON.stringify(s.mapping),'数字格式':s.numberFormat,'编码':s.csvEncoding||'工作簿','字段已核对':s.confirmed?'是':'否','亚马逊转换':JSON.stringify(s.amazon||{})})));
 add('按产品分类',(['included','pending','excluded'] as const).flatMap(status=>groupWorkflowLines(result.lines.filter(l=>l.status===status),true).map(g=>({'状态':status==='included'?(mode==='reviewed'?'已复核':'可核对'):status==='pending'?'待核对':'已排除','文件':g.fileName,'客户或报告账户':g.customer,'店铺':g.store,'产品':g.productName,'ASIN或SKU':g.productId,'国家':g.country,'期间':g.period,'类别':g.business,'分类':g.classification,'包装层级':g.layer,'当前候选重量 kg':g.kg??'未知','重量范围':g.partial?'仅已知项小计':'已填项合计','材料重量 kg':g.materials.map(m=>m.name+': '+(m.kg??'未知')).join('; '),'报告数量（勿跨类别累加）':g.quantity??'未知','来源行':g.sourceIds.join(', ')}))));
 add('可核对分类汇总',groupWorkflowLines(result.lines.filter(l=>l.status==='included'),false).flatMap(g=>g.materials.map(m=>({'文件':g.fileName,'客户或报告账户':g.customer,'店铺':g.store,'国家':g.country,'期间':g.period,'类别':g.business,'分类':g.classification,'包装层级':g.layer,'材料':m.name,'重量 kg':m.kg??'未知','报告数量（勿跨材料累加）':g.quantity??'未知','来源行':g.sourceIds.join(', ')}))));
 add('全部处理明细',result.lines.map(l=>({'状态':l.status==='included'?(mode==='reviewed'?'已复核':'可核对'):l.status==='pending'?'待核对':'已排除','来源ID':l.sourceId,'明细ID':l.row.id,'文件':l.row.fileName,'原始行号':l.row.rowNumber,'产品':l.productName,'ASIN或SKU':l.productId,'国家':l.country,'期间':l.period,'类别':l.business,'分类':l.classification,'包装层级':l.layer,'材料':l.material,'当前候选重量 kg':l.kg??'未知','报告数量':l.quantity??'未知','原始重量':l.row.values.weight??'未知','当前重量':l.effective.weight??'未知','全部原始映射值':JSON.stringify(l.row.values),'全部当前值':JSON.stringify(l.effective),'当前单位':l.effective.unit??'未知','重量含义':l.effective.weightMode??'未知','问题':l.notes.join('\n'),'处理依据':sourceReasons.get(l.sourceId)||''})));
 add('原始报告',state.sheets.flatMap(s=>s.rows.map((row,i)=>({'来源文件':s.fileName,'来源工作表':s.name,'来源原始行号':s.rowNumbers[i]??i+2,...Object.fromEntries(Object.entries(row).map(([k,v])=>['原始 · '+k,v]))}))));
 const editValues=new Map(result.lines.map(l=>[l.row.id,{...l.row.values}]));const linesById=new Map(result.lines.map(l=>[l.row.id,[l]]));for(const source of result.sources)linesById.set(source.id,source.lines);
 add('人工修改记录',state.edits.flatMap(e=>(linesById.get(e.rowId)||[]).map(l=>{const current=editValues.get(l.row.id)!;const before=current[e.field]??'';current[e.field]=e.after;return {'明细或来源ID':e.rowId,'应用明细ID':l.row.id,'字段':fields[e.field],'修改前':before,'修改后':e.after,'依据':e.reason,'时间':e.at};}))); 
 add('排除记录',result.sources.filter(s=>s.status==='excluded').map(s=>({'来源ID':s.id,'文件':s.lines[0]?.row.fileName,'原始行号':s.lines[0]?.row.rowNumber,'原因':s.reason})));
 return wb;
}
export async function downloadWorkflow(state:WorkflowState,mode:WorkflowExportMode='draft'){
 const bytes=await new Promise<ArrayBuffer>((resolve,reject)=>{
  const worker=new Worker(new URL('./workflow-export.worker.ts',import.meta.url),{type:'module'});
  const timer=setTimeout(()=>{worker.terminate();reject(Error('导出超时；数据仍保留，请重试。'));},60000);
  const finish=()=>{clearTimeout(timer);worker.terminate();};
  worker.onmessage=e=>{finish();e.data.error?reject(Error(e.data.error)):resolve(e.data.bytes);};
  worker.onerror=()=>{finish();reject(Error('导出失败；数据仍保留，请重试。'));};
  worker.postMessage({state,mode});
 });
 const label=mode==='reviewed'?'已复核通用整理':mode==='issues'?'问题清单':'待核对草稿';
 downloadBlob(new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),`EPR_${label}_v${state.revision}.xlsx`);
}
const canonical=(value:unknown):string=>{if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';if(value&&typeof value==='object')return '{'+Object.entries(value).filter(([,v])=>v!==undefined).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>JSON.stringify(k)+':'+canonical(v)).join(',')+'}';return JSON.stringify(value);};
async function checksum(value:unknown){const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical(value)));return Array.from(new Uint8Array(hash),n=>n.toString(16).padStart(2,'0')).join('');}
export async function createTaskBackup(state:WorkflowState):Promise<string>{
 const payload=structuredClone(state);return JSON.stringify({format:'epr-workflow-task',version:1,notice:'保存解析后的原始单元格、原文件哈希及处理记录，不包含原始文件二进制附件。校验用于检查副本完整性，不证明原文件真实性。',checksum:await checksum(payload),payload},null,2);
}
const isRecord=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
export async function restoreTaskBackup(text:string):Promise<WorkflowState>{
 if(text.length>50_000_000)throw Error('任务副本超过 50 MB，请使用较小副本。');
 let doc:unknown;try{doc=JSON.parse(text);}catch{throw Error('任务副本不是有效 JSON。');}
 if(!isRecord(doc)||doc.format!=='epr-workflow-task'||doc.version!==1||!isRecord(doc.payload))throw Error('任务副本格式或版本不支持。');
 if(typeof doc.checksum!=='string'||await checksum(doc.payload)!==doc.checksum)throw Error('任务副本完整性校验失败；未恢复修改，请使用未损坏的副本。');
 const p=doc.payload;
 if(!Array.isArray(p.sheets)||p.sheets.length>20||!Array.isArray(p.edits)||!Array.isArray(p.decisions)||!Array.isArray(p.manifest)||!isRecord(p.scope)||typeof p.knownGaps!=='string'||typeof p.manifestConfirmed!=='boolean'||typeof p.reviewed!=='boolean'||!Number.isSafeInteger(p.revision)||Number(p.revision)<1)throw Error('任务副本缺少必要字段。');
 const stringMap=(v:unknown)=>isRecord(v)&&Object.values(v).every(x=>typeof x==='string');
 const sheetIds=new Set<string>();let rowCount=0;
 for(const s of p.sheets){if(!isRecord(s)||!['id','fileId','fileName','hash','name'].every(k=>typeof s[k]==='string')||!Array.isArray(s.rows)||!s.rows.every(stringMap)||!Array.isArray(s.headers)||!s.headers.every(h=>typeof h==='string')||!Array.isArray(s.rowNumbers)||s.rowNumbers.length!==s.rows.length||!s.rowNumbers.every(n=>Number.isSafeInteger(n)&&n>0)||!stringMap(s.mapping)||!['dot','comma'].includes(String(s.numberFormat))||typeof s.confirmed!=='boolean'||typeof s.enabled!=='boolean'||typeof s.duplicate!=='boolean')throw Error('任务副本的原始工作表不完整；未套用旧修改。');
  if(s.amazon!==undefined&&(!isRecord(s.amazon)||typeof s.amazon.enabled!=='boolean'||typeof s.amazon.confirmed!=='boolean'||s.amazon.customer!==undefined&&typeof s.amazon.customer!=='string'||s.amazon.store!==undefined&&typeof s.amazon.store!=='string'))throw Error('亚马逊转换设置无效。');
  if(s.encodingNeedsReview!==undefined&&typeof s.encodingNeedsReview!=='boolean')throw Error('编码核对状态无效。');
  if(new Set(s.rowNumbers).size!==s.rowNumbers.length)throw Error('任务副本含重复原始行号。');
  if(sheetIds.has(String(s.id)))throw Error('任务副本含重复工作表标识。');sheetIds.add(String(s.id));rowCount+=s.rows.length;
  if(rowCount>20000)throw Error('任务副本超过 20,000 行。');
  if(Object.keys(s.mapping as object).some(k=>!Object.hasOwn(fields,k)))throw Error('任务副本存在不支持的映射字段。');
 }
 if(Object.entries(p.scope).some(([k,v])=>!['country','start','end'].includes(k)||typeof v!=='string'))throw Error('任务范围格式无效。');
 if(p.manifest.some(f=>!isRecord(f)||typeof f.id!=='string'||typeof f.name!=='string'||!['queued','processing','success','failed','stopped'].includes(String(f.status))||f.error!==undefined&&typeof f.error!=='string'||f.history!==undefined&&(!Array.isArray(f.history)||!f.history.every(x=>typeof x==='string'))))throw Error('文件清单格式无效。');
 if(p.edits.some(e=>!isRecord(e)||typeof e.rowId!=='string'||typeof e.field!=='string'||!Object.hasOwn(fields,e.field)||typeof e.after!=='string'||typeof e.reason!=='string'||!e.reason.trim()||typeof e.at!=='string'))throw Error('修改记录格式无效。');
 if(p.decisions.some(d=>!isRecord(d)||typeof d.sourceId!=='string'||!['confirm','exclude'].includes(String(d.action))||typeof d.reason!=='string'||!d.reason.trim()))throw Error('处理决定格式无效。');
 const state=p as unknown as WorkflowState;if(state.sheets.reduce((n,s)=>n+workflowDetailCount(s),0)>20000)throw Error('任务副本超过 20,000 条计算明细。');const derived=buildWorkflow({...state,edits:[],decisions:[]});if(derived.lines.length>20000)throw Error('任务副本超过 20,000 条计算明细。');const lineIds=new Set(derived.lines.map(l=>l.row.id)),sourceIds=new Set(derived.sources.map(s=>s.id));
 if(state.edits.some(e=>!lineIds.has(e.rowId)&&!sourceIds.has(e.rowId))||state.decisions.some(d=>!sourceIds.has(d.sourceId)))throw Error('修改记录无法匹配原始来源；未恢复旧修改。');
 return {...state,reviewed:false,revision:state.revision+1,manifest:state.manifest.map(f=>f.status==='queued'||f.status==='processing'?{...f,status:'stopped',error:'副本未包含原始文件附件，请重新选择该文件以继续解析。'}:f)};
}
