import {describe,it,expect} from 'vitest';
import fs from 'node:fs';
import * as XLSX from 'xlsx';
import {inferMapping,parseBuffer} from '../src/core/parser';
import {calculate,normalizeRows} from '../src/core/calculation';
import {resolveDestination} from '../src/core/country';
import {buildWorkbook,exportFileName} from '../src/core/export';
import type {Settings} from '../src/core/types';
const settings:Settings={country:'auto',business:'packaging',start:'2026-10-01',end:'2026-10-31',returns:'gross',basis:'模拟测试人工决定',scopeConfirmed:true,specialConfirmed:true,group:JSON.stringify(['模拟客户A','模拟店铺A']),reviewed:false};
function fixture(){const bytes=fs.readFileSync('public/samples/模拟数据_亚马逊国家字段.csv');return parseBuffer(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'模拟数据_亚马逊国家字段.csv','sample','hash').map(s=>({...s,confirmed:true}));}
describe('报告目的国家自动识别',()=>{
 it('识别大小写及下划线，代码优先且保留名称核对',()=>{
  const mapping=inferMapping(['SHIP_TO_COUNTRY_CODE','ship_to_country','AMAZON_MARKETPLACE']);
  expect(mapping.country).toBe('SHIP_TO_COUNTRY_CODE');expect(mapping.countryName).toBe('ship_to_country');expect(mapping.marketplace).toBe('AMAZON_MARKETPLACE');
  expect(inferMapping(['AMAZON_MARKETPLACE']).country).toBeUndefined();
 });
 it('德国和法国同报告自动分组，不需预选，不以德国商城替代法国目的国',()=>{
  const rows=normalizeRows(fixture());const result=calculate(rows,settings,[]);
  expect(result.counts.included).toBe(2);expect(result.counts.excluded).toBe(0);
  expect(result.summaries.map(s=>[s.country,s.kg])).toEqual([['DE','5'],['FR','5']]);
  expect(rows[1].values.marketplace).toBe('amazon.de');expect(rows[1].raw.SHIP_TO_COUNTRY_CODE).toBe('FR');
 });
 it('只有明确国家名称时可识别，缺代码可用名称；不修改原值',()=>{
  expect(resolveDestination({country:'France'}).code).toBe('FR');
  expect(resolveDestination({country:'',countryName:'Germany'})).toMatchObject({code:'DE',source:'countryName'});
  expect(resolveDestination({country:'de',countryName:'德国'}).code).toBe('DE');
  expect(inferMapping(['SHIP_TO_COUNTRY']).country).toBe('SHIP_TO_COUNTRY');
 });
 it('代码与名称冲突阻止，确认按钮或国家筛选均不能掩盖冲突',()=>{
  const rows=normalizeRows(fixture());rows[1].values.countryName='Germany';
  for(const country of ['auto','DE']){
   const result=calculate(rows,{...settings,country},[],[],rows.map(r=>r.id));
   expect(result.rows[1].status).toBe('pending');expect(result.rows[1].kg).toBeNull();expect(result.rows[1].issues.some(i=>i.code==='country-conflict')).toBe(true);
  }
 });
 it('缺失或未知国家保留待处理，不使用商城和筛选值补齐',()=>{
  for(const country of ['', 'not-a-country','ZZ']){
   const rows=normalizeRows(fixture());rows[0].values={...rows[0].values,country,countryName:''};
   const result=calculate(rows,{...settings,country:'DE'},[],[],[rows[0].id]);
   expect(result.rows[0].status).toBe('pending');expect(result.rows[0].kg).toBeNull();
  }
 });
 it('可选单国筛选保留其他国家的原始行，切回自动纳入全部',()=>{
  const rows=normalizeRows(fixture());const filtered=calculate(rows,{...settings,country:'FR'},[]);
  expect(filtered.summaries.map(s=>s.country)).toEqual(['FR']);expect(filtered.rows[0].status).toBe('excluded');expect(filtered.rows[0].raw.SHIP_TO_COUNTRY_CODE).toBe('DE');
  expect(calculate(rows,settings,[]).summaries).toHaveLength(2);
 });
 it('导出逐国结果及国家字段依据，文件名包含报告国家',()=>{
  const sheets=fixture();const result=calculate(normalizeRows(sheets),settings,[]);const wb=buildWorkbook(result,sheets,[],settings);
  const summary=XLSX.utils.sheet_to_json<Record<string,string>>(wb.Sheets['数据汇总']);
  expect(summary.map(r=>[r['国家'],r['重量 kg（精确值）']])).toEqual([['DE','5'],['FR','5']]);
  const details=XLSX.utils.sheet_to_json<Record<string,string>>(wb.Sheets['标准化明细']);
  expect(details[1]['识别目的国家']).toBe('FR');expect(details[1]['目的国家取值字段']).toBe('SHIP_TO_COUNTRY_CODE');
  expect(exportFileName(settings,'xlsx',['FR','DE','FR'])).toContain('DE-FR_包装');
 });
});
