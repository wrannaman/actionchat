// Simple in-memory fetch cache with in-flight deduping
// Only caches GET requests by default

const cacheStore = new Map()
const inflightStore = new Map()

function buildKey(url, options) {
  const method = (options && options.method) ? options.method.toUpperCase() : 'GET'
  const headers = options && options.headers ? options.headers : undefined
  const body = options && options.body ? options.body : undefined
  return JSON.stringify({ url, method, headers, body })
}

function isCacheable(method) {
  return method === 'GET'
}

function createResponseFromCache(cached) {
  return new Response(cached.body, {
    status: cached.status,
    statusText: cached.statusText,
    headers: cached.headers
  })
}

export async function cachedFetch(url, options = {}, extra = {}) {
  const method = (options.method || 'GET').toUpperCase()
  const ttlMs = typeof extra.ttlMs === 'number' ? extra.ttlMs : 10000
  const key = extra.cacheKey || buildKey(url, options)

  if (!isCacheable(method)) {
    return fetch(url, options)
  }

  const now = Date.now()
  const cached = cacheStore.get(key)
  if (cached && (now - cached.timestamp) < ttlMs) {
    return createResponseFromCache(cached)
  }

  // If there's an inflight request, wait for it then return fresh Response from cache
  const inflight = inflightStore.get(key)
  if (inflight) {
    await inflight
    const freshCached = cacheStore.get(key)
    if (freshCached) {
      return createResponseFromCache(freshCached)
    }
    // Fallback if cache was cleared during await
    return fetch(url, options)
  }

  const fetchPromise = (async () => {
    try {
      const response = await fetch(url, options)
      const clone = response.clone()
      const bodyText = await clone.text()
      const headersObj = {}
      clone.headers.forEach((v, k) => { headersObj[k] = v })

      cacheStore.set(key, {
        body: bodyText,
        status: clone.status,
        statusText: clone.statusText,
        headers: headersObj,
        timestamp: Date.now()
      })
    } finally {
      inflightStore.delete(key)
    }
  })()

  inflightStore.set(key, fetchPromise)
  await fetchPromise
  
  const newCached = cacheStore.get(key)
  if (newCached) {
    return createResponseFromCache(newCached)
  }
  // Fallback
  return fetch(url, options)
}

export function clearFetchCache(predicate) {
  if (!predicate) {
    cacheStore.clear()
    return
  }
  for (const [key] of cacheStore) {
    if (predicate(key)) cacheStore.delete(key)
  }
}


