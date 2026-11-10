# 亚马逊 EPR 报告国家字段核验

核验日期：2026-11-10。

## 官方资料

- [Amazon SP-API：Regulatory Compliance Reports](https://developer-docs.amazon/sp-api/docs/report-type-values-regulatory-compliance)：EPR 月度、季度、年度报告公开字段清单均列出 `ship_to_country_code`、`ship_to_country` 和独立的 `amazon_marketplace`。
- [Amazon Seller Central：EPR report field definitions](https://sellercentral.amazon.co.uk/help/hub/reference/external/GA9KU9UZWVXW8RPF)：提供大写下载表头及示例值，例如国家代码 FR、国家名称 France，商城列为独立字段。

本次核验的是亚马逊官方字段结构与示例值，**未获得完整真实卖家 CSV/XLSX 报告**。不以第三方文章、过时示例中的法规说明推导任何国家责任规则。

## 已实现调整

1. 上传前不再选择国家，也不默认德国。
2. 优先识别 `SHIP_TO_COUNTRY_CODE`；国家名称列单独保留作核对。表头大小写、下划线兼容。
3. 有明确国家名称但代码为空时，可用名称识别；仅支持已知名称及两位国家代码。无法识别的名称仍待处理。
4. `AMAZON_MARKETPLACE` 只作为商城字段保留，不用它填补目的国。
5. 代码和名称不一致，或国家缺失时阻断该行；不因选中某个筛选国家而替用户填值。
6. 默认按每行目的国分别汇总。单国选择改为折叠的可选筛选，不是导入前置条件。
7. Excel 保留原始国家字段、当前值、识别结果及取值列；自动范围的文件名包含报告里的国家代码。

## 测试范围

`public/samples/模拟数据_亚马逊国家字段.csv` 是合成测试文件：国家/商城列采用公开字段名，其余列为本工具通用演示字段，不冒充亚马逊完整报表。

专门覆盖：同一德国商城的 DE / FR 目的国分别汇总；国家名称回退；代码名称冲突；国家缺失时不以商城推断；可选国家筛选；Excel 原值与结果追溯。

真实报表的账号、期间起止、EPR 分类、多材料重量列及不同版本仍需独立适配验证，本次改动不声称已完成全部亚马逊字段适配。
