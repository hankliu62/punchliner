import { NextRequest, NextResponse } from 'next/server'

// 图片代理API - 解决智谱AI图片跨域问题
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const imageUrl = searchParams.get('url')

  if (!imageUrl) {
    return NextResponse.json({ code: 0, msg: '缺少图片URL', data: null })
  }

  try {
    // 下载图片
    const response = await fetch(imageUrl)

    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // 获取图片类型
    const contentType = response.headers.get('content-type') || 'image/png'

    // 返回图片
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch (error) {
    console.error('Image proxy error:', error)
    return NextResponse.json({ code: 0, msg: '图片加载失败', data: null })
  }
}
