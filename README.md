# 金河九号机补丁与扩展（支持 v1.6.4 / v1.8.7 / v1.9.3 / v1.9.4）

源自对金河县九号随身机的持续本地适配，现已支持 **`v1.6.4`、`v1.8.7`、`v1.9.3`、`v1.9.4`** 四个版本的模块补丁，并提供**零侵入跨端同步与酒馆代发修复扩展**、ComfyUI 工作流与合并预览工具。

## 版本支持一览

| 版本 | 补丁目录 | 说明 |
| --- | --- | --- |
| **v1.9.4（最新）** | [patches/v1.9.4/](patches/v1.9.4/) | 官方已合入 `scene.date` 日期追踪、`\u003c/script` 闭合转义与 `IndexedDB` 照片/主题本地存储；本补丁新增**自建地产删除联动撤回挂牌 + 钱包「撤回」按钮（修复删掉自建地产后钱包仍残留且占用重名的问题）**，并保留无限腰力与绿泡泡互通，附 `baseline.json` 校验摘要 |
| **v1.9.3** | [patches/v1.9.3/](patches/v1.9.3/) | 适配 `v1.9.3` 新版，新增自动 `YYYY-MM-DD` 日期追踪（`scene.date`），保留无限腰力、绿泡泡互通、熟人重登场与状态栏修复，附 `baseline.json` 校验摘要 |
| **v1.8.7** | [patches/v1.8.7/](patches/v1.8.7/) | 拆分可审阅的 `phone-host.patch`、`phone-ui.patch`、`zod.patch`、`turn.patch`、`status-ui.patch` 与 `baseline.json` |
| **v1.6.4** | [patches/](patches/) | 最初基线版本，配套 `scripts/apply.mjs` 一键生成合并预览 |

## 零侵入扩展（全版本通用，推荐安装）

- **[integrations/jinhe-phone-settings-sync/](integrations/jinhe-phone-settings-sync/README.md)**（SillyTavern 用户扩展，无需改动角色卡）：
  - **跨浏览器 / 跨设备同步**：将 `jinhe-phone-*` 通用设置（主题、外观、生图预设、TTS 音色、自定义地点、主设置、朋友圈数等）自动同步至酒馆服务端，换浏览器或 Mac/手机远程连接不再丢失。
  - **本机 / 远程 API 自动分档**：`jinhe-phone-api-settings-v1` 按访问来源自动分离为 `local`（本机 `127.0.0.1`/`localhost`）与 `remote`（Tailscale/局域网远程）两套档案，互不覆盖。
  - **悬浮球位置本地隔离**：`jinhe-phone-launch-position-v1` 保留在各设备本地，避免不同屏幕分辨率错位。
  - **自动修复 `v1.8.7+` 酒馆代发报错**：自动向 `iframe[title="金河九号随身机"]` 注入父窗口 `SillyTavern` 与同步钩子，彻底解决「手机自填，由酒馆代发」报“要在酒馆里打开九号机才能用”的问题。

## 核心改动

| 模块 | 改动 |
| --- | --- |
| 自建地产删除与挂牌撤回（`v1.9.4`） | 修复地图删除自建地点时未清理 MVU `state.player.custom_property_offers[id]` 导致钱包残留及新建同名报「同名物业已登记」的问题：① `Zod` 新增 `unregister-property` action（仅撤回未买断挂牌，已买断自有物业受保护）；② 宿主层 `savedPhoneActions` 加入 `'unregister-property'` 确保同步落盘；③ 地图 `removeCustomPlace` 删除前自动调用撤回并加防连点保护；④ 钱包「可买断物业」列表为 `custom_*` 挂牌新增「撤回」按钮，支持一键清理历史残留并同步刷新背景地图页。 |
| 自动日期追踪（`v1.9.3` / `v1.9.4` 官方已合入） | 以 `2026-01-02`（第 1 天，周五）为基准，在 `Zod` 回合结算时自动计算并推进 `scene.date`（`YYYY-MM-DD`），即使跨越多周也不会重复；同步注入回合资料提示词（方便台账直接读取，无需依赖正文时间锚点），并在同楼层状态栏、九号机主页/顶栏与金手指日期选择器中完整显示和联动修改。 |
| 聊天模型 | 九号机单独配置 OpenAI 兼容地址、密钥和模型，可经酒馆后端转发。所选酒馆预设的已启用提示词会加入请求。 |
| 绿泡泡 | 私聊记录支持逐条删除和清空。可选适配瑟瑟小手机 V1.308，在同一份金河聊天内同步唯一匹配的好友和每个会话最近 250 条文字或语音转写。 |
| 消息时间与性能 | 绿泡泡按剧情时间显示。双端已有对应记录时按消息 ID 补时间。空闲时只检查变化，滚出屏幕的金河县状态栏暂停定时扫描。 |
| 熟人重新登场 | 保留新写入的心声、穿搭、姿势和反应，工作、收入、日常、可约按字段更新，缺省时沿用档案。 |
| 台账生日（可选） | 限这张卡，AI 填表保留已登记的生日。首次入表时有剧情日期及 MVU 年龄就校准年份，手动编辑仍可用。 |
| 钱包 | 普通付款即时保存，保存失败后用同一请求重试时防止重复扣款。付款可识别唯一匹配的收款人姓名，拒绝原因显示在钱包。已加微信的好友可收异地私聊红包。 |
| 腰力 | 九号机显示 `∞`，MVU 存储用固定整数 `100`，正文指令和世界书规则同步调整。 |
| 楼层状态栏 | `<StatusPlaceHolderImpl/>` 标出状态栏位置，角色脚本挂载面板。状态栏读取当前楼层、当前回答版本的 MVU 变量，变更后自动刷新。显示规则隐藏状态栏后多生成的人物变量快照。 |
| 生图渠道 | 接柏宝绘公开接口，也可独立配置 ComfyUI。按工作流加载节点筛选模型，快速测试使用小图和最多四步。 |
| 生图用途 | 衣柜和自拍可用各自独立的剑侠 Krea2 工作流。衣柜生成无模特平铺图，自拍和试穿保留人物工作流。 |
| 任务提示词 | 六类用途覆盖角色立绘、正文插图、衣柜单品、衣柜套装、地图场景和物品总览。可选中文自然语言、英文自然语言或英文标签。 |

