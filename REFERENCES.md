# 参考来源与复用说明

调研及核查日期：2026-11-15。通过 Agent Reach 的 GitHub CLI 渠道查看真实仓库，并阅读官方文档。仓库存在和源码可读，不代表这些项目在当前 X 页面上可运行。

| 来源 | 参考范围 | 本项目处理 |
| --- | --- | --- |
| [jeejjeH1/x-following-manager](https://github.com/jeejjeH1/x-following-manager) | 关注管理流程、`UserCell` 识别、扫描和筛选结构 | 调研时未声明许可证，仅研究思路，没有复制源码；未采用其私有 API、批量取关和移除关注者能力 |
| [kysoog/x-unfollowers](https://github.com/kysoog/x-unfollowers) | 互关关系管理的产品功能、扩展组织方式 | 调研时为 MIT 许可证；本版未复制源码 |
| [Chrome content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts) | 内容脚本与页面 DOM 读取能力 | 使用标准 Manifest V3 内容脚本及 Shadow DOM |
| [X 自动化规则](https://help.x.com/en/rules-and-policies/x-automation) | 关注自动化边界 | 本版不自动关注，不承诺绕过限制 |

本项目代码独立编写，运行时无第三方库打包进扩展。开发依赖及版本见 `package-lock.json`。安装 ZIP 只含构建产物和文档，源码 ZIP 不包含 `node_modules`。

页面选择器还经过当前真实 X 关注者页面的只读核查，包括账号菜单、关注者 region、`userFollowIndicator` 与原生关注按钮。未记录真实名单到本项目测试文件，测试夹具均为虚构账号。
