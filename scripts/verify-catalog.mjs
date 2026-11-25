#!/usr/bin/env node
/**
 * Checks the signed catalog the host will fetch: the Ed25519 signature, that
 * catalog.json is the exact payload, and that every local package matches its
 * recorded sha256. Run this before pushing the Pages branch.
 */
import { createHash, createPublicKey, verify } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import { isDeepStrictEqual } from 'node:util'

const ROOT = resolve(import.meta.dirname, '..')

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

async function main() {
  const envelope = JSON.parse(await readFile(resolve(ROOT, 'catalog.signed.json'), 'utf8'))
  const catalog = JSON.parse(await readFile(resolve(ROOT, 'catalog.json'), 'utf8'))
  const publicKey = createPublicKey(await readFile(resolve(ROOT, 'market-public.pem'), 'utf8'))

  if (envelope.algorithm !== 'ed25519')
    throw new Error(`catalog algorithm is ${envelope.algorithm}, expected ed25519`)
  if (typeof envelope.payload !== 'string' || typeof envelope.signature !== 'string')
    throw new Error('catalog envelope is missing payload or signature')

  const payload = Buffer.from(envelope.payload, 'base64')
  if (!verify(null, payload, publicKey, Buffer.from(envelope.signature, 'base64')))
    throw new Error('catalog signature does not match market-public.pem')

  const signed = JSON.parse(payload.toString('utf8'))
  if (!isDeepStrictEqual(signed, catalog))
    throw new Error('catalog.json is not the payload inside catalog.signed.json')

  let checked = 0
  for (const app of catalog.apps ?? []) {
    for (const release of app.releases ?? []) {
      for (const asset of release.assets ?? []) {
        const local = resolve(ROOT, 'packages', basename(new URL(asset.url).pathname))
        let bytes
        try {
          bytes = await readFile(local)
        }
        catch {
          console.warn(`warn: ${app.id} ${release.version} asset is not in packages/: ${basename(asset.url)}`)
          continue
        }
        const info = await stat(local)
        if (sha256(bytes) !== asset.sha256)
          throw new Error(`${app.id} ${release.version}: sha256 does not match ${basename(asset.url)}`)
        if (info.size !== asset.size)
          throw new Error(`${app.id} ${release.version}: size does not match ${basename(asset.url)}`)
        checked += 1
      }
    }
  }

  console.log(`catalog ok: ${envelope.keyId}, ${catalog.apps?.length ?? 0} apps, ${checked} packages verified`)
}

main().catch((cause) => {
  console.error(cause instanceof Error ? cause.message : String(cause))
  process.exit(1)
})
