'use client'

import {
  ArrowLeftOutlined,
  CopyOutlined,
  DownloadOutlined,
  HeartFilled,
  HeartOutlined,
  LoadingOutlined,
  ShareAltOutlined,
} from '@ant-design/icons'
import { Image as AntImage, Button, Modal, Segmented, Skeleton } from 'antd'
import { useRouter, useSearchParams } from 'next/navigation'
import { use, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { generateShareUrl, getContentFromUrl } from '@/lib/crypto'
import { getRoutePrefix } from '@/lib/route'
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

  // 优先从加密参数获取，兼容旧版URL参数
  const encryptedData = getContentFromUrl(searchParams)
  const content = encryptedData?.content || searchParams.get('content') || ''
  const updateTime = encryptedData?.updateTime || searchParams.get('time') || ''

  const [joke, setJoke] = useState<Joke | null>(null)
  const [isCollected, setIsCollected] = useState(false)
  const [activeAction, setActiveAction] = useState<AIActionType | null>(null)
  const [aiResult, setAiResult] = useState<string | null>(null)
  const [aiImageUrl, setAiImageUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [rewriteStyle, setRewriteStyle] = useState<string>('冷幽默')
  const [shareModalVisible, setShareModalVisible] = useState(false)
  const [shareImageUrl, setShareImageUrl] = useState<string | null>(null)
  const [generatingShareImage, setGeneratingShareImage] = useState(false)
  // 动画视频相关状态
  const [generatingVideo, setGeneratingVideo] = useState(false)
  const [_videoTaskId, setVideoTaskId] = useState<string | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [videoProgress, setVideoProgress] = useState(0)

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

  // 生成分享图片
  const handleGenerateShareImage = async () => {
    if (!joke) return
    setGeneratingShareImage(true)
    try {
      const res = await fetch('/api/ai/share-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: joke.content,
          url: generateShareUrl(joke.id, joke.content, joke.updateTime, getRoutePrefix()),
        }),
      })
      const data = await res.json()
      if (data.code === 1 && data.data.imageUrl && data.data.qrCodeUrl) {
        // 使用 Canvas 合成分享图片
        const mergedImageUrl = await generateShareImageCanvas(
          data.data.imageUrl,
          data.data.qrCodeUrl,
          joke.content
        )
        setShareImageUrl(mergedImageUrl)
      } else {
        toast.error(data.msg || '分享图片生成失败')
      }
    } catch (error) {
      console.error('Generate share image error:', error)
      toast.error('分享图片生成失败')
    } finally {
      setGeneratingShareImage(false)
    }
  }

  // 复制链接
  const handleCopyLink = async () => {
    if (!joke) return
    const url = generateShareUrl(joke.id, joke.content, joke.updateTime, getRoutePrefix())
    try {
      await navigator.clipboard.writeText(url)
      toast.success('链接已复制')
    } catch {
      toast.error('复制失败')
    }
  }

  // 生成动画视频
  const handleGenerateVideo = async () => {
    if (!joke) return
    setGeneratingVideo(true)
    setVideoUrl(null)
    setVideoProgress(0)

    try {
      // 先获取AI配图
      const imageRes = await fetch('/api/ai/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: joke.content }),
      })
      const imageData = await imageRes.json()

      if (imageData.code !== 1 || !imageData.data.url) {
        toast.error('图片生成失败，无法生成视频')
        setGeneratingVideo(false)
        return
      }

      // 调用视频生成API
      const res = await fetch('/api/ai/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: joke.content,
          imageUrl: imageData.data.url,
        }),
      })
      const data = await res.json()

      if (data.code === 1 && data.data.taskId) {
        setVideoTaskId(data.data.taskId)
        // 开始轮询视频生成状态
        pollVideoStatus(data.data.taskId)
      } else {
        toast.error(data.msg || '视频生成失败，请配置 PIKA_API_KEY')
        setGeneratingVideo(false)
      }
    } catch (error) {
      console.error('Generate video error:', error)
      toast.error('视频生成失败')
      setGeneratingVideo(false)
    }
  }

  // 轮询视频生成状态
  const pollVideoStatus = async (taskId: string) => {
    const checkStatus = async () => {
      try {
        const res = await fetch(`/api/ai/video?taskId=${taskId}`)
        const data = await res.json()

        if (data.code === 1 && data.data) {
          setVideoProgress(data.data.progress || 0)

          if (data.data.status === 'completed' && data.data.videoUrl) {
            setVideoUrl(data.data.videoUrl)
            setGeneratingVideo(false)
            toast.success('视频生成完成！')
            return true
          } else if (data.data.status === 'failed') {
            toast.error('视频生成失败')
            setGeneratingVideo(false)
            return true
          }
        }
        return false
      } catch {
        return false
      }
    }

    // 每3秒轮询一次
    const interval = setInterval(async () => {
      const done = await checkStatus()
      if (done) {
        clearInterval(interval)
      }
    }, 3000)
  }

  // 保存视频
  const handleSaveVideo = async () => {
    if (!videoUrl) return
    try {
      const response = await fetch(videoUrl)
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `punchliner-video-${Date.now()}.mp4`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('视频已保存')
    } catch {
      toast.error('保存失败')
    }
  }

  // 保存分享图片
  const handleSaveShareImage = async () => {
    if (!shareImageUrl) return
    try {
      const response = await fetch(shareImageUrl)
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `punchliner-share-${Date.now()}.png`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('图片已保存')
    } catch {
      toast.error('保存失败')
    }
  }

  // 使用 Canvas 合成分享图片
  const generateShareImageCanvas = async (
    imageUrl: string,
    qrCodeUrl: string,
    content: string
  ): Promise<string> => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')

      if (!ctx) {
        reject(new Error('Canvas not supported'))
        return
      }

      // 设置画布大小为 16:9 比例 (800x450)
      const width = 800
      const height = 450
      canvas.width = width
      canvas.height = height

      // 使用代理URL加载图片，解决CORS问题
      const proxyImageUrl = `/api/proxy/image?url=${encodeURIComponent(imageUrl)}`

      // 加载AI生成的图片
      const img = new window.Image()
      img.onload = async () => {
        // 绘制背景
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, width, height)

        // 绘制AI图片（上半部分，约55%高度）
        const imageHeight = Math.floor(height * 0.55)
        ctx.drawImage(img, 0, 0, width, imageHeight)

        // 绘制下半部分背景
        ctx.fillStyle = '#f5f5f5'
        ctx.fillRect(0, imageHeight, width, height - imageHeight)

        // 绘制分隔线
        ctx.strokeStyle = '#e0e0e0'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(0, imageHeight)
        ctx.lineTo(width, imageHeight)
        ctx.stroke()

        // 绘制文字内容（左半部分）
        ctx.fillStyle = '#333333'
        ctx.font = 'bold 20px "PingFang SC", "Microsoft YaHei", sans-serif'

        // 文字截断处理，最多显示3行
        const maxLines = 3
        const maxCharsPerLine = 20
        const lines: string[] = []
        const allChars = content.split('')

        for (let i = 0; i < maxLines; i++) {
          const start = i * maxCharsPerLine
          const line = allChars.slice(start, start + maxCharsPerLine).join('')
          if (line) {
            lines.push(line + (start + maxCharsPerLine < allChars.length ? '...' : ''))
          }
        }

        const textX = 20
        const textY = imageHeight + 40
        const lineHeight = 28

        lines.forEach((line, index) => {
          ctx.fillText(line, textX, textY + index * lineHeight)
        })

        // 绘制二维码（右下角）
        const qrImg = new window.Image()
        qrImg.crossOrigin = 'anonymous'
        qrImg.onload = () => {
          const qrSize = 100
          const qrX = width - qrSize - 20
          const qrY = height - qrSize - 20
          ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize)

          // 绘制"扫码看更多"文字
          ctx.fillStyle = '#999999'
          ctx.font = '12px "PingFang SC", "Microsoft YaHei", sans-serif'
          ctx.fillText('扫码看更多', qrX, qrY - 8)

          resolve(canvas.toDataURL('image/png'))
        }
        qrImg.onerror = () => {
          // 二维码加载失败，只返回图片部分
          resolve(canvas.toDataURL('image/png'))
        }
        qrImg.src = qrCodeUrl
      }
      img.onerror = () => {
        reject(new Error('Failed to load image'))
      }
      img.src = proxyImageUrl
    })
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
            onClick={() => setShareModalVisible(true)}
            className={styles.actionBtn}
            aria-label="分享"
          >
            <ShareAltOutlined />
          </button>
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

      {/* 分享弹窗 */}
      <Modal
        open={shareModalVisible}
        onCancel={() => {
          setShareModalVisible(false)
          setShareImageUrl(null)
          setVideoUrl(null)
          setVideoTaskId(null)
          setVideoProgress(0)
        }}
        footer={null}
        title="分享"
        centered
        width={400}
      >
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          {generatingShareImage ? (
            <div>
              <LoadingOutlined spin style={{ fontSize: 32 }} />
              <p style={{ marginTop: 16 }}>正在生成分享图片...</p>
            </div>
          ) : shareImageUrl ? (
            <div>
              <AntImage
                src={shareImageUrl}
                alt="分享图片"
                style={{ maxWidth: '100%', borderRadius: 8 }}
              />
              <div style={{ marginTop: 16, display: 'flex', gap: 12, justifyContent: 'center' }}>
                <Button icon={<DownloadOutlined />} onClick={handleSaveShareImage}>
                  保存图片
                </Button>
                <Button type="primary" onClick={handleCopyLink}>
                  复制链接
                </Button>
              </div>
            </div>
          ) : generatingVideo ? (
            <div>
              <LoadingOutlined spin style={{ fontSize: 32 }} />
              <p style={{ marginTop: 16 }}>正在生成动画视频...</p>
              <p style={{ marginTop: 8, color: '#999' }}>
                进度: {Math.round(videoProgress * 100)}%
              </p>
              <p style={{ marginTop: 8, fontSize: 12, color: '#ccc' }}>
                请耐心等待，可能需要30-60秒
              </p>
            </div>
          ) : videoUrl ? (
            <div>
              {/* biome-ignore lint/a11y/useMediaCaption: 视频不需要字幕 */}
              <video src={videoUrl} controls style={{ width: '100%', borderRadius: 8 }} />
              <div style={{ marginTop: 16, display: 'flex', gap: 12, justifyContent: 'center' }}>
                <Button icon={<DownloadOutlined />} onClick={handleSaveVideo}>
                  保存视频
                </Button>
                <Button type="primary" onClick={handleCopyLink}>
                  复制链接
                </Button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Button
                type="primary"
                size="large"
                icon={<ShareAltOutlined />}
                onClick={handleGenerateShareImage}
                block
              >
                生成分享图片
              </Button>
              <Button size="large" icon={<CopyOutlined />} onClick={handleCopyLink} block>
                复制链接
              </Button>
              <Button
                size="large"
                icon={<LoadingOutlined spin={generatingVideo} />}
                onClick={handleGenerateVideo}
                block
                disabled={generatingVideo}
              >
                生成动画视频 (Beta)
              </Button>
              <p style={{ fontSize: 12, color: '#999', marginTop: 8 }}>
                动画视频需要配置 PIKA_API_KEY
              </p>
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
