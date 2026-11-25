#!/usr/bin/env node
/**
 * Builds one app, packs it with `acefu pack`, adds the release to the catalog
 * and signs the catalog with the offline Ed25519 key. The private key never
 * enters the repository: pass --key or set ACEFU_MARKET_KEY.
 */
import { execFileSync } from 'node:child_process'
import { createHash, createPrivateKey, sign } from 'node:crypto'
import { readFile, stat, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

const DEFAULT_KEY = join(homedir(), 'acefu-market-keys', 'market-private.pem')
const DEFAULT_BASE_URL = 'https://hilaliu.github.io/acefu-market'
const DEFAULT_KEY_ID = 'acefu-market-2026-01'

function parseArgs(argv) {
  const options = { dir: 'apps/weight-journal', notes: '', key: '', keyId: '', baseUrl: '' }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--notes') {
      options.notes = argv[++index] ?? ''
      continue
    }
    if (arg === '--key') {
      options.key = argv[++index] ?? ''
      continue
    }
    if (arg === '--key-id') {
      options.keyId = argv[++index] ?? ''
      continue
    }
    if (arg === '--base-url') {
      options.baseUrl = argv[++index] ?? ''
      continue
    }
    if (arg.startsWith('-'))
      throw new Error(`unknown option: ${arg}`)
    options.dir = arg
  }
  return options
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

async function sha256File(path) {
  return sha256(await readFile(path))
}

function permissionList(manifest) {
  const permissions = []
  const value = manifest.permissions ?? {}
  if (value.storage)
    permissions.push('storage')
  if (value.notify)
    permissions.push('notify')
  for (const item of value.clipboard ?? [])
    permissions.push(`clipboard:${item}`)
  for (const item of value.network ?? [])
    permissions.push(`network:${item}`)
  for (const item of value.secrets ?? [])
    permissions.push(`secrets:${item}`)
  for (const item of value.apps?.open ?? [])
    permissions.push(`apps.open:${item}`)
  for (const item of value.dialog ?? [])
    permissions.push(`dialog:${item}`)
  if (value.fs?.read?.length)
    permissions.push('fs.read')
  if (value.fs?.write?.length)
    permissions.push('fs.write')
  return permissions
}

function safeName(value) {
  return value.replace(/[^\w.+-]/g, '-')
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const appDir = resolve(options.dir)
  const keyPath = resolve(options.key || process.env.ACEFU_MARKET_KEY || DEFAULT_KEY)
  const keyId = options.keyId || process.env.ACEFU_MARKET_KEY_ID || DEFAULT_KEY_ID
  const baseUrl = (options.baseUrl || process.env.ACEFU_MARKET_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '')
  const outDir = resolve('packages')

  const manifest = JSON.parse(await readFile(join(appDir, 'app.json'), 'utf8'))
  const packageName = JSON.parse(await readFile(join(appDir, 'package.json'), 'utf8')).name
  const notes = options.notes || `${manifest.name} v${manifest.version}`

  console.log(`==> build ${packageName}`)
  execFileSync('pnpm', ['--dir', appDir, 'build'], { stdio: 'inherit' })

  console.log(`==> pack ${manifest.id}@${manifest.version}`)
  execFileSync('pnpm', [
    'exec',
    'acefu',
    'pack',
    appDir,
    '--out',
    outDir,
    '--key',
    keyPath,
    '--key-id',
    keyId,
    '--platform',
    'any',
  ], { stdio: 'inherit' })

  const fileName = `${safeName(manifest.id)}-${safeName(manifest.version)}-any.acefu`
  const filePath = join(outDir, fileName)
  const info = await stat(filePath)
  const asset = {
    platform: 'any',
    url: `${baseUrl}/packages/${fileName}`,
    sha256: await sha256File(filePath),
    size: info.size,
  }

  let icon
  try {
    const iconBytes = await readFile(join(appDir, manifest.icon))
    icon = `data:image/svg+xml;base64,${iconBytes.toString('base64')}`
  }
  catch {
    // The catalog allows a missing icon and the market shows a placeholder.
  }

  const catalogPath = resolve('catalog.json')
  const catalog = JSON.parse(await readFile(catalogPath, 'utf8'))
  const release = {
    version: manifest.version,
    sdk: manifest.sdk,
    publishedAt: new Date().toISOString(),
    notes,
    permissions: permissionList(manifest),
    assets: [asset],
  }

  const entry = {
    id: manifest.id,
    name: manifest.name,
    summary: manifest.description ?? manifest.name,
    description: `${manifest.description ?? manifest.name}。自动算出一夜代谢、日变化与趋势；数据只保存在本机，可导出 JSON 备份。`,
    publisher: { id: 'acefu', name: 'Acefu', keyId },
    categories: ['health', 'lifestyle'],
    ...(icon ? { icon } : {}),
    releases: [release],
  }

  const existingIndex = catalog.apps.findIndex(app => app.id === manifest.id)
  if (existingIndex >= 0) {
    const existing = catalog.apps[existingIndex]
    const releases = (existing.releases ?? []).filter(item => item.version !== manifest.version)
    entry.releases = [release, ...releases]
    catalog.apps[existingIndex] = entry
  }
  else {
    catalog.apps.push(entry)
  }
  catalog.generatedAt = new Date().toISOString()

  const payload = `${JSON.stringify(catalog, null, 2)}\n`
  const privateKey = createPrivateKey(await readFile(keyPath, 'utf8'))
  if (privateKey.asymmetricKeyType !== 'ed25519')
    throw new Error(`signing key must be Ed25519, got ${privateKey.asymmetricKeyType ?? 'unknown'}`)

  const envelope = {
    keyId,
    algorithm: 'ed25519',
    payload: Buffer.from(payload, 'utf8').toString('base64'),
    signature: sign(null, Buffer.from(payload, 'utf8'), privateKey).toString('base64'),
  }

  await writeFile(catalogPath, payload)
  await writeFile(resolve('catalog.signed.json'), `${JSON.stringify(envelope, null, 2)}\n`)

  console.log('')
  console.log(`package  ${asset.url}`)
  console.log(`sha256   ${asset.sha256}`)
  console.log(`size     ${asset.size}`)
  console.log(`catalog  catalog.json + catalog.signed.json`)
  console.log('')
  console.log('Next: git add packages catalog.json catalog.signed.json && git commit && git push')
}

main().catch((cause) => {
  console.error(cause instanceof Error ? cause.message : String(cause))
  process.exit(1)
})
