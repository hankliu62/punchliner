import { NextRequest, NextResponse } from 'next/server'
import { generateAIContent } from '@/lib/ai'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type, content, style } = body

    if (!type || !content) {
      return NextResponse.json({ code: 0, msg: '参数错误', data: null })
    }

    const result = await generateAIContent(type, content, style)

    return NextResponse.json({ code: 1, msg: '成功', data: result })
  } catch (error) {
    console.error('AI generate error:', error)
    const message = error instanceof Error ? error.message : 'AI 生成失败'
    return NextResponse.json({ code: 0, msg: message, data: null })
  }
}
