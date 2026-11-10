import * as XLSX from 'xlsx';
import { buildWorkbook } from './export';
import type { Calculation, Edit, Settings, Sheet } from './types';

// Importing export.ts only defines functions; it does not create workers or access the DOM.
self.onmessage=(event:MessageEvent<{calculation:Calculation;sheets:Sheet[];edits:Edit[];settings:Settings}>)=>{
  try {
    const {calculation,sheets,edits,settings}=event.data;
    const bytes=XLSX.write(buildWorkbook(calculation,sheets,edits,settings),{type:'array',bookType:'xlsx',compression:true}) as ArrayBuffer;
    self.postMessage({bytes},{transfer:[bytes]});
  } catch(error) {
    self.postMessage({error:error instanceof Error?error.message:'无法生成 Excel，请检查数据或减少导出数量。'});
  }
};
