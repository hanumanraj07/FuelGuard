import { apiUrl } from '@/lib/api'

export type AuthUser = {
  id: string
  name: string
  email: string
  role: 'consumer' | 'fleet' | 'gov'
  phone?: string
  joinedAt?: string
  plan?: string
  language?: string
  fuelCoins?: number
  analysesThisMonth?: number
  isVerifiedReporter?: boolean
  referralCode?: string
  notificationEmail?: boolean
  subscriptionCycle?: 'monthly' | 'annual'
  subscriptionStatus?: string
  nextBillingDate?: string | null
}

const STORAGE_KEY = 'fuelguard.auth'
const TOKEN_KEY = 'fuelguard.token'

export function getAuthUser(): AuthUser | null {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as AuthUser
  } catch {
    return null
  }
}

export function isAuthenticated(): boolean {
  if (typeof window === 'undefined') return false
  return !!window.localStorage.getItem(TOKEN_KEY)
}

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(TOKEN_KEY)
}

export function authHeaders(): HeadersInit {
  const token = getAuthToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const response = await fetch(apiUrl('/api/auth/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))
    throw new Error(payload.error || 'Login failed')
  }

  const data = await response.json()
  storeAuth(data.user, data.token)
  return data.user as AuthUser
}

export async function register(payload: {
  name: string
  email: string
  password: string
  phone?: string
  language?: string
}): Promise<AuthUser> {
  const response = await fetch(apiUrl('/api/auth/register'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.error || 'Registration failed')
  }

  const data = await response.json()
  storeAuth(data.user, data.token)
  return data.user as AuthUser
}

export async function requestPasswordReset(email: string): Promise<string | null> {
  const response = await fetch(apiUrl('/api/auth/forgot'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.error || 'Unable to request reset')
  }

  const data = await response.json()
  return data.resetToken || null
}

export async function resetPassword(token: string, password: string): Promise<void> {
  const response = await fetch(apiUrl('/api/auth/reset'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, password }),
  })

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.error || 'Unable to reset password')
  }
}

export function logout(): void {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(STORAGE_KEY)
  window.localStorage.removeItem(TOKEN_KEY)
  notifyAuthChanged()
}

export function updateStoredAuthUser(user: AuthUser): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
  notifyAuthChanged()
}

function notifyAuthChanged() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event('auth:changed'))
}

function storeAuth(user: AuthUser, token: string) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
  window.localStorage.setItem(TOKEN_KEY, token)
  notifyAuthChanged()
}
