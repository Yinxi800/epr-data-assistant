import * as XLSX from 'xlsx';
import {buildReportWorkbook} from './report-export';
self.onmessage=e=>{try{const {report,sheets,filter}=e.data;const bytes=XLSX.write(buildReportWorkbook(report,sheets,filter),{type:'array',bookType:'xlsx',compression:true});self.postMessage({bytes},{transfer:[bytes]});}catch(error){self.postMessage({error:error instanceof Error?error.message:String(error)});}};
