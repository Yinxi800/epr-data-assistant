import type {CsvEncoding} from './encoding';
import { parseBuffer } from './parser';
self.onmessage = (event:MessageEvent<{buffer:ArrayBuffer;fileName:string;fileId:string;hash:string;encoding?:CsvEncoding}>) => {
  try {
    const {buffer,fileName,fileId,hash,encoding}=event.data;
    self.postMessage({sheets:parseBuffer(buffer,fileName,fileId,hash,encoding)});
  } catch(error) {
    self.postMessage({error:error instanceof Error?error.message:'无法解析文件，请检查格式。'});
  }
};
