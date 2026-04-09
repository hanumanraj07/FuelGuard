const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'

export function apiUrl(path: string) {
  if (path.startsWith('http')) return path
  return `${API_BASE}${path}`
}
