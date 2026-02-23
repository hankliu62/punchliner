import { NextRequest, NextResponse } from 'next/server'
import { generateAIContent, generateImage } from '@/lib/ai'

// 简单的内存存储（生产环境应使用Redis或数据库）
const shareCache = new Map<string, { content: string; updateTime: string; createdAt: number }>()

// 生成短ID
function generateShortId(): string {
  return Math.random().toString(36).substring(2, 10)
}

// 清理过期的缓存（1小时后过期）
function cleanupExpiredCache() {
  const now = Date.now()
  const oneHour = 60 * 60 * 1000
  for (const [key, value] of shareCache.entries()) {
    if (now - value.createdAt > oneHour) {
      shareCache.delete(key)
    }
  }
}

// 定期清理
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupExpiredCache, 10 * 60 * 1000)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { content, url, id, updateTime } = body

    if (!content) {
      return NextResponse.json({ code: 0, msg: '参数错误', data: null })
    }

    // 生成分享ID并存储内容
    const shareId = generateShortId()
    shareCache.set(shareId, {
      content,
      updateTime: updateTime || new Date().toISOString().split('T')[0],
      createdAt: Date.now(),
    })

    // 构建短链接
    const shortUrl = url
      ? url.replace(/data=[^&]+/, `s=${shareId}`)
      : `/joke/${id || 'shared'}?s=${shareId}`

    // 1. 调用智谱 AI 生成配图
    const imagePrompt = await generateAIContent('image', content)
    const imageUrl = await generateImage(imagePrompt)

    if (!imageUrl) {
      return NextResponse.json({ code: 0, msg: '图片生成失败', data: null })
    }

    // 2. 生成二维码（使用短链接）
    const QRCode = (await import('qrcode')).default
    const qrCodeDataUrl = await QRCode.toDataURL(shortUrl || 'https://punchliner.vercel.app', {
      width: 200,
      margin: 2,
      errorCorrectionLevel: 'L',
      version: 5,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    })

    return NextResponse.json({
      code: 1,
      msg: '成功',
      data: {
        imageUrl,
        qrCodeUrl: qrCodeDataUrl,
        prompt: imagePrompt,
        shareUrl: shortUrl,
      },
    })
  } catch (error) {
    console.error('Share image generate error:', error)
    const message = error instanceof Error ? error.message : '分享图片生成失败'
    return NextResponse.json({ code: 0, msg: message, data: null })
  }
}

// 获取分享内容
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const shareId = searchParams.get('s')

  if (!shareId) {
    return NextResponse.json({ code: 0, msg: '缺少分享ID', data: null })
  }

  const shareData = shareCache.get(shareId)
  if (!shareData) {
    return NextResponse.json({ code: 0, msg: '分享内容已过期', data: null })
  }

  return NextResponse.json({
    code: 1,
    msg: '成功',
    data: shareData,
  })
}
