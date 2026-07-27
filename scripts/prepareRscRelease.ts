import { readFileSync, writeFileSync } from 'node:fs'
import { generateChangelog } from '@vitejs/release-scripts'

async function main() {
  const version = process.argv[2]
  const pkgPath = 'packages/plugin-rsc/package.json'

  if (!version || !isValidSemver(version)) {
    throw new Error(`Invalid version: ${version || '(missing)'}`)
  }

  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
  if (pkg.version === version) {
    throw new Error(`Version is already ${version}`)
  }

  pkg.version = version
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`)

  await generateChangelog({
    getPkgDir: () => 'packages/plugin-rsc',
    tagPrefix: 'plugin-rsc@',
  })
}

function isValidSemver(version: string) {
  const match = version.match(
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/,
  )
  if (!match) return false

  return !match[4]
    ?.split('.')
    .some(
      (identifier) =>
        /^\d+$/.test(identifier) &&
        identifier.length > 1 &&
        identifier.startsWith('0'),
    )
}

main()
