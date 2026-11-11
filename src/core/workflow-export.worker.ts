import * as XLSX from 'xlsx';
import {buildWorkflowWorkbook} from './workflow-export';
self.onmessage=e=>{try{const wb=buildWorkflowWorkbook(e.data.state,e.data.mode);const bytes=XLSX.write(wb,{type:'array',bookType:'xlsx'}) as ArrayBuffer;self.postMessage({bytes},{transfer:[bytes]});}catch(error){self.postMessage({error:error instanceof Error?error.message:String(error)});}};
