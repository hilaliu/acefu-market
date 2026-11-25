# 体重日记

一个 Acefu 桌面应用：记录每天**睡前**和**第二天起床后**的体重，算出一夜之间的变化，用趋势图看长期走向。

数据只保存在本机。没有账号、没有网络请求、没有云同步；需要备份或换电脑时，在设置里导出 JSON。

## 怎么用

- 打开应用时，首页是「昨晚 → 今早」两张卡片：填昨晚睡前的体重，再填今早起床后的体重。
- 下面的「今晚」用来记录今天睡前的体重；明早再填一次，就会自动算成下一夜。
- 点右下角的「补记」或列表里的铅笔，可以改任意一天、补备注。
- 单位可以在设置里切「公斤」和「斤」，数据始终按公斤保存。

## 两个数字怎么算

对某一天 `D`：

```text
夜间代谢  = 早上(D) − 晚上(D − 1)
日变化    = 早上(D) − 上一个有记录的早上
```

两个值都是「体重差」，负值表示下降。比如晚上 73.0、第二天早上 72.4，夜间代谢就是 `−0.6 kg`。

- 夜间代谢要求 `D-1` 的晚上和 `D` 的早上都有记录；缺一边就显示 `—`。
- 日变化不要求相邻：错过一天时，会和「上一个有记录的早上」比较，列表里会写清楚是哪一天。
- 图表里的「夜间代谢」和「日变化」用柱状图，零线以上是增加，以下是下降。

## 数据存在哪

Acefu 的应用数据目录里，键为 `weight-journal:v1`：

```text
<UserData>/appdata/com.acefu.weight-journal/storage.json
```

一条记录长这样：

```json
{
  "date": "2026-11-25",
  "morning": { "weight": 72.3, "at": "2026-11-25T07:32:00.000Z" },
  "evening": { "weight": 73.0, "at": "2026-11-25T21:38:00.000Z" },
  "note": "跑步 5km",
  "updatedAt": 1795621263745
}
```

卸载应用时如果选择保留数据，这份文件不会删；卸载并删除数据会一起清掉。

## 开发

在仓库根目录：

```bash
pnpm install
pnpm --filter acefu-app-weight-journal dev      # vite build --watch
pnpm --filter acefu-app-weight-journal typecheck
pnpm exec acefu check apps/weight-journal
pnpm exec acefu dev apps/weight-journal          # 装进正在运行的 Acefu 并打开
```

应用目录就是 `<app>/`：`app.json` 在根上，`ui.entry` 指向 `dist/index.html`。宿主只加载 `app.json` 和 `dist/`，源码不会进包。

```text
apps/weight-journal/
├── app.json
├── public/icon.svg          # 构建后到 dist/icon.svg
├── src/
│   ├── App.vue              # 首页、图表、状态
│   ├── components/          # 输入卡片、图表、弹窗、列表
│   ├── lib/date.ts          # 本地日期键与格式化
│   ├── lib/journal.ts       # 存储、单位、夜间代谢/日变化、导入导出
│   └── types.ts
├── index.html
└── vite.config.ts
```

## 发布

发布由仓库根目录的脚本完成：

```bash
pnpm publish:weight-journal
pnpm verify
```

打包只包含 `app.json` 和 `dist/`，用 `acefu-market-2026-01` 私钥签名。推送到 `main` 后由 GitHub Pages 部署目录和包，Acefu 应用市场里就能装。

## 权限

`app.json` 只声明了两项：

- `storage`：保存应用数据；
- `clipboard` 的 `write`：把 JSON 备份复制到剪贴板。

没有 `network`，所以这个版本不会发出任何网络请求。

## 许可

源码用于个人记录与备份；发布包由 `acefu-market` 仓库签名。
