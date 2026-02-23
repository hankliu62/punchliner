import { NextRequest, NextResponse } from 'next/server'
import QRCode from 'qrcode'
import { generateAIContent, generateImage } from '@/lib/ai'
import { generateShareUrl } from '@/lib/crypto'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { content, url, id, updateTime } = body

    if (!content) {
      return NextResponse.json({ code: 0, msg: '参数错误', data: null })
    }

    // 如果没有传 url，则使用默认的加密 URL
    const shareUrl = url || (id && updateTime ? generateShareUrl(id, content, updateTime) : '')

    // 1. 调用智谱 AI 生成配图
    const imagePrompt = await generateAIContent('image', content)
    const imageUrl = await generateImage(imagePrompt)

    if (!imageUrl) {
      return NextResponse.json({ code: 0, msg: '图片生成失败', data: null })
    }

    // 2. 生成二维码
    const qrCodeDataUrl = await QRCode.toDataURL(shareUrl || 'https://punchliner.vercel.app', {
      width: 200,
      margin: 2,
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
        shareUrl,
      },
    })
  } catch (error) {
    console.error('Share image generate error:', error)
    const message = error instanceof Error ? error.message : '分享图片生成失败'
    return NextResponse.json({ code: 0, msg: message, data: null })
  }
}
