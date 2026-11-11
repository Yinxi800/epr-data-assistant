import {test,expect,type Page} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import * as XLSX from 'xlsx';
const sample=path.resolve('public/samples/模拟数据_包装.csv');
const amazon=path.resolve('tests/fixtures/模拟_亚马逊多材料.csv');
const rows=(wb:XLSX.WorkBook,name:string)=>XLSX.utils.sheet_to_json<Record<string,unknown>>(wb.Sheets[name]);
async function workbook(page:Page,button:string){const ready=page.waitForEvent('download');await page.getByRole('button',{name:button,exact:true}).click();const file=await ready;return {name:file.suggestedFilename(),wb:XLSX.read(fs.readFileSync((await file.path())!))};}
async function flowUpload(page:Page,file=sample){await page.getByLabel('上传报告',{exact:true}).setInputFiles(file);await expect(page.getByRole('heading',{name:'已完成解析',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'处理异常',exact:true})).toBeEnabled();}
async function issues(page:Page){await page.getByRole('button',{name:'处理异常',exact:true}).click();}
async function confirmMapping(page:Page){await page.getByLabel('选择映射工作表').selectOption({index:1});await page.getByLabel('已核对本表字段、数字格式和编码预览').check();}
async function flowSummary(page:Page){await page.getByRole('button',{name:'查看汇总',exact:true}).click();}

test('三步流程、解析后范围、复核导出与搜索范围分离',async({page})=>{
 const requests:string[]=[];page.on('request',r=>requests.push(r.url()));await page.goto('/');
 await expect(page.getByLabel('目的国家范围')).toHaveCount(0);await expect(page.getByLabel('开始日期')).toHaveCount(0);
 await flowUpload(page);await issues(page);await expect(page.getByRole('heading',{name:'本次整理范围'})).toBeVisible();await expect(page.locator('.flow-scope')).toContainText('DE');await confirmMapping(page);await flowSummary(page);
 await expect(page.locator('#summary-table tbody tr')).toHaveCount(2);await expect(page.getByRole('button',{name:'导出已复核通用整理',exact:true})).toBeDisabled();
 await page.getByLabel('已核对本批预期文件、账户、国家与期间，无其他已知缺报').check();await page.getByLabel(/已复核当前 v/).check();
 await page.getByLabel('搜索产品或分类').fill('SIM-ASIN-001');await expect(page.locator('#summary-table tbody tr')).toHaveCount(1);
 const exported=await workbook(page,'导出已复核通用整理');expect(exported.name).toContain('已复核通用整理');expect(rows(exported.wb,'原始报告')).toHaveLength(2);expect(rows(exported.wb,'全部处理明细')).toHaveLength(2);expect(rows(exported.wb,'可核对分类汇总')[0]['重量 kg']).toBe('10');
 await page.getByLabel('搜索产品或分类').fill('');await page.getByRole('tab',{name:'按产品',exact:true}).focus();await page.keyboard.press('ArrowRight');await expect(page.getByRole('tab',{name:'按分类',exact:true})).toHaveAttribute('aria-selected','true');
 await page.getByRole('button',{name:'返回异常处理',exact:true}).click();await page.getByRole('button',{name:'调整国家与周期'}).click();await page.getByLabel('限定日期范围').check();await page.getByLabel('开始日期').fill('2026-10-15');await page.getByRole('button',{name:'应用范围'}).click();await flowSummary(page);await expect(page.getByLabel(/已复核当前 v/)).not.toBeChecked();await expect(page.getByRole('button',{name:'导出已复核通用整理',exact:true})).toBeDisabled();
 expect(requests.every(url=>url.startsWith('http://127.0.0.1:4173/')||url.startsWith('blob:'))).toBe(true);
});

