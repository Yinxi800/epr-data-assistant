import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
const {version}=JSON.parse(await readFile('package.json','utf8'));
const windows=process.platform==='win32';
const folder=path.resolve(`output/releases/v${version}/EPR-${windows?'Windows':'macOS'}-v${version}`);
const child=spawn(windows?'cmd':'sh',windows?['/d','/c',path.join(folder,'启动.bat')]:[path.join(folder,'启动.command')],{stdio:'inherit',env:{...process.env,EPR_PORT:'4190',EPR_NO_OPEN:'1'}});
child.on('exit',code=>process.exit(code??1));
child.on('error',error=>{console.error(error);process.exit(1);});
