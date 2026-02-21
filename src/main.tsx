import { useState } from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import { ApiKeySetup } from './ApiKeySetup'
import './index.css'

function Root() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('gemini-api-key') || '')
  const [isDark, setIsDark] = useState(() => localStorage.getItem('theme') !== 'light')

  const toggleTheme = () => {
    const next = !isDark
    setIsDark(next)
    localStorage.setItem('theme', next ? 'dark' : 'light')
  }

  if (!apiKey) {
    return (
      <ApiKeySetup
        isDark={isDark}
        onToggleTheme={toggleTheme}
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
      isDark={isDark}
      onToggleTheme={toggleTheme}
      onResetKey={() => {
        localStorage.removeItem('gemini-api-key')
        setApiKey('')
      }}
    />
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(<Root />)
