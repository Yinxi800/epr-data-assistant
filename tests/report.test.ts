import {it,expect} from 'vitest';
import fs from 'node:fs';
import * as XLSX from 'xlsx';
import {parseBuffer} from '../src/core/parser';
import {buildParsedReport,reportTotals} from '../src/core/report';
import {buildReportWorkbook} from '../src/core/report-export';
const load=()=>{const b=fs.readFileSync('tests/fixtures/模拟_亚马逊多材料.csv');return parseBuffer(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'synthetic.csv','file','hash');};
it('默认直接展示原报告，无需伪造人工确认或退货设置',()=>{const sheets=load(),r=buildParsedReport(sheets);expect(sheets[0].confirmed).toBe(false);expect(sheets[0].amazon?.confirmed).toBe(false);expect(r.sourceCount).toBe(3);expect(r.productCount).toBe(1);expect(r.products).toHaveLength(3);expect(r.products.map(g=>g.quantity)).toEqual(['10','10','10']);expect(r.products.find(g=>g.business==='weee')?.kg).toBe('7.125');});
it('不同产品和分类保留，不将无ASIN汇总行猜分到产品',()=>{const sheets=load();sheets[0].rows.push({...sheets[0].rows[0],ASIN:'SIM-B',TOTAL_UNITS_SOLD:'2',TOTAL_REPORTED_WEIGHT_KG:'1'});sheets[0].rowNumbers.push(5);sheets[0].rows[2].ASIN='';sheets[0].rows[2].ITEM_NAME_AS_IN_MARKETPLACE='';const r=buildParsedReport(sheets);expect(r.productCount).toBe(2);expect(r.unassignedCount).toBe(1);expect(r.products).toHaveLength(4);expect(r.products.at(-1)?.productName).toBe('未分配到产品');expect(r.categories.find(g=>g.business==='weee')?.quantity).toBe('12');});
it('空白材料保留未知范围，缺失数量不补0，不使用净重猜总重',()=>{const sheets=load();sheets[0].rows[1].PLASTIC_KG='';sheets[0].rows[0].TOTAL_REPORTED_WEIGHT_KG='';sheets[0].rows[0].TOTAL_UNITS_SOLD='';const r=buildParsedReport(sheets);expect(r.products.find(g=>g.layer==='初级包装')?.partial).toBe(true);expect(r.products.find(g=>g.business==='weee')?.kg).toBeNull();expect(r.products.find(g=>g.business==='weee')?.quantity).toBeNull();});
it('搜索、分类和期间只筛选，不按天分摊原报告',()=>{const sheets=load();expect(buildParsedReport(sheets,{business:'weee'}).sourceCount).toBe(1);expect(buildParsedReport(sheets,{search:'no match'}).sourceCount).toBe(0);expect(buildParsedReport(sheets,{start:'2026-11-01',end:'2026-11-30'}).sourceCount).toBe(0);const r=buildParsedReport(sheets,{start:'2026-10-15',end:'2026-10-31'});expect(r.products.find(g=>g.business==='weee')?.kg).toBe('7.125');expect(r.lines[0].notes.join()).toContain('未按天分摊');});
it('文件与账号分开，导出含产品、分类、原始行与解析说明',()=>{const sheets=load(),other={...sheets[0],id:'file2:0',fileId:'file2',fileName:'other.csv'};const r=buildParsedReport([...sheets,other]);expect(r.categories).toHaveLength(6);const wb=buildReportWorkbook(r,[...sheets,other],{});expect(wb.SheetNames).toEqual(['按产品分类','按分类材料','原始报告','解析说明']);expect(XLSX.utils.sheet_to_json(wb.Sheets['原始报告'])).toHaveLength(6);const rows=XLSX.utils.sheet_to_json<Record<string,unknown>>(wb.Sheets['按产品分类']);expect(rows.find(g=>g['EPR类别']==='电子电器')?.['已填重量合计 kg']).toBe('7.125');});
it('运输包装的SP FBA汇总标识不误计成第四个产品，原值保留',()=>{const sheets=load();sheets[0].rows[2].ASIN='SP FBA';const r=buildParsedReport(sheets);expect(r.productCount).toBe(1);expect(r.unassignedCount).toBe(1);expect(r.products.find(g=>g.layer==='运输包装')?.productId).toBe('');expect(sheets[0].rows[2].ASIN).toBe('SP FBA');});

it('产品、国家、材料、层级、子分类和文件可组合筛选',()=>{
 const sheets=load();sheets[0].rows.push({...sheets[0].rows[0],ASIN:'SECOND',SHIP_TO_COUNTRY_CODE:'FR',SHIP_TO_COUNTRY:'France'});sheets[0].rowNumbers.push(5);
 expect(buildParsedReport(sheets,{product:'SECOND',country:'FR'}).sourceCount).toBe(1);
 expect(buildParsedReport(sheets,{product:'SECOND',country:'DE'}).sourceCount).toBe(0);
 const selected=buildParsedReport(sheets,{product:'SIM-ONLY',country:'DE',business:'packaging',layer:'初级包装',material:'塑料',file:'file'});
 expect(selected.sourceCount).toBe(1);expect(selected.products[0].kg).toBe('0.2');expect(selected.products[0].quantity).toBe('10');
 expect(buildParsedReport(sheets,{classification:'SMALL EQUIPMENT'}).sourceCount).toBe(2);
 expect(buildParsedReport(sheets,{file:'unknown'}).sourceCount).toBe(0);
});
it('筛选合计跨产品和子分类，但隔离国家层级文件，材料不重复计数量',()=>{
 const sheets=load();sheets[0].rows.push({...sheets[0].rows[0],ASIN:'SECOND',EPR_SUBCATEGORY1:'LARGE EQUIPMENT',TOTAL_REPORTED_WEIGHT_KG:'0.1',TOTAL_UNITS_SOLD:'2'});sheets[0].rowNumbers.push(5);
 const totals=reportTotals(buildParsedReport(sheets).lines);expect(totals).toHaveLength(3);
 expect(totals.find(g=>g.business==='weee')?.kg).toBe('7.225');expect(totals.find(g=>g.business==='weee')?.quantity).toBe('12');
 expect(totals.find(g=>g.layer==='初级包装')?.quantity).toBe('10');expect(totals.find(g=>g.layer==='初级包装')?.kg).toBe('1.45');
 const other={...sheets[0],id:'other:0',fileId:'other'};expect(reportTotals(buildParsedReport([...sheets,other]).lines)).toHaveLength(6);
 sheets[0].rows[3].SHIP_TO_COUNTRY_CODE='FR';sheets[0].rows[3].SHIP_TO_COUNTRY='France';expect(reportTotals(buildParsedReport(sheets).lines)).toHaveLength(4);
});
it('筛选合计的空白和显式零区分，混有缺失时显示部分合计',()=>{
 const sheets=load();sheets[0].rows[0].TOTAL_REPORTED_WEIGHT_KG='';let total=reportTotals(buildParsedReport(sheets,{business:'weee'}).lines)[0];expect(total.kg).toBeNull();expect(total.partial).toBe(true);
 sheets[0].rows.push({...sheets[0].rows[0],ASIN:'ZERO',TOTAL_REPORTED_WEIGHT_KG:'0'});sheets[0].rowNumbers.push(5);total=reportTotals(buildParsedReport(sheets,{business:'weee'}).lines)[0];expect(total.kg).toBe('0');expect(total.partial).toBe(true);
 expect(reportTotals(buildParsedReport(sheets,{search:'nothing'}).lines)).toEqual([]);
});
