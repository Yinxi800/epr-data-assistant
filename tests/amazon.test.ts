import {it,expect} from 'vitest';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import {parseBuffer} from '../src/core/parser';
import {normalizeRows} from '../src/core/calculation';
import {buildParsedReport,reportQuantityGroups} from '../src/core/report';
import {buildReportWorkbook} from '../src/core/report-export';
const fixture=[
 {UNIQUE_ACCOUNT_IDENTIFIER:'SYNTHETIC',REPORT_PERIOD_START:'2026/10/1',REPORT_PERIOD_END:'2026/10/31',AMAZON_MARKETPLACE:'amazon.de',SHIP_TO_COUNTRY_CODE:'DE',SHIP_TO_COUNTRY:'Germany',ASIN:'SIM-A',EPR_CATEGORY:'EEE',EPR_SUBCATEGORY1:'SMALL EQUIPMENT',TOTAL_UNITS_SOLD:'10',TOTAL_REPORTED_WEIGHT_KG:'7.125',ITEM_WEIGHT_WITHOUT_PACKAGE_KG:'0.7',ITEM_WEIGHT_WITH_PACKAGE_KG:'0.8',PAPER_KG:'',PLASTIC_KG:'',GLASS_KG:''},
 {UNIQUE_ACCOUNT_IDENTIFIER:'SYNTHETIC',REPORT_PERIOD_START:'2026/10/1',REPORT_PERIOD_END:'2026/10/31',AMAZON_MARKETPLACE:'amazon.de',SHIP_TO_COUNTRY_CODE:'DE',SHIP_TO_COUNTRY:'Germany',ASIN:'SIM-A',EPR_CATEGORY:'Primary Packaging',EPR_SUBCATEGORY1:'',TOTAL_UNITS_SOLD:'10',TOTAL_REPORTED_WEIGHT_KG:'999',ITEM_WEIGHT_WITHOUT_PACKAGE_KG:'0.7',ITEM_WEIGHT_WITH_PACKAGE_KG:'0.8',PAPER_KG:'1.25',PLASTIC_KG:'0.2',GLASS_KG:'0'},
 {UNIQUE_ACCOUNT_IDENTIFIER:'SYNTHETIC',REPORT_PERIOD_START:'2026/10/1',REPORT_PERIOD_END:'2026/10/31',AMAZON_MARKETPLACE:'amazon.de',SHIP_TO_COUNTRY_CODE:'FR',SHIP_TO_COUNTRY:'France',ASIN:'',EPR_CATEGORY:'Secondary Packaging',EPR_SUBCATEGORY1:'',TOTAL_UNITS_SOLD:'10',TOTAL_REPORTED_WEIGHT_KG:'',ITEM_WEIGHT_WITHOUT_PACKAGE_KG:'',ITEM_WEIGHT_WITH_PACKAGE_KG:'',PAPER_KG:'0.5',PLASTIC_KG:'0.01',GLASS_KG:''},
];
function sheet(records:Record<string,string>[]=fixture,lower=false){const csv=Papa.unparse(records);const text=lower?csv.slice(0,csv.indexOf('\r\n')).toLowerCase()+csv.slice(csv.indexOf('\r\n')):csv;const [s]=parseBuffer(new TextEncoder().encode(text).buffer,'synthetic.csv','file','hash');s.confirmed=true;s.amazon!.confirmed=true;return s;}

it('大小写表头均保留材料、层级和目的国家，数量不按材料重复',()=>{
 for(const lower of [false,true]){
  const s=sheet(fixture,lower), report=buildParsedReport([s]);
  expect(normalizeRows([s])).toHaveLength(6);
  expect(report.products.find(g=>g.layer==='初级包装'&&g.classification==='纸')?.kg).toBe('1.25');
  expect(report.products.find(g=>g.layer==='运输包装'&&g.classification==='纸')?.country).toBe('FR');
  expect(reportQuantityGroups(report.lines,true).map(g=>g.quantity)).toEqual(['10','10','10']);
  expect(report.sourceCount).toBe(3);
 }
});
it('EEE使用报告总重并保留子分类，不乘UNITS_PER_ASIN',()=>{
 const report=buildParsedReport([sheet([{...fixture[0],UNITS_PER_ASIN:'4'}])]);
 expect(report.products[0].kg).toBe('7.125');expect(report.products[0].classification).toBe('SMALL EQUIPMENT');expect(report.products[0].quantity).toBe('10');
});
it('空白材料保留未知，全部缺失不补零',()=>{
 const report=buildParsedReport([sheet([{...fixture[1],PAPER_KG:'',PLASTIC_KG:'',GLASS_KG:''}])]);
 expect(report.lines.length).toBeGreaterThan(0);expect(report.lines.every(l=>l.kg===null)).toBe(true);
});
it('未知品类保留原文并提示核对',()=>{
 const report=buildParsedReport([sheet([{...fixture[0],EPR_CATEGORY:'New unknown category'}])]);
 expect(report.lines[0].business).toBe('New unknown category');expect(report.lines[0].notes.join()).toContain('无法识别分类');
});
it('重复原始行完整保留且数量只消除材料展开重复',()=>{
 const report=buildParsedReport([sheet([fixture[1],fixture[1]])]);
 expect(report.sourceCount).toBe(2);expect(reportQuantityGroups(report.lines,true)[0].quantity).toBe('20');expect(report.lines[0].notes.join()).toContain('内容相同');
});
it('导出原表不膨胀并保留材料原值与行号',()=>{
 const s=sheet(),report=buildParsedReport([s]);const wb=buildReportWorkbook(report,[s],{});
 const raw=XLSX.utils.sheet_to_json<Record<string,unknown>>(wb.Sheets['原始报告']);
 expect(raw).toHaveLength(3);expect(raw[1]['PAPER_KG']).toBe('1.25');expect(raw[1]['原始行号']).toBe(3);
 expect(XLSX.utils.sheet_to_json(wb.Sheets['数量核对'])).toHaveLength(3);
});
it('无效日期与负数重量保留核对提示',()=>{
 const report=buildParsedReport([sheet([{...fixture[1],REPORT_PERIOD_START:'2026/02/30',PAPER_KG:'-2'}])]);
 const paper=report.lines.find(l=>l.material==='纸')!;expect(paper.kg).toBeNull();expect(paper.notes.join()).toContain('日期未填写或无法识别');
});
it('材料展开后超过限制被明确拒绝',()=>{
 const data=Array.from({length:7000},()=>fixture[1]);const b=new TextEncoder().encode(Papa.unparse(data)).buffer;
 expect(()=>parseBuffer(b,'synthetic.csv','id','hash')).toThrow('材料拆分后超过');
});
