interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

export class CacheService {
  private cache: Map<string, CacheEntry<any>>;
  private ttl: number;
  private hits: number;
  private misses: number;

  constructor(ttl: number) {
    this.cache = new Map();
    this.ttl = ttl;
    this.hits = 0;
    this.misses = 0;

    // Очистка устаревших записей каждую минуту
    setInterval(() => this.cleanup(), 60 * 1000);
  }

  /**
   * Получение данных из кэша
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.misses++;
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }

    this.hits++;
    return entry.data;
  }

  /**
   * Сохранение данных в кэш
   */
  set<T>(key: string, data: T): void {
    const expiresAt = Date.now() + this.ttl;
    this.cache.set(key, { data, expiresAt });
  }

  /**
   * Проверка наличия ключа в кэше
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }

  /**
   * Удаление записи из кэша
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Очистка всего кэша
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Очистка устаревших записей
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Получение статистики
   */
  getStats() {
    const totalRequests = this.hits + this.misses;
    const hitRate = totalRequests > 0 ? (this.hits / totalRequests * 100).toFixed(2) : '0.00';

    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: `${hitRate}%`,
      ttl: this.ttl / 1000 / 60, // в минутах
    };
  }
}


