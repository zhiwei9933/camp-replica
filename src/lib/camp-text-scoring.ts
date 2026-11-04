// 简答题自动评分：基于关键词/同义词组命中率判分
// 规则：
//   - 每个 keyPoint 是一个同义词组（数组），答案中命中组内任意一个关键词就算命中该点
//   - 命中率 = 命中点数 / 总点数
//   - 命中率 >= fullThreshold（默认 0.8）给满分
//   - 命中率 >= halfThreshold（默认 0.5）给半分
//   - 低于 halfThreshold 给 0 分
//   - 答案字数低于 minChars（默认 8）直接 0 分

import type { ExamQuestion, ObjectiveQuestionScore, TextQuestionScore } from './camp-data';

export type { TextQuestionScore } from './camp-data';

// 常见同义词归一化：把一些口语化/同义表达映射到标准词，提升宽松匹配率
// 注意：这里用替换而不是删除，避免"不一定"被误判为"一定"
const NORMALIZE_REPLACEMENTS: Array<[RegExp, string]> = [
  [/黑色素细胞|黑素细胞|色素细胞|黑色素母细胞/g, '黑色素细胞'],
  [/自身免疫|免疫系统紊乱|免疫紊乱|免疫失调|免疫异常/g, '免疫'],
  [/t细胞|T细胞|cd8|CD8/g, '免疫'],
  [/白斑|白点|白色斑块|色素脱失斑/g, '白斑'],
  [/复色|色素恢复|长出色素|恢复颜色|颜色恢复/g, '复色'],
  [/复发|反复发作|反复|老是犯|总犯/g, '复发'],
  [/进展期|发展期|扩散期|正在长/g, '进展期'],
  [/稳定期|静止期|没在长|不发展/g, '稳定期'],
  [/308激光|308准分子|308nm激光|进口308|308/g, '308激光'],
  [/311窄谱|311全仓|311nm|全仓311/g, '311窄谱'],
  [/不传染|不会传染|不是传染病/g, '不传染'],
  [/不遗传|不一定遗传|不是遗传病/g, '不遗传'],
  [/情绪|压力|精神因素|心理因素/g, '情绪压力'],
  [/熬夜|睡眠不好|作息不规律/g, '熬夜'],
  [/暴晒|晒太阳太多|紫外线/g, '暴晒'],
  [/外伤|磕碰|手术伤口|抓伤/g, '外伤'],
  [/表皮移植|种植|黑色素种植|移植手术/g, '种植'],
  [/首诊负责|首诊制|专属医生|一个医生跟到底/g, '首诊负责制'],
  [/免费评估|免费看|免费帮看/g, '免费评估'],
  [/不承诺|不打包票|不说包好|不保证根治/g, '不承诺疗效'],
  [/治愈率|根治|包好|彻底治好/g, '根治承诺'],
  [/问诊|问清楚|了解情况/g, '问诊'],
  [/病因筛查|查病因|找原因|根源检查/g, '病因筛查'],
  [/诱因|导火索|触发因素/g, '诱因'],
  [/病因|根本原因|根子|底层原因/g, '病因'],
];

