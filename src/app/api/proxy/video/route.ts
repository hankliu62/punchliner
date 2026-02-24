import { NextRequest, NextResponse } from 'next/server'

// 视频下载代理，解决跨域问题

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const videoUrl = searchParams.get('url')

  if (!videoUrl) {
    return NextResponse.json({ code: 0, msg: '缺少视频URL', data: null })
  }

  try {
    // 下载视频
    const response = await fetch(videoUrl)

    if (!response.ok) {
      return NextResponse.json({ code: 0, msg: '下载失败', data: null })
    }

    // 获取视频内容
    const blob = await response.blob()

    // 返回视频
    return new NextResponse(blob, {
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Disposition': `attachment; filename="punchliner-video-${Date.now()}.mp4"`,
      },
    })
  } catch (error) {
    console.error('Video proxy error:', error)
    return NextResponse.json({ code: 0, msg: '下载失败', data: null })
  }
}
