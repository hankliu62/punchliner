'use client'

import {
  ArrowLeftOutlined,
  CopyOutlined,
  DownloadOutlined,
  HeartFilled,
  HeartOutlined,
  LinkOutlined,
  LoadingOutlined,
} from '@ant-design/icons'
import { Image as AntImage, Button, Skeleton } from 'antd'
import { useRouter, useSearchParams } from 'next/navigation'
import { use, useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { decodeParams, encodeParams } from '@/lib/crypto'
import type { CollectItem, Joke } from '@/types'
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

// 智能断句函数 - 按句子拆分冷笑话
function splitIntoSentences(content: string): string[] {
  // 匹配常见的句末符号：。！？；以及它们的组合
  const sentences = content.split(/([。！？；]+)/).filter((s) => s.trim().length > 0)

  // 重新组合句子和标点
  const result: string[] = []
  for (let i = 0; i < sentences.length; i += 2) {
    const sentence = sentences[i] || ''
    const punctuation = sentences[i + 1] || ''
    if (sentence.trim()) {
      result.push(sentence.trim() + punctuation)
    }
  }

  // 如果没有分隔开，返回原始内容作为单句
  if (result.length === 0) {
    return [content]
  }

  return result
}

export default function ColdJokeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  // 使用 use 解析 Promise 参数
  const resolvedParams = use(params)
  const jokeId = resolvedParams.id

  const router = useRouter()
  const searchParams = useSearchParams()

  // 从查询参数获取内容（Base64加密）
  const encryptedData = searchParams.get('data')
  let content = ''
  let updateTime = ''

  if (encryptedData) {
    const decoded = decodeParams(encryptedData)
    if (decoded) {
      content = decoded.content || ''
      updateTime = decoded.time || ''
    }
  }

  const [joke, setJoke] = useState<Joke | null>(null)
  const [isCollected, setIsCollected] = useState(false)
  const [generatingImage, setGeneratingImage] = useState(false)
  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [imageError, setImageError] = useState<string | null>(null)
  const [generatingSimilar, setGeneratingSimilar] = useState(false)
  const [similarJokes, setSimilarJokes] = useState<Joke[]>([])
  const [similarError, setSimilarError] = useState<string | null>(null)

  // 使用 ref 避免无限循环
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    if (content) {
      setJoke({
        id: String(jokeId),
        content: decodeURIComponent(content),
        updateTime: decodeURIComponent(updateTime),
      })
      const collects = getCollects()
      setIsCollected(collects.some((item) => item.id === String(jokeId)))
    }
  }, [jokeId, content, updateTime])

  // 计算句子数量（用于确定宫格数）
  const sentences = joke ? splitIntoSentences(joke.content) : []
  const gridCount = sentences.length

  // 本地猫咪图片列表
  const catImages = [
    '/Camera_1040g3k831n5t2j3vl2d05p4612e43ojud7380e8.jpg',
    '/Camera_1040g3k831n5t2j3vl2dg5p4612e43oju6gr8tfo.jpg',
  ]

  // 随机获取猫咪图片
  const getRandomCatImage = (index: number): string => {
    return catImages[index % catImages.length]
  }

  // 单个格子的尺寸（根据示例图片比例）
  const CELL_WIDTH = 340
  const CELL_HEIGHT = 380
  const GAP = 10

  // 绘制圆角矩形的辅助函数
  const roundedRect = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number
  ) => {
    ctx.beginPath()
    ctx.moveTo(x + radius, y)
    ctx.lineTo(x + width - radius, y)
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius)
    ctx.lineTo(x + width, y + height - radius)
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
    ctx.lineTo(x + radius, y + height)
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius)
    ctx.lineTo(x, y + radius)
    ctx.quadraticCurveTo(x, y, x + radius, y)
    ctx.closePath()
  }

  // 文字换行辅助函数
  const wrapText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] => {
    const lines: string[] = []
    let currentLine = ''

    for (const char of text) {
      const testLine = currentLine + char
      const metrics = ctx.measureText(testLine)
      if (metrics.width > maxWidth && currentLine !== '') {
        lines.push(currentLine)
        currentLine = char
      } else {
        currentLine = testLine
      }
    }
    if (currentLine) {
      lines.push(currentLine)
    }

    // 限制最多显示2行
    return lines.slice(0, 2)
  }

  // 用Canvas合成多宫格图片：每个断句是独立的黑色边框白色背景长方形框
  const composeGridImage = async (sentenceList: string[]): Promise<string> => {
    // 先为每个句子生成AI猫咪图片
    const catImageUrls: string[] = []
    for (const sentence of sentenceList) {
      try {
        const res = await fetch('/api/ai/image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: sentence,
            style: 'cold',
          }),
        })
        const data = await res.json()
        if (data.code === 1 && data.data.url) {
          // 使用代理URL
          catImageUrls.push(`/api/proxy/image?url=${encodeURIComponent(data.data.url)}`)
        } else {
          catImageUrls.push(getRandomCatImage(catImageUrls.length))
        }
      } catch {
        catImageUrls.push(getRandomCatImage(catImageUrls.length))
      }
    }

    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Canvas not supported'))
        return
      }

      // 计算画布大小（纵向排列）
      const gridRows = sentenceList.length
      const totalHeight = gridRows * CELL_HEIGHT + (gridRows - 1) * GAP
      canvas.width = CELL_WIDTH
      canvas.height = totalHeight

      // 绘制每个格子
      const drawCell = (index: number): Promise<void> => {
        return new Promise((resolveDraw) => {
          const y = index * (CELL_HEIGHT + GAP)

          // 1. 绘制白色背景
          ctx.fillStyle = '#FFFFFF'
          ctx.fillRect(0, y, CELL_WIDTH, CELL_HEIGHT)

          // 2. 绘制黑色边框的长方形框 (border-radius: 4px)
          const padding = 2
          const boxX = padding
          const boxY = y + padding
          const boxWidth = CELL_WIDTH - padding * 2
          const boxHeight = CELL_HEIGHT - padding * 2

          // 绘制黑色边框（描边）
          ctx.strokeStyle = '#000000'
          ctx.lineWidth = 4
          roundedRect(ctx, boxX, boxY, boxWidth, boxHeight, 4)
          ctx.stroke()

          // 3. 加载并绘制猫咪图片（在框内）
          const img = new window.Image()
          img.crossOrigin = 'anonymous'
          img.onload = () => {
            // 猫咪图片区域：上半部分
            const imgAreaHeight = boxHeight * 0.55
            const imgSize = Math.min(boxWidth * 0.7, imgAreaHeight * 0.8)
            const imgX = boxX + (boxWidth - imgSize) / 2
            const imgY = boxY + 20

            ctx.drawImage(img, imgX, imgY, imgSize, imgSize)

            // 4. 绘制文字（黑色，在框内下半部分）
            ctx.fillStyle = '#000000'
            ctx.font = '500 15px "PingFang SC", "Microsoft YaHei", sans-serif'
            ctx.textAlign = 'center'
            ctx.textBaseline = 'top'

            const textMaxWidth = boxWidth - 30
            const textAreaY = imgY + imgSize + 15

            const lines = wrapText(ctx, sentenceList[index], textMaxWidth)
            const lineHeight = 20

            lines.slice(-3).forEach((line, lineIndex) => {
              const lineY = textAreaY + lineIndex * lineHeight
              if (lineY + lineHeight < boxY + boxHeight - 15) {
                ctx.fillText(line, boxX + boxWidth / 2, lineY)
              }
            })

            resolveDraw()
          }
          img.onerror = () => {
            // 图片加载失败，只绘制文字
            ctx.fillStyle = '#000000'
            ctx.font = '500 15px "PingFang SC", "Microsoft YaHei", sans-serif'
            ctx.textAlign = 'center'
            ctx.textBaseline = 'top'

            const textMaxWidth = boxWidth - 30
            const textAreaY = boxY + 80
            const lines = wrapText(ctx, sentenceList[index], textMaxWidth)
            const lineHeight = 20

            lines.slice(-3).forEach((line, lineIndex) => {
              ctx.fillText(line, boxX + boxWidth / 2, textAreaY + lineIndex * lineHeight)
            })

            resolveDraw()
          }
          img.src = catImageUrls[index] || getRandomCatImage(index)
        })
      }

      // 顺序绘制所有格子
      ;(async () => {
        for (let i = 0; i < sentenceList.length; i++) {
          await drawCell(i)
        }
        resolve(canvas.toDataURL('image/png'))
      })()
    })
  }

  const handleCollect = () => {
    if (!joke) return

    if (isCollected) {
      const collects = getCollects().filter((item) => item.id !== String(jokeId))
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

  // 生成配图 - 每个句子生成一张图片，然后合成
  const handleGenerateImage = async () => {
    if (!joke) return
    setGeneratingImage(true)
    setImageUrls([])
    setImageError(null)

    try {
      const sentences = splitIntoSentences(joke.content)

      // 直接使用本地猫咪图片合成多宫格
      const composedUrl = await composeGridImage(sentences)

      if (composedUrl) {
        setImageUrls([composedUrl]) // 只有一张合成图
      } else {
        setImageError('图片生成失败')
        toast.error('图片生成失败')
      }
    } catch (error) {
      console.error('Image generation error:', error)
      setImageError('网络错误，请稍后重试')
      toast.error('图片生成失败，请重试')
    } finally {
      setGeneratingImage(false)
    }
  }

  // 生成类似冷笑话
  const handleGenerateSimilar = async () => {
    if (!joke) return
    setGeneratingSimilar(true)
    setSimilarJokes([])
    setSimilarError(null)

    try {
      const res = await fetch('/api/ai/generate-similar-cold', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: joke.content,
        }),
      })
      const data = await res.json()
      if (data.code === 1 && data.data) {
        setSimilarJokes(data.data)
      } else {
        setSimilarError(data.msg || '生成失败')
        toast.error(data.msg || '生成失败')
      }
    } catch (error) {
      console.error('Generate similar error:', error)
      setSimilarError('网络错误，请稍后重试')
      toast.error('生成失败，请重试')
    } finally {
      setGeneratingSimilar(false)
    }
  }

  const handleDownloadImage = async (url: string, index: number) => {
    try {
      const response = await fetch(url)
      const blob = await response.blob()
      const urlObj = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = urlObj
      a.download = `cold-joke-${Date.now()}-${index + 1}.png`
      a.click()
      URL.revokeObjectURL(urlObj)
      toast.success('图片已下载')
    } catch {
      toast.error('下载失败')
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

  const handleCopyLink = async () => {
    if (!joke) return
    const url = typeof window !== 'undefined' ? window.location.href : ''
    try {
      await navigator.clipboard.writeText(url)
      toast.success('链接已复制')
    } catch {
      toast.error('复制失败')
    }
  }

  // 跳转到类似冷笑话详情
  const handleSimilarClick = (similarJoke: Joke) => {
    router.push(
      `/cold-joke/${similarJoke.id}?data=${encodeParams({ content: similarJoke.content, time: similarJoke.updateTime })}`
    )
  }

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
        <h1 className={styles.title}>冷笑话详情</h1>
        <div className={styles.headerActions}>
          <button
            type="button"
            onClick={handleCopyLink}
            className={styles.actionBtn}
            aria-label="复制链接"
          >
            <LinkOutlined />
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
            <span className={styles.updateTime}>
              {joke.updateTime} · {gridCount}宫格
            </span>
          </div>
        </section>

        {/* 操作按钮 */}
        <section className={styles.actionSection}>
          <button type="button" className={styles.actionBtnLarge} onClick={handleGenerateImage}>
            <span className={styles.actionIcon}>🖼️</span>
            <span className={styles.actionLabel}>生成配图</span>
          </button>
          <button type="button" className={styles.actionBtnLarge} onClick={handleGenerateSimilar}>
            <span className={styles.actionIcon}>💡</span>
            <span className={styles.actionLabel}>类似冷笑话</span>
          </button>
        </section>

        {/* 生成的配图 */}
        {(generatingImage || imageUrls.length > 0 || imageError) && (
          <section className={styles.imageSection}>
            <h3 className={styles.sectionTitle}>🖼️ 配图</h3>
            {generatingImage ? (
              <div className={styles.loadingWrapper}>
                <div className={styles.loadingIconWrapper}>
                  <div className={styles.loadingOrbit}></div>
                  <LoadingOutlined spin className={styles.loadingIcon} />
                </div>
                <p className={styles.loadingTitle}>正在生成配图</p>
                <p className={styles.loadingSubtitle}>共{gridCount}张，请稍候...</p>
              </div>
            ) : imageUrls.length > 0 ? (
              <div className={styles.imageGrid}>
                {imageUrls.map((url, index) => (
                  <div key={index} className={styles.imageItem}>
                    <AntImage
                      src={url}
                      alt={`配图 ${index + 1}`}
                      style={{ width: '100%', borderRadius: 8 }}
                      preview={false}
                    />
                    <Button
                      size="small"
                      icon={<DownloadOutlined />}
                      onClick={() => handleDownloadImage(url, index)}
                      style={{ marginTop: 8 }}
                    >
                      下载
                    </Button>
                  </div>
                ))}
              </div>
            ) : imageError ? (
              <div className={styles.errorWrapper}>
                <p className={styles.errorMessage}>{imageError}</p>
                <Button type="primary" onClick={handleGenerateImage}>
                  重试
                </Button>
              </div>
            ) : null}
          </section>
        )}

        {/* 类似冷笑话 */}
        <section className={styles.similarSection}>
          <h3 className={styles.sectionTitle}>💡 类似冷笑话 ({similarJokes.length}条)</h3>
          {generatingSimilar ? (
            <div className={styles.loadingWrapper}>
              <div className={styles.loadingIconWrapper}>
                <div className={styles.loadingOrbit}></div>
                <LoadingOutlined spin className={styles.loadingIcon} />
              </div>
              <p className={styles.loadingTitle}>正在生成20条类似冷笑话...</p>
              <p className={styles.loadingSubtitle}>请稍候</p>
            </div>
          ) : similarJokes.length > 0 ? (
            <div className={styles.similarGrid}>
              {similarJokes.map((item, index) => (
                <div
                  key={index}
                  className={styles.similarCard}
                  onClick={() => handleSimilarClick(item)}
                >
                  <p className={styles.similarContent}>{item.content}</p>
                  <div className={styles.similarMeta}>
                    <span className={styles.similarIndex}>#{index + 1}</span>
                    <span className={styles.similarTime}>{item.updateTime}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : similarError ? (
            <div className={styles.errorWrapper}>
              <p className={styles.errorMessage}>{similarError}</p>
              <Button type="primary" onClick={handleGenerateSimilar}>
                重试
              </Button>
            </div>
          ) : (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>❄️</div>
              <p className={styles.emptyText}>点击上方"类似冷笑话"按钮生成20条</p>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
