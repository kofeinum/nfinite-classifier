import React, { useState, useEffect } from 'react'
import { CATEGORIES } from './categories'
import { PivotCube } from './PivotCube'

// --- TYPE → PIVOT LOOKUP HOOK ---

function useTypePivotLookup(categories: { type: string; pivot: string | null }[]) {
  const [input, setInput] = useState('')
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(0)

  const query = input.toUpperCase().trim()
  const exactEntry = categories.find(c => c.type === query)
  const suggestions = query.length >= 1
    ? categories.filter(c => c.type.includes(query) && c.type !== query)
    : []

  useEffect(() => { setHighlighted(0) }, [input])

  const select = (type: string) => {
    setInput(type)
    setOpen(false)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open || suggestions.length === 0) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted(h => Math.min(h + 1, suggestions.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlighted(h => Math.max(h - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); select(suggestions[highlighted].type) }
    else if (e.key === 'Escape') setOpen(false)
  }

  return { input, setInput, open, setOpen, suggestions, highlighted, setHighlighted, exactEntry, select, onKeyDown }
}

// --- PAGE ---

interface PivotPageProps {
  isDark: boolean
}

export function PivotPage({ isDark }: PivotPageProps) {
  // Начальные данные — статический CATEGORIES (мгновенно). При загрузке страницы
  // тихо заменяются свежими данными из pivot-data.json (генерируется GitHub Actions).
  const [categories, setCategories] = useState<{ type: string; pivot: string | null }[]>(CATEGORIES)
  const [dataStale, setDataStale] = useState(false)

  useEffect(() => {
    fetch('./pivot-data.json')
      .then(r => r.json())
      .then((map: Record<string, string | null>) => {
        const { _updated, ...rest } = map as Record<string, string | null>
        const entries = Object.entries(rest)
        if (entries.length > 0)
          setCategories(entries.map(([type, pivot]) => ({ type, pivot })))
        // Данные считаем устаревшими если обновлялись более 25 часов назад
        if (_updated) {
          const ageMs = Date.now() - new Date(_updated).getTime()
          if (ageMs > 25 * 60 * 60 * 1000) setDataStale(true)
        } else {
          setDataStale(true)
        }
      })
      .catch(() => setDataStale(true))
  }, [])

  const lookup = useTypePivotLookup(categories)

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 ${isDark ? 'bg-[#282828]' : 'bg-gray-100'}`}>
      <div className={`p-8 rounded-2xl shadow-xl w-full max-w-[548px] ${isDark ? 'bg-[#333333]' : 'bg-white'}`}>
        <div className="flex items-center justify-between mb-6">
          <h1 className={`text-2xl font-bold flex items-center gap-2 ${isDark ? '' : 'text-gray-800'}`} style={isDark ? { color: '#c8963c' } : undefined}>
            Pivot lookup
            {dataStale && <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#ef4444', display: 'inline-block', flexShrink: 0 }} />}
          </h1>
        </div>

        <div className="relative">
          <div className="flex gap-2 items-stretch">
            <input
              type="text"
              value={lookup.input}
              onChange={e => { lookup.setInput(e.target.value.toUpperCase()); lookup.setOpen(true) }}
              onFocus={() => { if (lookup.input.length >= 1) lookup.setOpen(true) }}
              onBlur={() => setTimeout(() => lookup.setOpen(false), 150)}
              onKeyDown={lookup.onKeyDown}
              placeholder="PRODUCT_CATEGORY"
              autoComplete="off"
              autoFocus
              style={{ color: /[^\x00-\x7F]/.test(lookup.input) ? '#ef4444' : 'rgb(120, 175, 230)' }}
              className={`flex-1 min-w-0 border rounded-lg px-3 h-[36px] text-lg font-normal font-mono focus:outline-none focus:ring-2 ${
                isDark
                  ? 'bg-[#262626] border-gray-600 placeholder-gray-600 focus:ring-[#c8963c]'
                  : 'bg-[#ebebeb] border-gray-300 placeholder-gray-400 focus:ring-blue-400'
              }`}
            />
            <div className={`w-20 shrink-0 border rounded-lg px-3 h-[36px] flex items-center justify-center text-xl font-mono font-bold transition-colors duration-300 ${
              isDark ? 'bg-[#262626] border-gray-600' : 'bg-[#ebebeb] border-gray-300'
            } ${lookup.exactEntry ? (isDark ? 'text-[#c8963c]' : 'text-blue-700') : (isDark ? 'text-gray-600' : 'text-gray-400')}`}>
              {lookup.exactEntry ? (lookup.exactEntry.pivot ?? 'null') : '—'}
            </div>
          </div>

          {lookup.open && lookup.suggestions.length > 0 && (
            <ul className={`lookup-list absolute z-10 left-0 right-[88px] mt-1 max-h-72 overflow-y-auto rounded-lg border text-sm font-mono ${
              isDark ? 'bg-[#262626] border-gray-700 text-gray-200' : 'bg-[#ebebeb] border-gray-300 text-gray-800'
            }`}>
              {lookup.suggestions.map((s, i) => (
                <li
                  key={s.type}
                  onMouseDown={() => lookup.select(s.type)}
                  onMouseEnter={() => lookup.setHighlighted(i)}
                  className={`px-3 py-px cursor-pointer flex justify-between items-center transition-colors duration-100 ${
                    i === lookup.highlighted
                      ? isDark ? 'bg-[#323232]' : 'bg-[#d8d8d8]'
                      : ''
                  }`}
                >
                  <span className="text-lg font-normal" style={{ color: 'rgb(120, 175, 230)' }}>{s.type}</span>
                  <span className={`text-lg ml-2 shrink-0 font-bold ${isDark ? 'text-[#c8963c]' : 'text-blue-600'}`}>{s.pivot}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Куб появляется только когда категория выбрана и dropdown закрыт */}
        {lookup.exactEntry && !lookup.open && (
          <PivotCube pivot={lookup.exactEntry.pivot} isDark={isDark} />
        )}
      </div>
    </div>
  )
}
