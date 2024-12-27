import ReactDOM from 'react-dom/client'
import React from 'react'
import { App } from './App'

React.startTransition(() => {
  ReactDOM.hydrateRoot(document.getElementById('app')!, <App />)
})
