// 视频缓存管理 - 使用 localStorage 持久化存储

const VIDEO_CACHE_PREFIX = 'punchliner_video_cache_'

interface CachedVideo {
  url: string
  content: string
  createdAt: number
}

// 生成缓存键
function getCacheKey(content: string): string {
  // 使用内容的哈希作为缓存键
  const hash = content.split('').reduce((acc, char) => {
    return (acc << 5) - acc + char.charCodeAt(0)
  }, 0)
  return VIDEO_CACHE_PREFIX + Math.abs(hash)
}

// 获取视频缓存
export function getVideoCache(content: string): string | null {
  if (typeof window === 'undefined') return null

  try {
    const key = getCacheKey(content)
    const cached = localStorage.getItem(key)

    if (cached) {
      const data: CachedVideo = JSON.parse(cached)
      // 检查缓存是否过期（24小时）
      const now = Date.now()
      const oneDay = 24 * 60 * 60 * 1000

      if (now - data.createdAt < oneDay) {
        console.log('使用缓存视频:', data.url)
        return data.url
      } else {
        // 过期则删除
        localStorage.removeItem(key)
      }
    }
  } catch (error) {
    console.error('获取视频缓存失败:', error)
  }

  return null
}

// 保存视频到缓存
export function saveVideoCache(content: string, url: string): void {
  if (typeof window === 'undefined') return

  try {
    const key = getCacheKey(content)
    const data: CachedVideo = {
      url,
      content,
      createdAt: Date.now(),
    }
    localStorage.setItem(key, JSON.stringify(data))
    console.log('视频已缓存:', url)
  } catch (error) {
    console.error('保存视频缓存失败:', error)
  }
}

// 清除所有视频缓存
export function clearVideoCache(): void {
  if (typeof window === 'undefined') return

  try {
    const keysToRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(VIDEO_CACHE_PREFIX)) {
        keysToRemove.push(key)
      }
    }
    // biome-ignore lint/suspicious/useIterableCallbackReturn: <explanation>
    keysToRemove.forEach((key) => localStorage.removeItem(key))
    console.log('已清除所有视频缓存')
  } catch (error) {
    console.error('清除视频缓存失败:', error)
  }
}

// 获取缓存统计
export function getVideoCacheStats(): {
  count: number
  oldest: number | null
  newest: number | null
} {
  if (typeof window === 'undefined') return { count: 0, oldest: null, newest: null }

  const videos: CachedVideo[] = []

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(VIDEO_CACHE_PREFIX)) {
        const cached = localStorage.getItem(key)
        if (cached) {
          videos.push(JSON.parse(cached))
        }
      }
    }
  } catch (error) {
    console.error('获取缓存统计失败:', error)
  }

  if (videos.length === 0) {
    return { count: 0, oldest: null, newest: null }
  }

  const timestamps = videos.map((v) => v.createdAt).sort((a, b) => a - b)

  return {
    count: videos.length,
    oldest: timestamps[0],
    newest: timestamps[timestamps.length - 1],
  }
}