test('部分文件失败保留成功数据，问题清单披露缺口',async({page})=>{
 await page.goto('/');await page.getByLabel('上传报告',{exact:true}).setInputFiles([{name:'正常.csv',mimeType:'text/csv',buffer:fs.readFileSync(sample)},{name:'损坏.xlsx',mimeType:'application/octet-stream',buffer:Buffer.from('not a workbook')}]);
 await expect(page.getByRole('heading',{name:'已完成解析'})).toBeVisible();await expect(page.locator('.rail-files')).toContainText('读取失败');await expect(page.getByRole('button',{name:'重试此文件'})).toBeEnabled();
 await page.getByRole('button',{name:'重试此文件'}).click();await expect(page.getByRole('button',{name:'处理异常',exact:true})).toBeEnabled();await expect(page.locator('.rail-files')).toContainText('文件内容与扩展名不一致');
 await issues(page);await flowSummary(page);const exported=await workbook(page,'导出待核对草稿');expect(rows(exported.wb,'原始报告')).toHaveLength(2);expect(rows(exported.wb,'文件清单')).toHaveLength(2);expect(JSON.stringify(rows(exported.wb,'文件清单'))).toContain('failed');await expect(page.getByRole('button',{name:'导出已复核通用整理'})).toBeDisabled();
});

test('未知与0区分、未保存修改三路处理、保存后导出新值',async({page})=>{
 await page.goto('/');const content=fs.readFileSync(sample,'utf8').replace(',50,g,单件',',,g,单件');await page.getByLabel('上传报告',{exact:true}).setInputFiles({name:'缺重量.csv',mimeType:'text/csv',buffer:Buffer.from(content)});await expect(page.getByRole('button',{name:'处理异常',exact:true})).toBeEnabled();await issues(page);await confirmMapping(page);
 const missing=page.locator('.report-data tbody tr').filter({hasText:'SIM-ASIN-001'});await expect(missing).toContainText('未知');await missing.getByRole('button',{name:'检查与修正'}).click();await page.getByLabel('新值（空白表示未知）').fill('60');await page.getByLabel('修改依据',{exact:true}).fill('测试测量记录：60g');await page.getByRole('dialog',{name:'检查与修正'}).getByRole('button',{name:'关闭',exact:true}).click();await expect(page.getByRole('alertdialog')).toBeVisible();await page.getByRole('button',{name:'返回编辑',exact:true}).click();await expect(page.getByLabel('新值（空白表示未知）')).toHaveValue('60');
 await page.getByRole('dialog',{name:'检查与修正'}).getByRole('button',{name:'关闭',exact:true}).click();await page.getByRole('button',{name:'保存后继续',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);await flowSummary(page);const exported=await workbook(page,'导出待核对草稿');expect(rows(exported.wb,'全部处理明细').find(r=>r['ASIN或SKU']==='SIM-ASIN-001')?.['当前候选重量 kg']).toBe('6');expect(JSON.stringify(rows(exported.wb,'人工修改记录'))).toContain('测试测量记录');expect(JSON.stringify(rows(exported.wb,'原始报告'))).not.toContain('60');
});

test('任务副本恢复原始数据和修改，损坏副本不清空现有任务',async({page})=>{
 await page.goto('/');await flowUpload(page);await issues(page);await confirmMapping(page);await page.locator('.report-data tbody tr').first().getByRole('button',{name:'检查与修正'}).click();await page.getByLabel('新值（空白表示未知）').fill('60');await page.getByLabel('修改依据',{exact:true}).fill('副本恢复测量记录');await page.getByRole('button',{name:'保存修改并重新检查'}).click();await page.getByRole('dialog').getByRole('button',{name:'关闭',exact:true}).click();
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'保存任务副本',exact:true}).click();const backup=await download;const data=fs.readFileSync((await backup.path())!);
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'清除本次任务'}).click();await page.getByLabel('恢复任务副本',{exact:true}).setInputFiles({name:'task.json',mimeType:'application/json',buffer:data});await expect(page.getByRole('heading',{name:'核对范围，处理异常'})).toBeVisible();await expect(page.locator('.report-data tbody tr').filter({hasText:'SIM-ASIN-001'})).toContainText('6');
 const corrupt=JSON.parse(data.toString());corrupt.payload.sheets=[];page.once('dialog',d=>d.accept());await page.getByLabel('恢复任务副本',{exact:true}).setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(corrupt))});await expect(page.getByRole('alert')).toContainText('完整性');await expect(page.locator('.report-data tbody tr')).toHaveCount(2);
});

