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

// 直接调用智谱API生成冷笑话
async function generateColdJokes(count: number): Promise<ColdJoke[]> {
  const prompt = `# 冷笑话生成专家

## 角色定位
你是一个冷笑话专家，只做一件事：生成让人看完先愣住、然后不由自主笑出来的冷笑话。不在乎梗老不老，只在乎够不够冷、够不够好笑。

## 生成规则

### 1. 好笑标准（必须同时满足）
- **谐音要“妙”**：谐音必须基于人们熟悉的词语、俗语、成语、歌名、英文单词（如 duck=躲开、plan=懒、菌=君）。让人一听就懂，一想就笑。
- **逻辑要“通”**：即使是歪理，也要有完整的因果关系。笑话的前后要能串联起来，不能是毫无关联的胡扯。
- **画面要“强”**：最好能让人在脑海中浮现出具体的画面（如大猩猩敲咪咪、小鸭被球砸）。
- **反应要“愣”**：读完第一秒是“？？？”，第二秒是“哈哈哈哈”。

### 2. 冷感标准（必须同时满足）
- **极简短**：15-50字，能短则短。废话一个字都不要。
- **极平淡**：语气像在陈述事实，不要用“哈哈哈”“笑死”这种词，不要刻意搞笑。
- **极无奈**：带着一种“我知道这很烂，但就这样吧”的冷峻气质。

### 3. 形式选择（二选一）
- **问答式**：问题合理，答案意外（如“什么动物生气最安静？大猩猩，因为敲咪咪”）
- **短叙事式**：1-2句话讲故事，最后一句点破（如“制定了plan，因为lan。完成了个p”）

### 4. 输出要求
- 只输出笑话正文，不要任何解释、前缀、后缀
- 每次输出${count}个冷笑话
- 每个冷笑话字数控制在15-50字之间
- 直接输出笑话内容，每个笑话用"---分隔"分隔，不要有其他前缀或解释

### 5. 参考风格（这就是你要的“冷+好笑”）
- 制定了plan，因为lan。完成了个p。
- 什么动物生气时最安静？大猩猩，因为敲咪咪。
- 小鸡、小鸭、小鹅打球，谁最容易被砸？小鸭，因为duck不避。
- 为什么橙子怕蘑菇？菌要橙死，橙不得不死。
- 绿豆鲨吃了绿豆，变成了绿豆沙。

请生成${count}个不同的冷笑话：`

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
      max_tokens: 1000,
    }),
  })

  if (!response.ok) {
    throw new Error(`AI API error: ${response.status}`)
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content?.trim() || ''

  // 分割成多个笑话
  const jokes = content
    .split('---')
    .map((joke: string) => joke.trim())
    .filter((joke: string) => joke.length > 0)
    .slice(0, count)
    .map((jokeContent: string) => ({
      id: generateId(),
      content: jokeContent,
      updateTime: new Date().toLocaleDateString('zh-CN'),
    }))

  return jokes
}

// 批量生成冷笑话列表
export async function GET(request: Request) {
  try {
    if (!ZHIPU_API_KEY) {
      return NextResponse.json({
        code: 0,
        msg: '智谱API未配置',
        data: { list: [], page: 1, totalPage: 1 },
      })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1', 10)
    const pageSize = 20 // 每页20条

    const jokes = await generateColdJokes(pageSize)

    return NextResponse.json({
      code: 1,
      msg: '成功',
      data: {
        list: jokes,
        page,
        totalPage: 1,
        totalCount: jokes.length,
      },
    })
  } catch (error) {
    console.error('Failed to generate cold jokes:', error)
    return NextResponse.json({
      code: 0,
      msg: '生成失败',
      data: { list: [], page: 1, totalPage: 1 },
    })
  }
}
