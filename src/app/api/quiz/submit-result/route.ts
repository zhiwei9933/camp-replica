import { NextRequest, NextResponse } from 'next/server';
import { upstashCommand } from '@/lib/upstash';
import { createLLM } from '@/lib/llm';

const REDIS_KEY = 'quiz_results';

interface WrongQuestion {
  question: string;
  userAnswer: string;
  correctAnswer: string;
  explanation: string;
  type: string;
}

async function generateImprovementPoints(wrongQuestions: WrongQuestion[]): Promise<string[]> {
  if (wrongQuestions.length === 0) return [];

  try {
    const client = createLLM();

    const prompt = `你是医疗客服培训主管。根据以下错题，生成2-3条加强建议。

要求：
1. 直击知识盲点，不铺垫不废话
2. 给出具体学习方向和需要掌握的知识点
3. 每条严格不超过80字，确保建议完整有意义
4. JSON数组格式返回，如 ["建议1", "建议2"]

错题：
${JSON.stringify(wrongQuestions, null, 2)}`;

    const result = await client.invoke(
      [{ role: 'user', content: prompt }],
      { model: 'doubao-seed-2-0-mini-260215' }
    );

    const text = result.content || '';
    // Extract JSON array from response
    const match = text.match(/\[[\s\S]*?\]/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.slice(0, 3);
      }
    }
    // Fallback: use explanations (full text, no truncation)
    return wrongQuestions.slice(0, 2).map(wq => wq.explanation);
  } catch (error) {
    console.error('[submit-result] LLM error:', error);
    // Fallback: use explanations (full text, no truncation)
    return wrongQuestions.slice(0, 2).map(wq => wq.explanation);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { staffName, city, chapterId, chapterName, score, passed, submittedAt, wrongQuestions } = body;

    if (!staffName || !city || !chapterId || score === undefined) {
      return NextResponse.json({ success: false, error: '缺少必要参数' }, { status: 400 });
    }

    // Generate improvement points from wrong questions
    const improvementPoints = await generateImprovementPoints(wrongQuestions || []);

    const newResult = {
      staffName,
      city,
      chapterId,
      chapterName,
      score,
      passed,
      submittedAt,
      improvementPoints,
    };

    // 1. GET current results
    const currentData = await upstashCommand(['GET', REDIS_KEY]);
    let results: Record<string, unknown>[] = [];
    if (currentData && currentData !== 'null') {
      try {
        results = JSON.parse(currentData as string);
      } catch {
        results = [];
      }
    }

    // 2. Append new result
    results.push(newResult);

    // 3. Filter out records older than 7 days
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    results = results.filter((r: Record<string, unknown>) => {
      const t = new Date(r.submittedAt as string).getTime();
      return t > sevenDaysAgo;
    });

    // 4. SET new results
    await upstashCommand(['SET', REDIS_KEY, JSON.stringify(results)]);

    // 5. EXPIRE 7 days
    await upstashCommand(['EXPIRE', REDIS_KEY, '604800']);

    return NextResponse.json({ success: true, improvementPoints });
  } catch (error) {
    console.error('[submit-result] Error:', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: `成绩提交失败: ${message}` }, { status: 500 });
  }
}
