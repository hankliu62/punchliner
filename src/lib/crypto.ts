/**
 * URL参数加密/解密工具
 */

/**
 * 将对象转换为Base64编码的字符串
 * 同时处理特殊字符，避免URL参数问题
 */
export function encodeParams(params: Record<string, string>): string {
  const jsonStr = JSON.stringify(params)
  // 先Base64编码
  const base64 = btoa(encodeURIComponent(jsonStr))
  // 替换URL不安全的字符
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

/**
 * 从Base64编码的字符串解码为对象
 */
export function decodeParams(encoded: string): Record<string, string> | null {
  try {
    // 恢复Base64原始字符
    let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/')
    // 补齐 padding
    const padding = base64.length % 4
    if (padding) {
      base64 += '='.repeat(4 - padding)
    }
    // Base64解码
    const jsonStr = decodeURIComponent(atob(base64))
    return JSON.parse(jsonStr)
  } catch (error) {
    console.error('Failed to decode params:', error)
    return null
  }
}

/**
 * 生成加密后的分享链接
 */
export function generateShareUrl(
  id: string,
  content: string,
  updateTime: string,
  baseUrl: string = ''
): string {
  const params = encodeParams({ content, updateTime })
  return `${baseUrl}/joke/${id}?data=${params}`
}

/**
 * 从URL中解密获取内容
 */
export function getContentFromUrl(
  searchParams: URLSearchParams
): { content: string; updateTime: string } | null {
  const data = searchParams.get('data')
  if (!data) return null

  const params = decodeParams(data)
  if (!params || !params.content) return null

  return {
    content: params.content,
    updateTime: params.updateTime || '',
  }
}