test('停止后不接纳迟到解析结果，重试不重复成功文件',async({page})=>{
 await page.goto('/');await flowUpload(page);let release!:()=>void;const hold=new Promise<void>(resolve=>{release=resolve;});
 await page.route('**/src/core/parser.worker.ts*',async route=>{await hold;await route.continue().catch(()=>{});});
 await page.getByLabel('上传报告',{exact:true}).setInputFiles({name:'第二份.csv',mimeType:'text/csv',buffer:Buffer.from(fs.readFileSync(sample,'utf8').replaceAll('SIM-ASIN','OTHER-ASIN'))});await expect(page.getByRole('button',{name:'停止剩余，保留已完成文件'})).toBeVisible();await page.getByRole('button',{name:'停止剩余，保留已完成文件'}).click();release();await expect(page.locator('.rail-files')).toContainText('已停止');await page.unroute('**/src/core/parser.worker.ts*');await page.getByRole('button',{name:'重试此文件'}).click();await expect(page.getByRole('button',{name:'处理异常',exact:true})).toBeEnabled();await expect(page.getByText('2 个文件 · 4 行原报告 · 4 个有标识产品',{exact:true})).toBeVisible();
});

test('导出失败可重试，原数据仍在，移动端无页面横向溢出',async({page})=>{
 await page.goto('/');await flowUpload(page,amazon);await issues(page);await flowSummary(page);await page.route('**/src/core/workflow-export.worker.ts*',route=>route.abort());await page.getByRole('button',{name:'导出待核对草稿'}).click();await expect(page.getByRole('alert')).toContainText('导出失败');await page.unroute('**/src/core/workflow-export.worker.ts*');const exported=await workbook(page,'导出待核对草稿');expect(rows(exported.wb,'原始报告')).toHaveLength(3);
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'output/playwright/workflow-mobile.png',fullPage:true});await page.setViewportSize({width:1440,height:1000});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'output/playwright/workflow-summary.png',fullPage:true});
});

test('实际报告本地解析与导出读回',async({page})=>{
 test.skip(!process.env.EPR_REAL_REPORT,'仅在用户授权的本机实际报告存在时运行');await page.goto('/');await flowUpload(page,process.env.EPR_REAL_REPORT!);await expect(page.getByText('1 个文件 · 7 行原报告 · 3 个有标识产品',{exact:true})).toBeVisible();await issues(page);await flowSummary(page);const exported=await workbook(page,'导出待核对草稿');expect(rows(exported.wb,'原始报告')).toHaveLength(7);const details=rows(exported.wb,'全部处理明细');const eee=details.filter(r=>r['类别']==='weee');expect(eee.map(r=>r['当前候选重量 kg']).sort()).toEqual(['0.044','145.975','88.621'].sort());expect(eee.map(r=>r['报告数量']).sort()).toEqual(['1','15','200'].sort());
});

test('替换失败清单项保留历史并解除文件缺口',async({page})=>{
 await page.goto('/');await page.getByLabel('上传报告',{exact:true}).setInputFiles({name:'损坏.xlsx',mimeType:'application/octet-stream',buffer:Buffer.from('bad')});await expect(page.locator('.rail-files')).toContainText('读取失败');const chooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:'重新选择文件',exact:true}).click();await (await chooser).setFiles(sample);await expect(page.getByRole('button',{name:'处理异常',exact:true})).toBeEnabled();await expect(page.locator('.rail-file')).toHaveCount(1);await issues(page);await confirmMapping(page);await flowSummary(page);await page.getByLabel('已核对本批预期文件、账户、国家与期间，无其他已知缺报').check();await page.getByLabel(/已复核当前 v/).check();const exported=await workbook(page,'导出已复核通用整理');expect(rows(exported.wb,'文件清单')).toHaveLength(1);expect(rows(exported.wb,'文件清单')[0]['历次处理记录']).toContain('损坏.xlsx');
});

