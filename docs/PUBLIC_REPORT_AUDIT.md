# 公开亚马逊 EPR 报告核验

核验日期：2026-11-10。

## 来源与证据边界

本轮检索公开 CSV/XLSX、报告模板、精确字段及附件。找到了官方字段说明和不同年份的公开截图，未取得完整、可直接导入的真实卖家原始文件。截图不能证明文件编码、完整行结构或总计准确性；转载不视为独立卖家样本。

| 来源 | 实际可核验内容 | 限制 |
| --- | --- | --- |
| [Amazon SP-API 官方文档](https://developer-docs.amazon/sp-api/docs/report-type-values-regulatory-compliance) | 月度、季度、年度 EPR 报告字段清单，34 个公开字段 | 字段规范，不是实际卖家文件 |
| [Seller Central 字段说明](https://sellercentral.amazon.co.uk/help/hub/reference/external/GA9KU9UZWVXW8RPF) | 大写表头、国家和商城示例 | 正文访问可能要求登录，不是下载样本 |
| [雨果跨境，2022-04-18](https://www.cifnews.com/article/121156) | 报表截图：2022 第一季度、DE/FR、材料重量多列 | 截图中部分数值被遮挡 |
| [搜狐，2023-03-21](https://www.sohu.com/a/657264895_120947317) | 国家代码、国家名称、商城独立；EEE/Primary Packaging 分类 | 第三方截图，不用其法规结论作规则依据 |
| [MJCM，2026 年文章](https://www.mjcm.ltd/index.php/xinwenzhongxin/903.html)、[转载](https://www.10100.com/article/67788724) | 截图内为 2024 年度报告；Primary/Secondary Packaging、七种材料列 | 文章年份不等于数据年份；转载不另计样本 |

下载的公开截图及 URL、SHA-256 清单保存在本机 Downloads/EPR公开样本核验_20261110，不作为客户数据或完整报告入库。

## 可复现实测

运行 `node scripts/audit-public-epr-schema.mjs`，按公开 34 字段构造三份**合成诊断文件**：大写季度初级包装、大写年度次级包装、小写月度初级包装。数值由测试设定，不从截图猜测或声称为真实报表。结果写入 `output/public-schema-audit/result.json`。

三种结构均可解析，自动映射 5 个字段：国家代码、国家名称、商城、ASIN、EPR 品类。原材料列完整保留，但三行均被标记待处理、没有纳入汇总。

| 未完成的适配 | 当前实际行为 |
| --- | --- |
| 账号标识与客户/店铺归属 | 需人工提供归属，不能凭标识猜客户 |
| `report_period_start` / `report_period_end` | 尚未自动合成为期间 |
| `total_units_sold` | 尚未自动映射销量 |
| `Primary Packaging` / `Secondary Packaging` | 尚未拆分为包装业务与包装层级 |
| `paper_kg`、`plastic_kg` 等七种材料列 | 尚未转换为可计算的材料明细；不能将材料行销量重复相加 |
| 产品净重、含包装总重与申报重量 | 不自动混用，不从差值推算包装重 |

**结论：已验证文件可读和部分字段识别，不是完整亚马逊报告计算兼容通过。** 通用格式测试、编码测试与真实亚马逊报告适配是三个不同层次，不互相替代。完整适配仍需明确各列重量口径并用真实脱敏文件核对。
