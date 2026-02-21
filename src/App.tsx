import React, { useState, useRef, useEffect, type ChangeEvent, type DragEvent } from 'react'
import { GoogleGenAI, Type } from '@google/genai'
import { CATEGORIES, CATEGORY_LIST } from './categories'

interface ClassificationResult {
  category: string
  subcategory: string
  type: string
  confidence: number
  pivot: string
}

// --- DYNAMIC BLUR BASED ON FACE ORIENTATION ---

const FACE_NORMALS: Record<string, [number, number, number]> = {
  front:  [0,  0,  1],
  back:   [0,  0, -1],
  right:  [1,  0,  0],
  left:   [-1, 0,  0],
  top:    [0, -1,  0], // CSS Y-down: "up" = -Y
  bottom: [0,  1,  0],
}

function getFaceBlur(face: string, rxDeg: number, ryDeg: number, maxBlur = 2.0): number {
  const rx = (rxDeg * Math.PI) / 180
  const ry = (ryDeg * Math.PI) / 180
  const [nx, ny, nz] = FACE_NORMALS[face] ?? [0, 0, 1]
  // apply rotateX(rx)
  const ny1 = ny * Math.cos(rx) - nz * Math.sin(rx)
  const nz1 = ny * Math.sin(rx) + nz * Math.cos(rx)
  // apply rotateY(ry) — only need z component (dot with view dir)
  const nz2 = -nx * Math.sin(ry) + nz1 * Math.cos(ry)
  return Math.max(0, -nz2) * maxBlur
}

// --- PIVOT CUBE VISUALIZATION ---

type FacePos = { face: string; x: string; y: string; half?: 'top' | 'bottom' | 'left' | 'right' | 'cornerTR' | 'cornerTL' | 'cornerBR' | 'cornerBL' }

const halfStyles: Record<string, React.CSSProperties> = {
  top:      { height: 10, borderRadius: '10px 10px 0 0', transform: 'translate(-50%, -100%)' },
  bottom:   { height: 10, borderRadius: '0 0 10px 10px', transform: 'translate(-50%, 0%)'    },
  left:     { width:  10, borderRadius: '0 10px 10px 0', transform: 'translate(0%, -50%)'    },
  right:    { width:  10, borderRadius: '10px 0 0 10px', transform: 'translate(-100%, -50%)' },
  // quarter circles for cube corners — extend toward face interior
  cornerTR: { width: 10, height: 10, borderRadius: '0 10px 0 0', transform: 'translate(0%, -100%)'    }, // right+up
  cornerTL: { width: 10, height: 10, borderRadius: '10px 0 0 0', transform: 'translate(-100%, -100%)' }, // left+up
  cornerBR: { width: 10, height: 10, borderRadius: '0 0 10px 0', transform: 'translate(0%, 0%)'       }, // right+down
  cornerBL: { width: 10, height: 10, borderRadius: '0 0 0 10px', transform: 'translate(-100%, 0%)'    }, // left+down
}

