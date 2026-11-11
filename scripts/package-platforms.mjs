import {cp,mkdir,writeFile,readFile,chmod} from 'node:fs/promises';
const {version}=JSON.parse(await readFile('package.json','utf8'));
const base=`output/releases/v${version}`;
await mkdir(base,{recursive:true});
for(const platform of ['macOS','Windows']){
 const dest=`${base}/EPR-${platform}-v${version}`;
 await mkdir(dest,{recursive:true});await cp('dist',`${dest}/app`,{recursive:true});await cp('scripts/serve-local.mjs',`${dest}/serve-local.mjs`);
 await cp('docs/PLATFORM_SUPPORT.md',`${dest}/使用说明.md`);
 if(platform==='macOS'){
  await writeFile(`${dest}/启动.command`,'#!/bin/sh\ncd "$(dirname "$0")"\nif ! command -v node >/dev/null 2>&1; then\n echo "请先安装 Node.js 22.12 或更新的 LTS 版本：https://nodejs.org/"\n read -r answer\n exit 1\nfi\nnode serve-local.mjs --open\n');await chmod(`${dest}/启动.command`,0o755);
 }else await writeFile(`${dest}/启动.bat`,'@echo off\r\nchcp 65001 >nul\r\ncd /d "%~dp0"\r\nwhere node >nul 2>nul\r\nif errorlevel 1 (\r\n echo 请先安装 Node.js 22.12 或更新的 LTS 版本：https://nodejs.org/\r\n pause\r\n exit /b 1\r\n)\r\nnode serve-local.mjs --open\r\npause\r\n');
}
await cp('extension-dist',`${base}/EPR-Chrome-Edge-v${version}`,{recursive:true});
console.log(`跨平台文件已生成：${base}`);
