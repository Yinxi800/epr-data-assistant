---
name: EPR申报数据助手
description: 白底蓝色、本地处理的中文报告工作区
colors:
  primary: "#2459b8"
  primary-hover: "#1944ae"
  text: "#18263b"
  muted: "#526174"
  surface: "#ffffff"
  canvas: "#f4f6f9"
  rail: "#edf2f8"
  line: "#dbe2ec"
  table-head: "#eef3f8"
  product-cell: "#fafbfd"
  active-nav: "#dce7f6"
  warn-bg: "#fff3d9"
  warn-text: "#805313"
  error: "#ad3030"
  focus: "#7296f4"
typography:
  headline:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", \"PingFang SC\", \"Microsoft YaHei\", sans-serif"
    fontSize: "24px"
    fontWeight: 650
    lineHeight: 1.35
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", \"PingFang SC\", \"Microsoft YaHei\", sans-serif"
    fontSize: "17px"
    fontWeight: 650
    lineHeight: 1.6
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", \"PingFang SC\", \"Microsoft YaHei\", sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.6
  table:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", \"PingFang SC\", \"Microsoft YaHei\", sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.65
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", \"PingFang SC\", \"Microsoft YaHei\", sans-serif"
    fontSize: "12px"
    fontWeight: 550
    lineHeight: 1.6
  compact-brand:
    fontSize: "19px"
  compact-brand-sub:
    fontSize: "10px"
  compact-title:
    fontSize: "20px"
  compact-table:
    fontSize: "12px"
  compact-helper:
    fontSize: "11px"
  touch-input:
    fontSize: "16px"
rounded:
  tag: "4px"
  control: "5px"
  panel: "6px"
  button: "7px"
spacing:
  xs: "6px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.button}"
    padding: "8px 14px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.button}"
    padding: "8px 14px"
  button-text:
    textColor: "{colors.primary}"
    padding: "4px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.panel}"
    padding: "9px 11px"
  nav-active:
    backgroundColor: "{colors.active-nav}"
    rounded: "{rounded.control}"
    padding: "12px 10px"
  tag-warn:
    backgroundColor: "{colors.warn-bg}"
    textColor: "{colors.warn-text}"
    rounded: "{rounded.tag}"
    padding: "3px 8px"
  panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.panel}"
    padding: "24px"
  product-cell:
    backgroundColor: "{colors.product-cell}"
    width: "220px"
    padding: "16px 12px"
---
# Design System: EPR 申报数据助手

## 使用场景与流程

每天处理大量报告的审核人员，需要迅速找到异常、理解数值来源，并明确区分待核对草稿和已复核整理。默认主流程统一为 **上传 → 异常处理 → 汇总**，导出位于汇总页。国家和周期仅在解析之后呈现，不要求预先填写。

视觉规范先于页面实现确定：白色工作区、浅蓝文件侧栏、深蓝主操作、红色阻断项、琥珀色待核对。没有渐变、入场动画、装饰图表或外部字体请求。

## 统一规范

| 项目 | 规范 |
|---|---|
| 主操作 | #2459b8，白字；悬停 #19468f |
| 正文 / 辅助文字 | #18263b / #526174 |
| 工作区 / 文件栏 / 表头 | #ffffff / #edf2f8 / #eef3f8 |
| 分隔线 | #dbe2ec |
| 阻断 / 失败 | #a32323 字、#fff1f0 底，并显示具体原因 |
| 待核对 | #805313 字、#fff3d9 底，并显示待办动作 |
| 已纳入数据 | #246445 字、#edf7f0 底，只表示数据状态，不表示法规通过 |
| 字体 | 系统中文无衬线：Apple / Segoe UI / PingFang SC / Microsoft YaHei |
| 字号 | 主标题 26px；区块标题 18px；正文、表格与控件 14px；表头、辅助文字 12px |
| 数字 | `tabular-nums`；数量、重量右对齐；单位放列名 |
| 间距 | 8 / 12 / 16 / 24 / 32px；区块内部 24px，窄屏 16px |
| 控件 | 最小高度 44px；6–7px 圆角；文字明确，避免图标独立承担含义 |
| 焦点 | 3px 深蓝外框、3px 偏移；页面头部预留滚动位置 |
| 提示 | 错误持续显示；说明原因、下一步和保留的数据；颜色配文字 |

