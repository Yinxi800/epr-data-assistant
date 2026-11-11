<p align="center"><img src="public/brand/icon-128.png" width="72" height="72" alt="EPR申报数据助手"></p>

# EPR申报数据助手

上传亚马逊 EPR 报告，按产品和分类查看数量、重量，筛选后核对，并下载 Excel。

**[打开在线工具](https://yinxi800.github.io/epr-data-assistant/)** · Mac、Windows 共用，无需安装或登录。

## 主要功能

- 支持 CSV、Excel 等表格，多文件一起读取。
- 按产品、国家、分类、包装层级和日期筛选，自动汇总。
- 查看原始来源，区分缺失重量与零值。
- 下载完整汇总、明细和原报告，查看时的筛选不影响下载范围。

文件只在浏览器本地处理，不上传。关闭或刷新前请先下载结果。本工具用于数据整理，不提交正式申报，不计算回收费；尚未覆盖所有亚马逊报告版本。

## 浏览器扩展

Chrome、Edge 可使用本地扩展。构建后在扩展管理页开启开发者模式，选择“加载已解压的扩展”，载入 `extension-dist`；更新后点击“重新加载”。

## 本地开发

需要 Node.js 22.12+ 和 npm。

```sh
npm ci
npm run dev
```

构建网站：`npm run build`；生成扩展：`npm run build && npm run extension`。推送 main 后，GitHub Pages 自动测试并发布网站。

[系统与浏览器兼容](docs/PLATFORM_SUPPORT.md) · [验证记录](docs/VALIDATION.md) · [详细实现与历史说明](docs/IMPLEMENTATION_HISTORY.md)