function normalize(text: string): string {
  let out = text.toLowerCase();
  for (const [re, rep] of NORMALIZE_REPLACEMENTS) {
    out = out.replace(re, rep);
  }
  // 去掉所有空白和标点，避免换行/逗号影响 includes
  out = out.replace(/[\s,。.、；;：:！!？?""''（）()【】\[\]《》<>"'`~@#$%^&*_+\-={}|\\/]+/g, '');
  // 宽松匹配（仅作用于匹配层，不改学员答案原文展示）：
  // 去掉情态/助动词插入字（能/会/可以/应该/应当/得/要/去/需/该 等），
  // 使"不能自称医生"→"不自称医生"、"保证能治好"→"保证治好"、"应该先评估"→"先评估"命中。
  // 多字情态词先替换（避免"可以"被单字规则拆坏），再删单字情态字。
  out = out
    .replace(/可以|能够|可能|应该|应当|需要|须得|会要|得要/g, '')
    .replace(/[能会得要需该去]/g, '');
  return out;
}

function isTextQuestion(
  q: ExamQuestion,
): q is Extract<ExamQuestion, { type: 'text' }> {
  return q.type === 'text';
}

/**
 * 对一道简答题评分
 * @returns 系数 0 / 0.5 / 1，以及命中详情
 */
export function scoreTextQuestion(
  q: Extract<ExamQuestion, { type: 'text' }>,
  rawAnswer: string,
): TextQuestionScore {
  const answer = (rawAnswer || '').trim();
  const minChars = q.minChars ?? 8;
  const fullT = q.fullThreshold ?? 0.8;
  const halfT = q.halfThreshold ?? 0.5;

  const totalPoints = q.keyPoints.length;
  const matchedKeywords: string[] = [];

  if (answer.length < minChars || totalPoints === 0) {
    return {
      questionId: q.id,
      answer,
      hitCount: 0,
      totalPoints,
      ratio: 0,
      awarded: 0,
      matchedKeywords,
    };
  }

  const normAnswer = normalize(answer);
  let hitCount = 0;
  for (const group of q.keyPoints) {
    let hit = false;
    for (const kw of group) {
      const normKw = normalize(kw);
      if (normKw && normAnswer.includes(normKw)) {
        hit = true;
        matchedKeywords.push(kw);
        break;
      }
    }
    if (hit) hitCount += 1;
  }

  const ratio = hitCount / totalPoints;
  let awarded = 0;
  if (ratio >= fullT) awarded = 1;
  else if (ratio >= halfT) awarded = 0.5;

  return {
    questionId: q.id,
    answer,
    hitCount,
    totalPoints,
    ratio: Math.round(ratio * 100) / 100,
    awarded,
    matchedKeywords,
  };
}

/**
 * 对一组考核题进行自动评分。
 * @returns examRaw 总分（未四舍五入）、客观题答对数、简答题评分明细
 */
export function gradeExam(
  questions: ExamQuestion[],
  answers: Record<string, number>,
  textAnswers: Record<string, string>,
  examMax: number,
): {
  examRaw: number;
  objectiveCorrect: number;
  objectiveTotal: number;
  perQ: number;
  objectiveScores: ObjectiveQuestionScore[];
  textScores: TextQuestionScore[];
} {
  const perQ = questions.length > 0 ? examMax / questions.length : 0;
  let examRaw = 0;
  let objectiveCorrect = 0;
  let objectiveTotal = 0;
  const objectiveScores: ObjectiveQuestionScore[] = [];
  const textScores: TextQuestionScore[] = [];

  for (const q of questions) {
    if (q.type === 'single' || q.type === 'judge') {
      objectiveTotal += 1;
      const chosen = typeof answers[q.id] === 'number' ? answers[q.id] : -1;
      const isCorrect = chosen === q.answer;
      if (isCorrect) {
        examRaw += perQ;
        objectiveCorrect += 1;
      }
      objectiveScores.push({
        questionId: q.id,
        type: q.type,
        chosen,
        correct: q.answer,
        isCorrect,
        score: isCorrect ? perQ : 0,
        maxScore: perQ,
      });
    } else if (isTextQuestion(q)) {
      const s = scoreTextQuestion(q, textAnswers[q.id] || '');
      textScores.push({ ...s, maxScore: perQ });
      examRaw += perQ * s.awarded;
    }
    // oral 类型（旧数据）：不计分
  }

  return {
    examRaw,
    objectiveCorrect,
    objectiveTotal,
    perQ,
    objectiveScores,
    textScores,
  };
}

/**
 * 结业考核版：每类题分值不同（oral/scenario/judge），需要按类分别传入
 */
export function gradeFinalExam(opts: {
  judgeQuestions: Array<{ id: string; answer: number; score: number }>;
  judgeAnswers: Record<string, number>;
  textQuestions: Array<
    Extract<ExamQuestion, { type: 'text' }> & { score: number }
  >;
  textAnswers: Record<string, string>;
}): {
  total: number;
  judgeScore: number;
  judgeCorrect: number;
  objectiveScores: ObjectiveQuestionScore[];
  textScores: TextQuestionScore[];
  textScore: number;
} {
  let judgeScore = 0;
  let judgeCorrect = 0;
  const objectiveScores: ObjectiveQuestionScore[] = [];
  for (const q of opts.judgeQuestions) {
    const chosen = typeof opts.judgeAnswers[q.id] === 'number' ? opts.judgeAnswers[q.id] : -1;
    const isCorrect = chosen === q.answer;
    if (isCorrect) {
      judgeScore += q.score;
      judgeCorrect += 1;
    }
    objectiveScores.push({
      questionId: q.id,
      type: 'judge',
      chosen,
      correct: q.answer,
      isCorrect,
      score: isCorrect ? q.score : 0,
      maxScore: q.score,
    });
  }

  let textScore = 0;
  const textScores: TextQuestionScore[] = [];
  for (const q of opts.textQuestions) {
    const s = scoreTextQuestion(q, opts.textAnswers[q.id] || '');
    textScores.push({ ...s, maxScore: q.score });
    textScore += q.score * s.awarded;
  }

  return {
    total: Math.round(judgeScore + textScore),
    judgeScore,
    judgeCorrect,
    objectiveScores,
    textScores,
    textScore: Math.round(textScore),
  };
}

// 从所有考核题中筛出简答题（供页面渲染/统计用）
export function filterTextQuestions(qs: ExamQuestion[]): Array<Extract<ExamQuestion, { type: 'text' }>> {
  return qs.filter(isTextQuestion);
}
