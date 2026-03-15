/**
 * API client - uses apiBaseUrl from config.json (public/config.json)
 */
let apiBaseUrl = '/api'

export async function setApiBaseUrl(url) {
  if (url) apiBaseUrl = url.replace(/\/$/, '')
}

export function getApiBaseUrl() {
  return apiBaseUrl
}

const PUBLIC_PATHS = ['/auth/login', '/auth/register']

function getNetworkUnreachableMessage() {
  const isRemote = apiBaseUrl && !/^\/|https?:\/\/localhost(\:|$)|https?:\/\/127\.0\.0\.1(\:|$)/.test(apiBaseUrl)
  let msg = 'Cannot reach server. Is the backend running at ' + apiBaseUrl + '?'
  if (isRemote) {
    msg += ' If the backend is on another machine, ensure it is started with "host": "0.0.0.0" in config.json and that port 8080 is not blocked by a firewall.'
  }
  return msg
}

function getFriendlyErrorMessage(status) {
  const messages = {
    400: 'Invalid request. Please check your input.',
    401: 'Invalid email or password.',
    403: 'Access denied.',
    404: 'Not found.',
    409: 'This email is already registered.',
    500: 'Something went wrong. Please try again later.',
  }
  return messages[status] || 'Something went wrong. Please try again.'
}

export async function api(path, options = {}) {
  const url = `${apiBaseUrl}${path.startsWith('/') ? path : '/' + path}`
  const normalizedPath = path.startsWith('/') ? path : '/' + path
  const isPublic = PUBLIC_PATHS.some((p) => normalizedPath === p || normalizedPath.startsWith(p + '?'))
  const token = localStorage.getItem('token')
  const headers = {
    'Content-Type': 'application/json',
    ...(token && !isPublic && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  }
  let res
  try {
    res = await fetch(url, { ...options, headers })
  } catch (e) {
    const err = new Error(e.message === 'Failed to fetch'
      ? getNetworkUnreachableMessage()
      : e.message)
    err.status = 0
    throw err
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    if (res.status === 401 && !isPublic) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.dispatchEvent(new CustomEvent('auth:logout'))
      const path = window.location.pathname
      if (path.startsWith('/cart') || path.startsWith('/checkout') || path.startsWith('/admin') || path.startsWith('/superadmin')) {
        window.location.href = '/login?expired=1'
      }
    }
    const friendlyMessage = data?.error || getFriendlyErrorMessage(res.status)
    const err = new Error(friendlyMessage)
    err.status = res.status
    err.data = data
    throw err
  }
  return data
}

/**
 * Upload a file and return the URL. Uses multipart/form-data.
 */
export async function uploadFile(file, path = '/upload') {
  const url = `${apiBaseUrl}${path.startsWith('/') ? path : '/' + path}`
  const token = localStorage.getItem('token')
  const formData = new FormData()
  formData.append('image', file)
  const res = await fetch(url, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data?.error || getFriendlyErrorMessage(res.status))
    err.data = data
    throw err
  }
  return data.url
}
