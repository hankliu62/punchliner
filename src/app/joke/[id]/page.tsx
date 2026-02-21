'use client'

import {
  ArrowLeftOutlined,
  CopyOutlined,
  DownloadOutlined,
  HeartFilled,
  HeartOutlined,
  LoadingOutlined,
} from '@ant-design/icons'
import { Image as AntImage, Button, Segmented, Skeleton } from 'antd'
import { useRouter, useSearchParams } from 'next/navigation'
import { use, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import type { AIAction, AIActionType, CollectItem, Joke } from '@/types'
import { AI_ACTIONS, REWRITE_STYLES } from '@/types'
import styles from './page.module.css'

const COLLECT_STORAGE_KEY = 'punchliner_collects'

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

export default function JokeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const searchParams = useSearchParams()
  const content = searchParams.get('content') || ''
  const updateTime = searchParams.get('time') || ''

  const [joke, setJoke] = useState<Joke | null>(null)
  const [isCollected, setIsCollected] = useState(false)
  const [activeAction, setActiveAction] = useState<AIActionType | null>(null)
  const [aiResult, setAiResult] = useState<string | null>(null)
  const [aiImageUrl, setAiImageUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [rewriteStyle, setRewriteStyle] = useState<string>('冷幽默')

  useEffect(() => {
    if (content) {
      setJoke({ id, content, updateTime })
      const collects = getCollects()
      setIsCollected(collects.some((item) => item.id === id))
    }
  }, [id, content, updateTime])

  const handleCollect = () => {
    if (!joke) return

    if (isCollected) {
      const collects = getCollects().filter((item) => item.id !== id)
      saveCollects(collects)
      setIsCollected(false)
      toast.success('已取消收藏')
    } else {
      const collects = getCollects()
      const newItem: CollectItem = {
        ...joke,
        collectTime: new Date().toISOString(),
      }
      saveCollects([newItem, ...collects])
      setIsCollected(true)
      toast.success('收藏成功')
    }
  }

  const handleAIAction = async (action: AIAction) => {
    if (!joke) return

    setActiveAction(action.type)
    setLoading(true)
    setAiResult(null)
    setAiImageUrl(null)

    try {
      if (action.type === 'image') {
        const res = await fetch('/api/ai/image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: joke.content }),
        })
        const data = await res.json()
        if (data.code === 1 && data.data.url) {
          setAiImageUrl(data.data.url)
        } else {
          toast.error(data.msg || '图片生成失败')
        }
      } else {
        const res = await fetch('/api/ai/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: action.type,
            content: joke.content,
            style: action.type === 'rewrite' ? rewriteStyle : undefined,
          }),
        })
        const data = await res.json()
        if (data.code === 1 && data.data) {
          setAiResult(data.data)
        } else {
          toast.error(data.msg || 'AI 生成失败')
        }
      }
    } catch (error) {
      console.error('AI action error:', error)
      toast.error('AI 生成失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success('已复制到剪贴板')
    } catch {
      toast.error('复制失败')
    }
  }

  const handleDownloadImage = async () => {
    if (!aiImageUrl) return
    try {
      const response = await fetch(aiImageUrl)
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `punchliner-${Date.now()}.png`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('图片已下载')
    } catch {
      toast.error('下载失败')
    }
  }

  const aiActions = AI_ACTIONS.filter(
    (action) => action.type !== 'moments' && action.type !== 'similar'
  )

  if (!joke) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingContainer}>
          <Skeleton active paragraph={{ rows: 6 }} />
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <button
          type="button"
          onClick={() => router.back()}
          className={styles.backBtn}
          aria-label="返回"
        >
          <ArrowLeftOutlined />
        </button>
        <h1 className={styles.title}>段子详情</h1>
        <div className={styles.headerActions}>
          <button
            type="button"
            onClick={handleCollect}
            className={styles.actionBtn}
            aria-label="收藏"
          >
            {isCollected ? <HeartFilled className={styles.heartFilled} /> : <HeartOutlined />}
          </button>
        </div>
      </header>

      <main className={styles.main}>
        <section className={styles.jokeSection}>
          <div className={styles.jokeCard}>
            <p className={styles.jokeContent}>{joke.content}</p>
            <span className={styles.updateTime}>{joke.updateTime}</span>
          </div>
        </section>

        <section className={styles.aiSection}>
          <h2 className={styles.sectionTitle}>🤖 AI 增强功能</h2>

          <div className={styles.aiActions}>
            {aiActions.map((action) => (
              <button
                key={action.type}
                type="button"
                onClick={() => handleAIAction(action)}
                className={`${styles.aiActionBtn} ${activeAction === action.type ? styles.aiActionBtnActive : ''}`}
                disabled={loading}
              >
                <span className={styles.aiActionIcon}>{action.icon}</span>
                <span className={styles.aiActionLabel}>{action.label}</span>
              </button>
            ))}
          </div>

          {activeAction === 'rewrite' && (
            <div className={styles.styleSelector}>
              <Segmented
                options={REWRITE_STYLES.map((s) => s.label)}
                value={rewriteStyle}
                onChange={(value) => {
                  setRewriteStyle(value as string)
                  if (joke) {
                    setLoading(true)
                    fetch('/api/ai/generate', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        type: 'rewrite',
                        content: joke.content,
                        style: value,
                      }),
                    })
                      .then((res) => res.json())
                      .then((data) => {
                        if (data.code === 1) {
                          setAiResult(data.data)
                        }
                      })
                      .finally(() => setLoading(false))
                  }
                }}
                block
              />
            </div>
          )}

          {(loading || aiResult || aiImageUrl) && (
            <div className={styles.resultSection}>
              {loading ? (
                <div className={styles.loadingBox}>
                  <LoadingOutlined spin style={{ fontSize: 32 }} />
                  <p>AI 正在生成中...</p>
                </div>
              ) : aiImageUrl ? (
                <div className={styles.imageResult}>
                  <AntImage
                    src={aiImageUrl}
                    alt="AI 生成的图片"
                    className={styles.generatedImage}
                    style={{ borderRadius: 12 }}
                  />
                  <div className={styles.imageActions}>
                    <Button icon={<DownloadOutlined />} onClick={handleDownloadImage}>
                      下载图片
                    </Button>
                  </div>
                </div>
              ) : aiResult ? (
                <div className={styles.textResult}>
                  <p className={styles.resultText}>{aiResult}</p>
                  <Button
                    type="primary"
                    icon={<CopyOutlined />}
                    onClick={() => handleCopy(aiResult)}
                  >
                    复制文案
                  </Button>
                </div>
              ) : null}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
