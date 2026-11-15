import { useCallback, useEffect, useRef, useState } from 'react'
import { ESCO_LIST_LIMIT, isAbortError, userFacingLoadError } from '../api/esco.js'

export function useEscoPagedSearch(fetcher, { limit = ESCO_LIST_LIMIT, extraParams, formatError, initialQuery = '' } = {}) {
  const [input, setInput] = useState(initialQuery)
  const [query, setQuery] = useState(initialQuery.trim())
  const [page, setPage] = useState(1)
  const [items, setItems] = useState([])
  const [meta, setMeta] = useState({ page: 1, limit, total: 0, totalPages: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const abortRef = useRef(null)
  const seqRef = useRef(0)
  const extraKey = JSON.stringify(extraParams ?? {})

  const load = useCallback(
    async (nextQuery, nextPage) => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      const requestId = seqRef.current + 1
      seqRef.current = requestId
      setLoading(true)
      setError('')
      const extra = extraKey === '{}' ? {} : JSON.parse(extraKey)

      try {
        const result = await fetcher({
          q: nextQuery || undefined,
          page: nextPage,
          limit,
          ...extra,
          signal: controller.signal,
        })
        if (requestId !== seqRef.current) {
          return
        }
        setItems(result.items)
        setMeta({
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages,
        })
      } catch (err) {
        if (isAbortError(err) || requestId !== seqRef.current) {
          return
        }
        setItems([])
        setMeta({ page: nextPage, limit, total: 0, totalPages: 0 })
        setError(
          formatError
            ? formatError(err)
            : userFacingLoadError(err, 'Unable to load results right now.'),
        )
      } finally {
        if (requestId === seqRef.current) {
          setLoading(false)
        }
      }
    },
    [extraKey, fetcher, formatError, limit],
  )

  useEffect(() => {
    void load(query, page)
    return () => abortRef.current?.abort()
  }, [load, page, query])

  function search(event) {
    event?.preventDefault()
    const nextQuery = input.trim()
    setPage(1)
    setQuery(nextQuery)
  }

  function goToPage(nextPage) {
    if (nextPage < 1 || (meta.totalPages > 0 && nextPage > meta.totalPages) || nextPage === page) {
      return
    }
    setPage(nextPage)
  }

  function resetSearch() {
    setInput('')
    setQuery('')
    setPage(1)
  }

  return {
    input,
    setInput,
    query,
    page,
    items,
    meta,
    loading,
    error,
    search,
    resetSearch,
    retry: () => {
      void load(query, page)
    },
    goToPage,
  }
}
