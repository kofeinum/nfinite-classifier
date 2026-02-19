import { useState } from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import { ApiKeySetup } from './ApiKeySetup'
import './index.css'

function Root() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('gemini-api-key') || '')

  if (!apiKey) {
    return (
      <ApiKeySetup
        onKeySet={(key) => {
          localStorage.setItem('gemini-api-key', key)
          setApiKey(key)
        }}
      />
    )
  }

  return (
    <App
      apiKey={apiKey}
      onResetKey={() => {
        localStorage.removeItem('gemini-api-key')
        setApiKey('')
      }}
    />
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(<Root />)
