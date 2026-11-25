# 九号机设置跨端同步扩展（零侵入）

独立 SillyTavern 用户扩展，无需修改金河九号随身机角色卡（兼容 `v1.6.4`、`v1.8.7` 及后续版本）。

## 功能

1. **三层分流跨端同步（`localStorage` ↔ 酒馆服务端 `extensionSettings.jinhe_phone_sync_v1`）**
   - **全端统一同步**：`jinhe-phone-*` 通用键（生图预设、主题、外观、TTS 音色、自定义地点、朋友圈数、主设置等）。
   - **本机 / 远程分档同步**：`jinhe-phone-api-settings-v1` 按访问地址自动区分 `local`（`127.0.0.1` / `localhost`）与 `remote`（Tailscale / 局域网 IP），本机与远程设备独立保存、互不覆盖。
   - **仅留当前设备本地**：`jinhe-phone-launch-position-v1`（悬浮球坐标）不同步，避免不同屏幕分辨率错位。
2. **修复 `v1.8.7` 独立 `iframe` 内「手机自填，由酒馆代发」报错**
   - 自动监听并向 `iframe[title="金河九号随身机"]` 注入父窗口 `SillyTavern` 与 `Storage` 同步钩子，解决 `phoneSt()` 返回 `null` 导致的「要在酒馆里打开九号机才能用」错误。

## 安装

将本目录复制到 `SillyTavern/data/default-user/extensions/jinhe-phone-settings-sync/`，重启酒馆或强刷页面即可生效。
