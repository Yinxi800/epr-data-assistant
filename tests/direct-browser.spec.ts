import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import * as XLSX from 'xlsx';
const screenshotDirectory=path.join('test-results/screenshots',new Date().toISOString().replace(/[:.]/g,'-'));
fs.mkdirSync(screenshotDirectory,{recursive:true});
const screenshotPath=(name:string)=>path.join(screenshotDirectory,name);
test('默认上传即展示、无异常步骤或确认门槛，搜索不缩小导出',async({page})=>{
 await page.goto('/');await page.getByLabel('上传报告',{exact:true}).setInputFiles(path.resolve('tests/fixtures/模拟_亚马逊多材料.csv'));await expect(page.getByRole('heading',{name:'报告已整理'})).toBeVisible();await expect(page.getByRole('checkbox')).toHaveCount(0);await expect(page.getByRole('navigation',{name:'整理步骤'})).toHaveCount(0);await expect(page.locator('#report-table tbody tr')).toHaveCount(15);await page.getByLabel('搜索产品或分类').fill('不存在');await expect(page.locator('#report-table tbody tr')).toHaveCount(0);await expect(page.getByRole('button',{name:'下载全部数据',exact:true})).toBeEnabled();const ready=page.waitForEvent('download');await page.getByRole('button',{name:'下载全部数据',exact:true}).click();const dl=await ready;const wb=XLSX.read(fs.readFileSync((await dl.path())!));expect(XLSX.utils.sheet_to_json(wb.Sheets['原始报告'])).toHaveLength(3);expect(XLSX.utils.sheet_to_json(wb.Sheets['按产品分类'])).toHaveLength(15);await page.getByRole('button',{name:'清除全部筛选'}).click();await page.screenshot({path:screenshotPath('direct-desktop.png'),fullPage:true});await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('缺少重量直接展示未知并允许导出，不要求处理异常',async({page})=>{
 await page.goto('/');await page.getByLabel('上传报告',{exact:true}).setInputFiles(path.resolve('public/samples/模拟数据_异常.csv'));await expect(page.getByRole('heading',{name:'报告已整理'})).toBeVisible();await expect(page.getByRole('checkbox')).toHaveCount(0);await expect(page.locator('#report-table')).toContainText('未提供');const ready=page.waitForEvent('download');await page.getByRole('button',{name:'下载全部数据',exact:true}).click();const dl=await ready;const wb=XLSX.read(fs.readFileSync((await dl.path())!));const data=XLSX.utils.sheet_to_json<Record<string,unknown>>(wb.Sheets['按产品分类']);expect(data.some(r=>r['重量合计 kg']==='未知')).toBe(true);expect(XLSX.utils.sheet_to_json(wb.Sheets['原始报告'])).toHaveLength(4);
});
test('实际报告直接解析并导出，无人工确认步骤',async({page})=>{
 test.skip(!process.env.EPR_REAL_REPORT,'仅本机授权实际报告');await page.goto('/');await page.getByLabel('上传报告',{exact:true}).setInputFiles(process.env.EPR_REAL_REPORT!);await expect(page.getByRole('heading',{name:'报告已整理'})).toBeVisible();await expect(page.locator('#report-table .weight-subtotal-cell[data-attention=missing]')).toHaveCount(0);await page.getByRole('button',{name:'显示未提供项',exact:true}).click();await expect(page.locator('#report-table tbody tr')).toHaveCount(30);await expect(page.getByRole('checkbox')).toHaveCount(0);await page.getByLabel('筛选EPR类别').selectOption('weee');const totals=page.getByRole('region',{name:'筛选结果合计'});await expect(totals.getByTestId('total-weight')).toHaveText(['146.019','88.621']);await expect(totals.getByTestId('total-quantity')).toHaveText(['201','15']);await expect(totals).toContainText('小型设备（光伏板除外）');await expect(totals).toContainText('温度交换设备');await page.getByRole('button',{name:'清除全部筛选'}).click();const ready=page.waitForEvent('download');await page.getByRole('button',{name:'下载全部数据',exact:true}).click();const wb=XLSX.read(fs.readFileSync((await (await ready).path())!));expect(XLSX.utils.sheet_to_json(wb.Sheets['原始报告'])).toHaveLength(7);const data=XLSX.utils.sheet_to_json<Record<string,unknown>>(wb.Sheets['按产品分类']);expect(data.filter(r=>r['EPR类别']==='电子电器').map(r=>r['重量合计 kg']).sort()).toEqual(['0.044','145.975','88.621'].sort());const classes=XLSX.utils.sheet_to_json<Record<string,unknown>>(wb.Sheets['分类汇总']).filter(r=>r['EPR类别']==='电子电器');expect(classes.map(r=>r['重量合计 kg']).sort()).toEqual(['146.019','88.621'].sort());expect(classes.map(r=>r['细分类']).sort()).toEqual(['小型设备（光伏板除外）','温度交换设备'].sort());
});

test('产品国家组合筛选更新合计，材料不重复计数量，清空可恢复',async({page})=>{
 const source=XLSX.read(fs.readFileSync('tests/fixtures/模拟_亚马逊多材料.csv','utf8'),{type:'string',raw:true});const rows=XLSX.utils.sheet_to_json<Record<string,unknown>>(source.Sheets[source.SheetNames[0]],{defval:''});rows.push({...rows[0],ASIN:'SECOND',ITEM_NAME_AS_IN_MARKETPLACE:'模拟法国商品',SHIP_TO_COUNTRY_CODE:'FR',SHIP_TO_COUNTRY:'France',TOTAL_UNITS_SOLD:2,TOTAL_REPORTED_WEIGHT_KG:0.1});const csv=XLSX.utils.sheet_to_csv(XLSX.utils.json_to_sheet(rows));
 await page.goto('/');await page.getByLabel('上传报告',{exact:true}).setInputFiles({name:'模拟_多国家.csv',mimeType:'text/csv',buffer:Buffer.from('\ufeff'+csv)});await expect(page.getByRole('heading',{name:'报告已整理'})).toBeVisible();
 await expect(page.locator('#report-table .report-table-heading').getByLabel('筛选产品',{exact:true})).toBeVisible();await expect(page.locator('#report-table .report-table-heading').getByLabel('搜索产品或分类')).toBeVisible();await expect(page.locator('#report-table thead').getByLabel('筛选产品',{exact:true})).toHaveCount(0);await expect(page.locator('#report-table thead').getByLabel('筛选目的国家')).toBeVisible();await expect(page.locator('.report-filter-grid')).toHaveCount(0);
 const totals=page.getByRole('region',{name:'筛选结果合计'});await expect(totals.locator('tbody tr')).toHaveCount(16);
 await page.getByLabel('筛选产品',{exact:true}).selectOption('SECOND');await page.getByLabel('筛选目的国家').selectOption('FR');await expect(page.locator('#report-table tbody tr')).toHaveCount(1);await expect(totals.getByTestId('total-quantity')).toHaveText('2');await expect(totals.getByTestId('total-weight')).toHaveText('0.1');
 await page.getByLabel('筛选目的国家').selectOption('DE');await expect(totals).toContainText('暂无合计');await page.getByRole('button',{name:'清除全部筛选'}).click();
 await page.getByLabel('筛选包装层级').selectOption('初级包装');await expect(totals.getByTestId('total-quantity')).toHaveText('10');await expect(totals.getByTestId('total-weight')).toHaveText(['1.25','0.2','0','0','0','0','0']);await page.getByLabel('筛选子分类').selectOption('塑料');await expect(totals.getByTestId('total-weight')).toHaveText('0.2');await expect(totals.getByTestId('total-quantity')).toHaveText('10');
 await page.getByRole('tab',{name:'按分类',exact:true}).click();await expect(page.getByRole('region',{name:'筛选结果合计'})).toHaveCount(0);await expect(page.locator('#report-table tbody tr')).toHaveCount(1);await expect(page.locator('#report-table tbody')).toContainText('0.2');await page.getByRole('button',{name:'清除全部筛选'}).click();await expect(page.locator('#report-table tbody tr')).toHaveCount(16);await page.getByRole('tab',{name:'按产品',exact:true}).click();await page.getByLabel('日期范围',{exact:true}).selectOption('month');await page.getByLabel('月份',{exact:true}).fill('2026-11');await expect(page.locator('#report-table tbody tr')).toHaveCount(0);await page.getByRole('button',{name:'显示全部日期'}).click();await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:screenshotPath('inline-filters-desktop.png'),fullPage:true});await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:screenshotPath('inline-filters-mobile.png'),fullPage:true});
});
test('合计包含全部分页，翻页不改变数字，筛选重置页码',async({page})=>{
 const source=XLSX.read(fs.readFileSync('tests/fixtures/模拟_亚马逊多材料.csv','utf8'),{type:'string',raw:true});const sample=XLSX.utils.sheet_to_json<Record<string,unknown>>(source.Sheets[source.SheetNames[0]],{defval:''})[0];const rows=Array.from({length:32},(_,i)=>({...sample,ASIN:`SIM-${i.toString().padStart(2,'0')}`,TOTAL_UNITS_SOLD:1,TOTAL_REPORTED_WEIGHT_KG:0.1}));const csv=XLSX.utils.sheet_to_csv(XLSX.utils.json_to_sheet(rows));
 await page.goto('/');await page.getByLabel('上传报告',{exact:true}).setInputFiles({name:'模拟_32产品.csv',mimeType:'text/csv',buffer:Buffer.from('\ufeff'+csv)});const totals=page.getByRole('region',{name:'筛选结果合计'});await expect(totals.getByTestId('total-weight')).toHaveText('3.2');await expect(totals.getByTestId('total-quantity')).toHaveText('32');await expect(page.locator('#report-table tbody tr')).toHaveCount(30);await page.getByRole('button',{name:'下一页',exact:true}).click();await expect(page.locator('#report-table tbody tr')).toHaveCount(2);await expect(totals.getByTestId('total-weight')).toHaveText('3.2');await page.getByLabel('筛选产品',{exact:true}).selectOption('SIM-00');await expect(page.locator('#report-table tbody tr')).toHaveCount(1);await expect(totals.getByTestId('total-weight')).toHaveText('0.1');
});

