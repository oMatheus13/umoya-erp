import { chmodSync, existsSync } from 'node:fs'

const candidates = [
  'node_modules/@esbuild/linux-x64/bin/esbuild',
  'node_modules/@esbuild/linux-arm64/bin/esbuild',
  'node_modules/@esbuild/darwin-x64/bin/esbuild',
  'node_modules/@esbuild/darwin-arm64/bin/esbuild',
  'node_modules/@esbuild/win32-x64/bin/esbuild.exe',
  'node_modules/@esbuild/win32-arm64/bin/esbuild.exe',
]

const updated = []

for (const target of candidates) {
  if (!existsSync(target)) {
    continue
  }
  try {
    chmodSync(target, 0o755)
    updated.push(target)
  } catch (error) {
    console.warn(`Nao foi possivel ajustar permissoes para ${target}:`, error)
  }
}

if (updated.length > 0) {
  console.log(`Permissoes ajustadas: ${updated.join(', ')}`)
}
