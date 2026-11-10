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
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.65
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", \"PingFang SC\", \"Microsoft YaHei\", sans-serif"
    fontSize: "11px"
    fontWeight: 550
    lineHeight: 1.6
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
# Design System: EPR申报数据助手

## Overview

**Creative North Star: "清晰的贸易目录"**

以贸易目录的清晰分组组织报告：白色主工作区承载表格，浅蓝文件栏承载文件上下文。中文系统字体、对齐的数字和细分隔线建立可信、克制的阅读节奏。

默认解析视图与高级准备工作台共用白蓝色彩和经典控件；前者强调直接阅读，后者保留步骤导航和必要确认。颜色始终配合文字说明状态。

**Key Characteristics:**
- 白色主区与浅蓝侧栏，桌面优先。
- 紧凑表格、产品分组合并单元格、等宽数字。
- 经典按钮、输入框和下划线页签；无装饰性卡片堆叠。

## Colors

### Primary
墨蓝主色用于主要操作、链接与选中页签；悬停加深。键盘焦点使用独立的浅蓝描边。

### Neutral
白色用于主工作区；浅蓝 rail 用于文件和步骤上下文；table-head 与 product-cell 提供轻微层次。text 为正文，muted 为辅助信息，line 为结构分隔。

### Status
琥珀色用于待复核，红色用于阻止或错误。状态必须同时有文字说明；没有“正式合规通过”的绿色装饰状态。

## Typography

系统中文无衬线贯穿标题、正文和控件，不引入展示字体。主标题使用 headline；高级工作台主标题加重至 700。品牌字标为 22px / 750；报告副标题为 13px，表格为 table，表头为 label。产品名称为 13px / 600，最多四行，完整名称保留在标题提示中。表格数字使用 tabular-nums，数量与已填重量右对齐；已填总重量以 14px / 650 墨蓝强调。

## Layout

桌面报告页使用 72px 顶栏、224px 浅蓝文件栏和白色弹性主区。顶栏与文件栏粘滞定位；主区内边距为 30px 32px 20px，不设桌面最大宽度。页签、搜索、类别和条件性国家筛选共享一条工具栏，时间筛选折叠在其下。数据表最小宽度为 920px。

空状态采用上传区与简短阅读说明的双列结构，间距为 48px。高级工作台保留同色步骤侧栏，主内容最大宽度为 1400px；不重复显示顶部步骤条。

1100px 以下报告文件栏为 190px，高级侧栏为 195px，上传内容改单列。750px 以下侧栏进入文档流，文件横排，主区左右留白为 16px，标题与导出纵向排列；筛选换行，表格保留 890px 最小宽度并显示横向滚动提示。1700px 以上报告主区左右留白为 48px。

## Elevation & Depth

默认使用底色和细边框建立层次，不使用卡片阴影。只有高级明细抽屉使用投影（-8px 0 30px #10244320），配合半透明背景覆盖层。按钮背景转换为 0.15s；减少动态效果偏好下关闭过渡。

## Shapes

经典矩形控件，轻圆角：标签为 tag，紧凑筛选为 control，表单与区块为 panel，按钮为 button。页签用直角底边线表达选中，不做胶囊。常规内容区依赖水平细线，不将每条数据包成卡片。

## Components

### Buttons
主按钮用于上传、当前解析导出或当前步骤推进；次按钮白底细边框；文字按钮用于次要入口。默认按钮间距为 8px，禁用态透明度为 .45。悬停有底色反馈，键盘焦点为 3px 实线、外偏移 3px。报告导出按钮使用 13px 字号与 9px 16px 内边距。

### Inputs / Fields
白底细边框，常规表单使用 6px 圆角和 9px 11px 内边距；报告工具栏缩为 12px 字号、5px 圆角。搜索图标位于左侧，文本留出空间。使用真实标签或可访问名称。

### Navigation
默认视图使用两项下划线页签；选中项加重并呈墨蓝色。高级工作台使用浅蓝选中步骤项，包含图标和步骤序号；窄屏步骤横向排列。报告文件栏底部只保留一个高级工作台入口。

### Tags and panels
待复核标签为琥珀浅底，普通标签为灰蓝浅底。高级工作台区块为白底细边框、24px 内边距、6px 圆角；报告来源区在表格下方使用浅底展开，打开后接收焦点，关闭后焦点返回来源按钮。

### Product table
产品身份在相邻类别行间使用真实 rowSpan，只在产品组起始处显示名称和 ASIN / SKU。文件和账户归属参与分组，不跨来源错误合并。产品单元格浅底，组界线加深；分类、国家、数量、材料重量、已填总重量和来源分别成列。零值材料折叠但保留；未知与未分配到产品使用明确文字。来源按钮是有下划线的文字操作。

## Do's and Don'ts

### Do:
- Do 使用明确文字解释未知、待复核与阻止项。
- Do 保留产品分组、材料明细、来源入口和数字对齐。
- Do 在窄屏让表格横向滚动，并保留可见键盘焦点。

### Don't:
- Don't 用颜色单独表达状态或把未知值显示为零。
- Don't 将报告解析或通用准备数据标为正式申报完成或合规通过。
- Don't 为默认阅读页增加重复步骤导航、装饰渐变或卡片网格。