test('按已提交版本继续明确使用旧值，未保存输入可以找回',async({page})=>{
 await page.goto('/');await flowUpload(page);await issues(page);await confirmMapping(page);await page.locator('.report-data tbody tr').first().getByRole('button',{name:'检查与修正'}).click();await page.getByLabel('新值（空白表示未知）').fill('60');await page.getByLabel('修改依据',{exact:true}).fill('保留未保存输入');await page.getByRole('dialog').getByRole('button',{name:'关闭',exact:true}).click();await page.getByRole('button',{name:'按已提交版本继续',exact:true}).click();await expect(page.getByText('当前结果、导出和任务副本不含尚未保存的字段修改。',{exact:false})).toBeVisible();await page.getByRole('button',{name:'返回未保存的编辑',exact:true}).click();await expect(page.getByLabel('新值（空白表示未知）')).toHaveValue('60');await expect(page.getByLabel('修改依据',{exact:true})).toHaveValue('保留未保存输入');await page.getByRole('button',{name:'撤销未保存输入',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'关闭',exact:true}).click();await flowSummary(page);const exported=await workbook(page,'导出待核对草稿');expect(rows(exported.wb,'全部处理明细').find(r=>r['ASIN或SKU']==='SIM-ASIN-001')?.['当前候选重量 kg']).toBe('5');
});

test('60行分页选择仅本页，追加重复报告撤销原确认',async({page})=>{
 await page.goto('/');const original=fs.readFileSync(sample,'utf8').trim().split(/\r?\n/);const data=[original[0],...Array.from({length:60},(_,i)=>original[1].replaceAll('SIM-ASIN-001',`SIM-${String(i+1).padStart(3,'0')}`).replaceAll('SIM-SKU-001',`SKU-${i}`).replace(',否,0,',',是,0,'))].join('\n');const file={name:'60行.csv',mimeType:'text/csv',buffer:Buffer.from(data)};await page.getByLabel('上传报告',{exact:true}).setInputFiles(file);await expect(page.getByRole('button',{name:'处理异常',exact:true})).toBeEnabled();await issues(page);await confirmMapping(page);await expect(page.locator('.report-data tbody tr')).toHaveCount(25);await page.getByLabel('选择本页全部记录').check();await expect(page.getByText('已选 25 行',{exact:true})).toBeVisible();await page.getByRole('button',{name:'选择全部匹配 60 行'}).click();await page.getByLabel('批量处理依据').fill('模拟估算数据来源已检查');await page.getByRole('button',{name:'按依据确认待确认项'}).click();await page.getByRole('button',{name:'下一页',exact:true}).click();await page.getByRole('button',{name:'下一页',exact:true}).click();await expect(page.locator('.report-data tbody tr').first()).toContainText('SIM-051');
 await page.getByRole('button',{name:'返回上传',exact:true}).click();await page.getByLabel('上传报告',{exact:true}).setInputFiles({...file,name:'同内容改名.csv'});await expect(page.getByRole('button',{name:'处理异常',exact:true})).toBeEnabled();await issues(page);await expect(page.getByText('120 行待核对 · 0 行已排除',{exact:true})).toBeVisible();
});

