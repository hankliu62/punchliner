import { NextResponse } from 'next/server'
import { getRandomJokes } from '@/lib/joke'

export async function GET() {
  try {
    const jokes = await getRandomJokes()

    if (jokes.length === 0) {
      return NextResponse.json({ code: 0, msg: '获取段子失败', data: [] })
    }

    return NextResponse.json({ code: 1, msg: '成功', data: jokes })
  } catch (_error) {
    return NextResponse.json({ code: 0, msg: '服务器错误', data: [] })
  }
}
