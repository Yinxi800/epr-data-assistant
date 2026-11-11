# 统一网址与浏览器兼容

Mac、Windows 用户访问同一个网址：https://yinxi800.github.io/epr-data-assistant/ 。无需安装 Node.js、下载桌面程序或保持启动窗口打开。

| 系统 | 建议访问方式 | 验证边界 |
|---|---|---|
| macOS | 当前稳定版 Chrome、Edge、Firefox；Safari 可尝试访问 | Chromium、Firefox、WebKit 自动化核验；Safari、Edge 实机另行核验 |
| Windows | 当前稳定版 Chrome、Edge、Firefox | Windows 托管环境执行浏览器测试；不能代表所有历史 Windows 版本 |
| Linux | 当前稳定版 Chrome / Chromium、Firefox | Linux 托管环境执行浏览器测试 |

浏览器必须仍受当前操作系统支持；不承诺兼容已停止维护的系统或旧浏览器。WebKit 测试不等同于 Safari 实机测试。具体通过情况以 GitHub Actions 的兼容检查为准。

## 部署与数据

项目源码公开，GitHub Pages 直接从同一个 epr-data-assistant 仓库构建和部署。公开网页无需登录。程序静态文件从 GitHub Pages 下载，报告解析、筛选及 Excel 生成在浏览器本地完成，不上传客户报告。关闭或刷新页面前请先下载结果。

Chrome / Edge 扩展仍可独立使用，Mac、Windows 共用一份扩展包。Firefox / Safari 本次使用统一网页版，不提供其扩展安装包。

核验参考（2026-11-11）：[GitHub Pages 说明](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)、[Edge 扩展兼容说明](https://learn.microsoft.com/en-us/microsoft-edge/extensions/developer-guide/port-chrome-extension)。

## 后续更新

代码推送至 `Yinxi800/epr-data-assistant` 的 main 分支后，Publish website 工作流自动测试、构建并发布 dist。源码、版本和网站统一在同一个公开仓库。客户报告、output 和本机测试下载不加入代码仓库。
