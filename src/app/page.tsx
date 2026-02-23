'use client'

import { HeartFilled, HeartOutlined, LoadingOutlined, ReloadOutlined } from '@ant-design/icons'
import { Button, Skeleton } from 'antd'
import Image from 'next/image'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { generateShareUrl } from '@/lib/crypto'
import { getRoutePrefix } from '@/lib/route'
import type { CollectItem, Joke } from '@/types'
import styles from './page.module.css'

const COLLECT_STORAGE_KEY = 'punchliner_collects'
const DAILY_JOKE_STORAGE_KEY = 'punchliner_daily_joke'

function getToday(): string {
  return new Date().toISOString().split('T')[0]
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

  const fetchRandomJoke = useCallback(async (forceRefresh: boolean = false) => {
    if (!forceRefresh) {
      const cached = getCachedDailyJoke()
      if (cached) {
        setDailyJoke(cached)
        return
      }
    }

    try {
      const res = await fetch('/api/jokes/random')
      const data = await res.json()
      if (data.code === 1 && data.data.length > 0) {
        const joke = data.data[0]
        setDailyJoke(joke)
        saveDailyJoke(joke)
      }
    } catch (error) {
      console.error('Failed to fetch random joke:', error)
    }
  }, [])

  const fetchJokes = useCallback(async (pageNum: number, _isLoadMore: boolean = false) => {
    try {
      const res = await fetch(`/api/jokes/list?page=${pageNum}`)
      const data = await res.json()
      if (data.code === 1 && data.data) {
        const newList = data.data.list
        if (pageNum === 1) {
          setJokes(newList)
        } else {
          setJokes((prev) => [...prev, ...newList])
        }
        setHasMore(data.data.page < data.data.totalPage)
      }
    } catch (error) {
      console.error('Failed to fetch jokes:', error)
    }
  }, [])

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

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      await Promise.all([fetchRandomJoke(false), fetchJokes(1, false)])
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
                {loadingMore && (
                  <div className={styles.loadingContainer}>
                    <LoadingOutlined className={styles.loadingIcon} spin />
                    <span>加载中...</span>
                  </div>
                )}
                {!hasMore && jokes.length > 0 && <span>没有更多了</span>}
                {hasMore && !loadingMore && (
                  <span className={styles.loadMorePlaceholder}>↓ 下拉加载更多</span>
                )}
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  )
}