test('亚马逊空白材料可以补正，原始空白仍保留',async({page})=>{
 const wb=XLSX.read(fs.readFileSync(amazon),{type:'buffer'});const matrix=XLSX.utils.sheet_to_json<string[]>(wb.Sheets[wb.SheetNames[0]],{header:1,raw:false});const col=matrix[0].indexOf('PLASTIC_KG');matrix[2][col]='';const csv=XLSX.utils.sheet_to_csv(XLSX.utils.aoa_to_sheet(matrix));await page.goto('/');await page.getByLabel('上传报告',{exact:true}).setInputFiles({name:'材料未知.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});await expect(page.getByRole('button',{name:'处理异常',exact:true})).toBeEnabled();await issues(page);const row=page.locator('.report-data tbody tr').filter({hasText:'第 3 行'});await expect(row).toContainText('待核对');await row.getByRole('button',{name:'检查与修正'}).click();await page.getByLabel('选择材料明细').selectOption({label:'塑料 · PLASTIC_KG'});await expect(page.getByLabel('新值（空白表示未知）')).toHaveValue('');await page.getByLabel('新值（空白表示未知）').fill('0');await page.getByLabel('修改依据',{exact:true}).fill('模拟测量确认本行没有塑料');await page.getByRole('button',{name:'保存修改并重新检查'}).click();await expect(page.getByRole('dialog')).toContainText('可核对');await page.getByRole('dialog').getByRole('button',{name:'关闭',exact:true}).click();await expect(row).toContainText('可核对');await flowSummary(page);const exported=await workbook(page,'导出待核对草稿');const raw=rows(exported.wb,'原始报告');expect(raw[1]['原始 · PLASTIC_KG']).toBe('');const line=rows(exported.wb,'全部处理明细').find(r=>r['原始行号']===3&&r['材料']==='塑料');expect(line?.['当前候选重量 kg']).toBe('0');expect(line?.['状态']).toBe('可核对');
});

test('修正目的国家后范围同步，原始国家可追溯',async({page})=>{
 await page.goto('/');await flowUpload(page);await issues(page);await confirmMapping(page);await page.locator('.report-data tbody tr').first().getByRole('button',{name:'检查与修正'}).click();await page.getByLabel('修改字段',{exact:true}).selectOption('country');await page.getByLabel('新值（空白表示未知）').fill('FR');await page.getByLabel('修改依据',{exact:true}).fill('模拟目的国字段核对');await page.getByRole('button',{name:'保存修改并重新检查'}).click();await page.getByRole('dialog').getByRole('button',{name:'关闭',exact:true}).click();await expect(page.locator('.flow-scope')).toContainText('FR');await page.getByRole('button',{name:'调整国家与周期'}).click();await page.getByLabel('目的国家范围').selectOption('FR');await page.getByRole('button',{name:'应用范围'}).click();await flowSummary(page);const exported=await workbook(page,'导出待核对草稿');expect(rows(exported.wb,'全部处理明细').find(r=>r['ASIN或SKU']==='SIM-ASIN-001')?.['国家']).toBe('FR');expect(rows(exported.wb,'原始报告')[0]['原始 · 目的国家']).toBe('DE');
});

test('20000行可分页处理，追加超限文件不丢失已完成数据',async({page})=>{
 test.setTimeout(60000);const csv=['SKU,目的国家,报告期间,销售数量,重量,重量单位,重量含义,EPR品类',...Array.from({length:20000},(_,i)=>`ROW-${i},DE,2026-10,1,1,g,单件,包装`)].join('\n');await page.goto('/');await page.getByLabel('上传报告',{exact:true}).setInputFiles({name:'大批量.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});await expect(page.getByRole('button',{name:'处理异常',exact:true})).toBeEnabled({timeout:30000});await expect(page.getByText('1 个文件 · 20000 行原报告 · 20000 个有标识产品',{exact:true})).toBeVisible();await issues(page);await expect(page.locator('.report-data tbody tr')).toHaveCount(25);await page.getByRole('button',{name:'返回上传',exact:true}).click();await page.getByLabel('上传报告',{exact:true}).setInputFiles({name:'超出一行.csv',mimeType:'text/csv',buffer:Buffer.from(csv.split('\n').slice(0,2).join('\n'))});await expect(page.locator('.rail-files')).toContainText('超过 20,000');await expect(page.getByText('1 个文件 · 20000 行原报告 · 20000 个有标识产品',{exact:true})).toBeVisible();
});
