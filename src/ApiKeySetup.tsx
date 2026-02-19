import { useState, type FormEvent } from 'react'

interface ApiKeySetupProps {
  onKeySet: (key: string) => void
}

export function ApiKeySetup({ onKeySet }: ApiKeySetupProps) {
  const [key, setKey] = useState('')

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (key.trim()) onKeySet(key.trim())
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Nfinite Category Classifier</h1>
        <p className="text-gray-500 mb-1 text-sm">
          Для работы приложения нужен Gemini API key.
        </p>
        <p className="text-gray-500 mb-6 text-sm">
          Получить бесплатно:{' '}
          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline"
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
            className="w-full border border-gray-300 rounded-lg px-4 py-3 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
          />
          <button
            type="submit"
            disabled={!key.trim()}
            className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            Сохранить и продолжить
          </button>
        </form>
        <p className="text-xs text-gray-400 mt-4 text-center">
          Ключ сохраняется только в вашем браузере
        </p>
      </div>
    </div>
  )
}
