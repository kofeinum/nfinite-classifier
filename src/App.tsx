import { useState, type ChangeEvent, type DragEvent } from 'react'
import { GoogleGenAI, Type } from '@google/genai'
import { CATEGORIES } from './categories'

interface ClassificationResult {
  category: string
  confidence: number
  pivot: string
}

// --- PIVOT CUBE VISUALIZATION ---

const pivotCodeMap: Record<string, { face: string; x: string; y: string }> = {
  'C1': { face: 'bottom', x: '0%', y: '100%' },
  'C2': { face: 'bottom', x: '100%', y: '100%' },
  'C3': { face: 'bottom', x: '100%', y: '0%' },
  'C4': { face: 'bottom', x: '0%', y: '0%' },
  'C7': { face: 'top', x: '100%', y: '0%' },
  'C8': { face: 'top', x: '0%', y: '0%' },
  'E1': { face: 'bottom', x: '50%', y: '100%' },
  'E3': { face: 'bottom', x: '50%', y: '0%' },
  'E11': { face: 'top', x: '50%', y: '0%' },
  'S1': { face: 'bottom', x: '50%', y: '50%' },
  'S4': { face: 'back', x: '50%', y: '50%' },
  'S6': { face: 'top', x: '50%', y: '50%' },
}

const parsePivotPosition = (pivot: string): { face: string; x: string; y: string } | null => {
  if (!pivot) return null

  const codeMatch = pivot.match(/\((C|E|S|A)\d*\)/)
  if (codeMatch) {
    const code = codeMatch[0].replace(/[()]/g, '')
    if (pivotCodeMap[code]) return pivotCodeMap[code]
  }

  const lowerPivot = pivot.toLowerCase()
  let face = 'bottom'
  if (lowerPivot.includes('back')) face = 'back'
  else if (lowerPivot.includes('front')) face = 'front'
  else if (lowerPivot.includes('left')) face = 'left'
  else if (lowerPivot.includes('right')) face = 'right'
  else if (lowerPivot.includes('top')) face = 'top'

  let x = '50%'
  if (lowerPivot.includes('left')) x = '0%'
  else if (lowerPivot.includes('right')) x = '100%'

  let y = '50%'
  if (face === 'top' || face === 'bottom') {
    if (lowerPivot.includes('back')) y = '0%'
    else if (lowerPivot.includes('front')) y = '100%'
  } else {
    if (lowerPivot.includes('top')) y = '0%'
    else if (lowerPivot.includes('bottom')) y = '100%'
  }

  if (lowerPivot.includes('center') || lowerPivot.includes('middle')) {
    x = '50%'
    y = '50%'
  }

  return { face, x, y }
}

