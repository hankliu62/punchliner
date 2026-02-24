import type { AIActionType } from '@/types'

const ZHIPU_API_KEY = process.env.ZHIPU_API_KEY || ''
const ZHIPU_API_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions'

const PROMPTS: Record<AIActionType, (content: string, style?: string) => string> = {
  continue: (content) =>
    `请根据以下段子续写后续情节，要求幽默风趣，与原文风格一致，续写内容不要超过200字：\n\n${content}\n\n续写：`,
  rewrite: (content, style = '冷幽默') =>
    `请将以下段子改写成${style}风格，要求保持原意但语言风格变化，不要超过原文字数太多：\n\n${content}\n\n改写：`,
  roast: (content) =>
    `请对以下段子进行毒舌点评/吐槽，要求幽默犀利，一针见血，不超过100字：\n\n${content}\n\n点评：`,
  similar: (content) =>
    `请根据以下段子的风格，推荐3-5个相似风格的段子主题或关键词（直接输出主题，用逗号分隔）：\n\n${content}\n\n推荐：`,
  image: (content) =>
    `请为以下段子生成一张幽默的配图描述，风格可以是表情包风格或简约文字卡片风格，描述不要超过50字：\n\n${content}\n\n图片描述：`,
  moments: (content) =>
    `请为以下段子生成一条适合发朋友圈的文案，要求有趣、吸引人点赞，不超过100字：\n\n${content}\n\n文案：`,
}

export async function generateAIContent(
  type: AIActionType,
  jokeContent: string,
  style?: string
): Promise<string> {
  if (!ZHIPU_API_KEY) {
    throw new Error('ZHIPU_API_KEY is not configured')
  }

  const prompt = PROMPTS[type](jokeContent, style)

  const response = await fetch(ZHIPU_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ZHIPU_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'glm-4-flash',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8,
      max_tokens: 500,
    }),
  })

  if (!response.ok) {
    throw new Error(`AI API error: ${response.status}`)
  }

  const data = await response.json()
  return data.choices?.[0]?.message?.content || ''
}

export async function generateImage(prompt: string): Promise<string | null> {
  if (!ZHIPU_API_KEY) {
    throw new Error('ZHIPU_API_KEY is not configured')
  }

  const maxRetries = 3
  let lastError: Error | null = null

  for (let retry = 0; retry < maxRetries; retry++) {
    try {
      const response = await fetch('https://open.bigmodel.cn/api/paas/v4/images/generations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ZHIPU_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'cogview-3-flash', // 使用免费版本
          prompt: prompt,
          size: '1024x1024',
        }),
      })

      if (!response.ok) {
        const errorMsg = `Image API error: ${response.status}`
        // 如果是429错误，等待后重试
        if (response.status === 429) {
          lastError = new Error(errorMsg)
          const waitTime = (retry + 1) * 2000 // 2秒、4秒、6秒
          console.log(`Rate limited, waiting ${waitTime}ms before retry...`)
          await new Promise((resolve) => setTimeout(resolve, waitTime))
          continue
        }
        throw new Error(errorMsg)
      }

      const data = await response.json()
      return data.data?.[0]?.url || null
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      console.error(`Image generation attempt ${retry + 1} failed:`, lastError.message)

      // 如果不是429错误，也等待一下再重试
      if (lastError.message !== 'Image API error: 429') {
        await new Promise((resolve) => setTimeout(resolve, 1000 * (retry + 1)))
      }
    }
  }

  throw lastError || new Error('Image generation failed after retries')
}