test('细分类独立列与合计，紧凑表格保留原文，文件管理可展开',async({page})=>{
 const source=XLSX.read(fs.readFileSync('tests/fixtures/模拟_亚马逊多材料.csv','utf8'),{type:'string',raw:true});const rows=XLSX.utils.sheet_to_json<Record<string,unknown>>(source.Sheets[source.SheetNames[0]],{defval:''});rows[0].EPR_SUBCATEGORY1='SMALL EQUIPMENT EXCEPT PHOTOVOLTAIC PANEL';rows.push({...rows[0],ASIN:'SIM-TEMP',ITEM_NAME_AS_IN_MARKETPLACE:'模拟温度交换设备',EPR_SUBCATEGORY1:'TEMPERATURE EXCHANGE EQUIPMENT',TOTAL_UNITS_SOLD:3,TOTAL_REPORTED_WEIGHT_KG:2.5});rows.push({...rows[0],ASIN:'SIM-SMALL-2',ITEM_NAME_AS_IN_MARKETPLACE:'模拟小型设备二',TOTAL_UNITS_SOLD:2,TOTAL_REPORTED_WEIGHT_KG:0.1});
 await page.goto('/');await page.getByLabel('上传报告',{exact:true}).setInputFiles({name:'模拟_细分类.csv',mimeType:'text/csv',buffer:Buffer.from('\ufeff'+XLSX.utils.sheet_to_csv(XLSX.utils.json_to_sheet(rows)))});
 const table=page.locator('#report-table');const totals=page.getByRole('region',{name:'筛选结果合计'});await expect(table.getByLabel('筛选子分类')).toBeVisible();await expect(table.getByLabel('筛选包装层级')).toBeVisible();await expect(totals.locator('tbody tr')).toHaveCount(16);
 const small=totals.locator('tbody tr').filter({hasText:'小型设备（光伏板除外）'});await expect(small.getByTestId('total-weight')).toHaveText('7.225');await expect(small.getByTestId('total-quantity')).toHaveText('12');await expect(small).toContainText('SMALL EQUIPMENT EXCEPT PHOTOVOLTAIC PANEL');const temperature=totals.locator('tbody tr').filter({hasText:'温度交换设备'});await expect(temperature.getByTestId('total-weight')).toHaveText('2.5');await expect(temperature.getByTestId('total-quantity')).toHaveText('3');
 await table.getByLabel('筛选子分类').selectOption('TEMPERATURE EXCHANGE EQUIPMENT');await expect(table.locator('tbody tr')).toHaveCount(1);await expect(totals.locator('tbody tr')).toHaveCount(1);await page.getByRole('button',{name:'清除全部筛选'}).click();
 await page.locator('.report-file-panel>summary').click();await expect(page.getByRole('button',{name:'添加报告',exact:true})).toBeVisible();await page.locator('.report-file-panel>summary').click();
 const dimensions=await table.locator('table').evaluate(el=>({font:getComputedStyle(el).fontSize,width:el.getBoundingClientRect().width}));expect(dimensions.font).toBe('13px');expect(dimensions.width).toBeGreaterThan(1300);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:screenshotPath('dense-subclasses-desktop.png'),fullPage:true});await page.getByRole('tab',{name:'按分类',exact:true}).click();await expect(table.locator('.report-table-heading').getByLabel('筛选产品',{exact:true})).toBeVisible();await expect(table.locator('thead').getByLabel('搜索产品或分类')).toHaveCount(0);await page.screenshot({path:screenshotPath('dense-subclasses-categories.png'),fullPage:true});await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:screenshotPath('dense-subclasses-mobile.png'),fullPage:true});
});

