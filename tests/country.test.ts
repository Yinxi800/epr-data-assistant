import {describe,it,expect} from 'vitest';
import fs from 'node:fs';
import * as XLSX from 'xlsx';
import {inferMapping,parseBuffer} from '../src/core/parser';
import {resolveDestination} from '../src/core/country';
import {buildParsedReport} from '../src/core/report';
import {buildReportWorkbook} from '../src/core/report-export';
function fixture(){const bytes=fs.readFileSync('public/samples/模拟数据_亚马逊国家字段.csv');return parseBuffer(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'模拟数据_亚马逊国家字段.csv','sample','hash').map(s=>({...s,confirmed:true}));}

describe('报告目的国家自动识别',()=>{
 it('识别大小写及下划线，国家代码与名称分别映射',()=>{
  const mapping=inferMapping(['SHIP_TO_COUNTRY_CODE','ship_to_country','AMAZON_MARKETPLACE']);
  expect(mapping.country).toBe('SHIP_TO_COUNTRY_CODE');expect(mapping.countryName).toBe('ship_to_country');expect(mapping.marketplace).toBe('AMAZON_MARKETPLACE');
  expect(inferMapping(['AMAZON_MARKETPLACE']).country).toBeUndefined();
 });
 it('德国商城的法国目的地按法国分组，原值不改',()=>{
  const report=buildParsedReport(fixture());
  expect(report.categories.map(g=>[g.country,g.kg])).toEqual([['DE','5'],['FR','5']]);
  expect(report.lines[1].row.values.marketplace).toBe('amazon.de');expect(report.lines[1].row.raw.SHIP_TO_COUNTRY_CODE).toBe('FR');
 });
 it('明确国家名称可识别，缺代码时可用名称',()=>{
  expect(resolveDestination({country:'France'}).code).toBe('FR');
  expect(resolveDestination({country:'',countryName:'Germany'})).toMatchObject({code:'DE',source:'countryName'});
  expect(resolveDestination({country:'de',countryName:'德国'}).code).toBe('DE');
  expect(inferMapping(['SHIP_TO_COUNTRY']).country).toBe('SHIP_TO_COUNTRY');
 });
 it('代码与名称冲突保留明确提示',()=>{
  const sheets=fixture();sheets[0].rows[1].SHIP_TO_COUNTRY='Germany';
  const report=buildParsedReport(sheets);
  expect(report.lines[1].notes.join()).toContain('不一致');
 });
 it('缺失或未知国家不以商城补齐',()=>{
  for(const country of ['', 'not-a-country','ZZ']) expect(resolveDestination({country,countryName:'',marketplace:'amazon.de'}).code).toBe('');
 });
 it('筛选国家不修改原报告，清除筛选可恢复全部',()=>{
  const sheets=fixture();expect(buildParsedReport(sheets,{country:'FR'}).sourceCount).toBe(1);
  expect(sheets[0].rows[0].SHIP_TO_COUNTRY_CODE).toBe('DE');expect(buildParsedReport(sheets).sourceCount).toBe(2);
 });
 it('导出逐国结果并保留原始国家字段',()=>{
  const sheets=fixture(),report=buildParsedReport(sheets);const wb=buildReportWorkbook(report,sheets,{});
  const summary=XLSX.utils.sheet_to_json<Record<string,string>>(wb.Sheets['按产品分类']);
  expect(summary.map(r=>[r['目的国家'],r['重量合计 kg']])).toEqual([['DE','5'],['FR','5']]);
  const raw=XLSX.utils.sheet_to_json<Record<string,string>>(wb.Sheets['原始报告']);expect(raw[1]['SHIP_TO_COUNTRY_CODE']).toBe('FR');
 });
});
