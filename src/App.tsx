import {useEffect,useRef,useState} from 'react';
import DirectReportWorkspace from './components/DirectReportWorkspace';
import {importDetailCount,type ImportManifestEntry} from './core/import';
import {parseFile} from './core/parser';
import type {CsvEncoding} from './core/encoding';
import type {Sheet} from './core/types';

export default function App(){
 const [sheets,setSheets]=useState<Sheet[]>([]),[manifest,setManifest]=useState<ImportManifestEntry[]>([]);
 const [busy,setBusy]=useState(''),[error,setError]=useState(''),[csvEncoding,setCsvEncoding]=useState<CsvEncoding>('auto');
 const taskFiles=useRef(new Map<string,File>()),importController=useRef<AbortController|null>(null),sheetsRef=useRef(sheets);
 sheetsRef.current=sheets;
 useEffect(()=>{const handler=(e:BeforeUnloadEvent)=>{if(sheets.length){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',handler);return()=>window.removeEventListener('beforeunload',handler);},[sheets.length]);
 async function runQueue(items:{id:string,file:File}[]){
  if(importController.current)return;
  const controller=new AbortController();importController.current=controller;
  setError('');setBusy('正在读取报告…');
  let failed=0;
  try{
   for(const item of items){
    if(controller.signal.aborted)break;
    setManifest(old=>old.map(m=>m.id===item.id?{...m,status:'processing',error:undefined}:m));
    setBusy(`正在读取报告 ${item.file.name}`);
    try{
     const parsed=await parseFile(item.file,csvEncoding,controller.signal);
     if(controller.signal.aborted)break;
     if(!parsed.length)throw Error('文件中没有可读取的工作表。');
     const current=sheetsRef.current;
     if(current.length+parsed.length>20)throw Error('一次最多处理 20 个工作表，请分批添加。');
     if([...current,...parsed].reduce((n,s)=>n+importDetailCount(s),0)>20000)throw Error('数据超过 20,000 条明细，请将报告拆成小文件后重试。');
     const duplicate=current.some(s=>s.hash===parsed[0].hash);
     const next=[...current,...parsed.map(s=>({...s,duplicate}))];
     sheetsRef.current=next;setSheets(next);
     setManifest(old=>old.map(m=>m.id===item.id?{...m,status:'success',error:undefined}:m));
    }catch(e){
     if(controller.signal.aborted)break;
     failed++;const message=e instanceof Error?e.message:String(e);
     setManifest(old=>old.map(m=>m.id===item.id?{...m,status:'failed',error:message}:m));
    }
   }
  }finally{
   if(controller.signal.aborted)setManifest(old=>old.map(m=>items.some(i=>i.id===m.id)&&['queued','processing'].includes(m.status)?{...m,status:'stopped',error:'已停止读取。读完的文件已保留，其他文件可重试。'}:m));
   importController.current=null;setBusy('');
   if(failed)setError(`${failed} 个文件读取失败，请展开“本次报告”查看原因并重试。其他已读文件不受影响。`);

  }
 }
 async function importFiles(files:File[]){
  if(importController.current||!files.length)return;
  if(files.length>20){setError('一次最多选择 20 个文件，请分批添加。');return;}
  const items=files.map(file=>({id:crypto.randomUUID(),file}));
  items.forEach(i=>taskFiles.current.set(i.id,i.file));
  setManifest(old=>[...old,...items.map(i=>({id:i.id,name:i.file.name,status:'queued' as const}))]);
  await runQueue(items);
 }
 function retryFile(id:string){
  const file=taskFiles.current.get(id);
  if(!file){setError('原文件不可用，请重新选择该报告文件。');return;}
  if(importController.current)return;
  setManifest(old=>old.map(m=>m.id===id?{...m,status:'queued',error:undefined}:m));void runQueue([{id,file}]);
 }
 function replaceFile(id:string,file:File){
  if(importController.current)return;
  const entry=manifest.find(m=>m.id===id);
  if(!entry||!['failed','stopped'].includes(entry.status))return;
  taskFiles.current.set(id,file);
  setManifest(old=>old.map(m=>m.id===id?{...m,name:file.name,status:'queued',error:undefined,history:[...(m.history||[]),`${m.name}：${m.error||m.status}；重新选择文件 ${file.name}`]}:m));
  void runQueue([{id,file}]);
 }

 async function demo(){setError('');try{const response=await fetch('./samples/模拟数据_包装.csv');if(!response.ok)throw Error('模拟文件未找到');await importFiles([new File([await response.blob()],'模拟数据_包装.csv')]);}catch(e){setError(String(e));}}
 function clear(){
  if(busy||!window.confirm('清空页面中的报告？原文件和已下载的结果不受影响。清空后需要重新添加报告。'))return false;
  setSheets([]);sheetsRef.current=[];setManifest([]);taskFiles.current.clear();setCsvEncoding('auto');setError('');return true;
 }
 return <DirectReportWorkspace sheets={sheets} busy={busy} error={error} encoding={csvEncoding} setEncoding={setCsvEncoding} onFiles={files=>void importFiles(files)} onDemo={()=>void demo()} manifest={manifest} onRetryFile={retryFile} onReplaceFile={replaceFile} onStop={()=>importController.current?.abort()} onClear={clear}/>;
}
