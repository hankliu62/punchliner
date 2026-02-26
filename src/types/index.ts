export interface Joke {
  id: string
  content: string
  updateTime: string
}

export interface JokeResponse {
  code: number
  msg: string
  data: Joke[]
}

export interface JokeListResponse {
  code: number
  msg: string
  data: {
    page: number
    totalCount: number
    totalPage: number
    limit: number
    list: Joke[]
  }
}

export interface CollectItem extends Joke {
  collectTime: string
}

export type AIActionType =
  | 'continue'
  | 'rewrite'
  | 'roast'
  | 'similar'
  | 'image'
  | 'moments'
  | 'coldImage'

export interface AIAction {
  type: AIActionType
  label: string
  icon: string
  description: string
}

export const AI_ACTIONS: AIAction[] = [
  {
    type: 'continue',
    label: 'AI续写',
    icon: '✍️',
    description: '让AI续写后续情节',
  },
  {
    type: 'rewrite',
    label: '改写风格',
    icon: '🎭',
    description: '改写成不同风格',
  },
  {
    type: 'roast',
    label: 'AI吐槽',
    icon: '🔥',
    description: 'AI毒舌点评',
  },
  {
    type: 'similar',
    label: '相似推荐',
    icon: '💡',
    description: '推荐相似段子',
  },
  {
    type: 'image',
    label: '生成图片',
    icon: '🖼️',
    description: '生成段子配图',
  },
  {
    type: 'moments',
    label: '朋友圈',
    icon: '📱',
    description: '生成朋友圈素材',
  },
]

export const REWRITE_STYLES = [
  { value: 'cold', label: '冷幽默' },
  { value: 'dark', label: '黑色幽默' },
  { value: 'silly', label: '沙雕风' },
  { value: 'literary', label: '文艺复兴' },
  { value: 'joker', label: '段子手' },
]