## 页面与组件

### 上传

上传区保留按钮与拖入两种操作，文件大小和支持格式可见。文件清单显示每项的等待、处理中、成功、失败或已停止状态；失败项提供独立重试。成功内容保留，不能因后续一个文件失败而全部丢失。

三步导航只显示一个当前位置。解析完成后才允许进入异常处理；停止后仅对已完整解析文件进行处理。文件清单完整与所有已上传文件成功是两个不同条件。

### 异常处理

顶部“本次整理范围”显示报告识别的国家与期间。筛选范围不覆盖原值，也不替未知国家或期间补值。日期错误靠近字段显示。

异常表优先展示阻断问题，其次待确认问题。状态文字、原因、原始值、候选数值和修正入口明确分列。字段映射、原始来源、改单使用就地面板，避免主流程增加步骤。修改需要依据；未保存编辑必须明确处理后再离开。

### 汇总

保留产品和分类两种数据视图。产品、分类、国家、期间、数量、材料重量及来源可直接阅读；未知与 0 明确区分。不同文件、账户、国家、期间不偷偷合并。

默认导出本次任务范围，搜索和分页仅控制显示。草稿明确标注待核对并携带异常和文件缺口；已复核通用整理需要当前版本的数据、文件清单和人工复核条件全部满足。工具不提供“正式申报通过”状态。

### 表格

表格正文 14px，默认每页 25 行，可选择 50 / 100 行。表头在独立滚动区内固定；滚动容器最大高度约 62vh。长文件名、产品名和原始值允许换行；不靠鼠标悬停才能读取完整关键信息。

数量和重量右对齐。未知显示“未知”，0 显示为 0；仅部分材料可计算时明确说明已知项小计。来源操作最小 44px，支持键盘操作。表格在窄屏内部横向滚动，页面整体不能被表格撑宽。

### 按钮、提示与表单

主按钮用于当前主要推进动作；其他动作采用白底细边框。禁用状态同时解释未满足条件。所有表单控件具有可访问名称，复选框文字与控件共用点击目标。错误、处理进度和导出反馈供辅助技术读取。

导出提示区分生成、发起下载和可确认保存。默认仅当前会话保留，离开前提示；主动保存任务副本不等于后台自动持久化。

## 响应式与兼容

桌面使用 72px 顶栏与 224px 文件侧栏，主区 32px 左右留白；1100px 以下侧栏 190px。750px 以下文件栏回到文档流、主区留白 16px、步骤保持横排，操作可换行，触控目标仍至少 44px。设备安全区域加入留白。

现有高级工作台保留兼容入口；本轮 CSS 以 `.report-workspace` 为范围，不重构无关旧页面。无外部字体、无动画库。减少动态效果偏好继续受支持。

## 方法与来源

本次实际运行 [UI UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) 官方检索，提交 `6ae86f61f520d6ca229d2f40e070410638c908c5`。Data-Dense Dashboard 样式及蓝色/琥珀色方向适合本场景。两次搜索返回的 Enterprise Gateway 营销布局不适用，未采用；Fira 字体和滚动动画也按中文离线及用户要求省略。此处布局由用户确认的三步流程决定。