const pivotCodeMap: Record<string, FacePos[]> = {
  'A':   [{ face: 'front',  x: '50%', y: '50%'  }],
  // Corners — marker wraps across all 3 meeting faces
  // Face coord systems (derived from E1/E3/E11):
  //   front/back: x=0%=left*, y=0%=top, y=100%=bottom  (*back x is mirrored in world, same in local)
  //   top/bottom: x=0%=left, x=100%=right, y=0%=back, y=100%=front
  //   right: x=0%=front, x=100%=back, y=0%=top, y=100%=bottom
  //   left:  x=0%=back,  x=100%=front, y=0%=top, y=100%=bottom
  // Quarter rule: at (0%,?)=cornerTR/BR, at (100%,?)=cornerTL/BL; at (?,0%)=cornerBR/BL, at (?,100%)=cornerTR/TL
  'C1':  [{ face: 'bottom', x: '0%',   y: '100%', half: 'cornerTR' }, { face: 'front',  x: '0%',   y: '100%', half: 'cornerTR' }, { face: 'left',  x: '100%', y: '100%', half: 'cornerTL' }],
  'C2':  [{ face: 'bottom', x: '100%', y: '100%', half: 'cornerTL' }, { face: 'front',  x: '100%', y: '100%', half: 'cornerTL' }, { face: 'right', x: '0%',   y: '100%', half: 'cornerTR' }],
  'C3':  [{ face: 'bottom', x: '100%', y: '0%',   half: 'cornerBL' }, { face: 'back',   x: '0%',   y: '100%', half: 'cornerTR' }, { face: 'right', x: '100%', y: '100%', half: 'cornerTL' }],
  'C4':  [{ face: 'bottom', x: '0%',   y: '0%',   half: 'cornerBR' }, { face: 'back',   x: '100%', y: '100%', half: 'cornerTL' }, { face: 'left',  x: '0%',   y: '100%', half: 'cornerTR' }],
  'C5':  [{ face: 'top',    x: '0%',   y: '100%', half: 'cornerTR' }, { face: 'front',  x: '0%',   y: '0%',   half: 'cornerBR' }, { face: 'left',  x: '100%', y: '0%',   half: 'cornerBL' }],
  'C6':  [{ face: 'top',    x: '100%', y: '100%', half: 'cornerTL' }, { face: 'front',  x: '100%', y: '0%',   half: 'cornerBL' }, { face: 'right', x: '0%',   y: '0%',   half: 'cornerBR' }],
  'C7':  [{ face: 'top',    x: '100%', y: '0%',   half: 'cornerBL' }, { face: 'back',   x: '0%',   y: '0%',   half: 'cornerBR' }, { face: 'right', x: '100%', y: '0%',   half: 'cornerBL' }],
  'C8':  [{ face: 'top',    x: '0%',   y: '0%',   half: 'cornerBR' }, { face: 'back',   x: '100%', y: '0%',   half: 'cornerBL' }, { face: 'left',  x: '0%',   y: '0%',   half: 'cornerBR' }],
  'E1':  [
    { face: 'bottom', x: '50%', y: '100%', half: 'top'    },
    { face: 'front',  x: '50%', y: '100%', half: 'top'    },
  ],
  'E2':  [{ face: 'bottom', x: '100%', y: '50%' }],
  'E3':  [
    { face: 'bottom', x: '50%', y: '0%',   half: 'bottom' },
    { face: 'back',   x: '50%', y: '100%', half: 'top'    },
  ],
  'E4':  [{ face: 'bottom', x: '0%', y: '50%' }],
  'E5':  [{ face: 'front',  x: '100%', y: '50%' }],
  'E6':  [{ face: 'right',  x: '50%',  y: '100%' }],
  'E7':  [{ face: 'back',   x: '100%', y: '50%' }],
  'E8':  [{ face: 'left',   x: '50%',  y: '100%' }],
  'E9':  [{ face: 'front',  x: '50%',  y: '0%'  }],
  'E10': [{ face: 'right',  x: '50%',  y: '0%'  }],
  'E11': [
    { face: 'top',    x: '50%', y: '0%',   half: 'bottom' },
    { face: 'back',   x: '50%', y: '0%',   half: 'bottom' },
  ],
  'E12': [{ face: 'left',   x: '50%', y: '0%' }],
  'S1':  [{ face: 'bottom', x: '50%', y: '50%'  }],
  'S2':  [{ face: 'front',  x: '50%', y: '50%'  }],
  'S3':  [{ face: 'right',  x: '50%', y: '50%'  }],
  'S4':  [{ face: 'back',   x: '50%', y: '50%'  }],
  'S5':  [{ face: 'left',   x: '50%', y: '50%'  }],
  'S6':  [{ face: 'top',    x: '50%', y: '50%'  }],
}

const parsePivotPositions = (pivot: string): FacePos[] => {
  if (!pivot) return []
  // Direct code lookup (new format: "S1", "E3", "C4", "A")
  if (pivotCodeMap[pivot]) return pivotCodeMap[pivot]
  // Legacy: code in parentheses "(E3)"
  const codeMatch = pivot.match(/\b(C|E|S|A)\d*\b/)
  if (codeMatch && pivotCodeMap[codeMatch[0]]) return pivotCodeMap[codeMatch[0]]
  return [{ face: 'bottom', x: '50%', y: '50%' }]
}

