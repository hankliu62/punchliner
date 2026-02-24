'use client'

import {
  ArrowLeftOutlined,
  CopyOutlined,
  DownloadOutlined,
  HeartFilled,
  HeartOutlined,
  LinkOutlined,
  LoadingOutlined,
  ShareAltOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons'
import { Image as AntImage, Button, Modal, Segmented, Skeleton } from 'antd'
import { useRouter, useSearchParams } from 'next/navigation'
import { use, useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { generateShareUrl, getContentFromUrl } from '@/lib/crypto'
import { getRoutePrefix } from '@/lib/route'
import { getVideoCache, saveVideoCache } from '@/lib/video-cache'
import type { AIAction, AIActionType, CollectItem, Joke } from '@/types'
import { AI_ACTIONS, REWRITE_STYLES } from '@/types'
import styles from './page.module.css'

// 图片分享 loading 组件
function ImageShareLoading({
  title = '正在生成分享图片',
  subtitle = 'AI 正在创作中...',
}: {
  title?: string
  subtitle?: string
}) {
  return (
    <div className={styles.loadingWrapper}>
      <div className={styles.loadingIconWrapper}>
        <div className={styles.loadingOrbit}></div>
        <LoadingOutlined spin className={styles.loadingIcon} />
      </div>
      <p className={styles.loadingTitle}>{title}</p>
      <p className={styles.loadingSubtitle}>{subtitle}</p>
      <div className={styles.loadingProgress}>
        <div className={styles.loadingProgressBar}></div>
      </div>
    </div>
  )
}

// 视频生成 loading 组件
function VideoGeneratingLoading({ progress = 0 }: { progress: number }) {
  return (
    <div className={styles.loadingWrapper}>
      <div className={styles.loadingIconWrapper}>
        <div className={styles.loadingOrbit}></div>
        <LoadingOutlined spin className={styles.loadingIcon} />
      </div>
      <p className={styles.loadingTitle}>正在生成动画视频</p>
      <p className={styles.loadingSubtitle}>AI 正在渲染中...</p>
      <div className={styles.loadingProgress}>
        <div className={styles.loadingProgressBar} style={{ width: `${progress}%` }}></div>
      </div>
      <p className={styles.loadingPercent}>{progress}%</p>
    </div>
  )
}

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

  // 优先从短ID参数获取（新的服务端存储方式）
  const shareId = searchParams.get('s')
  // 兼容旧版Base64加密参数
  const content = searchParams.get('content') || '' // 旧参数，保留兼容
  const updateTime = searchParams.get('time') || '' // 旧参数，保留兼容

  const [joke, setJoke] = useState<Joke | null>(null)
  const [isCollected, setIsCollected] = useState(false)
  const [activeAction, setActiveAction] = useState<AIActionType | null>(null)
  const [aiResult, setAiResult] = useState<string | null>(null)
  const [aiImageUrl, setAiImageUrl] = useState<string | null>(null)
  const [aiError, setAiError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [rewriteStyle, setRewriteStyle] = useState<string>('冷幽默')
  const [shareModalVisible, setShareModalVisible] = useState(false)
  const [shareImageUrl, setShareImageUrl] = useState<string | null>(null)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [generatingShareImage, setGeneratingShareImage] = useState(false)
  const [shareImageError, setShareImageError] = useState<string | null>(null)
  // 动画视频相关状态
  const [generatingVideo, setGeneratingVideo] = useState(false)
  const [_videoTaskId, setVideoTaskId] = useState<string | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [videoProgress, setVideoProgress] = useState(0)
  const [videoError, setVideoError] = useState<string | null>(null)
  const [modalTitle, setModalTitle] = useState<string>('分享') // 弹窗标题

  // 使用 ref 避免无限循环
  const initialized = useRef(false)

  // 从服务端获取分享内容
  // biome-ignore lint/correctness/useExhaustiveDependencies: 只需要在shareId或id变化时执行一次
  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    const fetchContent = async () => {
      if (shareId) {
        try {
          const res = await fetch(`/api/ai/share-image?s=${shareId}`)
          const data = await res.json()
          if (data.code === 1 && data.data) {
            setJoke({ id, content: data.data.content, updateTime: data.data.updateTime })
            const collects = getCollects()
            setIsCollected(collects.some((item) => item.id === id))
            return
          }
        } catch (error) {
          console.error('Failed to fetch share content:', error)
        }
      }

      // 旧版逻辑：从URL参数获取
      const encryptedData = getContentFromUrl(searchParams)
      if (content || encryptedData?.content) {
        const finalContent = encryptedData?.content || content
        const finalTime = encryptedData?.updateTime || updateTime
        setJoke({ id, content: finalContent, updateTime: finalTime })
        const collects = getCollects()
        setIsCollected(collects.some((item) => item.id === id))
      }
    }

    fetchContent()
  }, [shareId, id]) // 只依赖 shareId 和 id

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
    setAiError(null)

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
          setAiError(data.msg || '图片生成失败')
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
          setAiError(data.msg || 'AI 生成失败')
          toast.error(data.msg || 'AI 生成失败')
        }
      }
    } catch (error) {
      console.error('AI action error:', error)
      setAiError('网络错误，请稍后重试')
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
          id: joke.id,
          updateTime: joke.updateTime,
        }),
      })
      const data = await res.json()
      if (data.code === 1 && data.data.imageUrl && data.data.qrCodeUrl) {
        // 保存分享链接
        if (data.data.shareUrl) {
          setShareUrl(data.data.shareUrl)
        }
        // 使用 Canvas 合成分享图片
        const mergedImageUrl = await generateShareImageCanvas(
          data.data.imageUrl,
          data.data.qrCodeUrl,
          joke.content
        )
        setShareImageUrl(mergedImageUrl)
      } else {
        setShareImageError(data.msg || '分享图片生成失败')
        toast.error(data.msg || '分享图片生成失败')
      }
    } catch (error) {
      console.error('Generate share image error:', error)
      setShareImageError('网络错误，请稍后重试')
      toast.error('分享图片生成失败')
    } finally {
      setGeneratingShareImage(false)
    }
  }

  // 复制链接
  const handleCopyLink = async () => {
    if (!joke) return
    // 优先使用服务端生成的短链接
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
    const url = shareUrl
      ? baseUrl + shareUrl
      : generateShareUrl(joke.id, joke.content, joke.updateTime, baseUrl + getRoutePrefix())
    try {
      await navigator.clipboard.writeText(url)
      toast.success('链接已复制')
    } catch {
      toast.error('复制失败')
    }
  }

  // 生成动画视频（使用SSE实时推送进度）
  const handleGenerateVideo = async () => {
    if (!joke) return

    // 设置弹窗标题为"视频生成"
    setModalTitle('视频生成')

    // 首先检查缓存
    const cachedVideoUrl = getVideoCache(joke.content)
    if (cachedVideoUrl) {
      setVideoUrl(cachedVideoUrl)
      setGeneratingVideo(false)
      setShareModalVisible(true)
      return
    }

    setGeneratingVideo(true)
    setVideoUrl(null)
    setVideoProgress(0)
    setVideoError(null)
    setShareModalVisible(true)

    try {
      // 调用视频生成API，获取taskId
      const res = await fetch('/api/ai/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: joke.content,
        }),
      })
      const data = await res.json()

      if (data.code !== 1 || !data.data.taskId) {
        const errorMsg = data.msg || '视频生成失败'
        toast.error(errorMsg)
        setVideoError(errorMsg)
        setGeneratingVideo(false)
        return
      }

      // 使用SSE连接实时获取进度
      const eventSource = new EventSource(`/api/ai/video?taskId=${data.data.taskId}`)

      eventSource.onmessage = (event) => {
        try {
          const result = JSON.parse(event.data)

          if (result.status === 'processing') {
            // 更新进度
            setVideoProgress(result.progress || 0)
          } else if (result.status === 'completed') {
            // 视频生成完成
            eventSource.close()
            setVideoProgress(100)
            if (result.videoUrl) {
              setVideoUrl(result.videoUrl)
              // 保存到缓存
              if (joke) {
                saveVideoCache(joke.content, result.videoUrl)
              }
            }
            setGeneratingVideo(false)
            toast.success('视频生成完成！')
          } else if (result.status === 'failed') {
            // 视频生成失败
            eventSource.close()
            const errorMsg = result.error || '视频生成失败'
            toast.error(errorMsg)
            setVideoError(errorMsg)
            setGeneratingVideo(false)
          }
        } catch (parseError) {
          console.error('SSE parse error:', parseError)
        }
      }

      eventSource.onerror = () => {
        eventSource.close()
        // 如果已经拿到了videoUrl，就不报错
        if (!videoUrl) {
          const errorMsg = '视频生成连接失败'
          toast.error(errorMsg)
          setVideoError(errorMsg)
          setGeneratingVideo(false)
        }
      }
    } catch (error) {
      console.error('Generate video error:', error)
      const errorMsg = '视频生成失败，请重试'
      toast.error(errorMsg)
      setVideoError(errorMsg)
      setGeneratingVideo(false)
    }
  }

  // 保存视频
  const handleSaveVideo = async () => {
    if (!videoUrl) return
    try {
      // 使用代理下载视频，解决跨域问题
      const proxyUrl = `/api/proxy/video?url=${encodeURIComponent(videoUrl)}`
      const response = await fetch(proxyUrl)
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

      // 设置画布大小 (600x810，底部留白约24px)
      const width = 600
      const height = 810
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

        // 上部分：AI图片 1:1 正方形 (宽度占满，高度根据宽度自适应)
        const imageSize = width
        ctx.drawImage(img, 0, 0, imageSize, imageSize)

        // 下部分背景
        ctx.fillStyle = '#f8f8f8'
        ctx.fillRect(0, imageSize, width, height - imageSize)

        // 绘制分隔线
        ctx.strokeStyle = '#e0e0e0'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(0, imageSize)
        ctx.lineTo(width, imageSize)
        ctx.stroke()

        // 准备文字内容 - 从最后开始显示，显示最后3行
        ctx.fillStyle = '#333333'
        ctx.font = 'bold 22px "PingFang SC", "Microsoft YaHei", sans-serif'

        const maxLines = 3
        const maxCharsPerLine = 18
        const allChars = content.split('')
        const totalChars = allChars.length

        // 计算需要显示的行数
        let lines: string[] = []
        if (totalChars <= maxCharsPerLine) {
          // 内容只有一行，直接显示
          lines = [content]
        } else {
          // 从最后开始计算显示的行数
          const startIndex = Math.max(0, totalChars - maxCharsPerLine * maxLines)
          const displayChars = allChars.slice(startIndex)
          const displayText = displayChars.join('')

          // 分割成多行
          for (let i = 0; i < maxLines; i++) {
            const start = i * maxCharsPerLine
            const line = displayText.slice(start, start + maxCharsPerLine)
            if (line) {
              // 只在非最后一行或完整显示时添加省略号
              const needsEllipsis =
                startIndex > 0 && i === maxLines - 1 && start + maxCharsPerLine < totalChars
              lines.push(line + (needsEllipsis ? '...' : ''))
            }
          }
        }

        // 二维码区域
        const qrSize = 140
        const qrX = width - qrSize - 20
        const qrY = imageSize + 24 // 二维码上方留24px间隔

        // 加载二维码
        const qrImg = new window.Image()
        qrImg.crossOrigin = 'anonymous'
        qrImg.onload = () => {
          // 计算文字区域
          const textX = 20

          // 计算文字垂直居中
          const lineHeight = 32
          const totalTextHeight = lines.length * lineHeight
          const qrContentHeight = height - imageSize - 24
          const availableHeight = qrContentHeight

          // 如果内容比二维码区域短，居中显示
          const isShortContent = totalTextHeight < qrSize
          const textStartY = isShortContent
            ? imageSize + (availableHeight - totalTextHeight) / 2
            : qrY + qrSize + 10

          // 绘制文字
          lines.forEach((line, index) => {
            ctx.fillText(line, textX, textStartY + index * lineHeight)
          })

          // 绘制二维码
          ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize)

          // 绘制"扫码看更多"文字（二维码下方6px间隔）
          ctx.fillStyle = '#999999'
          ctx.font = '12px "PingFang SC", "Microsoft YaHei", sans-serif'
          ctx.fillText('扫码看更多', qrX, qrY + qrSize + 6)

          resolve(canvas.toDataURL('image/png'))
        }
        qrImg.onerror = () => {
          // 二维码加载失败，只返回上半部分
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
            onClick={handleCopyLink}
            className={styles.actionBtn}
            aria-label="复制链接"
            title="复制链接"
          >
            <LinkOutlined />
          </button>
          <button
            type="button"
            onClick={() => {
              setModalTitle('分享')
              setShareModalVisible(true)
              if (!shareImageUrl && !generatingShareImage) {
                handleGenerateShareImage()
              }
            }}
            className={styles.actionBtn}
            aria-label="分享"
            title="分享"
          >
            <ShareAltOutlined />
          </button>
          <button
            type="button"
            onClick={() => {
              // 如果有缓存视频，直接显示
              if (joke) {
                const cachedVideoUrl = getVideoCache(joke.content)
                if (cachedVideoUrl) {
                  setModalTitle('视频生成')
                  setVideoUrl(cachedVideoUrl)
                  setShareModalVisible(true)
                  return
                }
              }
              // 没有缓存则生成新视频
              if (!videoUrl && !generatingVideo) {
                handleGenerateVideo()
              } else {
                setModalTitle('视频生成')
                setShareModalVisible(true)
              }
            }}
            className={styles.actionBtn}
            aria-label="生成视频"
            title="生成视频"
          >
            {generatingVideo ? <LoadingOutlined spin /> : <VideoCameraOutlined />}
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

          {(loading || aiResult || aiImageUrl || aiError) && (
            <div className={styles.resultSection}>
              {loading ? (
                <div className={styles.loadingWrapper}>
                  <div className={styles.loadingIconWrapper}>
                    <div className={styles.loadingOrbit}></div>
                    <LoadingOutlined spin className={styles.loadingIcon} />
                  </div>
                  <p className={styles.loadingTitle}>AI 正在创作中</p>
                  <p className={styles.loadingSubtitle}>请稍候...</p>
                  <div className={styles.loadingProgress}>
                    <div className={styles.loadingProgressBar}></div>
                  </div>
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
              ) : aiError ? (
                <div className={styles.errorWrapper}>
                  <div className={styles.errorIconWrapper}>
                    <div className={styles.errorCircle}>
                      <span className={styles.errorX}>×</span>
                    </div>
                  </div>
                  <p className={styles.errorTitle}>生成失败</p>
                  <p className={styles.errorMessage}>{aiError}</p>
                  {activeAction && (
                    <Button
                      type="primary"
                      onClick={() => {
                        const action = AI_ACTIONS.find((a) => a.type === activeAction)
                        if (action) handleAIAction(action)
                      }}
                      block
                    >
                      重试
                    </Button>
                  )}
                </div>
              ) : null}
            </div>
          )}
        </section>
      </main>

      {/* 分享/视频生成弹窗 */}
      <Modal
        open={shareModalVisible}
        onCancel={() => {
          setShareModalVisible(false)
          setShareImageUrl(null)
          setShareUrl(null)
          setShareImageError(null)
          setVideoUrl(null)
          setVideoTaskId(null)
          setVideoProgress(0)
          setVideoError(null)
        }}
        footer={null}
        title={modalTitle}
        centered
        width={420}
      >
        <div style={{ textAlign: 'center', padding: '20px 0', minHeight: 360 }}>
          {/* 占位符：保持最小高度，避免高度变化 */}
          <div style={{ minHeight: 280 }}>
            {generatingShareImage ? (
              <ImageShareLoading />
            ) : shareImageUrl ? (
              <div>
                <AntImage
                  src={shareImageUrl}
                  alt="分享图片"
                  style={{ maxWidth: '100%', borderRadius: 12, minHeight: 280 }}
                  preview={false}
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
              <VideoGeneratingLoading progress={videoProgress} />
            ) : videoUrl ? (
              <div>
                {/* biome-ignore lint/a11y/useMediaCaption: 视频不需要字幕 */}
                <video
                  src={`/api/proxy/video?url=${encodeURIComponent(videoUrl)}`}
                  controls
                  style={{ width: '100%', borderRadius: 12, minHeight: 280 }}
                />
                <div style={{ marginTop: 16, display: 'flex', gap: 12, justifyContent: 'center' }}>
                  <Button icon={<DownloadOutlined />} onClick={handleSaveVideo}>
                    保存视频
                  </Button>
                  <Button type="primary" onClick={handleCopyLink}>
                    复制链接
                  </Button>
                </div>
              </div>
            ) : videoError ? (
              <div className={styles.errorWrapper}>
                <div className={styles.errorIconWrapper}>
                  <div className={styles.errorCircle}>
                    <span className={styles.errorX}>×</span>
                  </div>
                </div>
                <p className={styles.errorTitle}>生成失败</p>
                <p className={styles.errorMessage}>{videoError}</p>
                <Button
                  type="primary"
                  size="large"
                  icon={<VideoCameraOutlined />}
                  onClick={() => {
                    setVideoError(null)
                    handleGenerateVideo()
                  }}
                  block
                >
                  重试
                </Button>
              </div>
            ) : shareImageError ? (
              <div className={styles.errorWrapper}>
                <div className={styles.errorIconWrapper}>
                  <div className={styles.errorCircle}>
                    <span className={styles.errorX}>×</span>
                  </div>
                </div>
                <p className={styles.errorTitle}>生成失败</p>
                <p className={styles.errorMessage}>{shareImageError}</p>
                <Button
                  type="primary"
                  size="large"
                  icon={<ShareAltOutlined />}
                  onClick={() => {
                    setShareImageError(null)
                    handleGenerateShareImage()
                  }}
                  block
                >
                  重试
                </Button>
              </div>
            ) : null}
          </div>

          {/* 初始状态按钮（当没有生成任何内容且没有错误时显示） */}
          {!generatingShareImage &&
            !shareImageUrl &&
            !generatingVideo &&
            !videoUrl &&
            !shareImageError &&
            !videoError && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 20 }}>
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
                >
                  生成动画视频 (Beta)
                </Button>
              </div>
            )}
        </div>
      </Modal>
    </div>
  )
}
