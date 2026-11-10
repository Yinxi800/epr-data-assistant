// Diagnostic reconstruction using public column definitions, never a genuine seller report.
import {createServer} from 'vite';
import {mkdir,writeFile} from 'node:fs/promises';
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try {
 const {parseBuffer}=await server.ssrLoadModule('/src/core/parser.ts');
 const {normalizeRows,calculate}=await server.ssrLoadModule('/src/core/calculation.ts');
 const headers='unique_account_identifier report_period_start report_period_end asin amazon_marketplace ship_to_country_code ship_to_country item_name_in_english item_name_as_in_marketplace registration_number epr_category epr_subcategory1 epr_subcategory2 epr_subcategory3 epr_subcategory4 gl_product_group_description product_type total_units_sold units_per_asin battery_embedded item_weight_without_package_kg item_weight_with_package_kg total_reported_weight_kg item_width_cm package_width_cm item_height_cm package_height_cm paper_kg glass_kg aluminum_kg steel_kg plastic_kg wood_kg other_kg'.split(' ');
 const scenarios=[{id:'uppercase-quarterly-primary',upper:true,period:['2022-01-01','2022-03-31'],country:'DE',name:'Germany',category:'Primary Packaging'},{id:'uppercase-annual-secondary',upper:true,period:['2024-01-01','2024-12-31'],country:'DE',name:'Germany',category:'Secondary Packaging'},{id:'lowercase-monthly-primary',upper:false,period:['2026-10-01','2026-10-31'],country:'FR',name:'France',category:'Primary Packaging'}];
 const results=[];await mkdir('output/public-schema-audit',{recursive:true});
 for(const s of scenarios){
  const values={unique_account_identifier:'SYNTHETIC-ACCOUNT',report_period_start:s.period[0],report_period_end:s.period[1],asin:'SYNTHETIC-ASIN',amazon_marketplace:'amazon.de',ship_to_country_code:s.country,ship_to_country:s.name,item_name_in_english:'Synthetic test only',item_name_as_in_marketplace:'模拟重建数据，非真实报告',epr_category:s.category,total_units_sold:'100',units_per_asin:'1',battery_embedded:'N',item_weight_without_package_kg:'0.2',item_weight_with_package_kg:'0.25',total_reported_weight_kg:'20',paper_kg:'5',glass_kg:'0',aluminum_kg:'0',steel_kg:'0',plastic_kg:'1',wood_kg:'0',other_kg:'0'};
  const csv=[headers.map(h=>s.upper?h.toUpperCase():h).join(','),headers.map(h=>values[h]||'').join(',')].join('\r\n');
  const sheets=parseBuffer(new TextEncoder().encode(csv).buffer,`${s.id}.csv`,s.id,'synthetic');sheets[0].confirmed=true;
  const settings={country:'auto',business:'packaging',start:s.period[0],end:s.period[1],returns:'gross',basis:'模拟重建核验：按报告数量',scopeConfirmed:true,specialConfirmed:true,group:'["SYNTHETIC-ACCOUNT","amazon.de"]',reviewed:false};
  const result=calculate(normalizeRows(sheets),settings,[]);
  await writeFile(`output/public-schema-audit/${s.id}.csv`,csv);
  results.push({id:s.id,evidenceType:'public-schema-reconstruction-not-actual-report',headerCount:headers.length,mapped:sheets[0].mapping,rowCount:sheets[0].rows.length,included:result.counts.included,pending:result.counts.pending,issues:result.issues.map(i=>({code:i.code,message:i.message})),rawMaterialColumnsPreserved:sheets[0].rows[0][s.upper?'PAPER_KG':'paper_kg']==='5'});
 }
 await writeFile('output/public-schema-audit/result.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
}finally{await server.close();}
