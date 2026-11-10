import {it,expect} from 'vitest';
import fs from 'node:fs';
import {parseBuffer} from '../src/core/parser';
import {decodeText} from '../src/core/encoding';
const bytes=(name:string)=>{const b=fs.readFileSync(`tests/fixtures/${name}`);return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength) as ArrayBuffer;};
for(const name of ['模拟_GBK.csv','模拟_UTF16LE.csv','模拟_UTF16BE.csv','模拟_制表.tsv','模拟_分号.txt','模拟.xls','模拟.ods'])it(`${name} 保留中文和数值`,()=>{
 const [sheet]=parseBuffer(bytes(name),name,'test','test');expect(sheet.rows).toHaveLength(2);expect(sheet.rows[0]['客户']).toBe('模拟客户A');expect(sheet.rows[0]['重量']).toBe('50');expect(sheet.mapping.country).toBe('目的国家');
 if(name.includes('GBK')){expect(sheet.csvEncoding).toBe('gb18030');expect(sheet.encodingNeedsReview).toBe(true);}
});
it('西欧编码可手动解码而非无条件自动猜测',()=>{const b=Uint8Array.from([0x6e,0x61,0x6d,0x65,10,0x63,0x61,0x66,0xe9]).buffer;expect(decodeText(b,'windows-1252').text).toBe('name\ncafé');expect(()=>decodeText(b,'utf-8')).toThrow();});
it('错误与二进制内容不静默替换或吞掉',()=>{expect(()=>decodeText(Uint8Array.from([0xff,0xfe,0x41]).buffer)).toThrow();expect(()=>decodeText(Uint8Array.from([0,1,2,3]).buffer)).toThrow();});
it('无BOM UTF16只标记候选，原始物理行号保留',()=>{const raw=bytes('模拟_UTF16LE.csv').slice(2);const [s]=parseBuffer(raw,'test.csv','test','hash');expect(s.encodingNeedsReview).toBe(true);expect(s.rowNumbers).toEqual([2,3]);});
