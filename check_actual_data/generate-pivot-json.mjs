// Тянет карту "код категории → пивот" из nfinite плоским запросом (~47 страниц).
// Токен берётся из env NFINITE_TOKEN (получить: GET model-replacer.kofein3d.workers.dev с X-Viser-Key).
// Пишет JSON { "CODE": "PIVOT", ... } по пути из первого аргумента.
//
// Запуск: NFINITE_TOKEN=<token> node generate-pivot-json.mjs ../public/pivot-data.json

import { writeFileSync } from 'fs'

const GRAPHQL_URL  = 'https://my.nfinite.app/api/graphql'
const ORGANIZATION = '5e8c228d1bae80366fd11328'
const PAGE_LIMIT   = 200

const token = process.env.NFINITE_TOKEN
if (!token) { console.error('NFINITE_TOKEN not set'); process.exit(1) }

const outPath = process.argv[2]
if (!outPath) { console.error('Usage: node generate-pivot-json.mjs <output-path>'); process.exit(1) }

const QUERY = `query Q($skip: Int) {
  paginatedCategories(paging: { limit: ${PAGE_LIMIT}, skip: $skip }) {
    items { code pivotPoint }
    paging { hasNext }
  }
}`

async function fetchPage(skip) {
  const res = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'hub-organization': ORGANIZATION,
      'apollographql-client-name': 'tree-manager',
      'cookie': `hubstairs-auth=${token}`,
    },
    body: JSON.stringify({ query: QUERY, variables: { skip } }),
  })
  if (res.status === 401 || res.status === 403) throw new Error('AUTH')
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json()
  if (json.errors) throw new Error('GraphQL: ' + json.errors.map(e => e.message).join('; '))
  return json.data.paginatedCategories
}

async function main() {
  const map = {}
  let skip = 0, pages = 0
  while (true) {
    const page = await fetchPage(skip)
    pages++
    for (const it of page.items) {
      const code = (it.code || '').trim()
      if (!code || code.startsWith('$')) continue
      if (!(code in map)) map[code] = it.pivotPoint ?? null   // при дублях первый выигрывает
    }
    process.stdout.write(`\r  pages: ${pages}, codes: ${Object.keys(map).length}   `)
    if (!page.paging.hasNext) break
    skip += PAGE_LIMIT
  }
  process.stdout.write('\n')

  const output = { _updated: new Date().toISOString(), ...map }
  writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf-8')
  console.log(`Written ${Object.keys(map).length} categories to ${outPath}`)
}

main().catch(e => {
  if (e.message === 'AUTH') {
    console.error('Token invalid or expired')
  } else {
    console.error('Error:', e.message)
  }
  process.exit(1)
})
