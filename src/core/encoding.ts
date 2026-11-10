export type CsvEncoding='auto'|'utf-8'|'gb18030'|'utf-16le'|'utf-16be'|'windows-1252';
export interface DecodedText {text:string;csvEncoding:string;encodingDetection:'bom'|'utf8-valid'|'heuristic'|'manual';encodingNeedsReview:boolean}
export function decodeText(buffer:ArrayBuffer,requested:CsvEncoding='auto'):DecodedText {
 const b=new Uint8Array(buffer);
 const decode=(encoding:Exclude<CsvEncoding,'auto'>,method:DecodedText['encodingDetection'],review:boolean):DecodedText=>{
  if(encoding.startsWith('utf-16')&&b.length%2)throw Error('UTF-16 文件字节不完整，请检查文件或切换文本编码。');
  const text=new TextDecoder(encoding,{fatal:true}).decode(b).replace(/^\uFEFF/,'');
  if(/[\u0000-\u0008\u000b\u000e-\u001f]/.test(text))throw Error('文件含非文本控制字符，请检查格式或切换文本编码。');
  return {text,csvEncoding:encoding,encodingDetection:method,encodingNeedsReview:review};
 };
 if(requested!=='auto'){try{return decode(requested,'manual',false);}catch{throw Error(`无法按 ${requested} 解码，请检查文件或选择其他文本编码。`);}}
 try {
  if(b[0]===0xef&&b[1]===0xbb&&b[2]===0xbf)return decode('utf-8','bom',false);
  if(b[0]===0xff&&b[1]===0xfe)return decode('utf-16le','bom',false);
  if(b[0]===0xfe&&b[1]===0xff)return decode('utf-16be','bom',false);
  // Without a BOM, repeated ASCII high-byte zeros are only an encoding candidate.
  const length=Math.min(b.length,4096);let even=0,odd=0;
  for(let i=0;i<length;i++)if(b[i]===0){if(i%2)odd++;else even++;}
  if(length>=4&&odd>length*.15&&even<length*.05)return decode('utf-16le','heuristic',true);
  if(length>=4&&even>length*.15&&odd<length*.05)return decode('utf-16be','heuristic',true);
  try{return decode('utf-8','utf8-valid',false);}catch{}
  return decode('gb18030','heuristic',true);
 }catch{throw Error('无法自动识别文本编码，请选择 GBK/GB18030、UTF-16 或 Windows-1252 后重试。');}
}