const PivotCube = ({ pivot, isDark }: { pivot: string; isDark: boolean }) => {
  const positions = parsePivotPositions(pivot)
  const faces = [
    { name: 'front', label: 'Front' },
    { name: 'back', label: 'Back' },
    { name: 'top', label: 'Top' },
    { name: 'bottom', label: 'Bottom' },
    { name: 'left', label: 'Left' },
    { name: 'right', label: 'Right' },
  ]

  const [rotation, setRotation] = useState({ x: -22, y: -28 })
  const [isReturning, setIsReturning] = useState(false)
  const dragging = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return
      const dx = e.clientX - lastPos.current.x
      const dy = e.clientY - lastPos.current.y
      lastPos.current = { x: e.clientX, y: e.clientY }
      setRotation(prev => ({
        x: Math.max(-85, Math.min(0, prev.x - dy * 0.5)),
        y: prev.y + dx * 0.5,
      }))
    }
    const onMouseUp = () => {
      dragging.current = false
      setIsReturning(true)
      setRotation({ x: -22, y: -28 })
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  const onMouseDown = (e: React.MouseEvent) => {
    dragging.current = true
    setIsReturning(false)
    lastPos.current = { x: e.clientX, y: e.clientY }
  }

  return (
    <div className="flex flex-col items-center mt-6">
      <div
        className="cube-container"
        data-dark={String(isDark)}
        onMouseDown={onMouseDown}
      >
        <div
          className="cube"
          style={{
            transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`,
            transition: isReturning ? 'transform 0.6s ease' : 'none',
          }}
        >
          {faces.map(({ name, label }) => (
            <div
              key={name}
              className={`cube-face ${name}`}
              style={{ filter: `blur(${getFaceBlur(name, rotation.x, rotation.y).toFixed(2)}px)` }}
            >
              {label}
              {positions.filter(p => p.face === name).map((p, i) => (
                <div
                  key={i}
                  className="pivot-point"
                  style={{ left: p.x, top: p.y, ...(p.half ? halfStyles[p.half] : { borderRadius: '50%' }) }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className={`mt-4 p-4 rounded-lg text-center w-full shadow-inner ${isDark ? 'bg-[#404040]' : 'bg-gray-100'}`}>
        <p className={`text-sm font-semibold ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Pivot Point:</p>
        <p className={`text-base font-mono ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{pivot}</p>
      </div>
    </div>
  )
}

// --- LOADING INDICATOR ---

const stageLabels = ['', 'Scanning image...', 'Classifying objects...']

function LoadingIndicator({ stage, isDark }: { stage: 1 | 2; isDark: boolean }) {
  const accent = isDark ? '#c8963c' : '#c8963c'
  return (
    <div className="flex flex-col items-center justify-center mt-8 space-y-4">
      <svg className={`animate-spin h-8 w-8 ${isDark ? '' : 'text-blue-500'}`} style={accent ? { color: accent } : undefined} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
      </svg>
      <p className="text-lg text-gray-500">{stageLabels[stage]}</p>
      <div className="flex space-x-2">
        {[1, 2].map(s => (
          <div
            key={s}
            className={`h-2 w-8 rounded-full transition-all duration-300 ${s <= stage ? '' : 'opacity-30'} ${isDark ? '' : s <= stage ? 'bg-blue-500' : 'bg-blue-300'}`}
            style={isDark ? { backgroundColor: accent } : undefined}
          />
        ))}
      </div>
    </div>
  )
}

// --- RESULT DISPLAY ---

interface ResultDisplayProps {
  loadingStage: 0 | 1 | 2 | 3
  error: string | null
  notFound: boolean
  results: ClassificationResult[]
  selectedResultIndex: number | null
  copiedType: string | null
  isDark: boolean
  onCopy: (type: string) => void
  onSelectResult: (index: number) => void
}

function ResultDisplay({
  loadingStage, error, notFound, results, selectedResultIndex,
  copiedType, isDark, onCopy, onSelectResult,
}: ResultDisplayProps) {
  if (loadingStage > 0) {
    return <LoadingIndicator stage={loadingStage as 1 | 2} isDark={isDark} />
  }

  if (error) {
    return <p className="mt-8 text-center text-red-400 bg-red-900/20 p-4 rounded-lg">{error}</p>
  }

  if (notFound) {
    return <p className={`mt-8 text-center text-2xl font-semibold ${isDark ? 'text-gray-400' : 'text-gray-700'}`}>Not found</p>
  }

  if (results.length > 0) {
    return (
      <div className="w-full">
        <h2 className={`text-base font-semibold mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Found:</h2>
        <ul className={`border rounded-lg p-1 max-h-[50vh] overflow-y-auto ${isDark ? 'border-gray-600' : 'border-gray-200'}`}>
          {results.map((result, index) => (
            <li
              key={index}
              onClick={() => onSelectResult(index)}
              className={`flex items-center justify-between px-2 py-1 rounded transition-all duration-150 cursor-pointer
                ${selectedResultIndex === index
                  ? isDark ? 'bg-blue-900/40 border-l-2 border-blue-400' : 'bg-blue-100 border-l-2 border-blue-500'
                  : isDark ? 'hover:bg-[#444]' : 'hover:bg-blue-50'
                } ${isDark ? 'text-gray-100' : 'text-gray-800'}`}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && onSelectResult(index)}
            >
              <span className="font-mono text-xs truncate mr-2">{result.type}</span>
              <div className="flex items-center space-x-1.5 flex-shrink-0">
                <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${isDark ? 'text-blue-400 bg-blue-900/30' : 'text-blue-700 bg-blue-100'}`}>
                  {Math.round(result.confidence * 100)}%
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); onCopy(result.type) }}
                  className={`transition-colors ${isDark ? 'text-gray-600 hover:text-gray-300' : 'text-gray-300 hover:text-gray-600'}`}
                  aria-label={`Copy ${result.type}`}
                >
                  {copiedType === result.type ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
  const [loadingStage, setLoadingStage] = useState<0 | 1 | 2 | 3>(0)
  const [results, setResults] = useState<ClassificationResult[]>([])
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [copiedType, setCopiedType] = useState<string | null>(null)
  const [selectedResultIndex, setSelectedResultIndex] = useState<number | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [usedModel, setUsedModel] = useState<string | null>(null)
  const [everExpanded, setEverExpanded] = useState(false)

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
      setEverExpanded(true)
    } else {
      setError('Please provide an image file.')
    }
  }

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file) { handleFile(file); break }
        }
      }
    }
    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [])

  const handleDragEnter = (e: DragEvent<HTMLLabelElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true) }
  const handleDragLeave = (e: DragEvent<HTMLLabelElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false) }
  const handleDragOver = (e: DragEvent<HTMLLabelElement>) => { e.preventDefault(); e.stopPropagation() }
  const handleDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  const handleCopy = (type: string) => {
    navigator.clipboard.writeText(type)
    setCopiedType(type)
    setTimeout(() => setCopiedType(null), 2000)
  }

  const handleClassify = async () => {
    if (!imageFile) { setError('Please select an image first.'); return }

    setLoadingStage(1)
    setError(null)
    setResults([])
    setNotFound(false)
    setSelectedResultIndex(null)
    setUsedModel(null)

    try {
      const ai = new GoogleGenAI({ apiKey })
      const imagePart = await fileToGenerativePart(imageFile)

      const pool = selectedCategory ? CATEGORIES.filter(c => c.category === selectedCategory) : CATEGORIES
      const pivotMap = new Map(pool.map(item => [item.type, item.pivot]))
      const typeList = pool.map(c => c.type).join('\n')

      const prompt = `Analyze the image and identify all objects shown. From the following list of types, select all that apply. For each match provide a confidence score (0–1). Order results from most to least confident. If nothing matches, return an empty array.\n\nTypes:\n${typeList}`
      const schema = {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            results: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  type:       { type: Type.STRING },
                  confidence: { type: Type.NUMBER },
                },
                required: ['type', 'confidence'],
              },
            },
          },
        },
      }

      const models = ['gemini-2.5-flash', 'gemini-2.0-flash']
      let response = null
      let activeModel = models[0]
      for (const model of models) {
        try {
          response = await ai.models.generateContent({
            model,
            contents: { parts: [imagePart, { text: prompt }] },
            config: schema,
          })
          activeModel = model
          break
        } catch (err) {
          const is429 = err instanceof Error && err.message.includes('429')
          if (is429 && model !== models[models.length - 1]) continue
          throw err
        }
      }
      setUsedModel(activeModel)

      const parsed = JSON.parse(response!.text ?? '{}')
      const typeResults: { type: string; confidence: number }[] = parsed.results ?? []

      if (typeResults.length === 0) {
        setNotFound(true)
        return
      }

      const finalResults: ClassificationResult[] = typeResults.map(r => ({
        category: '',
        subcategory: '',
        type: r.type,
        confidence: r.confidence,
        pivot: pivotMap.get(r.type) ?? 'S1',
      }))

      setResults(finalResults)
      setSelectedResultIndex(0)
    } catch (err) {
      console.error(err)
      const msg = err instanceof Error ? err.message : ''
      if (msg.includes('429') || msg.includes('quota') || msg.includes('limit')) {
        setError(
          selectedCategory === null
            ? 'Daily token quota exceeded. Select a specific category (not ALL) to reduce token usage, or try again after midnight Pacific Time.'
            : 'Daily token quota exceeded. Try again after midnight Pacific Time.'
        )
      } else {
        setError(`Error: ${msg || 'An unexpected error occurred.'}`)
      }
    } finally {
      setLoadingStage(0)
    }
  }

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center p-4 md:p-8 ${isDark ? 'bg-[#282828]' : 'bg-gray-100'}`}>
      <div className={`p-8 rounded-2xl shadow-xl w-full mx-auto min-h-[720px] ${everExpanded ? 'transition-[max-width] duration-500 ease-out' : ''} ${imageUrl ? 'max-w-6xl' : 'max-w-[600px]'} ${isDark ? 'bg-[#333333]' : 'bg-white'}`}>
        <div className="flex gap-8 items-start">
          {/* Left: Title + Uploader — fixed width, never reflows */}
          <div className="w-[536px] shrink-0 min-h-[656px]">
            {/* Title row */}
            <div className="flex items-center justify-between mb-3">
              <h1 className={`text-2xl font-bold ${isDark ? '' : 'text-gray-800'}`} style={isDark ? { color: '#c8963c' } : undefined}>
                Nfinite category classifier
              </h1>
              <div className="flex items-center gap-1">
                <button
                  onClick={onToggleTheme}
                  className={`p-2 rounded-lg transition-colors ${isDark ? 'text-gray-400 hover:text-gray-200 hover:bg-[#444]' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
                  title={isDark ? 'Light theme' : 'Dark theme'}
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
                  onClick={() => {
                    if (window.confirm('Reset API key?'))
                      if (window.confirm('Are you sure? You will need to enter it again.'))
                        onResetKey()
                  }}
                  className={`text-xs underline px-1 transition-colors ${isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  API key
                </button>
              </div>
            </div>
            <p className={`text-sm mb-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              Upload, drag & drop, or paste (Ctrl+V) an image.
            </p>

            <label
              htmlFor="file-upload"
              className="w-full cursor-pointer"
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
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
              disabled={!imageFile || loadingStage > 0}
              className={`mt-6 w-full font-bold py-3 px-4 rounded-lg disabled:bg-gray-600 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-[1.01] focus:outline-none focus:ring-2 focus:ring-opacity-50 ${isDark ? 'text-black focus:ring-[#c8963c]' : 'text-white bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'}`}
              style={isDark ? { backgroundColor: '#c8963c' } : undefined}
              onMouseEnter={e => { if (isDark) (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#b07e2e' }}
              onMouseLeave={e => { if (isDark) (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#c8963c' }}
            >
              {loadingStage > 0
                ? stageLabels[loadingStage]
                : selectedCategory ? `Classify in ${selectedCategory}` : 'CLASSIFY IMAGE'}
            </button>

            {/* Category filter chips */}
            <div className="mt-4">
              <p className={`text-xs mb-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Filter by category:</p>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setSelectedCategory(null)}
                  className={`flex-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    selectedCategory === null
                      ? isDark ? 'text-black' : 'bg-amber-600/80 text-white'
                      : isDark ? 'bg-[#444] text-gray-500 hover:bg-[#555]' : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
                  }`}
                  style={isDark && selectedCategory === null ? { backgroundColor: '#c8963c' } : undefined}
                >
                  ALL
                </button>
                {CATEGORY_LIST.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat === selectedCategory ? null : cat)}
                    className={`flex-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                      selectedCategory === cat
                        ? isDark ? 'text-black' : 'bg-blue-600 text-white'
                        : isDark ? 'bg-[#444] text-gray-300 hover:bg-[#555]' : 'bg-gray-300 text-gray-800 hover:bg-gray-400'
                    }`}
                    style={isDark && selectedCategory === cat ? { backgroundColor: '#c8963c' } : undefined}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
            {selectedCategory === null && (
              <p className={`mt-4 text-sm font-medium ${isDark ? 'text-amber-500/80' : 'text-amber-700'}`}>
                ⚠ Select a category to save tokens
              </p>
            )}
          </div>

          {/* Right: Results and Cube — appears when image is selected */}
          {imageUrl && (
          <div className="flex-1 min-w-0 flex flex-col space-y-6">
            <div className="flex-grow min-h-[100px]">
              <ResultDisplay
                loadingStage={loadingStage}
                error={error}
                notFound={notFound}
                results={results}
                selectedResultIndex={selectedResultIndex}
                copiedType={copiedType}
                isDark={isDark}
                onCopy={handleCopy}
                onSelectResult={setSelectedResultIndex}
              />
            </div>
            {usedModel === 'gemini-2.0-flash' && (
              <p className="mt-2 text-xs text-center text-amber-500">
                ⚠ Rate limit reached — switched to gemini-2.0-flash
              </p>
            )}
            {selectedResultIndex !== null && results[selectedResultIndex] && (
              <div className="mt-4">
                <PivotCube pivot={results[selectedResultIndex].pivot} isDark={isDark} />
              </div>
            )}
          </div>
          )}
        </div>
      </div>
    </div>
  )
}
