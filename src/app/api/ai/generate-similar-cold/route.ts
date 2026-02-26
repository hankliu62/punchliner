import { NextResponse } from 'next/server'

const ZHIPU_API_KEY = process.env.ZHIPU_API_KEY || ''
const ZHIPU_API_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions'

interface ColdJoke {
  id: string
  content: string
  updateTime: string
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Date.now().toString(36)
}

// 生成类似冷笑话
async function generateSimilarColdJokes(content: string, count: number): Promise<ColdJoke[]> {
  const prompt = `请根据以下冷笑话的风格，生成${count}个类似的冷笑话。

要求：
1. 风格要相似（同样的尴尬、无聊、冷漠的幽默感）
2. 每个长度控制在30-80字之间
3. 内容要原创
4. 直接输出笑话内容，每行一个笑话，**不要带任何序号**，不要用1. 2. 这样的格式
5. 不要用任何标记分隔

原冷笑话：
${content}

请直接输出${count}个笑话，每行一个，不要序号：`

  const response = await fetch(ZHIPU_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ZHIPU_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'glm-4-flash',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.9,
      max_tokens: 2000,
    }),
  })

  if (!response.ok) {
    throw new Error(`AI API error: ${response.status}`)
  }

  const data = await response.json()
  const resultContent = data.choices?.[0]?.message?.content?.trim() || ''

  // 按行分割，每行一个笑话，同时去除开头的序号
  const jokes = resultContent
    .split('\n')
    .map((joke: string) => joke.trim())
    .map((joke: string) => joke.replace(/^\d+[.、]\s*/, '')) // 去除 "1. " 这样的序号
    .filter((joke: string) => joke.length > 0)
    .slice(0, count)
    .map((jokeContent: string) => ({
      id: generateId(),
      content: jokeContent,
      updateTime: new Date().toLocaleDateString('zh-CN'),
    }))

  return jokes
}

// POST - 生成类似冷笑话
export async function POST(request: Request) {
  try {
    if (!ZHIPU_API_KEY) {
      return NextResponse.json({ code: 0, msg: '智谱API未配置', data: [] })
    }

    const body = await request.json()
    const { content } = body

    if (!content) {
      return NextResponse.json({ code: 0, msg: '参数错误', data: [] })
    }

    // 生成20条类似冷笑话
    const jokes = await generateSimilarColdJokes(content, 20)

    return NextResponse.json({ code: 1, msg: '成功', data: jokes })
  } catch (error) {
    console.error('Failed to generate similar cold jokes:', error)
    return NextResponse.json({ code: 0, msg: '生成失败', data: [] })
  }
}