test('日期常显、月季年自定义与单边范围真实筛选，未知和跨期明确提示',async({page})=>{
 const source=XLSX.read(fs.readFileSync('tests/fixtures/模拟_亚马逊多材料.csv','utf8'),{type:'string',raw:true});const base=XLSX.utils.sheet_to_json<Record<string,unknown>>(source.Sheets[source.SheetNames[0]],{defval:''})[0];
 const rows=[base,{...base,ASIN:'NOV',REPORT_PERIOD_START:'2026/11/1',REPORT_PERIOD_END:'2026/11/30',TOTAL_UNITS_SOLD:2,TOTAL_REPORTED_WEIGHT_KG:0.2},{...base,ASIN:'UNKNOWN-DATE',REPORT_PERIOD_START:'',REPORT_PERIOD_END:'',TOTAL_UNITS_SOLD:1,TOTAL_REPORTED_WEIGHT_KG:0.1}];
 await page.goto('/');await page.getByLabel('上传报告',{exact:true}).setInputFiles({name:'模拟_日期范围.csv',mimeType:'text/csv',buffer:Buffer.from('\ufeff'+XLSX.utils.sheet_to_csv(XLSX.utils.json_to_sheet(rows)))});
 const table=page.locator('#report-table');const dates=page.getByRole('region',{name:'日期筛选'});await expect(dates.getByLabel('开始日期',{exact:true})).toBeVisible();await expect(dates.getByLabel('结束日期',{exact:true})).toBeVisible();await expect(dates.getByLabel('开始日期',{exact:true})).toHaveValue('');await expect(table.locator('tbody tr')).toHaveCount(3);
 await dates.getByLabel('日期范围',{exact:true}).selectOption('month');await expect(dates.getByLabel('开始日期')).toHaveValue('2026-10-01');await expect(table.locator('tbody tr')).toHaveCount(1);await expect(page.locator('.date-scope-warning')).toContainText('1 行日期不明');await expect(page.locator('.report-statusbar')).toContainText('匹配 1 / 3 行原报告');
 await dates.getByLabel('月份').fill('2026-11');await expect(table.locator('tbody')).toContainText('NOV');await dates.getByLabel('日期范围').selectOption('quarter');await expect(dates.getByLabel('结束日期')).toHaveValue('2026-12-31');await expect(table.locator('tbody tr')).toHaveCount(2);await dates.getByLabel('季度').selectOption('3');await expect(table.locator('tbody tr')).toHaveCount(0);
 await dates.getByLabel('日期范围').selectOption('year');await expect(dates.getByLabel('开始日期')).toHaveValue('2026-01-01');await expect(table.locator('tbody tr')).toHaveCount(2);await dates.getByLabel('日期范围').selectOption('custom');await dates.getByLabel('开始日期').fill('2026-10-15');await dates.getByLabel('结束日期').fill('2026-10-20');await expect(table.locator('tbody tr')).toHaveCount(1);await expect(page.locator('.date-scope-warning')).toContainText('1 行包含所选日期以外的数据');await expect(page.getByRole('region',{name:'筛选结果合计'}).getByTestId('total-weight')).toHaveText('7.125');
 await dates.getByLabel('结束日期').fill('2026-10-01');await expect(dates.getByRole('alert')).toContainText('开始日期晚于结束日期');await expect(table.locator('tbody tr')).toHaveCount(0);await dates.getByLabel('开始日期').fill('');await expect(table.locator('tbody tr')).toHaveCount(1);await dates.getByRole('button',{name:'显示全部日期'}).click();await expect(table.locator('tbody tr')).toHaveCount(3);await expect(page.locator('.date-scope-warning')).toHaveCount(0);
 await dates.getByLabel('开始日期').fill('2026-11-01');await expect(table.locator('tbody tr')).toHaveCount(1);await expect(table.locator('tbody')).toContainText('NOV');await page.getByRole('button',{name:'移除日期筛选'}).click();await expect(table.locator('tbody tr')).toHaveCount(3);
 await table.getByLabel('筛选产品',{exact:true}).selectOption('NOV');await expect(page.getByRole('button',{name:'移除产品筛选'})).toBeVisible();await page.getByRole('button',{name:'移除产品筛选'}).click();await expect(table.locator('tbody tr')).toHaveCount(3);
 await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:screenshotPath('date-toolbar-desktop.png'),fullPage:true});await page.setViewportSize({width:390,height:844});await expect(dates.getByLabel('开始日期')).toBeInViewport();await expect(dates.getByLabel('结束日期')).toBeInViewport();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:screenshotPath('date-toolbar-mobile.png'),fullPage:true});
});

