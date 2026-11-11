import http from 'node:http';
import {readFile,realpath,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
const [major,minor]=process.versions.node.split('.').map(Number);
if(major<22||(major===22&&minor<12)){console.error('请安装 Node.js 22.12 或更新的 LTS 版本。');process.exit(1);}
const root=await realpath(path.join(path.dirname(fileURLToPath(import.meta.url)),'app'));
const port=Number(process.env.EPR_PORT||4173);
if(!Number.isInteger(port)||port<1024||port>65535)throw Error('端口须在1024–65535之间');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.csv':'text/csv; charset=utf-8'};
const server=http.createServer(async(req,res)=>{
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
 try{
  const url=new URL(req.url,'http://localhost');
  const relative=decodeURIComponent(url.pathname).replace(/^\/+/, '')||'index.html';
  const target=await realpath(path.resolve(root,relative));
  if(!target.startsWith(root+path.sep)||!(await stat(target)).isFile())throw Error('not found');
  const data=await readFile(target);res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':'no-store'});res.end(req.method==='HEAD'?undefined:data);
 }catch{res.writeHead(404);res.end('Not found');}
});
server.on('error',e=>{console.error(e.code==='EADDRINUSE'?`端口 ${port} 已被占用。请关闭之前的启动窗口，或设置 EPR_PORT 换一个端口。`:e.message);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>{
 const url=`http://127.0.0.1:${port}`;console.log(`EPR申报数据助手：${url}\n保持此窗口打开。结束后按 Ctrl+C。报告仅在浏览器中处理。`);
 if(process.argv.includes('--open')&&process.env.EPR_NO_OPEN!=='1'){
  const command=process.platform==='win32'?'cmd':process.platform==='darwin'?'open':'xdg-open';
  const args=process.platform==='win32'?['/c','start','',url]:[url];
  const child=spawn(command,args,{stdio:'ignore'});child.on('error',()=>console.log('请手动在浏览器打开上述地址。'));
 }
});
