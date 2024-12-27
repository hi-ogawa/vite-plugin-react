import React from 'react'

export function App() {
  const [count, setCount] = React.useState(0)

  return (
    <div>
      <h1>SSR Streaming</h1>
      <div>
        <div>Hydated: {String(useHydrated())}</div>
        <div>Count is {count}</div>
        <div>
          <button onClick={() => setCount((c) => c - 1)}>-1</button>
          <button onClick={() => setCount((c) => c + 1)}>+1</button>
        </div>
      </div>
    </div>
  )
}

function useHydrated() {
  return React.useSyncExternalStore(
    React.useCallback(() => () => {}, []),
    () => true,
    () => false,
  )
}