test('细分类重量单列、未知与零值分开、合计说明可追溯且焦点返回',async({page})=>{
 const wb=XLSX.read(fs.readFileSync('tests/fixtures/模拟_亚马逊多材料.csv','utf8'),{type:'string',raw:true});const rows=XLSX.utils.sheet_to_json<Record<string,unknown>>(wb.Sheets[wb.SheetNames[0]],{defval:''});rows[2].PLASTIC_KG='';
 await page.goto('/');await page.getByLabel('上传报告',{exact:true}).setInputFiles({name:'模拟_重量核对.csv',mimeType:'text/csv',buffer:Buffer.from('\ufeff'+XLSX.utils.sheet_to_csv(XLSX.utils.json_to_sheet(rows)))});
 await page.getByRole('button',{name:'显示未提供项',exact:true}).click();const totals=page.getByRole('region',{name:'筛选结果合计'});await expect(totals.getByRole('columnheader',{name:'重量合计（kg）',exact:true})).toBeVisible();await expect(totals.getByRole('columnheader',{name:'重量明细（kg）',exact:true})).toHaveCount(0);
 const primary=totals.locator('tbody tr').filter({hasText:'初级包装'});await expect(primary.getByTestId('total-quantity')).toHaveText('10');await expect(primary.getByTestId('total-quantity')).toHaveAttribute('rowspan','7');await expect(primary.getByTestId('total-weight')).toHaveText(['1.25','0.2','0','0','0','0','0']);
 const plastic=totals.locator('tbody tr').filter({hasText:'运输包装'}).filter({has:page.locator('.report-classification strong',{hasText:/^塑料$/})});await expect(plastic.getByTestId('total-weight')).toHaveText('未提供');await expect(plastic.getByTestId('total-weight')).toHaveAttribute('data-attention','missing');const explain=plastic.getByRole('button',{name:'查看合计说明'});await explain.click();await expect(page.getByRole('region',{name:'原始来源'})).toContainText('PLASTIC_KG');await page.getByRole('region',{name:'原始来源'}).press('Escape');await expect(explain).toBeFocused();
 await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:screenshotPath('classification-unified.png'),fullPage:true});await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:screenshotPath('classification-unified-mobile.png'),fullPage:true});
});

