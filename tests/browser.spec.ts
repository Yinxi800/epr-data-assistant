import {test,expect,chromium,type Page} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import * as XLSX from 'xlsx';
const sample=path.resolve('public/samples/模拟数据_包装.csv');
const group=JSON.stringify(['模拟客户A','模拟店铺A']);
async function upload(page:Page,file:string=sample){await page.getByLabel('上传报告').setInputFiles(file);await expect(page.getByRole('status')).toContainText('解析完成');}
async function map(page:Page){await page.locator('nav').getByRole('button',{name:/字段映射/}).click();await page.getByLabel('我已核对本表字段映射与数字格式').check();await page.locator('nav').getByRole('button',{name:/口径与范围/}).click();}
async function configure(page:Page){await page.getByLabel('客户 / 店铺（不自动合并）').selectOption(group);await page.getByLabel('退货处理').selectOption('gross');await page.getByLabel('口径依据 / 人工确认说明').fill('模拟测试：不扣退货，人工确认责任范围');await page.getByLabel('已核对本次纳入的包装层级').check();await page.getByLabel('已核对取消、跨境流转').check();await page.locator('nav').getByRole('button',{name:/异常检查/}).click();}
async function summary(page:Page){await page.getByRole('button',{name:'查看汇总与导出'}).click();}
function sheetRows(wb:XLSX.WorkBook,name:string){return XLSX.utils.sheet_to_json<Record<string,unknown>>(wb.Sheets[name]);}
async function downloadWorkbook(page:Page){const done=page.waitForEvent('download');await page.getByRole('button',{name:/导出通用准备数据|导出未完成草稿/}).click();const downloaded=await done;const file=await downloaded.path();expect(downloaded.suggestedFilename()).toMatch(/DE_包装_2026-10-01_2026-10-31_\d{4}-\d{2}-\d{2}\.xlsx/);return XLSX.read(fs.readFileSync(file!));}
test('CSV 本地上传、100×50g 与总重5kg，导出与页面一致',async({page})=>{
 await page.goto('/');await page.screenshot({path:'output/playwright/desktop.png',fullPage:true});
 const requests:{method:string,url:string,body:string|null}[]=[];page.on('request',r=>requests.push({method:r.method(),url:r.url(),body:r.postData()}));
 await upload(page);await map(page);await configure(page);
 const records=page.locator('tbody tr');await expect(records).toHaveCount(2);await expect(records.nth(0).locator('td').nth(4)).toHaveText('5');await expect(records.nth(1).locator('td').nth(4)).toHaveText('5');
 await summary(page);await expect(page.locator('tbody tr').first().locator('td').nth(5)).toHaveText('10');
 await page.getByLabel('我已复核当前纳入、排除记录及计算结果').check();await page.screenshot({path:'output/playwright/summary.png',fullPage:true});
 const wb=await downloadWorkbook(page);expect(wb.SheetNames).toEqual(['数据汇总','标准化明细','异常及缺失清单','人工修改记录','字段映射及计算口径','原始数据']);expect(sheetRows(wb,'数据汇总')[0]['重量 kg（精确值）']).toBe('10');expect(sheetRows(wb,'标准化明细').map(r=>r['计算重量 kg'])).toEqual(['5','5']);
 expect(requests.every(r=>r.method==='GET'&&!r.body&&new URL(r.url).origin==='http://127.0.0.1:4173')).toBe(true);expect(requests.some(r=>r.url.includes('parser.worker'))).toBe(true);
 await page.getByRole('button',{name:'口径与范围',exact:true}).first().click();await page.getByText('可选：仅查看某个国家',{exact:true}).click();await page.getByRole('combobox',{name:'国家筛选（可选）',exact:true}).selectOption('FR');await page.locator('nav').getByRole('button',{name:/汇总与导出/}).click();await expect(page.getByLabel('我已复核当前纳入、排除记录及计算结果')).not.toBeChecked();await expect(page.getByText('尚无可纳入的记录。')).toBeVisible();
});
test('XLSX 上传与本地映射主动保存、清除',async({page})=>{
 await page.goto('/');await upload(page,path.resolve('public/samples/模拟数据_包装.xlsx'));await page.locator('nav').getByRole('button',{name:/字段映射/}).click();expect(await page.evaluate(()=>localStorage.getItem('epr-mapping-v1'))).toBeNull();await page.getByRole('button',{name:'主动保存此映射'}).click();expect(await page.evaluate(()=>localStorage.getItem('epr-mapping-v1'))).not.toBeNull();await page.getByLabel('我已核对本表字段映射与数字格式').check();await page.locator('nav').getByRole('button',{name:/口径与范围/}).click();await configure(page);await summary(page);await expect(page.locator('tbody tr').first().locator('td').nth(5)).toHaveText('10');page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'清除数据与保存的映射'}).click();expect(await page.evaluate(()=>localStorage.getItem('epr-mapping-v1'))).toBeNull();await expect(page.getByText('已解析文件',{exact:true})).toHaveCount(0);
});
test('缺失重量未知，修正留痕，人工确认后导出一致',async({page})=>{
 await page.goto('/');await upload(page,path.resolve('public/samples/模拟数据_异常.csv'));await map(page);await configure(page);
 const missing=page.locator('tbody tr').filter({hasText:'SIM-MISSING'});await expect(missing.locator('td').nth(4)).toHaveText('未知');await missing.getByRole('button',{name:'检查与修正'}).click();await page.getByLabel('新值',{exact:true}).fill('60');await page.getByLabel('修改原因',{exact:true}).fill('模拟人工实测包装单重60g');await page.getByRole('button',{name:'保存修改并重新计算'}).click();const dialog=page.getByRole('dialog');await expect(dialog.getByText('6 kg · 数量 100',{exact:true})).toBeVisible();await dialog.getByRole('button',{name:'确认本行提示并纳入'}).click();await dialog.getByRole('button',{name:'关闭',exact:true}).click();await summary(page);await expect(page.locator('tbody tr').first().locator('td').nth(5)).toHaveText('6');const wb=await downloadWorkbook(page);const changed=sheetRows(wb,'标准化明细').find(r=>r['当前·SKU']==='SIM-MISSING')!;expect(changed['原值·重量']).toBe('');expect(changed['当前·重量']).toBe('60');expect(changed['计算重量 kg']).toBe('6');const log=sheetRows(wb,'人工修改记录')[0];expect(log['修改原因']).toBe('模拟人工实测包装单重60g');expect(log['本次修改前重量 kg']).toBe('未知');expect(log['本次修改后重量 kg']).toBe('6');
});
test('重复文件与合法相同行不自动删除',async({page})=>{
 await page.goto('/');await upload(page);await upload(page);await expect(page.getByText('重复文件待确认',{exact:true})).toHaveCount(1);await page.locator('nav').getByRole('button',{name:/字段映射/}).click();const chooser=page.getByRole('combobox',{name:'工作表',exact:true});const options=await chooser.locator('option').evaluateAll(items=>items.map(o=>(o as HTMLOptionElement).value));for(const value of options){await chooser.selectOption(value);await page.getByLabel('我已核对本表字段映射与数字格式').check();}await page.locator('nav').getByRole('button',{name:/口径与范围/}).click();await configure(page);await expect(page.locator('tbody tr')).toHaveCount(4);await expect(page.getByText(/疑似重复记录/)).toHaveCount(4);await page.locator('tbody tr').first().getByRole('button',{name:'检查与修正'}).click();await page.getByRole('dialog').getByRole('button',{name:'确认本行提示并纳入'}).click();await page.getByRole('dialog').getByRole('button',{name:'关闭',exact:true}).click();await expect(page.locator('tbody tr')).toHaveCount(4);
});
test('手机视图无页面横向溢出',async({page})=>{await page.setViewportSize({width:390,height:844});await page.goto('/');await expect(page.getByRole('heading',{name:'导入报告',exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await page.screenshot({path:'output/playwright/mobile.png',fullPage:true});});

test('退货可配置，国家期间品类切换保留行号追溯',async({page})=>{
 await page.goto('/');const csv=fs.readFileSync(sample,'utf8').replace(/100,0,包装/g,'100,10,包装');await page.getByLabel('上传报告').setInputFiles({name:'模拟退货.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});await expect(page.getByRole('status')).toContainText('解析完成');await map(page);await configure(page);
 await page.locator('nav').getByRole('button',{name:/口径与范围/}).click();await page.getByLabel('退货处理').selectOption('net');await page.locator('nav').getByRole('button',{name:/异常检查/}).click();const records=page.locator('tbody tr');await expect(records.first().locator('td').nth(4)).toHaveText('4.5');await expect(records.nth(1).locator('td').nth(4)).toHaveText('未知');await records.first().getByRole('button',{name:'检查与修正'}).click();await expect(page.getByRole('dialog')).toContainText('第 2 行');await page.getByRole('dialog').getByRole('button',{name:'关闭',exact:true}).click();
 await page.locator('nav').getByRole('button',{name:/口径与范围/}).click();await page.getByLabel('开始日期').fill('2026-11-01');await page.getByLabel('结束日期').fill('2026-11-30');await page.getByRole('combobox',{name:'业务类型',exact:true}).selectOption('battery');await page.locator('nav').getByRole('button',{name:/异常检查/}).click();await expect(page.locator('tbody tr')).toHaveCount(2);await expect(page.locator('tbody tr').first()).toContainText('已排除');await expect(page.locator('tbody tr').first()).toContainText('第 2 行');
});
test('打包扩展独立打开并本地解析报告',async()=>{
 test.skip(!fs.existsSync('extension-dist/manifest.json'),'先运行 npm run build && npm run extension');
 const extensionPath=path.resolve('extension-dist');const context=await chromium.launchPersistentContext('',{channel:'chromium',executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,headless:true,args:[`--disable-extensions-except=${extensionPath}`,`--load-extension=${extensionPath}`]});
 try {const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');const extensionId=new URL(worker.url()).host;const page=await context.newPage();const requests:string[]=[];page.on('request',r=>requests.push(r.url()));await page.goto(`chrome-extension://${extensionId}/app/index.html`);await upload(page);await map(page);await configure(page);await summary(page);await expect(page.locator('tbody tr').first().locator('td').nth(5)).toHaveText('10');const wb=await downloadWorkbook(page);expect(sheetRows(wb,'数据汇总')[0]['重量 kg（精确值）']).toBe('10');expect(requests.every(url=>url.startsWith(`chrome-extension://${extensionId}/`)||url.startsWith('blob:chrome-extension:'))).toBe(true);await page.screenshot({path:'output/playwright/extension.png',fullPage:true});}finally{await context.close();}
});

test('按引导顺序从导入到人工确认导出',async({page})=>{
 await page.goto('/');await upload(page);await page.getByRole('button',{name:'下一步：口径与范围'}).click();await expect(page.getByRole('heading',{name:'口径与范围',exact:true})).toBeVisible();await page.getByLabel('客户 / 店铺（不自动合并）').selectOption(group);await page.getByLabel('退货处理').selectOption('gross');await page.getByLabel('口径依据 / 人工确认说明').fill('模拟引导流程确认');await page.getByLabel('已核对本次纳入的包装层级').check();await page.getByLabel('已核对取消、跨境流转').check();await page.getByRole('button',{name:'下一步：字段映射'}).click();await page.getByLabel('我已核对本表字段映射与数字格式').check();await page.getByRole('button',{name:'下一步：异常检查'}).click();await summary(page);await page.getByLabel('我已复核当前纳入、排除记录及计算结果').check();const wb=await downloadWorkbook(page);expect(sheetRows(wb,'数据汇总')[0]['重量 kg（精确值）']).toBe('10');
});


test('亚马逊目的国字段自动读取，多国分别汇总且导出不按商城猜测',async({page})=>{
 await page.goto('/');await expect(page.getByRole('heading',{name:'选择国家',exact:true})).toHaveCount(0);
 await upload(page,path.resolve('public/samples/模拟数据_亚马逊国家字段.csv'));
 const detection=page.getByRole('region',{name:'报告国家识别'});
 await expect(detection).toContainText('德国（DE）');await expect(detection).toContainText('法国（FR）');
 await map(page);await expect(page.getByText('默认按报告逐行识别并分别汇总，无需选择。',{exact:false})).toBeVisible();
 await configure(page);await summary(page);
 const summaries=page.locator('tbody tr');await expect(summaries).toHaveCount(2);
 await expect(summaries.nth(0).locator('td').nth(0)).toHaveText('DE');await expect(summaries.nth(1).locator('td').nth(0)).toHaveText('FR');
 await expect(summaries.nth(1).locator('td').nth(5)).toHaveText('5');
 const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'导出未完成草稿'}).click();const file=await downloadPromise;
 expect(file.suggestedFilename()).toContain('DE-FR_包装');const wb=XLSX.read(fs.readFileSync((await file.path())!));
 expect(sheetRows(wb,'数据汇总').map(r=>r['国家'])).toEqual(['DE','FR']);expect(sheetRows(wb,'标准化明细')[1]['当前·商城站点']).toBe('amazon.de');
 await page.screenshot({path:'output/playwright/multi-country-summary.png',fullPage:true});
});

for(const file of ['模拟_GBK.csv','模拟_UTF16LE.csv','模拟_UTF16BE.csv','模拟_制表.tsv','模拟_分号.txt','模拟.xls','模拟.ods'])test(`${file} 上传、中文预览、10kg与Excel导出`,async({page})=>{
 await page.goto('/');await upload(page,path.resolve('tests/fixtures',file));await map(page);await configure(page);await summary(page);await expect(page.locator('tbody tr').first().locator('td').nth(5)).toHaveText('10');
 const wb=await downloadWorkbook(page);expect(sheetRows(wb,'数据汇总')[0]['重量 kg（精确值）']).toBe('10');expect(sheetRows(wb,'标准化明细')[0]['当前·客户']).toBe('模拟客户A');
});
test('月、季、整年、自定义期间，切换撤销复核且导出日期一致',async({page})=>{
 await page.goto('/');await upload(page);await map(page);await configure(page);await summary(page);await page.getByLabel('我已复核当前纳入、排除记录及计算结果').check();
 await page.locator('nav').getByRole('button',{name:/口径与范围/}).click();await page.getByLabel('时间段选择').selectOption('month');await page.getByLabel('月份',{exact:true}).fill('2024-02');await expect(page.getByLabel('结束日期')).toHaveValue('2024-02-29');
 await page.getByLabel('时间段选择').selectOption('quarter');await expect(page.getByLabel('开始日期')).toHaveValue('2024-01-01');await expect(page.getByLabel('结束日期')).toHaveValue('2024-03-31');await page.getByLabel('季度',{exact:true}).selectOption('4');await expect(page.getByLabel('结束日期')).toHaveValue('2024-12-31');
 await page.screenshot({path:'output/playwright/period-quarter.png',fullPage:true});await page.getByLabel('时间段选择').selectOption('year');await page.getByLabel('年份',{exact:true}).selectOption('2026');await expect(page.getByLabel('开始日期')).toHaveValue('2026-01-01');await expect(page.getByLabel('结束日期')).toHaveValue('2026-12-31');
 await page.locator('nav').getByRole('button',{name:/汇总与导出/}).click();await expect(page.getByLabel('我已复核当前纳入、排除记录及计算结果')).not.toBeChecked();await expect(page.locator('tbody tr').first().locator('td').nth(5)).toHaveText('10');
 const ready=page.waitForEvent('download');await page.getByRole('button',{name:'导出未完成草稿'}).click();expect((await ready).suggestedFilename()).toContain('2026-01-01_2026-12-31');
 await page.locator('nav').getByRole('button',{name:/口径与范围/}).click();await expect(page.getByLabel('时间段选择')).toHaveValue('year');await page.getByLabel('时间段选择').selectOption('custom');await page.getByLabel('开始日期').fill('2026-10-02');await expect(page.getByLabel('开始日期')).toHaveValue('2026-10-02');
});

test('亚马逊多材料转换，数量按层级核对，EEE总重与导出来源一致',async({page})=>{
 await page.goto('/');await upload(page,path.resolve('tests/fixtures/模拟_亚马逊多材料.csv'));
 await page.locator('nav').getByRole('button',{name:/字段映射/}).click();await expect(page.getByText('亚马逊 EPR 报告转换',{exact:true})).toBeVisible();await expect(page.getByLabel('映射报告期间')).toBeDisabled();await page.getByLabel('已核对亚马逊重量口径、账户归属和空白材料处理').check();await page.getByLabel('我已核对本表字段映射与数字格式').check();
 await page.locator('nav').getByRole('button',{name:/口径与范围/}).click();await page.getByLabel('客户 / 店铺（不自动合并）').selectOption({index:1});await page.getByLabel('退货处理').selectOption('gross');await page.getByLabel('口径依据 / 人工确认说明').fill('合成测试：原报告总kg，仅汇总已填项，不另扣退货');await page.getByLabel('已核对本次纳入的包装层级').check();await page.getByLabel('已核对取消、跨境流转').check();
 await page.locator('nav').getByRole('button',{name:/汇总与导出/}).click();const quantities=page.getByRole('region',{name:'原始行数量核对'});await expect(quantities).toContainText('初级包装：10 件');await expect(quantities).toContainText('运输包装：10 件');
 const wb=await downloadWorkbook(page);const summaries=sheetRows(wb,'数据汇总');expect(summaries.find(r=>r['包装层级']==='初级包装'&&r['材料']==='纸')?.['重量 kg（精确值）']).toBe('1.25');expect(sheetRows(wb,'原始数据')).toHaveLength(3);expect(sheetRows(wb,'标准化明细')).toHaveLength(15);expect(sheetRows(wb,'原始行数量核对').map(r=>r['数量（仅消除材料拆分重复）'])).toEqual(['10','10']);
 await page.getByLabel('我已复核当前纳入、排除记录及计算结果').check();await page.locator('nav').getByRole('button',{name:/口径与范围/}).click();await page.getByRole('combobox',{name:'业务类型',exact:true}).selectOption('weee');await page.locator('nav').getByRole('button',{name:/汇总与导出/}).click();await expect(page.locator('tbody tr').first().locator('td').nth(5)).toHaveText('7.125');await expect(quantities).toContainText('10 件');await expect(page.getByLabel('我已复核当前纳入、排除记录及计算结果')).not.toBeChecked();
 await page.locator('nav').getByRole('button',{name:/字段映射/}).click();await page.getByLabel('已核对亚马逊重量口径、账户归属和空白材料处理').uncheck();await page.locator('nav').getByRole('button',{name:/汇总与导出/}).click();await expect(page.getByText('尚无可纳入的记录。')).toBeVisible();
});