const PivotCube = ({ pivot, isDark }: { pivot: string; isDark: boolean }) => {
  const position = parsePivotPosition(pivot)
  const faces = [
    { name: 'front', label: 'Front' },
    { name: 'back', label: 'Back' },
    { name: 'top', label: 'Top' },
    { name: 'bottom', label: 'Bottom' },
    { name: 'left', label: 'Left' },
    { name: 'right', label: 'Right' },
  ]

  return (
    <div className="flex flex-col items-center mt-6">
      <div className="cube-container">
        <div className="cube">
          {faces.map(({ name, label }) => (
            <div key={name} className={`cube-face ${name}`}>
              {label}
              {position && position.face === name && (
                <div
                  className="pivot-point"
                  style={{ left: position.x, top: position.y }}
                  aria-label={`Pivot point at ${position.x}, ${position.y} on the ${name} face`}
                />
              )}
            </div>
          ))}
        </div>
      </div>
      <div className={`mt-4 p-4 rounded-lg text-center w-full shadow-inner ${isDark ? 'bg-[#404040]' : 'bg-gray-100'}`}>
        <p className={`text-sm font-semibold ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Pivot Point:</p>
        <p className={`text-base font-mono break-words ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{pivot}</p>
      </div>
    </div>
  )
}

// --- RESULT DISPLAY ---

interface ResultDisplayProps {
  isLoading: boolean
  error: string | null
  notFound: boolean
  results: ClassificationResult[]
  selectedResultIndex: number | null
  copiedCategory: string | null
  isDark: boolean
  onCopy: (category: string) => void
  onSelectResult: (index: number) => void
}

function ResultDisplay({
  isLoading, error, notFound, results, selectedResultIndex,
  copiedCategory, isDark, onCopy, onSelectResult,
}: ResultDisplayProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center text-gray-500 mt-8 h-full">
        <svg className="animate-spin h-8 w-8 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <p className="mt-2 text-lg">Analyzing...</p>
      </div>
    )
  }

  if (error) {
    return <p className="mt-8 text-center text-red-400 bg-red-900/20 p-4 rounded-lg">{error}</p>
  }

  if (notFound) {
    return <p className={`mt-8 text-center text-2xl font-semibold ${isDark ? 'text-gray-400' : 'text-gray-700'}`}>не нашел</p>
  }

  if (results.length > 0) {
    return (
      <div className="w-full">
        <h2 className={`text-2xl font-bold mb-4 text-center ${isDark ? 'text-gray-100' : 'text-gray-800'}`}>Found Categories:</h2>
        <ul className={`border rounded-lg space-y-2 p-2 max-h-[50vh] overflow-y-auto ${isDark ? 'border-gray-600' : 'border-gray-200'}`}>
          {results.map((result, index) => (
            <li
              key={index}
              onClick={() => onSelectResult(index)}
              className={`flex items-center justify-between p-3 rounded-lg transition-all duration-200 cursor-pointer
                ${selectedResultIndex === index
                  ? isDark ? 'bg-blue-900/40 border-l-4 border-blue-400' : 'bg-blue-100 border-l-4 border-blue-500'
                  : isDark ? 'bg-[#3a3a3a] hover:bg-[#444]' : 'bg-white hover:bg-blue-50'
                } ${isDark ? 'text-gray-100' : 'text-gray-800'}`}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && onSelectResult(index)}
            >
              <span className="font-mono font-medium text-sm md:text-base">{result.category}</span>
              <div className="flex items-center space-x-3">
                <span className="text-xs font-semibold text-blue-400 bg-blue-900/30 px-2.5 py-1 rounded-full">
                  {Math.round(result.confidence * 100)}%
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); onCopy(result.category) }}
                  className={`transition-colors ${isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`}
                  aria-label={`Copy category ${result.category}`}
                >
                  {copiedCategory === result.category ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  )}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  return null
}

// --- MAIN APP ---

interface AppProps {
  apiKey: string
  isDark: boolean
  onToggleTheme: () => void
  onResetKey: () => void
}