test('包装材料直接作为细分类，两页签、合并数量、筛选和Excel一致',async({page})=>{
 await page.goto('/');await page.getByLabel('上传报告',{exact:true}).setInputFiles(path.resolve('tests/fixtures/模拟_亚马逊多材料.csv'));await expect(page.getByRole('tab')).toHaveCount(2);await expect(page.getByRole('tab',{name:'按材料',exact:true})).toHaveCount(0);
 const table=page.locator('#report-table');await expect(table.locator('tbody td.number:not(.weight-subtotal-cell)')).toHaveText(['10','10','10']);await page.getByRole('tab',{name:'按分类',exact:true}).click();await page.getByLabel('筛选子分类').selectOption('纸');await expect(table.locator('tbody tr')).toHaveCount(2);await expect(table.locator('tbody .weight-subtotal-cell')).toHaveText(['1.25','0.5']);
 await page.getByLabel('筛选包装层级').selectOption('初级包装');await expect(table.locator('tbody tr')).toHaveCount(1);await table.getByRole('button',{name:/查看来源/}).click();await expect(page.getByRole('region',{name:'原始来源'})).toContainText('PAPER_KG');await page.getByRole('region',{name:'原始来源'}).press('Escape');
 const ready=page.waitForEvent('download');await page.getByRole('button',{name:'下载全部数据',exact:true}).click();const wb=XLSX.read(fs.readFileSync((await (await ready).path())!));expect(wb.SheetNames).not.toContain('按材料汇总');const materials=XLSX.utils.sheet_to_json<Record<string,unknown>>(wb.Sheets['分类汇总']);expect(materials.filter(r=>r['细分类']==='纸').map(r=>r['重量合计 kg']).sort()).toEqual(['0.5','1.25']);expect(materials.filter(r=>r['EPR类别']==='包装').every(r=>r['报告数量（包装见数量核对表）']==='见数量核对表')).toBe(true);const counts=XLSX.utils.sheet_to_json<Record<string,unknown>>(wb.Sheets['数量核对']);expect(counts.filter(r=>r['EPR类别']==='包装').map(r=>r['报告数量'])).toEqual(['10','10']);
 await page.getByRole('button',{name:'清除全部筛选'}).click();await page.getByLabel('筛选子分类').selectOption('塑料');await expect(table.locator('tbody .weight-subtotal-cell')).toHaveText(['0.2','0.01']);await page.getByRole('button',{name:'清除全部筛选'}).click();await page.screenshot({path:screenshotPath('classification-categories.png'),fullPage:true});await page.getByRole('tab',{name:'按分类',exact:true}).focus();await page.keyboard.press('ArrowRight');await expect(page.getByRole('tab',{name:'按产品',exact:true})).toBeFocused();
});

