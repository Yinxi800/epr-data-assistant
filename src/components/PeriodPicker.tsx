export type PeriodMode='month'|'quarter'|'year'|'custom';
export function periodRange(year:number,month:number,months:number){
 const pad=(n:number)=>String(n).padStart(2,'0');
 const lastMonth=month+months-1;
 const day=new Date(Date.UTC(year,lastMonth,0)).getUTCDate();
 return {start:`${year}-${pad(month)}-01`,end:`${year}-${pad(lastMonth)}-${pad(day)}`};
}
export default function PeriodPicker({start,end,onChange,mode,setMode}:{start:string;end:string;onChange:(range:{start:string;end:string})=>void;mode:PeriodMode;setMode:(mode:PeriodMode)=>void}){
 const year=Number(start.slice(0,4))||new Date().getFullYear();
 const month=Number(start.slice(5,7))||1;
 const quarter=Math.ceil(month/3);
 const years=[...new Set([...Array.from({length:31},(_,i)=>new Date().getFullYear()-20+i),year])].sort((a,b)=>b-a);
 function selectMode(next:PeriodMode){setMode(next);if(next!=='custom')onChange(periodRange(year,next==='year'?1:next==='quarter'?(quarter-1)*3+1:month,next==='year'?12:next==='quarter'?3:1));}
 return <>
 <label className="field"><span>时间段选择</span><select name="period-mode" aria-label="时间段选择" value={mode} onChange={e=>selectMode(e.target.value as PeriodMode)}><option value="month">按月份</option><option value="quarter">按季度</option><option value="year">整年</option><option value="custom">自定义日期</option></select></label>
 {mode==='month'&&<label className="field"><span>月份</span><input name="period-month" autoComplete="off" type="month" value={start.slice(0,7)} onChange={e=>{if(/^\d{4}-\d{2}$/.test(e.target.value)){const [y,m]=e.target.value.split('-').map(Number);onChange(periodRange(y,m,1));}}}/></label>}
 {(mode==='quarter'||mode==='year')&&<label className="field"><span>年份</span><select name="period-year" aria-label="年份" value={year} onChange={e=>onChange(periodRange(Number(e.target.value),mode==='year'?1:(quarter-1)*3+1,mode==='year'?12:3))}>{years.map(y=><option key={y} value={y}>{y} 年</option>)}</select></label>}
 {mode==='quarter'&&<label className="field"><span>季度</span><select name="period-quarter" aria-label="季度" value={quarter} onChange={e=>onChange(periodRange(year,(Number(e.target.value)-1)*3+1,3))}>{[1,2,3,4].map(q=><option key={q} value={q}>第 {q} 季度（{(q-1)*3+1}–{q*3} 月）</option>)}</select></label>}
 <label className="field"><span>开始日期</span><input name="period-start" autoComplete="off" type="date" value={start} readOnly={mode!=='custom'} onChange={e=>onChange({start:e.target.value,end})}/></label>
 <label className="field"><span>结束日期</span><input name="period-end" autoComplete="off" type="date" value={end} readOnly={mode!=='custom'} onChange={e=>onChange({start,end:e.target.value})}/></label>
 <p className="small">按自然月、自然季度或自然年筛选，起止日期均包含在内。跨期报告仍需核对，不自动按天分摊；此选择不代表机构规定的申报周期。</p>
 </>;
}
