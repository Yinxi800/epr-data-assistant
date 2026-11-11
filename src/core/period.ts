export type PeriodMode='month'|'quarter'|'year'|'custom';
export function periodRange(year:number,month:number,months:number){
 const pad=(n:number)=>String(n).padStart(2,'0');
 const lastMonth=month+months-1;
 const day=new Date(Date.UTC(year,lastMonth,0)).getUTCDate();
 return {start:`${year}-${pad(month)}-01`,end:`${year}-${pad(lastMonth)}-${pad(day)}`};
}