test('默认隐藏未提供重量，零和部分合计保留，开关不改变下载和数量',async({page})=>{
 const wb=XLSX.read(fs.readFileSync('tests/fixtures/模拟_亚马逊多材料.csv','utf8'),{type:'string',raw:true});const rows=XLSX.utils.sheet_to_json<Record<string,unknown>>(wb.Sheets[wb.SheetNames[0]],{defval:''});rows[2].PLASTIC_KG='';rows[0].TOTAL_REPORTED_WEIGHT_KG='';
 await page.goto('/');await page.getByLabel('上传报告',{exact:true}).setInputFiles({name:'模拟_隐藏空白.csv',mimeType:'text/csv',buffer:Buffer.from('\ufeff'+XLSX.utils.sheet_to_csv(XLSX.utils.json_to_sheet(rows)))});
 const table=page.locator('#report-table'),totals=page.getByRole('region',{name:'筛选结果合计'});await expect(table.locator('tbody tr')).toHaveCount(13);await expect(totals.locator('tbody tr')).toHaveCount(13);await expect(table.locator('.weight-subtotal-cell[data-attention=missing]')).toHaveCount(0);await expect(table.locator('tbody .weight-subtotal-cell').filter({hasText:/^0$/})).toHaveCount(10);await expect(table.locator('.report-table-heading')).toContainText('已隐藏 2 组');await expect(totals.getByTestId('total-quantity')).toHaveText(['10','10']);
 await page.screenshot({path:screenshotPath('missing-hidden-default.png'),fullPage:true});await page.getByRole('button',{name:'显示未提供项',exact:true}).click();await expect(table.locator('tbody tr')).toHaveCount(15);await expect(totals.getByTestId('total-quantity')).toHaveText(['10','10','10']);await page.getByRole('button',{name:'隐藏未提供项',exact:true}).click();
 const ready=page.waitForEvent('download');await page.getByRole('button',{name:'下载全部数据',exact:true}).click();const output=XLSX.read(fs.readFileSync((await (await ready).path())!));const data=XLSX.utils.sheet_to_json<Record<string,unknown>>(output.Sheets['按产品分类']);expect(data).toHaveLength(15);expect(data.filter(r=>r['重量合计 kg']==='未知')).toHaveLength(2);expect(XLSX.utils.sheet_to_json(output.Sheets['数量核对'])).toHaveLength(3);
 await page.getByLabel('筛选EPR类别').selectOption('weee');await expect(table.locator('tbody tr')).toHaveCount(0);await expect(table).toContainText('当前记录均未提供重量');await page.getByRole('button',{name:'显示未提供项',exact:true}).click();await expect(table.locator('tbody tr')).toHaveCount(1);await page.setViewportSize({width:390,height:844});await expect(page.getByRole('button',{name:'隐藏未提供项',exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.goto('/');rows.push({...rows[1],ASIN:'MISSING-PAPER',PAPER_KG:''});await page.getByLabel('上传报告',{exact:true}).setInputFiles({name:'模拟_部分重量.csv',mimeType:'text/csv',buffer:Buffer.from('\ufeff'+XLSX.utils.sheet_to_csv(XLSX.utils.json_to_sheet(rows)))});const partial=totals.locator('tbody tr').filter({hasText:'初级包装'}).filter({has:page.locator('.report-classification strong',{hasText:/^纸$/})});await expect(partial.getByTestId('total-weight')).toHaveText('1.25部分重量缺失，仅合计已知值');await expect(partial.getByTestId('total-weight')).toHaveAttribute('data-attention','review');
});

test('长表来源收起和Escape均恢复窗口及表内位置，原按钮可见且聚焦',async({page})=>{
 await page.setViewportSize({width:1366,height:768});
 const wb=XLSX.read(fs.readFileSync('tests/fixtures/模拟_亚马逊多材料.csv','utf8'),{type:'string',raw:true});
 const base=XLSX.utils.sheet_to_json<Record<string,unknown>>(wb.Sheets[wb.SheetNames[0]],{defval:''})[0];
 const rows=Array.from({length:35},(_,i)=>({...base,ASIN:`SCROLL-${i.toString().padStart(2,'0')}`,ITEM_NAME_AS_IN_MARKETPLACE:`模拟滚动产品 ${i+1}`,TOTAL_UNITS_SOLD:1,TOTAL_REPORTED_WEIGHT_KG:'0.1'}));
 const lowercaseRows=rows.map(row=>Object.fromEntries(Object.entries(row).map(([key,value])=>[key.toLowerCase(),value])));
 await page.goto('/');await page.getByLabel('上传报告',{exact:true}).setInputFiles({name:'模拟_长表来源.csv',mimeType:'text/csv',buffer:Buffer.from('\ufeff'+XLSX.utils.sheet_to_csv(XLSX.utils.json_to_sheet(lowercaseRows)))});
 const wrap=page.locator('#report-table .table-wrap');
 const trigger=wrap.getByRole('button',{name:'查看来源 SCROLL-18 1行',exact:true});
 await trigger.scrollIntoViewIfNeeded();
 await page.mouse.move(5,400);await page.mouse.wheel(0,140);
 await expect(trigger).toBeInViewport({ratio:1});
 await expect.poll(()=>wrap.evaluate(el=>el.scrollTop)).toBeGreaterThan(0);
 await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBeGreaterThan(0);
 for(const closeWith of ['button','Escape']){
  const before={windowY:await page.evaluate(()=>window.scrollY),tableY:await wrap.evaluate(el=>el.scrollTop),buttonY:(await trigger.boundingBox())!.y};
  await trigger.click();const source=page.getByRole('region',{name:'原始来源'});await expect(source).toBeFocused();await expect(source).toContainText('本次取值');
  const inputs=source.locator('.source-input-summary');await expect(inputs).toContainText('total_units_sold');await expect(inputs).toContainText('total_reported_weight_kg');await expect(inputs.locator('dd')).toHaveText(['1','0.1']);
  await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBeGreaterThan(before.windowY+100);
  if(closeWith==='Escape')await source.press('Escape');else await source.getByRole('button',{name:'收起来源',exact:true}).click();
  await expect(source).toHaveCount(0);await expect(trigger).toBeFocused();await expect(trigger).toBeInViewport({ratio:1});
  await expect.poll(async()=>Math.abs(await page.evaluate(()=>window.scrollY)-before.windowY)).toBeLessThanOrEqual(2);
  await expect.poll(async()=>Math.abs(await wrap.evaluate(el=>el.scrollTop)-before.tableY)).toBeLessThanOrEqual(2);
  expect(Math.abs((await trigger.boundingBox())!.y-before.buttonY)).toBeLessThanOrEqual(2);
 }
 await page.screenshot({path:screenshotPath('source-return-visible.png')});
});

test('收起零值只隐藏正常包装材料，部分零值和异常未知保留，下载仍完整',async({page})=>{
 const wb=XLSX.read(fs.readFileSync('tests/fixtures/模拟_亚马逊多材料.csv','utf8'),{type:'string',raw:true});
 const samples=XLSX.utils.sheet_to_json<Record<string,unknown>>(wb.Sheets[wb.SheetNames[0]],{defval:''});
 const packaging={...samples[1],PAPER_KG:'0',PLASTIC_KG:'0',GLASS_KG:'0',ALUMINUM_KG:'0',STEEL_KG:'0',WOOD_KG:'0',OTHER_KG:'0'};
 const partial={...packaging,ASIN:'ZERO-PARTIAL',ITEM_NAME_AS_IN_MARKETPLACE:'模拟部分零值',SHIP_TO_COUNTRY_CODE:'FR',SHIP_TO_COUNTRY:'France'};
 const rows=[
  {...packaging,ASIN:'ZERO-CLEAN',ITEM_NAME_AS_IN_MARKETPLACE:'模拟正常包装',PAPER_KG:'1.25'},
  {...partial,TOTAL_UNITS_SOLD:'2'},
  {...partial,TOTAL_UNITS_SOLD:'3',PAPER_KG:''},
  {...packaging,ASIN:'ZERO-ANOMALY',ITEM_NAME_AS_IN_MARKETPLACE:'模拟数量异常',SHIP_TO_COUNTRY_CODE:'IT',SHIP_TO_COUNTRY:'Italy',TOTAL_UNITS_SOLD:'not-a-number'},
  {...packaging,ASIN:'ZERO-UNKNOWN',ITEM_NAME_AS_IN_MARKETPLACE:'模拟未知重量',SHIP_TO_COUNTRY_CODE:'ES',SHIP_TO_COUNTRY:'Spain',PAPER_KG:''},
  {...samples[0],ASIN:'ZERO-EEE',ITEM_NAME_AS_IN_MARKETPLACE:'模拟电子电器零值',TOTAL_UNITS_SOLD:'4',TOTAL_REPORTED_WEIGHT_KG:'0'},
 ];
 await page.goto('/');await page.getByLabel('上传报告',{exact:true}).setInputFiles({name:'模拟_零值保护.csv',mimeType:'text/csv',buffer:Buffer.from('\ufeff'+XLSX.utils.sheet_to_csv(XLSX.utils.json_to_sheet(rows)))});
 const table=page.locator('#report-table'),totals=page.getByRole('region',{name:'筛选结果合计'});
 await expect(table.locator('tbody tr')).toHaveCount(28);await expect(totals.locator('tbody tr')).toHaveCount(28);
 await page.getByRole('button',{name:'显示未提供项',exact:true}).click();await expect(table.locator('tbody tr')).toHaveCount(29);
 const quantities=await totals.getByTestId('total-quantity').allTextContents();
 await page.getByRole('button',{name:'收起零值材料',exact:true}).click();
 await expect(page.getByRole('button',{name:'展开零值材料',exact:true})).toBeVisible();
 await expect(table.locator('tbody tr')).toHaveCount(11);await expect(totals.locator('tbody tr')).toHaveCount(11);await expect(totals.getByTestId('total-quantity')).toHaveText(quantities);
 await page.getByLabel('筛选产品',{exact:true}).selectOption('ZERO-CLEAN');await expect(table.locator('tbody tr')).toHaveCount(1);await expect(table.locator('tbody .weight-subtotal-cell')).toHaveText('1.25');await expect(totals.getByTestId('total-quantity')).toHaveText('10');
 await page.getByLabel('筛选产品',{exact:true}).selectOption('ZERO-PARTIAL');await expect(table.locator('tbody tr')).toHaveCount(1);
 const paper=(scope:typeof table)=>scope.locator('tbody tr').filter({has:page.locator('.report-classification strong',{hasText:/^纸$/})});
 await expect(paper(table).locator('.weight-subtotal-cell')).toHaveText('0部分重量缺失，仅合计已知值');await expect(paper(totals).getByTestId('total-weight')).toHaveAttribute('data-attention','review');
 await page.getByLabel('筛选产品',{exact:true}).selectOption('ZERO-ANOMALY');await expect(table.locator('tbody tr')).toHaveCount(7);await expect(table.locator('tbody .weight-subtotal-cell')).toHaveText(Array(7).fill('0'));await expect(totals.getByTestId('total-quantity')).toHaveText('无法确定');
 await page.getByLabel('筛选产品',{exact:true}).selectOption('ZERO-UNKNOWN');await expect(table.locator('tbody tr')).toHaveCount(1);await expect(paper(table).locator('.weight-subtotal-cell')).toHaveText('未提供');await expect(paper(totals).getByTestId('total-weight')).toHaveAttribute('data-attention','missing');
 await page.getByRole('button',{name:'清除全部筛选',exact:true}).click();await expect(table.locator('tbody tr')).toHaveCount(11);await expect(totals.getByTestId('total-quantity')).toHaveText(quantities);
 await page.getByRole('tab',{name:'按分类',exact:true}).click();await expect(table.locator('tbody tr')).toHaveCount(11);await expect(table.locator('.report-table-heading').getByLabel('筛选产品',{exact:true})).toBeVisible();
 await page.getByLabel('筛选产品',{exact:true}).selectOption('ZERO-EEE');await expect(table.locator('tbody tr')).toHaveCount(1);await expect(table.locator('tbody .weight-subtotal-cell')).toHaveText('0');
 const ready=page.waitForEvent('download');await page.getByRole('button',{name:'下载全部数据',exact:true}).click();const exported=XLSX.read(fs.readFileSync((await (await ready).path())!));
 const detail=XLSX.utils.sheet_to_json<Record<string,unknown>>(exported.Sheets['按产品分类']),counts=XLSX.utils.sheet_to_json<Record<string,unknown>>(exported.Sheets['数量核对']);
 expect(XLSX.utils.sheet_to_json(exported.Sheets['原始报告'])).toHaveLength(6);expect(detail).toHaveLength(29);expect(XLSX.utils.sheet_to_json(exported.Sheets['分类汇总'])).toHaveLength(29);expect(counts).toHaveLength(5);
 expect(detail.filter(r=>r['ASIN或SKU']==='ZERO-CLEAN'&&r['重量合计 kg']==='0')).toHaveLength(6);
 expect(detail.find(r=>r['ASIN或SKU']==='ZERO-PARTIAL'&&r['细分类']==='纸')).toMatchObject({'重量合计 kg':'0','重量范围':'部分材料或重量未提供，仅合计已知项'});
 expect(detail.find(r=>r['ASIN或SKU']==='ZERO-UNKNOWN'&&r['细分类']==='纸')?.['重量合计 kg']).toBe('未知');expect(counts.find(r=>r['ASIN或SKU']==='ZERO-CLEAN')?.['报告数量']).toBe('10');expect(counts.find(r=>r['ASIN或SKU']==='ZERO-ANOMALY')?.['报告数量']).toBe('未知');
 await page.getByRole('button',{name:'清除全部筛选',exact:true}).click();await page.getByRole('button',{name:'展开零值材料',exact:true}).click();await expect(table.locator('tbody tr')).toHaveCount(29);await page.screenshot({path:screenshotPath('zero-materials-restored.png'),fullPage:true});
});

test('通用报告集中说明自动识别，下载成功使用独立绿色反馈',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'先用示例试试',exact:true}).click();
 await expect(page.locator('.report-mapping-note')).toHaveCount(1);await expect(page.locator('.report-mapping-note')).toContainText('自动识别');
 await expect(page.locator('#report-table tbody td:last-child[data-attention="review"]')).toHaveCount(0);
 const ready=page.waitForEvent('download');await page.getByRole('button',{name:'下载全部数据',exact:true}).click();await ready;
 const success=page.locator('.export-success');await expect(success).toContainText('Excel 已生成');
 await expect(success.locator('svg')).toBeVisible();const colors=await success.evaluate(el=>({text:getComputedStyle(el).color,warning:getComputedStyle(document.querySelector('.report-workspace')!).getPropertyValue('--flow-warning').trim()}));expect(colors.text).toBe('rgb(36, 100, 69)');expect(colors.warning).toBe('#805313');
 await page.screenshot({path:screenshotPath('mapping-note-export-success.png')});
});
