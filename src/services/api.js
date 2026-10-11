import axios from 'axios'

/**
 * Central API client.
 *
 * The frontend NEVER talks to MongoDB directly — all data access goes through
 * the Node/Express API. When the backend or an API key is unavailable, services
 * fall back to the mock layer and flag the response as `demo: true` so the UI
 * can label it honestly.
 */

const BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'

export const API_BASE_URL = BASE_URL

/** Default to mock mode unless explicitly disabled. */
export const USE_MOCK =
  String(import.meta.env.VITE_USE_MOCK ?? 'true').toLowerCase() !== 'false'

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 9000,
  headers: { 'Content-Type': 'application/json' },
})

/** True after a real request has failed (used to surface a banner). */
let backendReachable = null
export function getBackendStatus() {
  return backendReachable
}
export function setBackendStatus(v) {
  backendReachable = v
}

/**
 * Perform a request with an explicit mock fallback.
 * @returns {Promise<{data:any, demo:boolean, error?:Error}>}
 */
export async function request(path, { fallback, method = 'get', data, params } = {}) {
  if (USE_MOCK) {
    return { data: resolveFallback(fallback), demo: true }
  }
  try {
    const res = await api.request({ url: path, method, data, params })
    backendReachable = true
    return { data: res.data, demo: false }
  } catch (error) {
    backendReachable = false
    // One honest warning; never pretend the real service answered.
    // eslint-disable-next-line no-console
    console.warn(`[synq] API ${method.toUpperCase()} ${path} unavailable — using demo data.`, error?.message)
    return { data: resolveFallback(fallback), demo: true, error }
  }
}

function resolveFallback(fallback) {
  return typeof fallback === 'function' ? fallback() : fallback
}

/** Small helper to simulate latency so loading states are observable. */
export function delay(ms = 220) {
  return new Promise((r) => setTimeout(r, ms))
}
