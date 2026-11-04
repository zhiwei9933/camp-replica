// 考核题库配置 - 升级版（6章节）

// 题目类型
export type QuestionType = 'single' | 'scenario' | 'short';

// 难度等级
export type Difficulty = 'basic' | 'medium' | 'advanced';

// 考核板块
export type Category = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

// 题目基础接口
export interface BaseQuestion {
  id: string;
  type: QuestionType;
  difficulty: Difficulty;
  category: Category;
  question: string;
  explanation: string;
}

// 单选题/情景题
export interface ChoiceQuestion extends BaseQuestion {
  type: 'single' | 'scenario';
  options: string[];
  answer: string;
}

// 简答题
export interface ShortQuestion extends BaseQuestion {
  type: 'short';
  keywords: string[];
  referenceAnswer: string;
}

// 联合类型
export type QuizQuestion = ChoiceQuestion | ShortQuestion;

// 章节配置
export interface ChapterConfig {
  id: number;
  title: string;
  subtitle: string;
  description: string;
  icon: string;
  passScore: number;
}

// 章节配置数据
export const chapters: ChapterConfig[] = [
  {
    id: 1,
    title: '第一章',
    subtitle: '白癜风基础知识',
    description: '白癜风是什么？定义、发病机制、影响与常见误区',
    icon: '📖',
    passScore: 90
  },
  {
    id: 2,
    title: '第二章',
    subtitle: '病因及诱因',
    description: '为什么会得白癜风？内在病因与外在诱因的区别',
    icon: '🔬',
    passScore: 90
  },
  {
    id: 3,
    title: '第三章',
    subtitle: '鉴别诊断和分类',
    description: '如何区分白癜风与其他白斑？分期分型分级',
    icon: '🔍',
    passScore: 90
  },
  {
    id: 4,
    title: '第四章',
    subtitle: '检查项目',
    description: '伍德灯、皮肤CT、免疫检查等项目的意义',
    icon: '🏥',
    passScore: 90
  },
  {
    id: 5,
    title: '第五章',
    subtitle: '治疗方法',
    description: '药物、光疗、移植等治疗手段及原则',
    icon: '💊',
    passScore: 90
  },
  {
    id: 6,
    title: '第六章',
    subtitle: '医院信息与话术转化',
    description: '医院优势、首诊制、转化策略与违禁词',
    icon: '🎯',
    passScore: 90
  }
];

// 板块名称映射
export const categoryNames: Record<Category, string> = {
  A: '白癜风基础知识',
  B: '病因及诱因',
  C: '鉴别诊断和分类',
  D: '检查项目',
  E: '治疗方法',
  F: '医院信息与话术'
};

// 简答题评分函数
export function gradeShortAnswer(answer: string, keywords: string[]): { score: number; matchedKeywords: string[] } {
  const normalizedAnswer = answer.toLowerCase();
  const matchedKeywords: string[] = [];
  
  for (const keyword of keywords) {
    if (normalizedAnswer.includes(keyword.toLowerCase())) {
      matchedKeywords.push(keyword);
    }
  }
  
  // 每个关键词得分 = 100 / keywords.length
  const scorePerKeyword = 100 / keywords.length;
  const score = Math.round(matchedKeywords.length * scorePerKeyword);
  
  return { score, matchedKeywords };
}

// 随机抽取题目
export function getRandomQuestions<T>(questions: T[], count: number): T[] {
  const shuffled = [...questions].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

// 打乱选项顺序（仅对选择题）
export function shuffleOptions(question: ChoiceQuestion): ChoiceQuestion {
  const optionsWithIndex = question.options.map((opt, idx) => ({ opt, idx }));
  const shuffled = optionsWithIndex.sort(() => Math.random() - 0.5);
  
  const letterMap = ['A', 'B', 'C', 'D'];
  const newOptions = shuffled.map((item, idx) => {
    const originalText = item.opt.substring(3); // 去掉 "X. " 前缀
    return `${letterMap[idx]}. ${originalText}`;
  });
  
  const originalAnswerIndex = question.answer.charCodeAt(0) - 65; // A=0, B=1, C=2, D=3
  const originalOption = optionsWithIndex.find(item => item.idx === originalAnswerIndex);
  const newAnswerIndex = shuffled.indexOf(originalOption!);
  const newAnswer = letterMap[newAnswerIndex];
  
  return {
    ...question,
    options: newOptions,
    answer: newAnswer
  };
}

// 章节成绩记录
export interface ChapterScore {
  chapterId: number;
  score: number;
  passed: boolean;
  date: string;
  answers: Record<string, string>;
}

// 本地存储工具
export const storageUtils = {
  // 获取章节解锁状态
  getUnlockedChapters: (): number[] => {
    // 检查是否已通过密码解锁所有章节
    if (localStorage.getItem('quiz_all_unlocked') === 'true') {
      return [1, 2, 3, 4, 5, 6];
    }
    const data = localStorage.getItem('quiz_unlocked_chapters');
    return data ? JSON.parse(data) : [1]; // 默认只解锁第1章
  },

  // 解锁所有章节（通过密码）
  setAllUnlocked: (): void => {
    localStorage.setItem('quiz_all_unlocked', 'true');
    localStorage.setItem('quiz_unlocked_chapters', JSON.stringify([1, 2, 3, 4, 5, 6]));
  },

  // 检查是否已全解锁
  isAllUnlocked: (): boolean => {
    return localStorage.getItem('quiz_all_unlocked') === 'true';
  },
  
  // 解锁章节
  unlockChapter: (chapterId: number): void => {
    const unlocked = storageUtils.getUnlockedChapters();
    if (!unlocked.includes(chapterId)) {
      unlocked.push(chapterId);
      localStorage.setItem('quiz_unlocked_chapters', JSON.stringify(unlocked));
    }
  },
  
  // 获取章节最佳成绩
  getBestScore: (chapterId: number): ChapterScore | null => {
    const data = localStorage.getItem(`quiz_best_score_${chapterId}`);
    return data ? JSON.parse(data) : null;
  },
  
  // 保存章节成绩
  saveScore: (score: ChapterScore): void => {
    const existing = storageUtils.getBestScore(score.chapterId);
    if (!existing || score.score > existing.score) {
      localStorage.setItem(`quiz_best_score_${score.chapterId}`, JSON.stringify(score));
    }
  },
  
  // 重置章节进度
  resetChapter: (chapterId: number): void => {
    localStorage.removeItem(`quiz_best_score_${chapterId}`);
  }
};

// 第6章题库导入
import { chapter6CommonQuestions } from './quiz/chapter6-common';
import { chapter6HefeiQuestions } from './quiz/chapter6-hefei';
import { chapter6HangzhouQuestions } from './quiz/chapter6-hangzhou';

// 项目类型
export type ProjectType = 'hefei' | 'hangzhou';

// 项目名称映射
export const projectNames: Record<ProjectType, string> = {
  hefei: '合肥',
  hangzhou: '杭州'
};

// 获取第6章题库（根据项目类型组合通用题和城市专属题）
export function getChapter6Questions(project: ProjectType): QuizQuestion[] {
  const cityQuestions: Record<ProjectType, QuizQuestion[]> = {
    hefei: chapter6HefeiQuestions,
    hangzhou: chapter6HangzhouQuestions
  };

  // 通用题 + 院区专属题
  return [...chapter6CommonQuestions, ...cityQuestions[project]];
}
