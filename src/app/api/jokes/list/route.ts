import { NextRequest, NextResponse } from 'next/server'
import { getJokesByPage } from '@/lib/joke'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const page = Number.parseInt(searchParams.get('page') || '1', 10)

  try {
    const data = await getJokesByPage(page)

    if (!data) {
      return NextResponse.json({ code: 0, msg: '获取段子失败', data: null })
    }

    return NextResponse.json({ code: 1, msg: '成功', data })
  } catch (_error) {
    return NextResponse.json({ code: 0, msg: '服务器错误', data: null })
  }
}
