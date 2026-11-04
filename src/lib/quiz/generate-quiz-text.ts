#!/usr/bin/env tsx
/**
 * 生成所有考核题目的纯文本格式
 */

import { chapter1Questions } from './chapter1';
import { chapter2Questions } from './chapter2';
import { chapter3Questions } from './chapter3';
import { chapter4Questions } from './chapter4';
import { chapter5Questions } from './chapter5';
import { chapter6CommonQuestions } from './chapter6-common';
import { chapter6NanchangQuestions } from './chapter6-nanchang';
import { chapter6ChangshaQuestions } from './chapter6-changsha';
import { chapter6ShanghaiQuestions } from './chapter6-shanghai';
import { chapter6NingboQuestions } from './chapter6-ningbo';
import { chapter6WenzhouQuestions } from './chapter6-wenzhou';
import { chapter6GanzhouQuestions } from './chapter6-ganzhou';
import type { QuizQuestion, ChoiceQuestion, ShortQuestion } from '../quiz-data';

const typeNames: Record<string, string> = {
  single: '单选',
  scenario: '情景判断',
  short: '简答'
};

function formatQuestion(q: QuizQuestion, index: number, chapterName: string): string {
  const typeName = typeNames[q.type] || q.type;
  let output = `${index}. [${typeName}] ${q.question}\n`;

  if (q.type === 'single' || q.type === 'scenario') {
    const choiceQ = q as ChoiceQuestion;
    choiceQ.options.forEach(opt => {
      output += `${opt}\n`;
    });
    output += `答案：${choiceQ.answer}\n`;
    output += `解析：${choiceQ.explanation}\n`;
  } else if (q.type === 'short') {
    const shortQ = q as ShortQuestion;
    output += `关键词：${shortQ.keywords.join('、')}\n`;
    output += `参考答案：${shortQ.referenceAnswer}\n`;
    output += `解析：${shortQ.explanation}\n`;
  }

  return output;
}

function formatChapter(questions: QuizQuestion[], chapterNum: string, chapterName: string): string {
  let output = `\n${'='.repeat(60)}\n`;
  output += `【第${chapterNum}章】${chapterName}\n`;
  output += `共${questions.length}题\n`;
  output += `${'='.repeat(60)}\n\n`;

  questions.forEach((q, index) => {
    output += formatQuestion(q, index + 1, chapterName);
    output += '\n';
  });

  return output;
}

async function main() {
  let output = '# 白癜风客服训练营 - 完整题库\n\n';
  output += `生成时间：${new Date().toLocaleString('zh-CN')}\n`;
  output += `总题数：约300题\n\n`;

  // 第1章
  output += formatChapter(chapter1Questions, '1', '白癜风基础知识');

  // 第2章
  output += formatChapter(chapter2Questions, '2', '病因及诱因');

  // 第3章
  output += formatChapter(chapter3Questions, '3', '鉴别诊断和分类');

  // 第4章
  output += formatChapter(chapter4Questions, '4', '检查项目');

  // 第5章
  output += formatChapter(chapter5Questions, '5', '治疗方法');

  // 第6章通用题
  output += formatChapter(chapter6CommonQuestions, '6-通用', '医院信息与话术转化（通用题）');

  // 第6章南昌专属
  output += formatChapter(chapter6NanchangQuestions, '6-南昌', '南昌国丹专属题');

  // 第6章长沙专属
  output += formatChapter(chapter6ChangshaQuestions, '6-长沙', '长沙华研专属题');

  // 第6章上海专属
  output += formatChapter(chapter6ShanghaiQuestions, '6-上海', '上海华研专属题');

  // 第6章宁波专属
  output += formatChapter(chapter6NingboQuestions, '6-宁波', '宁波华仁专属题');

  // 第6章温州专属
  output += formatChapter(chapter6WenzhouQuestions, '6-温州', '温州中研专属题');

  // 第6章赣州专属
  output += formatChapter(chapter6GanzhouQuestions, '6-赣州', '赣州中研专属题');

  // 输出到控制台
  console.log(output);
}

main().catch(console.error);
