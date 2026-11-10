import { describe,it,expect } from 'vitest';
import * as XLSX from 'xlsx';
import { inferMapping,parseBuffer,FILE_LIMIT } from '../src/core/parser';
import { buildWorkbook,buildIssuesCsv,safeCsvCell,exportFileName } from '../src/core/export';
import type {Calculation,Settings,ResultRow} from '../src/core/types';
const buffer=(s:string)=>new TextEncoder().encode(s).buffer as ArrayBuffer;
const parse=(s:string)=>parseBuffer(buffer(s),'模拟.csv','file-1','hash');
const settings:Settings={country:'DE',business:'packaging',start:'2026-10-01',end:'2026-10-31',returns:'gross',basis:'用户确认销售数量，不扣退货',scopeConfirmed:true,specialConfirmed:true,group:'["模拟客户","模拟店铺"]',reviewed:false};
function calculation():Calculation {
  const row:ResultRow={id:'row1',sheetId:'sheet1',fileId:'file1',fileName:'=HYPERLINK("https://bad")',sheetName:'模拟',rowNumber:2,raw:{'重量':'50','名称':'=1+1'},values:{weight:'50',name:'=1+1'},effective:{weight:'60',name:'=1+1'},numberFormat:'dot',mappingConfirmed:true,duplicateFile:false,quantity:'100',kg:'6',formula:'100 × 60 × 0.001 = 6 kg',issues:[{rowId:'row1',severity:'info',code:'edited',message:'人工修改'}],status:'included',edited:true};
  return {rows:[row],issues:row.issues,summaries:[{key:'a',country:'DE',customer:'模拟客户',store:'模拟店铺',category:'包装',material:'纸',quantity:'100',kg:'6',rowIds:['row1']}],counts:{imported:1,included:1,excluded:0,pending:0}};
}
describe('local parser',()=>{
  it('keeps source text and physical row numbers, does not confirm inferred mappings',()=>{
    const sheet=parse('客户,重量,重量单位\n模拟客户,50,g\n\n模拟客户,"1,25",kg')[0];
    expect(sheet.rows[1]['重量']).toBe('1,25');expect(sheet.rowNumbers).toEqual([2,4]);expect(sheet.confirmed).toBe(false);expect(sheet.mapping.weight).toBe('重量');
  });
  it('preserves physical line numbers for quoted multiline CSV',()=>{
    const sheet=parse('SKU,产品名称\na,"第一行\n第二行"\nb,名称')[0];
    expect(sheet.rowNumbers).toEqual([2,4]);expect(sheet.rows[0]['产品名称']).toBe('第一行\n第二行');
  });
  it('supports aliases while declining ambiguous aliases',()=>{
    expect(inferMapping(['weight','destination_country','marketplace']).country).toBe('destination_country');
    expect(inferMapping(['weight','重量']).weight).toBeUndefined();expect(inferMapping(['marketplace']).country).toBeUndefined();
  });
  it('does not remove legitimate identical records',()=>{expect(parse('SKU,重量\na,50\na,50')[0].rows).toHaveLength(2);});
  it('rejects malformed headers, oversize, wrong extension and invalid UTF-8',()=>{
    expect(()=>parse('SKU,SKU\na,a')).toThrow('重复列名');expect(()=>parse('SKU,,重量\na,b,4')).toThrow('空列名');
    expect(()=>parseBuffer(new ArrayBuffer(FILE_LIMIT+1),'a.csv','a','b')).toThrow('10 MB');
    expect(()=>parseBuffer(buffer('abc'),'a.pdf','a','b')).toThrow('支持');
    expect(()=>parseBuffer(new Uint8Array([0xff]).buffer,'a.csv','a','b')).toThrow('编码');
  });
  it('parses multiple xlsx worksheets, preserves formatted values and rejects formulas',()=>{
    const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['SKU','重量'],['A','1,25']]),'模拟1');XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['SKU','重量'],['B','5']]),'模拟2');
    const sheets=parseBuffer(XLSX.write(wb,{type:'array',bookType:'xlsx'}),'a.xlsx','a','b');
    expect(sheets).toHaveLength(2);expect(sheets[0].rows[0]['重量']).toBe('1,25');
    wb.Sheets['模拟1'].B2={t:'n',v:5,f:'2+3'};
    expect(()=>parseBuffer(XLSX.write(wb,{type:'array',bookType:'xlsx'}),'a.xlsx','a','b')).toThrow('含公式');
  });
});
describe('auditable exports',()=>{
  it('round trips consistent results, original values, edits and metadata',()=>{
    const data=calculation();const sheet=parse('客户,重量\n模拟客户,50')[0];
    const wb=buildWorkbook(data,[sheet],[{id:'e1',rowId:'row1',field:'weight',before:'50',after:'60',reason:'人工实测',at:'2026-11-10T00:00:00Z'}],settings);
    const restored=XLSX.read(XLSX.write(wb,{type:'array',bookType:'xlsx'}),{type:'array'});
    expect(restored.SheetNames).toEqual(['数据汇总','标准化明细','异常及缺失清单','人工修改记录','字段映射及计算口径','原始数据']);
    const summary=XLSX.utils.sheet_to_json<Record<string,string>>(restored.Sheets['数据汇总'])[0];expect(summary['重量 kg（精确值）']).toBe('6');
    const details=XLSX.utils.sheet_to_json<Record<string,string>>(restored.Sheets['标准化明细'])[0];expect(details['原值·重量']).toBe('50');expect(details['当前·重量']).toBe('60');
    expect(details['当前·产品名称']).toBe('=1+1');
    expect(Object.values(restored.Sheets['标准化明细']).some(c=>typeof c==='object'&&c&&'f' in c)).toBe(false);
    const audit=XLSX.utils.sheet_to_json<Record<string,string>>(restored.Sheets['人工修改记录'])[0];expect(audit['修改原因']).toBe('人工实测');
  });
  it('never turns missing calculated weight into zero',()=>{
    const data=calculation();data.rows[0].kg=null;
    const row=XLSX.utils.sheet_to_json<Record<string,string>>(buildWorkbook(data,[],[],settings).Sheets['标准化明细'])[0];expect(row['计算重量 kg']).toBe('未知');
  });
  it('protects CSV against formulas and keeps a UTF-8 BOM',()=>{
    for(const value of ['=1+1','+SUM(A1)','-2+3','@x',' \t=cmd'])expect(safeCsvCell(value).startsWith("'")).toBe(true);
    const csv=buildIssuesCsv(calculation());expect(csv.startsWith('\uFEFF')).toBe(true);expect(csv).toContain("'=HYPERLINK");expect(safeCsvCell('普通中文')).toBe('普通中文');
  });
  it('names exports with context and never claims formal filing',()=>{const filename=exportFileName(settings,'xlsx');expect(filename).toContain('DE_包装_2026-10-01_2026-10-31_');expect(filename).toContain('通用整理');});
});
