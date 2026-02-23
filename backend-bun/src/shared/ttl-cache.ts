interface CacheEntry<T> {
  value: T
  expiresAt: number
}

export class TtlCache<T> {
  private data = new Map<string, CacheEntry<T>>()

  get(key: string): T | null {
    const entry = this.data.get(key)
    if (!entry) return null
    if (Date.now() > entry.expiresAt) {
      this.data.delete(key)
      return null
    }
    return entry.value
  }

  set(key: string, value: T, ttlMs: number): void {
    this.data.set(key, { value, expiresAt: Date.now() + ttlMs })
  }

  delete(key: string): void {
    this.data.delete(key)
  }

  clear(): void {
    this.data.clear()
  }
}
