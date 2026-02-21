import { NextRequest, NextResponse } from 'next/server';
import { generateImage, generateAIContent } from '@/lib/ai';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { content } = body;

    if (!content) {
      return NextResponse.json({ code: 0, msg: '参数错误', data: null });
    }

    const imagePrompt = await generateAIContent('image', content);
    const imageUrl = await generateImage(imagePrompt);

    if (!imageUrl) {
      return NextResponse.json({ code: 0, msg: '图片生成失败', data: null });
    }

    return NextResponse.json({
      code: 1,
      msg: '成功',
      data: { url: imageUrl, prompt: imagePrompt },
    });
  } catch (error) {
    console.error('Image generate error:', error);
    const message = error instanceof Error ? error.message : '图片生成失败';
    return NextResponse.json({ code: 0, msg: message, data: null });
  }
}
