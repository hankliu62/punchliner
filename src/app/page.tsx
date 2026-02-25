'use client'

import {
  FrownOutlined,
  HeartFilled,
  HeartOutlined,
  LoadingOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import { Button, Skeleton } from 'antd'
import Image from 'next/image'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { generateShareUrl } from '@/lib/crypto'
import { getRoutePrefix } from '@/lib/route'
import type { CollectItem, Joke } from '@/types'
import styles from './page.module.css'

const COLLECT_STORAGE_KEY = 'punchliner_collects'
const DAILY_JOKE_STORAGE_KEY = 'punchliner_daily_joke'
const JOKES_LIST_CACHE_KEY = 'punchliner_jokes_list'
const JOKES_PAGE_CACHE_KEY = 'punchliner_jokes_page'

function getToday(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getCollects(): CollectItem[] {
  if (typeof window === 'undefined') return []
  try {
    const data = localStorage.getItem(COLLECT_STORAGE_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

function saveCollects(collects: CollectItem[]) {
  localStorage.setItem(COLLECT_STORAGE_KEY, JSON.stringify(collects))
}

function getCachedDailyJoke(): Joke | null {
  if (typeof window === 'undefined') return null
  try {
    const data = localStorage.getItem(DAILY_JOKE_STORAGE_KEY)
    if (!data) return null
    const cached = JSON.parse(data)
    if (cached.date === getToday()) {
      return cached.joke
    }
    return null
  } catch {
    return null
  }
}

function saveDailyJoke(joke: Joke) {
  localStorage.setItem(
    DAILY_JOKE_STORAGE_KEY,
    JSON.stringify({
      date: getToday(),
      joke,
    })
  )
}

function getCachedJokesList(): { jokes: Joke[]; page: number; hasMore: boolean } | null {
  if (typeof window === 'undefined') return null
  try {
    const jokesData = localStorage.getItem(JOKES_LIST_CACHE_KEY)
    const pageData = localStorage.getItem(JOKES_PAGE_CACHE_KEY)
    if (jokesData && pageData) {
      return {
        jokes: JSON.parse(jokesData),
        page: parseInt(pageData, 10),
        hasMore: true, // 默认还有更多
      }
    }
  } catch {
    // ignore
  }
  return null
}

function saveJokesList(jokes: Joke[], page: number) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(JOKES_LIST_CACHE_KEY, JSON.stringify(jokes))
    localStorage.setItem(JOKES_PAGE_CACHE_KEY, String(page))
  } catch {
    // ignore
  }
}

function addCollect(joke: Joke) {
  const collects = getCollects()
  const newItem: CollectItem = {
    ...joke,
    collectTime: new Date().toISOString(),
  }
  saveCollects([newItem, ...collects])
}

function removeCollect(id: string) {
  const collects = getCollects().filter((item) => item.id !== id)
  saveCollects(collects)
}

export default function HomePage() {
  const [dailyJoke, setDailyJoke] = useState<Joke | null>(null)
  const [jokes, setJokes] = useState<Joke[]>([])
  const [likes, setLikes] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [lastRefreshTime, setLastRefreshTime] = useState(0)
  const [collectedIds, setCollectedIds] = useState<Set<string>>(new Set())
  const [jokesError, setJokesError] = useState<string | null>(null) // 段子列表错误状态
  const initialized = useRef(false) // 标记是否已初始化

  const fetchRandomJoke = useCallback(async (forceRefresh: boolean = false, retryCount = 0) => {
    const maxRetries = 2 // 最多重试2次

    // 先检查缓存
    if (!forceRefresh) {
      const cached = getCachedDailyJoke()
      if (cached) {
        setDailyJoke(cached)
        return
      }
    }

    const doFetch = async () => {
      try {
        const res = await fetch('/api/jokes/random')
        const data = await res.json()
        if (data.code === 1 && data.data.length > 0) {
          const joke = data.data[0]
          setDailyJoke(joke)
          saveDailyJoke(joke)
          return true
        } else {
          // API 返回空数据，重试
          if (retryCount < maxRetries) {
            console.log(`每日段子请求为空，第${retryCount + 1}次重试...`)
            await new Promise((resolve) => setTimeout(resolve, 1000))
            return doFetch()
          }
        }
      } catch (error) {
        console.error('Failed to fetch random joke:', error)
        // 网络错误，重试
        if (retryCount < maxRetries) {
          console.log(`每日段子请求失败，第${retryCount + 1}次重试...`)
          await new Promise((resolve) => setTimeout(resolve, 1000))
          return doFetch()
        }
      }
      return false
    }

    await doFetch()
  }, [])

  const fetchJokes = useCallback(
    async (pageNum: number, _isLoadMore: boolean = false, retryCount = 0) => {
      const maxRetries = 2 // 最多重试2次

      const doFetch = async () => {
        try {
          const res = await fetch(`/api/jokes/list?page=${pageNum}`)
          const data = await res.json()
          if (data.code === 1 && data.data) {
            const newList = data.data.list
            if (pageNum === 1) {
              setJokes(newList)
              // 保存到缓存
              saveJokesList(newList, pageNum)
              // 如果第一页数据为空，设置错误提示
              if (!newList || newList.length === 0) {
                setJokesError('暂无段子，请稍后再试')
              } else {
                setJokesError(null)
              }
            } else {
              setJokes((prev) => [...prev, ...newList])
              // 更新缓存
              const currentJokes = JSON.parse(localStorage.getItem(JOKES_LIST_CACHE_KEY) || '[]')
              saveJokesList([...currentJokes, ...newList], pageNum)
            }
            setHasMore(data.data.page < data.data.totalPage)
          } else {
            // API 返回错误，重试
            if (retryCount < maxRetries) {
              console.log(`段子列表请求失败，第${retryCount + 1}次重试...`)
              await new Promise((resolve) => setTimeout(resolve, 1000)) // 等待1秒
              return doFetch()
            }
            if (pageNum === 1) {
              setJokesError(data.msg || '获取段子失败')
            }
          }
        } catch (error) {
          console.error('Failed to fetch jokes:', error)
          // 网络错误，重试
          if (retryCount < maxRetries) {
            console.log(`段子列表请求失败，第${retryCount + 1}次重试...`)
            await new Promise((resolve) => setTimeout(resolve, 1000)) // 等待1秒
            return doFetch()
          }
          if (pageNum === 1) {
            setJokesError('网络错误，请检查网络后重试')
          }
        }
      }

      await doFetch()
    },
    []
  )

  // 为新段子生成固定点赞数（内存缓存）
  const getLikes = useCallback(
    (jokeId: string) => {
      if (!likes[jokeId]) {
        const newLikes = Math.floor(Math.random() * 9000) + 1000
        setLikes((prev) => ({ ...prev, [jokeId]: newLikes }))
        return newLikes
      }
      return likes[jokeId]
    },
    [likes]
  )

  // 使用 useRef 防止重复初始化
  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    const init = async () => {
      // 先尝试从缓存加载
      const cachedData = getCachedJokesList()
      if (cachedData) {
        setJokes(cachedData.jokes)
        setPage(cachedData.page)
        setHasMore(cachedData.hasMore)
        // 设置 loading 为 false，先显示缓存
        setLoading(false)
      } else {
        setLoading(true)
      }

      // 然后请求最新数据
      await Promise.all([fetchRandomJoke(false), fetchJokes(1, false)])

      // 请求完成后更新缓存
      const updatedData = getCachedJokesList()
      if (updatedData) {
        saveJokesList(updatedData.jokes, updatedData.page)
      }

      setLoading(false)
      setCollectedIds(new Set(getCollects().map((item) => item.id)))
    }
    init()
  }, [fetchRandomJoke, fetchJokes])

  const handleRefresh = async () => {
    const now = Date.now()
    if (now - lastRefreshTime < 2000) {
      toast.error('请稍后再试')
      return
    }
    setRefreshing(true)
    setLastRefreshTime(now)
    await fetchRandomJoke(true)
    setRefreshing(false)
    toast.success('换了一个新段子')
  }

  const handleLoadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    const nextPage = page + 1
    setPage(nextPage)
    await fetchJokes(nextPage, true)
    setLoadingMore(false)
  }, [loadingMore, hasMore, page, fetchJokes])

  // 滚动到底部自动加载更多
  useEffect(() => {
    const handleScroll = () => {
      if (loadingMore || !hasMore) return

      const scrollTop = window.scrollY
      const windowHeight = window.innerHeight
      const documentHeight = document.documentElement.scrollHeight

      // 距离底部 200px 时触发加载
      if (scrollTop + windowHeight >= documentHeight - 200) {
        handleLoadMore()
      }
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [loadingMore, hasMore, handleLoadMore])

  const handleCollect = (joke: Joke) => {
    if (collectedIds.has(joke.id)) {
      removeCollect(joke.id)
      setCollectedIds((prev) => {
        const newSet = new Set(prev)
        newSet.delete(joke.id)
        return newSet
      })
      toast.success('已取消收藏')
    } else {
      addCollect(joke)
      setCollectedIds((prev) => new Set(prev).add(joke.id))
      toast.success('收藏成功')
    }
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <Link href="/" className={styles.logo}>
          <Image
            src={`${getRoutePrefix()}/logo.jpg`}
            alt="包袱铺"
            width={36}
            height={36}
            className={styles.logoImage}
          />
          <span className={styles.logoText}>包袱铺</span>
        </Link>
        <Link href="/collect" className={styles.collectLink}>
          <HeartOutlined />
          <span>收藏</span>
        </Link>
      </header>

      <main className={styles.main}>
        <section className={styles.dailySection}>
          <div className={styles.dailyHeader}>
            <span className={styles.dailyTitle}>✨ 今日也要笑一笑</span>
          </div>
          {loading ? (
            <div className={styles.dailyCard}>
              <Skeleton active paragraph={{ rows: 3 }} />
            </div>
          ) : dailyJoke ? (
            <Link
              href={generateShareUrl(
                dailyJoke.id,
                dailyJoke.content,
                dailyJoke.updateTime,
                getRoutePrefix()
              )}
              className={styles.dailyCard}
            >
              {/* 装饰性光点 */}
              <span className={styles.sparkle}></span>
              <span className={styles.sparkle}></span>
              <span className={styles.sparkle}></span>

              <p className={styles.dailyContent}>{dailyJoke.content}</p>
              <div className={styles.dailyFooter}>
                <span className={styles.updateTime}>{dailyJoke.updateTime}</span>
                <Button
                  type="primary"
                  icon={<ReloadOutlined spin={refreshing} />}
                  loading={refreshing}
                  onClick={(e) => {
                    e.preventDefault()
                    handleRefresh()
                  }}
                  className={styles.refreshBtn}
                >
                  换一个
                </Button>
              </div>
            </Link>
          ) : (
            <div className={styles.dailyCard}>
              <p className={styles.dailyContent}>暂无段子，请稍后再试</p>
            </div>
          )}
        </section>

        <section className={styles.listSection}>
          <h2 className={styles.sectionTitle}>🎭 更多段子</h2>
          {loading ? (
            <div className={styles.jokeList}>
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className={styles.jokeCard}>
                  <Skeleton active paragraph={{ rows: 2 }} />
                </div>
              ))}
            </div>
          ) : jokesError ? (
            <div className={styles.errorWrapper}>
              <div className={styles.errorIconWrapper}>
                <div className={styles.errorCircle}>
                  <FrownOutlined className={styles.errorIcon} />
                </div>
              </div>
              <p className={styles.errorTitle}>哎呀，段子跑丢了</p>
              <p className={styles.errorMessage}>{jokesError}</p>
              <Button
                type="primary"
                size="large"
                icon={<ReloadOutlined />}
                onClick={() => {
                  setJokesError(null)
                  setJokes([])
                  setPage(1)
                  fetchJokes(1, false)
                }}
                className={styles.retryBtn}
              >
                再试一次
              </Button>
            </div>
          ) : (
            <>
              <div className={styles.jokeList}>
                {jokes.map((joke) => (
                  <Link
                    key={joke.id}
                    href={generateShareUrl(
                      joke.id,
                      joke.content,
                      joke.updateTime,
                      getRoutePrefix()
                    )}
                    className={styles.jokeCard}
                  >
                    <p className={styles.jokeContent}>{joke.content}</p>
                    <div className={styles.jokeFooter}>
                      <span className={styles.updateTime}>{joke.updateTime}</span>
                      <div className={styles.jokeActions}>
                        <span
                          className={styles.likeCount}
                          onClick={(e) => {
                            e.preventDefault()
                            handleCollect(joke)
                          }}
                        >
                          {collectedIds.has(joke.id) ? (
                            <HeartFilled className={styles.heartFilled} />
                          ) : (
                            <HeartOutlined />
                          )}
                        </span>
                        <span className={styles.likeCount}>👍 {getLikes(joke.id)}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
              {/* 滚动加载更多触发器 */}
              <div className={styles.loadMore}>
                {loadingMore ? (
                  <div className={styles.loadingWrapper}>
                    <div className={styles.loadingIconWrapper}>
                      <div className={styles.loadingOrbit}></div>
                      <LoadingOutlined spin className={styles.loadingIcon} />
                    </div>
                    <span className={styles.loadingText}>正在加载更多...</span>
                  </div>
                ) : !hasMore && jokes.length > 0 ? (
                  <div className={styles.noMore}>
                    <span className={styles.noMoreLine}></span>
                    <span className={styles.noMoreText}>没有更多了</span>
                    <span className={styles.noMoreLine}></span>
                  </div>
                ) : jokes.length > 0 ? (
                  <button type="button" className={styles.loadMoreBtn} onClick={handleLoadMore}>
                    <span className={styles.loadMoreIcon}>↓</span>
                    <span className={styles.loadMoreText}>加载更多</span>
                  </button>
                ) : null}
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  )
}