export function App({ apiKey, isDark, onToggleTheme, onResetKey }: AppProps) {
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [results, setResults] = useState<ClassificationResult[]>([])
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [copiedCategory, setCopiedCategory] = useState<string | null>(null)
  const [selectedResultIndex, setSelectedResultIndex] = useState<number | null>(null)

  async function fileToGenerativePart(file: File) {
    const base64EncodedDataPromise = new Promise<string>((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve((reader.result as string).split(',')[1])
      reader.readAsDataURL(file)
    })
    return {
      inlineData: { data: await base64EncodedDataPromise, mimeType: file.type },
    }
  }

  const handleFile = (file: File) => {
    if (file && file.type.startsWith('image/')) {
      setImageFile(file)
      setImageUrl(URL.createObjectURL(file))
      setResults([])
      setError(null)
      setNotFound(false)
      setSelectedResultIndex(null)
    } else {
      setError('Please provide an image file.')
    }
  }

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  const handleDragEnter = (e: DragEvent<HTMLLabelElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true) }
  const handleDragLeave = (e: DragEvent<HTMLLabelElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false) }
  const handleDragOver = (e: DragEvent<HTMLLabelElement>) => { e.preventDefault(); e.stopPropagation() }
  const handleDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  const handleCopy = (category: string) => {
    navigator.clipboard.writeText(category)
    setCopiedCategory(category)
    setTimeout(() => setCopiedCategory(null), 2000)
  }

  const handleClassify = async () => {
    if (!imageFile) { setError('Please select an image first.'); return }

    setIsLoading(true)
    setError(null)
    setResults([])
    setNotFound(false)
    setSelectedResultIndex(null)

    try {
      const ai = new GoogleGenAI({ apiKey })
      const imagePart = await fileToGenerativePart(imageFile)
      const pivotMap = new Map(CATEGORIES.map(item => [item.category, item.pivot]))

      const prompt = `Analyze the image and identify the object(s) shown. From the following list of categories, please select all that apply. For each category, provide a confidence score between 0 and 1 indicating how certain you are of the match. Order the results from most to least relevant. If none of the categories apply, return an empty array.

Categories:
${CATEGORIES.map(c => c.category).join('\n')}`

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
          parts: [imagePart, { text: prompt }],
        },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              categories: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    category: { type: Type.STRING },
                    confidence: { type: Type.NUMBER },
                  },
                  required: ['category', 'confidence'],
                },
              },
            },
          },
        },
      })

      const classified = JSON.parse(response.text ?? '')

      if (classified.categories?.length > 0) {
        const categoriesWithPivots = classified.categories.map((result: { category: string; confidence: number }) => ({
          ...result,
          pivot: pivotMap.get(result.category) || 'Pivot information not available.',
        }))
        setResults(categoriesWithPivots)
        setSelectedResultIndex(0)
      } else {
        setNotFound(true)
      }
    } catch (err) {
      console.error(err)
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred.'
      setError(`Error: ${errorMessage}`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center p-4 md:p-8 ${isDark ? 'bg-[#282828]' : 'bg-gray-100'}`}>
      <div className={`p-8 rounded-2xl shadow-xl w-full max-w-6xl mx-auto ${isDark ? 'bg-[#333333]' : 'bg-white'}`}>
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3">
            <h1 className={`text-4xl font-bold mb-2 ${isDark ? 'text-gray-100' : 'text-gray-800'}`}>
              Nfinite category classifier
            </h1>
            <button
              onClick={onToggleTheme}
              className={`p-2 rounded-lg mb-2 transition-colors ${isDark ? 'text-gray-400 hover:text-gray-200 hover:bg-[#444]' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
              title={isDark ? 'Светлая тема' : 'Тёмная тема'}
            >
              {isDark ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364-.707.707M6.343 17.657l-.707.707m12.728 0-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
            <button
              onClick={onResetKey}
              className={`text-xs underline mb-2 transition-colors ${isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`}
              title="Изменить API key"
            >
              API key
            </button>
          </div>
          <p className={isDark ? 'text-gray-400' : 'text-gray-500'}>Upload an image to classify it into a category.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          {/* Left Column: Uploader */}
          <div className="w-full">
            <label
              htmlFor="file-upload"
              className="w-full cursor-pointer"
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              aria-label="Image upload drop zone"
            >
              <div className={`flex justify-center rounded-lg border border-dashed px-6 py-10 transition-colors duration-300
                ${isDragging
                  ? 'border-blue-500 bg-blue-900/20'
                  : isDark ? 'border-gray-600 hover:border-gray-400' : 'border-gray-900/25 hover:border-gray-400'
                }`}>
                {imageUrl ? (
                  <img src={imageUrl} alt="Preview" className="max-h-64 rounded-lg object-contain" />
                ) : (
                  <div className="text-center">
                    <svg className={`mx-auto h-12 w-12 ${isDark ? 'text-gray-600' : 'text-gray-300'}`} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M1.5 6a2.25 2.25 0 012.25-2.25h16.5A2.25 2.25 0 0122.5 6v12a2.25 2.25 0 01-2.25 2.25H3.75A2.25 2.25 0 011.5 18V6zM3 16.06V18c0 .414.336.75.75.75h16.5A.75.75 0 0021 18v-1.94l-2.69-2.689a1.5 1.5 0 00-2.12 0l-.88.879.97.97a.75.75 0 11-1.06 1.06l-5.16-5.159a1.5 1.5 0 00-2.12 0L3 16.061zm10.125-7.81a1.125 1.125 0 112.25 0 1.125 1.125 0 01-2.25 0z" clipRule="evenodd" />
                    </svg>
                    <div className="mt-4 flex text-sm leading-6 justify-center">
                      <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>Click to upload or drag and drop</p>
                    </div>
                    <p className={`text-xs leading-5 ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>PNG, JPG, etc.</p>
                  </div>
                )}
              </div>
            </label>
            <input id="file-upload" name="file-upload" type="file" className="sr-only" accept="image/*" onChange={handleImageChange} />

            <button
              onClick={handleClassify}
              disabled={!imageFile || isLoading}
              className="mt-6 w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
              aria-label="Classify uploaded image"
            >
              {isLoading ? 'Analyzing...' : 'Classify Image'}
            </button>
          </div>

          {/* Right Column: Results and Cube */}
          <div className="flex flex-col space-y-6">
            <div className="flex-grow min-h-[100px]">
              <ResultDisplay
                isLoading={isLoading}
                error={error}
                notFound={notFound}
                results={results}
                selectedResultIndex={selectedResultIndex}
                copiedCategory={copiedCategory}
                isDark={isDark}
                onCopy={handleCopy}
                onSelectResult={setSelectedResultIndex}
              />
            </div>
            {selectedResultIndex !== null && results[selectedResultIndex] && (
              <div className="mt-4">
                <PivotCube pivot={results[selectedResultIndex].pivot} isDark={isDark} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
