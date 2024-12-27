import type { IncomingMessage, ServerResponse } from 'node:http'
import ReactDOMServer from 'react-dom/server'
import { App } from './App'

export default async function handler(
  _req: IncomingMessage,
  res: ServerResponse,
) {
  // @ts-ignore
  const { bootstrapModules } = await import('virtual:ssr-assets')
  const stream = ReactDOMServer.renderToPipeableStream(<Document />, {
    bootstrapModules,
    onShellReady() {
      res.setHeader('content-type', 'text/html')
      stream.pipe(res)
    },
  })
}

function Document() {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Vite App</title>
      </head>
      <body>
        <div id="app">
          <App />
        </div>
      </body>
    </html>
  )
}
