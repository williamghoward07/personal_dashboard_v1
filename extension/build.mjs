// Bundles the extension into extension/dist with Vite (already installed for
// vitest). Each entry is built on its own as an IIFE: content scripts can't be
// ES modules, and separate builds mean no shared chunks to import.
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const entries = ['background', 'content', 'sidepanel']

for (const [index, name] of entries.entries()) {
  await build({
    configFile: false,
    root: here,
    logLevel: 'warn',
    publicDir: false,
    resolve: { alias: { '@': root } },
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    build: {
      rollupOptions: {
        // unpdf's Node-only branches use import.meta, which an IIFE can't
        // have; it becomes {} and those branches never run in the extension.
        onwarn(warning, warn) {
          if (warning.code === 'EMPTY_IMPORT_META') return
          warn(warning)
        },
      },
      outDir: path.join(here, 'dist'),
      emptyOutDir: index === 0,
      minify: false,
      sourcemap: false,
      lib: {
        entry: path.join(here, 'src', `${name}.ts`),
        formats: ['iife'],
        name: `bb_${name}`,
        fileName: () => `${name}.js`,
      },
    },
  })
}

console.log(`Built ${entries.length} bundles into extension/dist. Load extension/ unpacked in chrome://extensions.`)
