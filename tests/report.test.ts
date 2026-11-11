import {it,expect} from 'vitest';
import fs from 'node:fs';
import * as XLSX from 'xlsx';
import {parseBuffer} from '../src/core/parser';
import {buildParsedReport,reportTotals,reportMaterialTotals,classificationLabel} from '../src/core/report';
import {buildReportWorkbook} from '../src/core/report-export';
const load=()=>{const b=fs.readFileSync('tests/fixtures/模拟_亚马逊多材料.csv');return parseBuffer(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'synthetic.csv','file','hash');};
it('默认直接展示原报告，无需伪造人工确认或退货设置',()=>{const sheets=load(),r=buildParsedReport(sheets);expect(sheets[0].confirmed).toBe(false);expect(sheets[0].amazon?.confirmed).toBe(false);expect(r.sourceCount).toBe(3);expect(r.productCount).toBe(1);expect(r.products).toHaveLength(3);expect(r.products.map(g=>g.quantity)).toEqual(['10','10','10']);expect(r.products.find(g=>g.business==='weee')?.kg).toBe('7.125');});
it('不同产品和分类保留，不将无ASIN汇总行猜分到产品',()=>{const sheets=load();sheets[0].rows.push({...sheets[0].rows[0],ASIN:'SIM-B',TOTAL_UNITS_SOLD:'2',TOTAL_REPORTED_WEIGHT_KG:'1'});sheets[0].rowNumbers.push(5);sheets[0].rows[2].ASIN='';sheets[0].rows[2].ITEM_NAME_AS_IN_MARKETPLACE='';const r=buildParsedReport(sheets);expect(r.productCount).toBe(2);expect(r.unassignedCount).toBe(1);expect(r.products).toHaveLength(4);expect(r.products.at(-1)?.productName).toBe('无法对应产品');expect(r.categories.find(g=>g.business==='weee')?.quantity).toBe('12');});
it('空白材料保留未知范围，缺失数量不补0，不使用净重猜总重',()=>{const sheets=load();sheets[0].rows[1].PLASTIC_KG='';sheets[0].rows[0].TOTAL_REPORTED_WEIGHT_KG='';sheets[0].rows[0].TOTAL_UNITS_SOLD='';const r=buildParsedReport(sheets);expect(r.products.find(g=>g.layer==='初级包装')?.partial).toBe(true);expect(r.products.find(g=>g.business==='weee')?.kg).toBeNull();expect(r.products.find(g=>g.business==='weee')?.quantity).toBeNull();});
it('搜索、分类和期间只筛选，不按天分摊原报告',()=>{const sheets=load();expect(buildParsedReport(sheets,{business:'weee'}).sourceCount).toBe(1);expect(buildParsedReport(sheets,{search:'no match'}).sourceCount).toBe(0);expect(buildParsedReport(sheets,{start:'2026-11-01',end:'2026-11-30'}).sourceCount).toBe(0);const r=buildParsedReport(sheets,{start:'2026-10-15',end:'2026-10-31'});expect(r.products.find(g=>g.business==='weee')?.kg).toBe('7.125');expect(r.lines[0].notes.join()).toContain('未按天拆分');});
it('文件与账号分开，导出含产品、分类、原始行与解析说明',()=>{const sheets=load(),other={...sheets[0],id:'file2:0',fileId:'file2',fileName:'other.csv'};const r=buildParsedReport([...sheets,other]);expect(r.categories).toHaveLength(6);const wb=buildReportWorkbook(r,[...sheets,other],{});expect(wb.SheetNames).toEqual(['按产品分类','按分类材料','按材料汇总','原始报告','解析说明']);expect(XLSX.utils.sheet_to_json(wb.Sheets['原始报告'])).toHaveLength(6);const rows=XLSX.utils.sheet_to_json<Record<string,unknown>>(wb.Sheets['按产品分类']);expect(rows.find(g=>g['EPR类别']==='电子电器')?.['已填重量合计 kg']).toBe('7.125');expect(rows.find(g=>g['EPR类别']==='电子电器')?.['重量明细 kg']).toBe('产品报告重量: 7.125');});
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
it('筛选合计保留细分类并隔离国家层级文件，材料不重复计数量',()=>{
 const sheets=load();sheets[0].rows.push({...sheets[0].rows[0],ASIN:'SECOND',EPR_SUBCATEGORY1:'LARGE EQUIPMENT',TOTAL_REPORTED_WEIGHT_KG:'0.1',TOTAL_UNITS_SOLD:'2'});sheets[0].rowNumbers.push(5);
 const totals=reportTotals(buildParsedReport(sheets).lines);expect(totals).toHaveLength(4);
 expect(totals.find(g=>g.classification==='SMALL EQUIPMENT')?.kg).toBe('7.125');expect(totals.find(g=>g.classification==='SMALL EQUIPMENT')?.quantity).toBe('10');expect(totals.find(g=>g.classification==='LARGE EQUIPMENT')?.kg).toBe('0.1');expect(totals.find(g=>g.classification==='LARGE EQUIPMENT')?.quantity).toBe('2');
 expect(totals.find(g=>g.layer==='初级包装')?.quantity).toBe('10');expect(totals.find(g=>g.layer==='初级包装')?.kg).toBe('1.45');
 const other={...sheets[0],id:'other:0',fileId:'other'};expect(reportTotals(buildParsedReport([...sheets,other]).lines)).toHaveLength(8);
 sheets[0].rows[3].SHIP_TO_COUNTRY_CODE='FR';sheets[0].rows[3].SHIP_TO_COUNTRY='France';expect(reportTotals(buildParsedReport(sheets).lines)).toHaveLength(4);
});
it('筛选合计的空白和显式零区分，混有缺失时显示部分合计',()=>{
 const sheets=load();sheets[0].rows[0].TOTAL_REPORTED_WEIGHT_KG='';let total=reportTotals(buildParsedReport(sheets,{business:'weee'}).lines)[0];expect(total.kg).toBeNull();expect(total.partial).toBe(true);
 sheets[0].rows.push({...sheets[0].rows[0],ASIN:'ZERO',TOTAL_REPORTED_WEIGHT_KG:'0'});sheets[0].rowNumbers.push(5);total=reportTotals(buildParsedReport(sheets,{business:'weee'}).lines)[0];expect(total.kg).toBe('0');expect(total.partial).toBe(true);
 expect(reportTotals(buildParsedReport(sheets,{search:'nothing'}).lines)).toEqual([]);
});

