import {cp,mkdir,writeFile,readFile} from 'node:fs/promises';
await mkdir('extension-dist',{recursive:true});
await cp('dist','extension-dist/app',{recursive:true});
await cp('extension','extension-dist',{recursive:true});
let html=await readFile('extension-dist/app/index.html','utf8');
html=html.replace(/connect-src 'self' ws:\/\/127\.0\.0\.1:4173/g,"connect-src 'self'");
await writeFile('extension-dist/app/index.html',html);
console.log('浏览器扩展已生成：extension-dist；完整应用随扩展打包，无需本地服务器。');
