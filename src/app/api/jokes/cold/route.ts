import { NextResponse } from 'next/server'

const ZHIPU_API_KEY = process.env.ZHIPU_API_KEY || ''
const ZHIPU_API_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions'

interface ColdJoke {
  id: string
  content: string
  updateTime: string
  imageUrl?: string
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Date.now().toString(36)
}

// 直接调用智谱API生成冷笑话
async function generateColdJoke(): Promise<string> {
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
- 每次输出1个冷笑话
- 字数控制在15-50字之间

### 5. 参考风格（这就是你要的“冷+好笑”）
- 制定了plan，因为lan。完成了个p。
- 什么动物生气时最安静？大猩猩，因为敲咪咪。
- 小鸡、小鸭、小鹅打球，谁最容易被砸？小鸭，因为duck不避。
- 为什么橙子怕蘑菇？菌要橙死，橙不得不死。
- 绿豆鲨吃了绿豆，变成了绿豆沙。

请返回一个新的冷笑话：`

//   `请生成一个冷笑话，要求：
// 1. 笑话要真正的"冷"（尴尬、无聊、冷漠的幽默）
// 2. 长度控制在50-100字之间
// 3. 内容要原创，不要网上流传的经典笑话
// 4. 带有一种淡淡的无奈和冷峻的气质
// 5. 直接输出笑话内容，不要有前缀或解释
// 6. 冷笑话一定要简短一点，可以是问题回答之类的
// 7. 冷笑话一定要合理，有逻辑，不是简单的问答
// 8. 冷笑话一定要有笑点，可以来点谐音梗

// 冷笑话示例风格：
// - "小鸡、小鸭、小鹅一起打球，谁最容易被球砸中？小鸭，因为duck不避"
// - "一天橙子碰见一个蘑菇蘑菇对橙子说你去死吧。结果橙子死了，为什么？因为菌要橙死，橙不得不死。其实橙子只要做一件事就可以不用死。他可以身上抹一层果酱，就不用死了。因为酱在外而菌令有所不受。"
// - "你知道什么动物生气时最安静吗？大猩猩，因为生气的时候敲咪咪"
// - "小蒜、中蒜、大蒜谁最会谈恋爱？中蒜，因为后来~ 我中蒜学会了~ 如何去爱"
// - "世界上所有的猪都si光，猜一个歌名。《至少还有你》"
// - "吸血鬼吃火锅会选清汤还是辣锅？清汤，因为吸血鬼吃Blood"
// - "制定了plan，因为lan。完成了个p"

// 请生成一个新的冷笑话：`

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
      max_tokens: 200,
    }),
  })

  if (!response.ok) {
    throw new Error(`AI API error: ${response.status}`)
  }

  const data = await response.json()
  return data.choices?.[0]?.message?.content?.trim() || ''
}

// 生成单条冷笑话
export async function GET() {
  try {
    if (!ZHIPU_API_KEY) {
      return NextResponse.json({ code: 0, msg: '智谱API未配置', data: [] })
    }

    const content = await generateColdJoke()

    const joke: ColdJoke = {
      id: generateId(),
      content,
      updateTime: new Date().toLocaleDateString('zh-CN'),
    }

    return NextResponse.json({ code: 1, msg: '成功', data: [joke] })
  } catch (error) {
    console.error('Failed to generate cold joke:', error)
    return NextResponse.json({ code: 0, msg: '生成失败', data: [] })
  }
}
