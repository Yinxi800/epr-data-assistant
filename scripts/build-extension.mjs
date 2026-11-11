import {cp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
// Read the completed build before replacing either generated application copy.
let html=await readFile('dist/index.html','utf8');
html=html.replace(/connect-src 'self' ws:\/\/127\.0\.0\.1:4173/g,"connect-src 'self'");
await mkdir('extension-dist',{recursive:true});
for(const name of ['manifest.json','background.js'])await cp(`extension/${name}`,`extension-dist/${name}`);
await cp('extension/icons','extension-dist/icons',{recursive:true});
// Both visible extension folders are loadable; generated app files stay out of Git.
for(const folder of ['extension-dist','extension']){
 await rm(`${folder}/app`,{recursive:true,force:true});
 await cp('dist',`${folder}/app`,{recursive:true});
 await writeFile(`${folder}/app/index.html`,html);
}
console.log('浏览器扩展已生成：extension-dist；extension 目录也已同步完整应用，无需本地服务器。');
