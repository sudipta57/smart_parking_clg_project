// Tiny wrapper around fetch(). Every call goes to /api/* (proxied by Vite to
// FastAPI). On an error it throws Error(detail), where `detail` is the
// human-readable message sent by the backend, so pages can show it as-is.

const BASE_URL = '/api'

async function request(method, path, body) {
  let response
  try {
    response = await fetch(BASE_URL + path, {
      method,
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new Error('Cannot reach the server. Is the backend running?')
  }

  // Some errors (e.g. backend down behind the proxy) have no JSON body.
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    const fallback = `Server error (${response.status}). Is the backend running on port 8000?`
    throw new Error(typeof data?.detail === 'string' ? data.detail : fallback)
  }
  return data
}

// Build "?a=1&b=2" from an object, skipping empty values. URLSearchParams
// also encodes "+" in "+05:30" correctly (a raw "+" would become a space).
function queryString(params = {}) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') query.set(key, value)
  }
  const text = query.toString()
  return text ? `?${text}` : ''
}

export const api = {
  get: (path, params) => request('GET', path + queryString(params)),
  post: (path, body = {}) => request('POST', path, body),
}
