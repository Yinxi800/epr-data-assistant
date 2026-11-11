# 系统与浏览器使用说明

推荐使用 Chrome / Edge 扩展：Mac、Windows 共用一份扩展包，不需要安装 Node.js，也不需要保持启动窗口打开。

| 使用方式 | macOS | Windows | 前提 |
|---|---|---|---|
| Chrome / Edge 扩展 | 可加载本地扩展 | 可加载本地扩展 | 使用受系统支持的当前稳定版浏览器 |
| Chrome / Edge 网页版 | 提供启动入口 | 提供启动入口 | Node.js 22.12 或更新的 LTS 版本 |
| Firefox 网页版 | 提供启动入口 | 提供启动入口 | 同上 |
| Safari 网页版 | 提供启动入口 | 不提供 | 使用当前系统支持的 Safari；WebKit 自动测试不等同于 Safari 实机验证 |

本项目不提供 Firefox / Safari 扩展安装包，也不承诺兼容停止维护的操作系统或旧浏览器。浏览器与 Node.js 是否支持你的系统版本，以各自安装要求为准。自动测试记录见 GitHub Actions；未列出的系统版本、Intel Mac 实机、Safari 实机和 Edge 实机未逐一验证。

## 安装扩展（Mac / Windows）

1. 将 Chrome-Edge 压缩包完整解压到一个固定目录。
2. Chrome 打开 `chrome://extensions`；Edge 打开 `edge://extensions`。
3. 开启开发者模式，选择“加载已解压的扩展”，选择含 manifest.json 的目录。
4. 点击扩展图标打开工具。更新时替换同一目录的程序文件，再点击“重新加载”。刷新或更新前先下载本次结果。

## 本地网页版

1. 安装 [Node.js LTS](https://nodejs.org/)，然后解压对应系统的文件包。无需安装项目依赖。
2. Mac 打开“启动.command”；Windows 打开“启动.bat”。Mac 若因下载文件权限不能直接打开，可在终端进入解压目录，运行 `sh 启动.command`；不要关闭系统安全保护。
3. 浏览器会打开本机地址。可复制地址到 Chrome、Edge、Firefox 或 Mac 的 Safari。
4. 保持启动窗口打开，结束后按 Ctrl+C。若端口被占用，关闭之前的启动窗口，或通过环境变量 EPR_PORT 选择其他端口。

不能直接双击 app/index.html：浏览器对本地文件的限制会影响解析工作进程。请使用启动入口。程序只监听本机地址，不向局域网开放；报告在浏览器处理，启动服务只提供程序静态文件。关闭或刷新页面会清除本次未下载的数据。

## 兼容依据

核验日期：2026-11-11。Chrome 扩展采用 Manifest V3；Edge 提供 Chrome 扩展移植机制。Firefox 的后台机制不同，因此本次提供网页版，不把 Chrome 包称为 Firefox 包。

- [Chrome 扩展清单](https://developer.chrome.com/docs/extensions/reference/manifest)
- [Edge 的 Chrome 扩展移植说明](https://learn.microsoft.com/en-us/microsoft-edge/extensions/developer-guide/port-chrome-extension)
- [Mozilla 后台脚本兼容说明](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/background)