[UX Flow Skills](https://github.com/jpoindexter/ux-flow-skills) 的表单、错误恢复和表格方法用于交互方案；完整条件见 `flow-report.html`。实现后的交互检查采用重新获取的 [Vercel Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md)。运行结果和未完成项应在验证记录中单独说明，不把设计建议当作功能已实现。

## v0.2.1 默认入口修正
默认使用直接解析阅读页：上传后表格直接出现，导出始终可用（有成功解析数据时）。保留本规范的配色、字号、表格与焦点样式，取消默认三步导航、异常工作队列和人工复核门槛。三步工作区仅由 `?review=1` 访问。

## 解析表格的列筛选
产品搜索及选择、类别、国家、材料、来源文件筛选直接置于对应表头；子分类、包装层级及期间收于表头内的原生展开控件。按分类视图的产品范围保留在首列表头，切换视图不重置筛选。取消独立筛选区，先展示明细表，再展示当前筛选结果合计；窄屏横向滚动，数字不拆行。

## v0.2.3 紧凑解析表格
用户要求表格优先并允许缩小字号。已解析视图移除常驻左栏，改为顶部可展开文件栏；主区全宽，桌面边距20px。EPR 类别、细分类、包装层级独立列和独立筛选。桌面表格12px、表头与辅助文字11px、单元格8px留白、筛选控件32px；手机输入16px、44px点击区域，宽表局部横向滚动。细分类中文仅为原标签翻译，英文同列保留；合计按原报告细分类分别显示。上述密度仅适用于默认直接解析页，复核工作区沿用既有规范。

## v0.2.4 日期与范围可见性
日期范围常显于表格上方，支持全部期间、月份、季度、年度和自定义；起止日期始终可编辑，留空表示该端不限。手机日期入口不随表格横向滚动。非日期筛选保留表头内。当前条件显示可移除标签；表尾显示匹配原报告行数、当前页分组和跨页合计范围。按产品视图保留下方分类合计，按分类视图只显示一份分类表。导出按钮明确为“导出全部解析结果”，附近标明全量行数。

参考模式：[Excel SUBTOTAL](https://support.microsoft.com/en-us/excel/functions/subtotal-function) 的筛选后小计、[AG Grid 状态栏](https://www.ag-grid.com/javascript-data-grid/status-bar/) 的总行数/筛选行数显示，以及 [DataTables footer callback](https://datatables.net/examples/core/advanced_init/footer_callback.html) 对本页与全部数据合计的区分。本项目继续按EPR类别、细分类等业务边界分别合计，未引入这些组件库。

## v0.2.5 重量明细与合计说明

明细表与合计表共用重量明细组件：名称和值采用内容宽度两列，间距12px，数值右对齐，避免随宽屏拉开。统一使用“重量明细（kg）”与“已知重量小计（kg）”，以边线区分分项和小计；非材料重量按业务显示产品报告重量或电池报告重量。数量标注“本类别/层级数量”及不可跨类别层级累加。两处均支持零值展开，缺失重量保持未知。合计来源及说明可点击，关闭来源后焦点返回触发按钮；日期未知、跨期边界在合计下方再次就地说明。

## v0.2.6 数据分块与列边界

明细表、分类合计分别使用完整浅蓝灰边框和独立标题底色，块间留白20px。所有数据列加1px竖线，行线保持较浅；已知重量小计采用淡蓝底色。表格使用独立边框模型，滚动时固定表头仍保留列线。手机继续局部横向滚动。

## v0.2.7 客户文案

默认网页与扩展统一面向报告使用者：使用“读取报告、查看数据、下载 Excel”，避免“解析、当前会话、字段映射”等内部描述。操作按钮用“下载全部数据”，附近说明包含筛选隐藏的数据。保留 EPR、ASIN、SKU、包装层级等业务必要术语；缺失数据、跨期整行统计和未提交正式申报仍明确说明。上传页只介绍输入、查看和下载，乱码设置按问题命名“文字乱码？”。关闭或刷新前提示先下载结果。

## v0.2.8 重点数据提示色

突出受影响的单元格：无法计算的数量或重量使用浅红底和深红字；部分重量、无法对应产品、日期或国家不明、类别不明及来源说明使用浅黄底；分类合计的有效数量与重量使用浅蓝底。表上方提供简短色标，单元格保留状态文字，避免只凭颜色理解。重复文件在文件栏提示，跨期和日期不明提示加浅黄底。0是有效原值，不因数值为零而标红。可选细分类缺失不自动视为异常。

## v0.2.9 独立材料分类

默认工作区增加“按材料”页签，纸和塑料优先显示，各材料独立行并保留包装层级及报告范围。材料分类列使用轻底色，重量沿用既有未知/部分/正常提示色。不展示重复的产品数量。现有产品与细分类视图不改变，三个页签均支持左右方向键切换。
