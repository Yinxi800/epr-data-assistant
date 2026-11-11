import {useEffect,useState} from 'react';
import {CalendarDays} from 'lucide-react';
import {periodRange,type PeriodMode} from './PeriodPicker';
interface Props {start?:string;end?:string;reportRange:[string,string]|null;onChange:(range:{start?:string;end?:string})=>void;}
export default function ReportDateFilter({start,end,reportRange,onChange}:Props){
 const [mode,setMode]=useState<PeriodMode|'all'>(start||end?'custom':'all');
 useEffect(()=>{if(!start&&!end)setMode('all');},[start,end]);
 const seed=start||end||reportRange?.[0]||new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(new Date());
 const year=Number(seed.slice(0,4)),month=Number(seed.slice(5,7)),quarter=Math.ceil(month/3);
 const years=[...new Set([...Array.from({length:31},(_,i)=>new Date().getFullYear()-20+i),year,...(reportRange?.map(d=>Number(d.slice(0,4)))||[])])].sort((a,b)=>b-a);
 function chooseMode(next:PeriodMode|'all'){
  setMode(next);
  if(next==='all')onChange({start:undefined,end:undefined});
  else if(next==='custom'){if(!start&&!end&&reportRange)onChange({start:reportRange[0],end:reportRange[1]});}
  else onChange(periodRange(year,next==='year'?1:next==='quarter'?(quarter-1)*3+1:month,next==='year'?12:next==='quarter'?3:1));
 }
 return <section className="report-date-filter" aria-label="日期筛选">
 <div className="date-filter-controls">
 <label className="date-mode"><span><CalendarDays size={14}/>日期范围</span><select aria-label="日期范围" value={mode} onChange={e=>chooseMode(e.target.value as PeriodMode|'all')}><option value="all">全部期间</option><option value="month">按月份</option><option value="quarter">按季度</option><option value="year">按年度</option><option value="custom">自定义日期</option></select></label>
 {mode==='month'&&<label className="date-period-choice"><span>月份</span><input aria-label="月份" type="month" value={seed.slice(0,7)} onChange={e=>{if(/^\d{4}-\d{2}$/.test(e.target.value)){const [y,m]=e.target.value.split('-').map(Number);onChange(periodRange(y,m,1));}}}/></label>}
 {(mode==='quarter'||mode==='year')&&<label className={mode==='year'?'date-period-choice':''}><span>年份</span><select aria-label="年份" value={year} onChange={e=>onChange(periodRange(Number(e.target.value),mode==='year'?1:(quarter-1)*3+1,mode==='year'?12:3))}>{years.map(y=><option key={y} value={y}>{y} 年</option>)}</select></label>}
 {mode==='quarter'&&<label><span>季度</span><select aria-label="季度" value={quarter} onChange={e=>onChange(periodRange(year,(Number(e.target.value)-1)*3+1,3))}>{[1,2,3,4].map(q=><option key={q} value={q}>第 {q} 季度</option>)}</select></label>}
 <label><span>开始日期</span><input aria-label="开始日期" type="date" value={start||''} onChange={e=>{setMode('custom');onChange({start:e.target.value||undefined,end});}}/></label>
 <span className="date-range-separator" aria-hidden="true">至</span>
 <label><span>结束日期</span><input aria-label="结束日期" type="date" value={end||''} onChange={e=>{setMode('custom');onChange({start,end:e.target.value||undefined});}}/></label>
 {(start||end)&&<button className="text-button" onClick={()=>chooseMode('all')}>显示全部期间</button>}
 <span className="report-range-hint">{reportRange?`已读期间：${reportRange[0]} 至 ${reportRange[1]}`:'报告期间未提供'}{!start&&!end?' · 尚未限制日期':''}</span>
 </div>
 {start&&end&&start>end?<p role="alert" className="error">开始日期晚于结束日期，请调整时间段。</p>:(start||end)&&<p className="date-filter-note">按报告期间与所选日期是否有交集筛选；跨期记录保留整行数值，不按天分摊。日期留空表示该端不限。</p>}
 </section>;
}
