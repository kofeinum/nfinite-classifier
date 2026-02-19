import { useState, type FormEvent } from 'react'

interface ApiKeySetupProps {
  isDark: boolean
  onToggleTheme: () => void
  onKeySet: (key: string) => void
}

export function ApiKeySetup({ isDark, onToggleTheme, onKeySet }: ApiKeySetupProps) {
  const [key, setKey] = useState('')

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (key.trim()) onKeySet(key.trim())
  }

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 ${isDark ? 'bg-[#282828]' : 'bg-gray-100'}`}>
      <div className={`p-8 rounded-2xl shadow-xl w-full max-w-md ${isDark ? 'bg-[#333333]' : 'bg-white'}`}>
        <div className="flex items-center justify-between mb-4">
          <h1 className={`text-2xl font-bold ${isDark ? 'text-gray-100' : 'text-gray-800'}`}>
            Nfinite Category Classifier
          </h1>
          <button
            onClick={onToggleTheme}
            className={`p-2 rounded-lg transition-colors ${isDark ? 'text-gray-400 hover:text-gray-200 hover:bg-[#444]' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
            title={isDark ? 'Светлая тема' : 'Тёмная тема'}
          >
            {isDark ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364-.707.707M6.343 17.657l-.707.707m12.728 0-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none"/>
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
        </div>
        <p className={`mb-1 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          Для работы приложения нужен Gemini API key.
        </p>
        <p className={`mb-6 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          Получить бесплатно:{' '}
          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:underline"
          >
            aistudio.google.com/apikey
          </a>
        </p>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="AIza..."
            autoComplete="off"
            className={`w-full border rounded-lg px-4 py-3 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm ${isDark ? 'bg-[#444] border-gray-600 text-gray-100 placeholder-gray-500' : 'bg-white border-gray-300 text-gray-900'}`}
          />
          <button
            type="submit"
            disabled={!key.trim()}
            className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            Сохранить и продолжить
          </button>
        </form>
        <p className={`text-xs mt-4 text-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
          Ключ сохраняется только в вашем браузере
        </p>
      </div>
    </div>
  )
}
