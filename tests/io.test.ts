import { describe,it,expect } from 'vitest';
import * as XLSX from 'xlsx';
import { inferMapping,parseBuffer,FILE_LIMIT } from '../src/core/parser';
import {buildParsedReport} from '../src/core/report';
import {buildReportWorkbook} from '../src/core/report-export';
const buffer=(s:string)=>new TextEncoder().encode(s).buffer as ArrayBuffer;
const parse=(s:string)=>parseBuffer(buffer(s),'模拟.csv','file-1','hash');
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

describe('report exports',()=>{
  it('round trips original values as text without executable formulas',()=>{
    const sheets=parse('SKU,产品名称,销售数量,重量,重量单位,重量含义\nA,=1+1,100,50,g,单件');
    const report=buildParsedReport(sheets);
    const workbook=buildReportWorkbook(report,sheets,{});
    const restored=XLSX.read(XLSX.write(workbook,{type:'array',bookType:'xlsx'}),{type:'array'});
    expect(restored.SheetNames).toEqual(['按产品分类','分类汇总','数量核对','原始报告','解析说明']);
    const detail=XLSX.utils.sheet_to_json<Record<string,string>>(restored.Sheets['按产品分类'])[0];
    expect(detail['重量合计 kg']).toBe('5');
    expect(detail['产品名称']).toBe('=1+1');
    for(const sheet of Object.values(restored.Sheets)) expect(Object.values(sheet).some(c=>typeof c==='object'&&c&&'f' in c)).toBe(false);
    const original=XLSX.utils.sheet_to_json<Record<string,string>>(restored.Sheets['原始报告'])[0];
    expect(original['重量']).toBe('50');expect(original['产品名称']).toBe('=1+1');
  });
  it('never exports missing weight as zero',()=>{
    const sheets=parse('SKU,销售数量,重量,重量单位,重量含义\nA,100,,g,单件');
    const workbook=buildReportWorkbook(buildParsedReport(sheets),sheets,{});
    const detail=XLSX.utils.sheet_to_json<Record<string,string>>(workbook.Sheets['按产品分类'])[0];
    expect(detail['重量合计 kg']).toBe('未知');
  });
});