## 审阅位置

- **v1.9.4（最新）**：`patches/v1.9.4/`（`phone-host.patch`、`phone-ui.patch`、`zod.patch`、`turn.patch`、`baseline.json`）
- **v1.9.3**：`patches/v1.9.3/`（`phone-host.patch`、`phone-ui.patch`、`zod.patch`、`turn.patch`、`status-ui.patch`、`baseline.json`）
- **v1.8.7**：`patches/v1.8.7/`（同上结构）
- **v1.6.4**：[手机宿主](patches/phone-host.patch)、[手机页面](patches/phone-ui.patch)、[MVU Zod](patches/zod.patch)、[回合脚本](patches/turn.patch)、[状态栏刷新补丁](patches/status-ui.patch)与[世界书改动](docs/worldbook.md)
- **扩展与联动组件**：
  - [九号机设置跨端同步扩展](integrations/jinhe-phone-settings-sync/README.md)（零侵入，全版本通用）
  - [状态栏挂载脚本](integrations/status-host.js)
  - [瑟瑟小手机适配器](integrations/sese-phone-1308.js)（依赖 V1.308 维护版）
  - [衣柜工作流](workflows/jianxia-wardrobe-api.json)与[自拍工作流](workflows/jianxia-selfie-api.json)（ComfyUI API 格式，沿用剑侠整合包布局）

## 生成合并预览（v1.6.4 自动化脚本）

需要 Node.js 和 Git。输入原版 v1.6.4 的 JSON 格式角色卡：

```sh
node scripts/apply.mjs original-card.json preview
```

若有单独加载的世界书，可同时生成改后的世界书：

```sh
node scripts/apply.mjs original-card.json preview --world original-world.json
```

输出为新的 JSON 角色卡。工具校验原版三个脚本和状态栏规则的摘要，再应用补丁。`v1.8.7` / `v1.9.3` 可直接按 `patches/v1.8.7/` 或 `patches/v1.9.3/` 对应补丁审阅并合并。

仓库的六类生图任务使用同一用途和输出协议的兼容模板。通过 `--task-prompts own-templates.json` 可传入自有模板，结构见[模板样例](integrations/task-prompts.json)。

可选参数 `--sese-phone original-sese.script.json` 可为 V1.308 维护版的单脚本 JSON 导出生成适配副本；`--sese-ledger original-ledger.script.json` 可生成带生日保护的台账脚本。

## 验证

- `v1.9.4` 补丁脚本（`zod.js`、`turn.js`、`phone.js` 及 `phoneHtml` 内嵌 `<script>`）已全部通过 `node --check` 语法与 `\u003c/script` 闭合转义校验，确认 `unregister-property` 联动撤回、防连点与钱包撤回后背景地图刷新均正常闭环。
- `v1.9.3` 移植脚本（`zod.js`、`turn.js`、`phone.js` 及内嵌 HTML/JSON 块）与 `scene.date` 跨周日期计算已通过 Node.js 语法与断言测试。
- `jinhe-phone-settings-sync` 已通过本机/远程 API 分档隔离、共享同步、悬浮球坐标排除与 `iframe` `SillyTavern` 注入单元测试。
- 合并预览、ComfyUI 生图工作流、选定预设注入、收款失败重试、无限腰力、消息互通与任务提示词输出均已完成验证。
