import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import * as XLSX from 'xlsx';
test('统一网页版导入、筛选、来源及全量下载',async({page})=>{
 await page.goto('/');await expect(page.getByRole('heading',{name:'上传报告，直接看数据'})).toBeVisible();
 await page.getByLabel('上传报告',{exact:true}).setInputFiles(path.resolve('tests/fixtures/模拟_亚马逊多材料.csv'));
 await expect(page.getByRole('heading',{name:'报告已整理'})).toBeVisible();await expect(page.locator('#report-table tbody tr')).toHaveCount(15);
 await page.locator('#report-table tbody button').first().click();await expect(page.getByRole('region',{name:'原始来源'})).toBeVisible();await page.getByRole('button',{name:'收起来源',exact:true}).click();
 await page.getByLabel('搜索产品或分类').fill('不存在');await expect(page.locator('#report-table tbody tr')).toHaveCount(0);
 const ready=page.waitForEvent('download');await page.getByRole('button',{name:'下载全部数据',exact:true}).click();const dl=await ready;const wb=XLSX.read(fs.readFileSync((await dl.path())!));expect(XLSX.utils.sheet_to_json(wb.Sheets['原始报告'])).toHaveLength(3);expect(XLSX.utils.sheet_to_json(wb.Sheets['按产品分类'])).toHaveLength(15);
});
