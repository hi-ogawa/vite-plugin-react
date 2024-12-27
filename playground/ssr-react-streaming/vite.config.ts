import assert from 'node:assert'
import { type Manifest, defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// TODO: browser is stuck when reloading on server restart

declare let __browserManifest: Manifest

export default defineConfig({
  appType: 'custom',
  environments: {
    client: {
      build: {
        outDir: 'dist/client',
        manifest: true,
        rollupOptions: {
          input: { index: 'virtual:client-entry.js' },
        },
      },
    },
    ssr: {
      build: {
        outDir: 'dist/server',
        rollupOptions: {
          input: { index: 'src/entry-server.tsx' },
        },
      },
    },
  },
  plugins: [
    react(),
    {
      name: 'ssr-middleware',
      configureServer(server) {
        return () => {
          server.middlewares.use(async (req, res, next) => {
            try {
              const mod = await server.ssrLoadModule('/src/entry-server.tsx')
              await mod.default(req, res)
            } catch (e) {
              next(e)
            }
          })
        }
      },
      async configurePreviewServer(server) {
        const mod = await import(
          new URL('./dist/server/index.js', import.meta.url).href
        )
        return () => {
          server.middlewares.use(async (req, res, next) => {
            try {
              await mod.default(req, res)
            } catch (e) {
              next(e)
            }
          })
        }
      },
    },
    {
      name: 'virtuals',
      sharedDuringBuild: true,
      resolveId(source) {
        if (
          ['virtual:client-entry.js', 'virtual:ssr-assets'].includes(source)
        ) {
          return '\0' + source
        }
      },
      load(id) {
        if (id === '\0virtual:client-entry.js') {
          // inject preamble to client entry to ensure hmr globals
          if (this.environment.mode === 'dev') {
            return `\
              ${react.preambleCode.replace('__BASE__', '/')};
              import("/src/entry-client.tsx");
            `
          }
          return 'import "/src/entry-client.tsx"'
        }
        // switch bootstrapModules for dev and prod
        if (id === '\0virtual:ssr-assets') {
          const bootstrapModules: string[] = []
          if (this.environment.mode === 'dev') {
            bootstrapModules.push('/@id/__x00__virtual:client-entry.js')
          } else {
            const entry = __browserManifest['virtual:client-entry.js']
            bootstrapModules.push(`/${entry.file}`)
          }
          return `export const bootstrapModules = ${JSON.stringify(
            bootstrapModules,
          )}`
        }
      },
      writeBundle(_options, bundle) {
        if (this.environment.name === 'client') {
          const output = bundle['.vite/manifest.json']
          assert(output.type === 'asset')
          assert(typeof output.source === 'string')
          ;(globalThis as any).__browserManifest = JSON.parse(output.source)
        }
      },
    },
  ],
  builder: {
    async buildApp(builder) {
      await builder.build(builder.environments.client)
      await builder.build(builder.environments.ssr)
    },
  },
})
