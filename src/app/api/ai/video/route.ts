import { NextRequest, NextResponse } from 'next/server'

// AI 动画视频生成 API
// 注意：智谱AI不支持视频生成，需要使用其他AI服务
// 以下是 Pika Labs 的示例（需要 API Key）

const PIKA_API_KEY = process.env.PIKA_API_KEY || ''
const PIKA_API_URL = 'https://api.pika.art/v1/generations'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { content, imageUrl } = body

    if (!content && !imageUrl) {
      return NextResponse.json({ code: 0, msg: '参数错误', data: null })
    }

    // 如果没有配置 Pika API Key，返回提示信息
    if (!PIKA_API_KEY) {
      return NextResponse.json({
        code: 0,
        msg: '视频生成服务未配置，请在环境变量中配置 PIKA_API_KEY',
        data: null,
      })
    }

    // 构建 prompt
    const prompt = `Create a funny cartoon animation of: ${content}. Cartoon style, humorous, engaging.`

    // 调用 Pika Labs API
    const response = await fetch(PIKA_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${PIKA_API_KEY}`,
      },
      body: JSON.stringify({
        prompt,
        image_url: imageUrl,
        model: 'pika-1.0',
        motion: 1,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Pika API error: ${error}`)
    }

    const data = await response.json()

    // Pika 返回的是异步任务，需要轮询获取结果
    // 这里返回任务 ID，前端可以轮询查询进度
    return NextResponse.json({
      code: 1,
      msg: 'success',
      data: {
        taskId: data.id,
        status: 'processing',
      },
    })
  } catch (error) {
    console.error('Video generate error:', error)
    const message = error instanceof Error ? error.message : '视频生成失败'
    return NextResponse.json({ code: 0, msg: message, data: null })
  }
}

// 查询视频生成状态
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const taskId = searchParams.get('taskId')

  if (!taskId) {
    return NextResponse.json({ code: 0, msg: '缺少taskId', data: null })
  }

  if (!PIKA_API_KEY) {
    return NextResponse.json({ code: 0, msg: '视频生成服务未配置', data: null })
  }

  try {
    const response = await fetch(`${PIKA_API_URL}/${taskId}`, {
      headers: {
        Authorization: `Bearer ${PIKA_API_KEY}`,
      },
    })

    if (!response.ok) {
      throw new Error(`Pika API error: ${response.status}`)
    }

    const data = await response.json()

    return NextResponse.json({
      code: 1,
      msg: 'success',
      data: {
        status: data.status,
        videoUrl: data.output?.[0],
        progress: data.progress || 0,
      },
    })
  } catch (error) {
    console.error('Query video status error:', error)
    return NextResponse.json({ code: 0, msg: '查询失败', data: null })
  }
}