it('细分类仅翻译已有标签，不根据产品补分类，未识别原值保留',()=>{
 expect(classificationLabel('SMALL EQUIPMENT EXCEPT PHOTOVOLTAIC PANEL')).toBe('小型设备（光伏板除外）');expect(classificationLabel('TEMPERATURE EXCHANGE EQUIPMENT')).toBe('温度交换设备');expect(classificationLabel('UNLISTED / SOURCE LABEL')).toBe('UNLISTED / SOURCE LABEL');
 const sheets=load();sheets[0].rows.push({...sheets[0].rows[0],ASIN:'SECOND',EPR_SUBCATEGORY1:'',TOTAL_REPORTED_WEIGHT_KG:'0.1'});sheets[0].rowNumbers.push(5);const totals=reportTotals(buildParsedReport(sheets,{business:'weee'}).lines);expect(totals).toHaveLength(2);expect(totals.find(g=>!g.classification)?.kg).toBe('0.1');
});

it('日期筛选支持单边边界，未知期间单独计数，跨期整行保留且材料不重复计行',()=>{
 const sheets=load();sheets[0].rows[2].REPORT_PERIOD_START='';sheets[0].rows[2].REPORT_PERIOD_END='';
 expect(buildParsedReport(sheets).sourceCount).toBe(3);const r=buildParsedReport(sheets,{start:'2026-10-15',end:'2026-10-20'});expect(r.sourceCount).toBe(2);expect(r.unknownPeriodCount).toBe(1);expect(r.crossPeriodCount).toBe(2);expect(r.products.find(g=>g.business==='weee')?.kg).toBe('7.125');
 expect(buildParsedReport(sheets,{start:'2026-11-01'}).sourceCount).toBe(0);expect(buildParsedReport(sheets,{end:'2026-10-01'}).sourceCount).toBe(2);expect(buildParsedReport(sheets,{end:'2026-09-30'}).sourceCount).toBe(0);expect(buildParsedReport(sheets,{start:'2026-10-31'}).sourceCount).toBe(2);
 expect(buildParsedReport(sheets,{start:'2026-02-30'}).sourceCount).toBe(0);expect(buildParsedReport(sheets,{start:'2026-11-01',end:'2026-10-01'}).sourceCount).toBe(0);expect(buildParsedReport(sheets,{business:'weee',start:'2026-10-01'}).unknownPeriodCount).toBe(0);
 expect(buildParsedReport(sheets).lines.some(l=>l.notes.some(n=>n.includes('此行包含所选日期以外')))).toBe(false);
});

it('纸与塑料按材料单独汇总，层级隔离且其他材料缺失不污染纸重量',()=>{
 const sheets=load();sheets[0].rows[1].PLASTIC_KG='';const r=buildParsedReport(sheets);const m=reportMaterialTotals(r.lines);const paper=m.filter(g=>g.materials[0].name==='纸');expect(paper).toHaveLength(2);expect(paper.map(g=>g.kg).sort()).toEqual(['0.5','1.25']);expect(paper.every(g=>!g.partial)).toBe(true);expect(m.some(g=>g.business==='weee')).toBe(false);
 const wb=buildReportWorkbook(r,sheets,{});const rows=XLSX.utils.sheet_to_json<Record<string,unknown>>(wb.Sheets['按材料汇总']);expect(rows.filter(g=>g['材料分类']==='纸')).toHaveLength(2);expect(rows.every(g=>!Object.keys(g).some(k=>k.includes('数量')))).toBe(true);
});

it('材料分类补全原报告空白列，缺失不补零且部分材料合计标明范围',()=>{
 const sheets=load();sheets[0].rows.push({...sheets[0].rows[1],PAPER_KG:'',ASIN:'SECOND'});sheets[0].rowNumbers.push(5);
 const m=reportMaterialTotals(buildParsedReport(sheets).lines);const p=m.find(g=>g.layer==='初级包装'&&g.materials[0].name==='纸')!;expect(p.kg).toBe('1.25');expect(p.partial).toBe(true);expect(p.sourceIds).toHaveLength(2);
 sheets[0].rows[1].PAPER_KG='';const unknown=reportMaterialTotals(buildParsedReport(sheets).lines).find(g=>g.layer==='初级包装'&&g.materials[0].name==='纸')!;expect(unknown.kg).toBeNull();
});
