import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { fields, type Field, type Sheet } from './types';

export const FILE_LIMIT = 10 * 1024 * 1024;
export const ROW_LIMIT = 20000;
const aliases: Partial<Record<Field, string[]>> = {
  customer:['customer','customer name','client'], store:['store','store name','seller'],
  period:['report period','reporting period','period'], country:['destination country','destination country code'],
  marketplace:['marketplace','marketplace id'], asin:['asin'],sku:['sku','seller sku'],name:['product name','item name'],
  brand:['brand'],sales:['sales quantity','quantity sold','units sold'],returns:['return quantity','returns quantity'],
  category:['epr category','epr type'],material:['packaging material','material'],layer:['packaging layer'],
  weight:['weight'],unit:['weight unit','unit of weight'],weightMode:['weight basis','weight mode'],
  weightKind:['weight type','weight kind'],channel:['fulfillment channel','fulfilment channel'],source:['data source'],
  estimated:['estimated','estimate flag'],cancelled:['cancelled quantity'],flow:['cross border flow'],buyer:['buyer type','b2b/b2c'],
};
const key = (s:string) => s.trim().toLowerCase().replace(/[\s_-]+/g,'');
export function inferMapping(headers:string[]):Sheet['mapping'] {
  const mapping:Sheet['mapping'] = {};
  for (const field of Object.keys(fields) as Field[]) {
    const matches = headers.filter(h => [fields[field],...(aliases[field] || [])].some(a=>key(a)===key(h)));
    if(matches.length===1) mapping[field]=matches[0];
  }
  return mapping;
}
function matrixToSheet(matrix:unknown[][],name:string,fileName:string,fileId:string,hash:string,index:number,sourceRowNumbers?:number[]):Sheet {
  const first = matrix.findIndex(row=>row.some(value=>String(value??'').trim()!==''));
  if(first<0) throw new Error(`工作表“${name}”为空，请删除空工作表后重试。`);
  const headers=matrix[first].map(value=>String(value??'').trim());
  if(headers.length>100) throw new Error(`工作表“${name}”超过 100 列限制。`);
  if(headers.some(h=>!h)) throw new Error(`工作表“${name}”有空列名，请补齐表头后重试。`);
  if(new Set(headers.map(key)).size!==headers.length) throw new Error(`工作表“${name}”有重复列名，请使用唯一列名。`);
  const rows:Record<string,string>[]=[];const rowNumbers:number[]=[];
  for(let i=first+1;i<matrix.length;i++) {
    const row=matrix[i];
    if(!row.some(value=>String(value??'').trim()!=='')) continue;
    if(row.some(value=>String(value??'').length>32767)) throw new Error(`“${name}”第 ${sourceRowNumbers?.[i]??i+1} 行单元格超过 Excel 的 32,767 字符限制，请拆分内容。`);
    if(row.length>headers.length && row.slice(headers.length).some(v=>String(v??'').trim()!=='')) throw new Error(`“${name}”第 ${i+1} 行超出表头列数，请检查分隔符或补齐表头。`);
    rows.push(Object.fromEntries(headers.map((h,j)=>[h,String(row[j]??'')])));rowNumbers.push(sourceRowNumbers?.[i]??i+1);
  }
  if(!rows.length) throw new Error(`工作表“${name}”只有表头，没有数据。`);
  if(rows.length>ROW_LIMIT) throw new Error(`单个文件最多 ${ROW_LIMIT.toLocaleString()} 条记录，请拆分文件。`);
  return {id:`${fileId}:${index}`,fileId,fileName,hash,name,headers,rows,rowNumbers,mapping:inferMapping(headers),confirmed:false,enabled:true,duplicate:false,numberFormat:'dot'};
}
export function parseBuffer(buffer:ArrayBuffer,fileName:string,fileId:string,hash:string):Sheet[] {
  if(buffer.byteLength>FILE_LIMIT) throw new Error('文件超过 10 MB，请拆分后重试。');
  const extension=fileName.split('.').pop()?.toLowerCase();
  if(extension==='csv') {
    let content:string;
    try {content=new TextDecoder('utf-8',{fatal:true}).decode(buffer).replace(/^\uFEFF/,'');}
    catch {throw new Error('CSV 编码不是 UTF-8，请另存为 UTF-8 CSV 后重试。');}
    const matrix:string[][]=[];const sourceRowNumbers:number[]=[];const parseErrors:Papa.ParseError[]=[];
    let cursor=0,line=1;
    Papa.parse<string[]>(content,{dynamicTyping:false,skipEmptyLines:false,step:result=>{
      matrix.push(result.data);sourceRowNumbers.push(line);parseErrors.push(...result.errors);
      const consumed=content.slice(cursor,result.meta.cursor);
      line+=(consumed.match(/\r\n|\r|\n/g)||[]).length;cursor=result.meta.cursor;
    }});
    const errors=parseErrors.filter(e=>e.code!=='UndetectableDelimiter');
    if(errors.length) throw new Error(`CSV 格式错误：${errors[0].message}。请检查引号和分隔符。`);
    return [matrixToSheet(matrix,'CSV',fileName,fileId,hash,0,sourceRowNumbers)];
  }
  if(extension!=='xlsx') throw new Error('仅支持 .csv 和 .xlsx 文件，不支持旧版 XLS 或含宏文件。');
  const workbook=XLSX.read(buffer,{type:'array',cellDates:false,cellFormula:true});
  if(!workbook.SheetNames.length) throw new Error('工作簿没有可读取的工作表。');
  if(workbook.SheetNames.length>20) throw new Error('单个文件最多 20 个工作表，请拆分文件。');
  let total=0;
  return workbook.SheetNames.map((name,index)=>{
    const worksheet=workbook.Sheets[name];
    const range=XLSX.utils.decode_range(worksheet['!ref']||'A1');
    if(range.e.c>=100 || range.e.r>ROW_LIMIT) throw new Error(`工作表“${name}”超过 20,000 行或 100 列范围限制，请删除多余格式区域或拆分文件。`);
    for(const [address,cell] of Object.entries(worksheet)) {
      if(!address.startsWith('!') && typeof cell==='object' && cell && 'f' in cell) throw new Error(`工作表“${name}”的 ${address} 含公式。请复制为数值后导入，避免读取过期缓存结果。`);
    }
    const matrix=XLSX.utils.sheet_to_json<unknown[]>(worksheet,{header:1,raw:false,defval:'',blankrows:true,range:0});
    const sheet=matrixToSheet(matrix,name,fileName,fileId,hash,index);
    total+=sheet.rows.length;
    if(total>ROW_LIMIT) throw new Error('单个文件所有工作表合计最多 20,000 条记录，请拆分文件。');
    return sheet;
  });
}
export async function parseFile(file:File):Promise<Sheet[]> {
  if(file.size>FILE_LIMIT) throw new Error('文件超过 10 MB，请拆分后重试。');
  if(!/\.(csv|xlsx)$/i.test(file.name)) throw new Error('请选择 CSV 或 XLSX 文件。');
  const buffer=await file.arrayBuffer();
  const digest=await crypto.subtle.digest('SHA-256',buffer);
  const hash=Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
  const fileId=crypto.randomUUID();
  return new Promise((resolve,reject)=>{
    const worker=new Worker(new URL('./parser.worker.ts',import.meta.url),{type:'module'});
    const timeout=setTimeout(()=>{worker.terminate();reject(new Error('解析超过 30 秒，已停止。请拆分文件或检查工作簿是否包含过多格式区域。'));},30000);
    worker.onmessage=(event:MessageEvent<{sheets?:Sheet[];error?:string}>)=>{
      clearTimeout(timeout);worker.terminate();
      if(event.data.error) reject(new Error(event.data.error));else resolve(event.data.sheets||[]);
    };
    worker.onerror=()=>{clearTimeout(timeout);worker.terminate();reject(new Error('文件解析失败，请检查文件内容或尝试另存为 UTF-8 CSV。'));};
    worker.postMessage({buffer,fileName:file.name,fileId,hash},[buffer]);
  });
}
