package utils

import (
	"sync"
	"time"

	"golang.org/x/sync/singleflight"
)

// CacheItem represents an item stored in the memory cache.
type CacheItem[T any] struct {
	Value      T
	Expiration int64
}

// MemoryCache is a thread-safe in-memory cache with TTL support using Go generics.
type MemoryCache[T any] struct {
	items map[string]CacheItem[T]
	mu    sync.RWMutex
	sf    singleflight.Group
}

// NewMemoryCache creates a new instance of MemoryCache and starts a background cleanup goroutine.
func NewMemoryCache[T any]() *MemoryCache[T] {
	c := &MemoryCache[T]{
		items: make(map[string]CacheItem[T]),
	}
	go c.cleanupLoop()
	return c
}

func (c *MemoryCache[T]) cleanupLoop() {
	ticker := time.NewTicker(10 * time.Minute)
	for range ticker.C {
		c.Cleanup()
	}
}

// Cleanup removes all expired items from the cache.
func (c *MemoryCache[T]) Cleanup() {
	now := time.Now().UnixNano()
	c.mu.Lock()
	defer c.mu.Unlock()
	for k, item := range c.items {
		if item.Expiration > 0 && now > item.Expiration {
			delete(c.items, k)
		}
	}
}

// Set adds an item to the cache with a specified duration.
// If duration is 0, the item will never expire.
func (c *MemoryCache[T]) Set(key string, value T, duration time.Duration) {
	var expiration int64
	if duration > 0 {
		expiration = time.Now().Add(duration).UnixNano()
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	c.items[key] = CacheItem[T]{
		Value:      value,
		Expiration: expiration,
	}
}

// Get retrieves an item from the cache.
// Returns the value and a boolean indicating if the item was found and hasn't expired.
func (c *MemoryCache[T]) Get(key string) (T, bool) {
	c.mu.RLock()
	item, found := c.items[key]
	c.mu.RUnlock()

	if !found {
		var zero T
		return zero, false
	}

	if item.Expiration > 0 && time.Now().UnixNano() > item.Expiration {
		// Lazily delete to avoid waiting for Cleanup loop
		go c.Delete(key)
		var zero T
		return zero, false
	}

	return item.Value, true
}

// Delete removes an item from the cache.
func (c *MemoryCache[T]) Delete(key string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	delete(c.items, key)
}

// GetOrSet attempts to get from cache, or uses the provided fetch function with singleflight protection.
func (c *MemoryCache[T]) GetOrSet(key string, ttl time.Duration, fetch func() (T, error)) (T, error) {
	// 1. Try Cache Get
	if val, found := c.Get(key); found {
		return val, nil
	}

	// 2. Cache Miss: Use Singleflight to prevent stampede
	res, err, _ := c.sf.Do(key, func() (interface{}, error) {
		// Double check cache inside singleflight (another goroutine might have filled it already)
		if val, found := c.Get(key); found {
			return val, nil
		}

		val, err := fetch()
		if err != nil {
			return nil, err
		}

		c.Set(key, val, ttl)
		return val, nil
	})

	if err != nil {
		var zero T
		return zero, err
	}

	return res.(T), nil
}

// Clear removes all items from the cache.
func (c *MemoryCache[T]) Clear() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.items = make(map[string]CacheItem[T])
}
