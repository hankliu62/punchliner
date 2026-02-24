import { NextRequest, NextResponse } from 'next/server'

// 智谱AI CogVideoX-Flash 视频生成 API
// 使用免费的 CogVideoX-Flash 模型
// 使用SSE (Server-Sent Events) 实时推送进度

const ZHIPU_API_KEY = process.env.ZHIPU_API_KEY || ''
const ZHIPU_API_URL = 'https://open.bigmodel.cn/api/paas/v4'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { content } = body

    if (!content) {
      return NextResponse.json({ code: 0, msg: '参数错误', data: null })
    }

    if (!ZHIPU_API_KEY) {
      return NextResponse.json({
        code: 0,
        msg: '视频生成服务未配置，请配置 ZHIPU_API_KEY',
        data: null,
      })
    }

    // 构建 prompt
    const prompt = `Create a funny animated video of: ${content}. Cartoon style, humorous, engaging, smooth animation.`

    // 调用智谱AI CogVideoX-Flash 视频生成 API
    const response = await fetch(`${ZHIPU_API_URL}/videos/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ZHIPU_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'cogvideox-flash',
        prompt: prompt,
        with_audio: true, // 开启AI音效
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Zhipu AI API error:', response.status, errorText)
      throw new Error(`智谱AI API error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()

    // 智谱AI 返回任务 ID
    const taskId = data.id || data.request_id

    if (!taskId) {
      console.error('No task ID returned:', data)
      throw new Error('视频生成任务创建失败')
    }

    // 返回taskId给前端，让前端连接SSE
    return NextResponse.json({
      code: 1,
      msg: 'success',
      data: {
        taskId: taskId,
      },
    })
  } catch (error) {
    console.error('Video generate error:', error)
    const message = error instanceof Error ? error.message : '视频生成失败'
    return NextResponse.json({ code: 0, msg: message, data: null })
  }
}

// SSE端点：实时推送视频生成进度
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const taskId = searchParams.get('taskId')

  if (!taskId) {
    return NextResponse.json({ code: 0, msg: '缺少taskId', data: null })
  }

  if (!ZHIPU_API_KEY) {
    return NextResponse.json({ code: 0, msg: '视频生成服务未配置', data: null })
  }

  // 创建SSE流
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      // 模拟进度（因为智谱API不返回实时进度）
      let progress = 0
      let mockInterval: NodeJS.Timeout | null = null

      // 启动mock进度（每秒增加2-5%）
      const startMockProgress = () => {
        mockInterval = setInterval(() => {
          if (progress < 95) {
            progress += Math.floor(Math.random() * 4) + 2 // 每次增加2-5%
            send({ progress: Math.min(progress, 95), status: 'processing' })
          }
        }, 1000)
      }

      // 停止mock进度
      const stopMockProgress = () => {
        if (mockInterval) {
          clearInterval(mockInterval)
          mockInterval = null
        }
      }

      // 发送初始进度
      send({ progress: 0, status: 'processing' })
      startMockProgress()

      // 轮询智谱AI API直到完成（最多5分钟）
      const maxWaitTime = 300000 // 5分钟
      const startTime = Date.now()
      const checkInterval = setInterval(async () => {
        // 检查超时
        if (Date.now() - startTime > maxWaitTime) {
          stopMockProgress()
          send({ progress: 0, status: 'failed', error: '视频生成超时' })
          controller.close()
          clearInterval(checkInterval)
          return
        }

        try {
          const res = await fetch(`${ZHIPU_API_URL}/async-result/${taskId}`, {
            headers: {
              Authorization: `Bearer ${ZHIPU_API_KEY}`,
            },
          })

          if (!res.ok) {
            return // 继续等待
          }

          const data = await res.json()
          const taskStatus = data.task_status || data.status

          if (taskStatus === 'SUCCESS') {
            stopMockProgress()
            // video_result 是一个数组，取第一个元素
            const videoResult = data.video_result?.[0]
            const videoUrl = videoResult?.url || data.video_url || data.url
            send({ progress: 100, status: 'completed', videoUrl })
            controller.close()
            clearInterval(checkInterval)
          } else if (taskStatus === 'FAIL') {
            stopMockProgress()
            send({ progress: 0, status: 'failed', error: '视频生成失败' })
            controller.close()
            clearInterval(checkInterval)
          }
        } catch (error) {
          console.error('SSE check error:', error)
        }
      }, 3000) // 每3秒检查一次

      // 清理函数
      request.signal.addEventListener('abort', () => {
        stopMockProgress()
        clearInterval(checkInterval)
        controller.close()
      })
    },
  })

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
