# acefu-market

Acefu 的签名应用目录，也是应用的源码仓库。目录和安装包都托管在 GitHub Pages；宿主拉取、验签、安装。

- 应用源码：`apps/`
- 签名目录：`catalog.json`（可读的源）+ `catalog.signed.json`（宿主实际拉取的信封）
- 安装包：`packages/*.acefu`
- 发布脚本：`scripts/publish-app.mjs`、`scripts/verify-catalog.mjs`

## 应用

| 应用 | 说明 |
| --- | --- |
| `apps/weight-journal` | 体重日记：记录每晚与次晨体重，自动算出一夜代谢、日变化和趋势；数据只保存在本机。 |

## 开发

```bash
pnpm install
pnpm typecheck
pnpm build
pnpm exec acefu check apps/weight-journal
```

本机装了 Acefu 宿主时，可以把开发中的应用装进去：

```bash
pnpm exec acefu dev apps/weight-journal
```

`acefu dev` 会监听 `dist/`，保存后自动重装并打开。也可以在应用自己的目录里 `pnpm dev`，再用 `acefu install <dir>` 安装。

## 发布

签名私钥不在仓库里。默认从 `~/acefu-market-keys/market-private.pem` 读取，也可以用 `ACEFU_MARKET_KEY` 指定：

```bash
pnpm publish:weight-journal
# 或者
ACEFU_MARKET_KEY=/path/to/market-private.pem \
  pnpm publish:weight-journal apps/weight-journal --notes "首个版本"
```

脚本会：

1. 构建应用；
2. `acefu pack` 产出 `packages/<id>-<version>-any.acefu`；
3. 更新 `catalog.json` 的 release；
4. 用 Ed25519 私钥签 `catalog.signed.json`。

发布前检查：

```bash
pnpm verify
```

它会验签、确认 `catalog.json` 与签名里的 payload 一致，并核对本地包的 sha256/size。通过后提交：

```bash
git add apps packages catalog.json catalog.signed.json index.html
git commit -m "feat(weight-journal): publish 0.1.0"
git push
```

推送到 `main` 后，`.github/workflows/pages.yml` 会把 `index.html`、`catalog.signed.json` 和 `packages/` 部署到 GitHub Pages。宿主只信任 `acefu-market-2026-01` 这一把公钥（`market-public.pem` 是它的公开部分）。

## 安装

打开 Acefu → 应用市场 → 体重日记 → 安装。`0.1.0` 的包是 `any` 平台，macOS / Windows / Linux 共用。

本地开发安装不验签，只用于调试：

```bash
pnpm exec acefu install apps/weight-journal
```
