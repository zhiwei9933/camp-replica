'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { 
  chapters, 
  categoryNames, 
  gradeShortAnswer, 
  getRandomQuestions, 
  shuffleOptions, 
  storageUtils,
  getChapter6Questions,
  type QuizQuestion, 
  type ChoiceQuestion, 
  type ShortQuestion,
  type ChapterScore 
} from '@/lib/quiz-data';
import { chapter1Questions } from '@/lib/quiz/chapter1';
import { chapter2Questions } from '@/lib/quiz/chapter2';
import { chapter3Questions } from '@/lib/quiz/chapter3';
import { chapter4Questions } from '@/lib/quiz/chapter4';
import { chapter5Questions } from '@/lib/quiz/chapter5';
import { getUserInfo, PROJECT_NAMES, type UserInfo } from '@/lib/user-info';

const chapterQuestionMap: Record<number, typeof chapter1Questions> = {
  1: chapter1Questions,
  2: chapter2Questions,
  3: chapter3Questions,
  4: chapter4Questions,
  5: chapter5Questions,
  // 第6章使用动态获取的题目，根据用户选择的项目组合
  6: [] as typeof chapter1Questions
};

interface AnswerRecord {
  questionId: string;
  userAnswer: string;
  isCorrect: boolean;
  score: number;
  matchedKeywords?: string[];
}

export default function ChapterQuizPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const chapterId = Number(params.id);
  const chapter = chapters.find(c => c.id === chapterId);
  const isTestMode = searchParams.get('test') === 'auto';
  
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [showResult, setShowResult] = useState(false);
  const [shortAnswerInput, setShortAnswerInput] = useState('');
  const [showShortAnswerResult, setShowShortAnswerResult] = useState(false);
  const [shortAnswerFeedback, setShortAnswerFeedback] = useState('');
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);

  useEffect(() => {
    setMounted(true);
    // 加载用户信息
    setUserInfo(getUserInfo());
    // 检查章节是否解锁（测试模式跳过检查）
    if (!isTestMode) {
      const unlocked = storageUtils.getUnlockedChapters();
      if (!unlocked.includes(chapterId)) {
        router.push('/quiz');
        return;
      }
    }
    
    loadQuestions();
  }, [chapterId, router, isTestMode]);

  // 测试模式：自动答题
  const runTestMode = useCallback(async (loadedQuestions: QuizQuestion[]) => {
    if (!isTestMode || loadedQuestions.length === 0) return;
    
    console.log('[测试模式] 开始自动答题...');
    const testAnswers: AnswerRecord[] = [];
    const scorePerQuestion = 100 / loadedQuestions.length;
    
    for (let i = 0; i < loadedQuestions.length; i++) {
      const q = loadedQuestions[i];
      
      if (q.type === 'single' || q.type === 'scenario') {
        // 选择题：选择正确答案
        const choiceQ = q as ChoiceQuestion;
        testAnswers.push({
          questionId: q.id,
          userAnswer: choiceQ.answer,
          isCorrect: true,
          score: scorePerQuestion
        });
      } else if (q.type === 'short') {
        // 简答题：使用关键词作为答案
        const shortQ = q as ShortQuestion;
        const mockAnswer = shortQ.keywords.join('，');
        const { score, matchedKeywords } = gradeShortAnswer(mockAnswer, shortQ.keywords);
        const finalScore = (score / 100) * scorePerQuestion;
        testAnswers.push({
          questionId: q.id,
          userAnswer: mockAnswer,
          isCorrect: score >= 60,
          score: finalScore,
          matchedKeywords
        });
      }
      
      // 每道题间隔100ms，模拟答题过程
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log('[测试模式] 自动答题完成，总分:', testAnswers.reduce((sum, a) => sum + a.score, 0));
    setAnswers(testAnswers);
    setShowResult(true);
  }, [isTestMode]);

  const loadQuestions = useCallback(() => {
    // 第6章使用动态获取的题目，根据用户选择的项目组合
    let allQuestions: QuizQuestion[];
    if (chapterId === 6) {
      // 直接从 localStorage 读取，避免依赖异步 state 更新
      const currentUserInfo = getUserInfo();
      allQuestions = getChapter6Questions(currentUserInfo?.project || 'nanchang');
    } else {
      allQuestions = chapterQuestionMap[chapterId] || [];
    }
    
    // 按题型分类
    const singleQuestions = allQuestions.filter(q => q.type === 'single');
    const scenarioQuestions = allQuestions.filter(q => q.type === 'scenario');
    const shortQuestions = allQuestions.filter(q => q.type === 'short');
    
    // 随机抽取：约15单选 + 10情景 + 5简答 = 30题
    const selectedSingle = getRandomQuestions(singleQuestions, Math.min(15, singleQuestions.length));
    const selectedScenario = getRandomQuestions(scenarioQuestions, Math.min(10, scenarioQuestions.length));
    const selectedShort = getRandomQuestions(shortQuestions, Math.min(5, shortQuestions.length));
    
    // 合并并打乱选项
    const selectedQuestions = [...selectedSingle, ...selectedScenario, ...selectedShort]
      .sort(() => Math.random() - 0.5)
      .map(q => {
        if (q.type === 'single' || q.type === 'scenario') {
          return shuffleOptions(q as ChoiceQuestion);
        }
        return q;
      });
    
    setQuestions(selectedQuestions);
    
    // 测试模式：自动答题
    if (isTestMode) {
      setTimeout(() => runTestMode(selectedQuestions), 500);
    }
  }, [chapterId, isTestMode, runTestMode]);

  const currentQuestion = questions[currentIndex];
  const totalQuestions = questions.length;
  const progress = ((currentIndex) / totalQuestions) * 100;

  const handleChoiceAnswer = (optionText: string) => {
    if (!currentQuestion || currentQuestion.type === 'short' || hasAnswered) return;
    
    const choiceQ = currentQuestion as ChoiceQuestion;
    // 提取选项字母（第一个字符）
    const optionLetter = optionText.charAt(0);
    const isCorrect = optionLetter === choiceQ.answer;
    const scorePerQuestion = 100 / totalQuestions;
    
    const record: AnswerRecord = {
      questionId: currentQuestion.id,
      userAnswer: optionLetter,
      isCorrect,
      score: isCorrect ? scorePerQuestion : 0
    };
    
    setAnswers([...answers, record]);
    setHasAnswered(true);
  };

  const handleNextQuestion = () => {
    setHasAnswered(false);
    
    if (currentIndex < totalQuestions - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      finishQuiz();
    }
  };

  const handleShortAnswerSubmit = async () => {
    if (!currentQuestion || currentQuestion.type !== 'short' || !shortAnswerInput.trim() || hasAnswered) return;
    
    const shortQ = currentQuestion as ShortQuestion;
    setIsEvaluating(true);
    
    try {
      // 调用AI评分API
      const response = await fetch('/api/quiz/evaluate-short-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: shortQ.question,
          referenceAnswer: shortQ.referenceAnswer,
          keywords: shortQ.keywords,
          userAnswer: shortAnswerInput
        })
      });
      
      const result = await response.json();
      
      let score: number;
      let matchedKeywords: string[];
      let feedback: string;
      
      if (result.success) {
        // AI评分成功
        score = result.score;
        matchedKeywords = result.matchedKeywords || [];
        feedback = result.feedback || '';
      } else {
        // AI评分失败，降级为关键词匹配
        const localResult = gradeShortAnswer(shortAnswerInput, shortQ.keywords);
        score = localResult.score;
        matchedKeywords = localResult.matchedKeywords;
        feedback = '（AI评分暂时不可用，使用关键词匹配）';
      }
      
      const scorePerQuestion = 100 / totalQuestions;
      const finalScore = (score / 100) * scorePerQuestion;
      
      const record: AnswerRecord = {
        questionId: currentQuestion.id,
        userAnswer: shortAnswerInput,
        isCorrect: score >= 60,
        score: finalScore,
        matchedKeywords
      };
      
      setAnswers([...answers, record]);
      setShortAnswerFeedback(feedback);
      setShowShortAnswerResult(true);
      setHasAnswered(true);
    } catch (error) {
      console.error('简答题评分错误:', error);
      // 降级为本地关键词匹配
      const { score, matchedKeywords } = gradeShortAnswer(shortAnswerInput, shortQ.keywords);
      const scorePerQuestion = 100 / totalQuestions;
      const finalScore = (score / 100) * scorePerQuestion;
      
      const record: AnswerRecord = {
        questionId: currentQuestion.id,
        userAnswer: shortAnswerInput,
        isCorrect: score >= 60,
        score: finalScore,
        matchedKeywords
      };
      
      setAnswers([...answers, record]);
      setShortAnswerFeedback('（评分服务暂时不可用，使用关键词匹配）');
      setShowShortAnswerResult(true);
      setHasAnswered(true);
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleNextAfterShortAnswer = () => {
    setShortAnswerInput('');
    setShowShortAnswerResult(false);
    setHasAnswered(false);
    
    if (currentIndex < totalQuestions - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      finishQuiz();
    }
  };

  // 提交成绩到后台（静默失败）
  const submitResultToServer = async (score: number, passed: boolean) => {
    try {
      const info = getUserInfo();
      if (!info) return;

      // 收集错题
      const wrongQuestions = answers
        .map(a => {
          const q = questions.find(qq => qq.id === a.questionId);
          if (!q) return null;
          const isShort = q.type === 'short';
          // 简答题：得分<60%算错；选择题：score===0算错
          if (isShort) {
            if (a.score >= 60) return null;
          } else {
            if (a.score > 0) return null;
          }
          let correctAnswer = '';
          if (isShort) {
            correctAnswer = (q as { referenceAnswer?: string }).referenceAnswer || '';
          } else {
            correctAnswer = (q as { answer: string }).answer;
          }
          return {
            question: q.question,
            userAnswer: a.userAnswer || '',
            correctAnswer,
            explanation: q.explanation || '',
            type: isShort ? '简答题' : (q.type === 'single' ? '单选题' : '情景判断'),
          };
        })
        .filter((w): w is NonNullable<typeof w> => w !== null);

      const payload = {
        staffName: info.name,
        city: PROJECT_NAMES[info.project],
        chapterId,
        chapterName: chapter?.title || `第${chapterId}章`,
        score,
        passed,
        wrongQuestions,
        submittedAt: new Date().toISOString(),
      };
      console.log('[Quiz] 提交考核成绩数据:', payload);
      const res = await fetch('/api/quiz/submit-result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const resJson = await res.json();
      console.log('[Quiz] 提交考核成绩响应:', resJson);
    } catch (err) {
      console.error('[Quiz] 成绩提交失败:', err);
    }
  };

  const finishQuiz = () => {
    const totalScore = answers.reduce((sum, a) => sum + a.score, 0);
    const roundedScore = Math.round(totalScore);
    const passed = roundedScore >= (chapter?.passScore || 90);
    
    // 保存成绩
    const scoreRecord: ChapterScore = {
      chapterId,
      score: roundedScore,
      passed,
      date: new Date().toLocaleDateString('zh-CN'),
      answers: answers.reduce((acc, a) => ({ ...acc, [a.questionId]: a.userAnswer }), {})
    };
    
    storageUtils.saveScore(scoreRecord);
    
    // 自动提交成绩到后台（静默失败）
    submitResultToServer(roundedScore, passed);
    
    // 如果通过，解锁下一章
    if (passed && chapterId < 6) {
      storageUtils.unlockChapter(chapterId + 1);
    }
    
    setShowResult(true);
  };

  const handleRetry = () => {
    setAnswers([]);
    setCurrentIndex(0);
    setShowResult(false);
    setHasAnswered(false);
    loadQuestions();
  };

  if (!mounted || !chapter || questions.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white flex items-center justify-center">
        <div className="text-sky-600">加载中...</div>
      </div>
    );
  }

  if (showResult) {
    const totalScore = Math.round(answers.reduce((sum, a) => sum + a.score, 0));
    const passed = totalScore >= chapter.passScore;
    
    return (
      <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white">
        <div className="max-w-2xl mx-auto px-4 py-8">
          {/* 用户信息 */}
          {userInfo && (
            <div className="text-center mb-4">
              <p className="text-sm text-gray-500">
                {userInfo.name}（{PROJECT_NAMES[userInfo.project]}项目）
              </p>
            </div>
          )}
          
          {/* 结果卡片 */}
          <div className={`rounded-2xl p-8 text-center ${passed ? 'bg-green-50 border-2 border-green-300' : 'bg-orange-50 border-2 border-orange-300'}`}>
            <div className="text-5xl mb-4">{passed ? '🎉' : '💪'}</div>
            <h2 className={`text-2xl font-bold mb-2 ${passed ? 'text-green-700' : 'text-orange-700'}`}>
              {passed ? '恭喜通过！' : '未通过'}
            </h2>
            <div className={`text-5xl font-bold my-4 ${passed ? 'text-green-600' : 'text-orange-600'}`}>
              {totalScore}分
            </div>
            <p className="text-gray-600">
              {passed ? `你已成功通过${chapter.subtitle}考核！` : `及格分数为${chapter.passScore}分，再接再厉！`}
            </p>
          </div>

          {/* 答题详情 */}
          <div className="mt-6 bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="font-bold text-gray-900 mb-4">答题详情</h3>
            <div className="space-y-3">
              {questions.map((q, idx) => {
                const answer = answers[idx];
                return (
                  <div key={q.id} className="border-b border-gray-100 pb-3 last:border-0">
                    <div className="flex items-start gap-2">
                      <span className={`text-sm font-medium ${answer?.isCorrect ? 'text-green-600' : 'text-red-500'}`}>
                        {answer?.isCorrect ? '✓' : '✗'}
                      </span>
                      <div className="flex-1">
                        <p className="text-sm text-gray-700 line-clamp-2">{q.question}</p>
                        {q.type === 'short' && answer?.matchedKeywords && (
                          <p className="text-xs text-gray-500 mt-1">
                            命中关键词：{answer.matchedKeywords.join('、') || '无'}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="mt-6 flex gap-4">
            {!passed && (
              <button
                onClick={handleRetry}
                className="flex-1 py-3 bg-sky-500 text-white rounded-xl font-medium hover:bg-sky-600"
              >
                重新考核
              </button>
            )}
            {passed && chapterId < 6 && (
              <Link
                href={`/quiz/chapter/${chapterId + 1}`}
                className="flex-1 py-3 bg-green-500 text-white rounded-xl font-medium text-center hover:bg-green-600"
              >
                进入下一章 →
              </Link>
            )}
            <Link
              href="/quiz"
              className="flex-1 py-3 bg-white border border-gray-300 text-gray-700 rounded-xl font-medium text-center hover:bg-gray-50"
            >
              返回章节列表
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white">
      {/* 头部 */}
      <header className="bg-white border-b border-sky-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <Link href="/quiz" className="text-sky-600 text-sm">← 返回</Link>
            <span className="text-sm text-gray-500">{currentIndex + 1} / {totalQuestions}</span>
          </div>
          {/* 进度条 */}
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-sky-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </header>

      {/* 题目内容 */}
      <div className="max-w-2xl mx-auto px-4 py-6">
        {currentQuestion && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            {/* 题目类型标签 */}
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs bg-sky-100 text-sky-700 px-2 py-0.5 rounded">
                {currentQuestion.type === 'single' ? '单选题' : currentQuestion.type === 'scenario' ? '情景判断' : '简答题'}
              </span>
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                {categoryNames[currentQuestion.category]}
              </span>
            </div>
            
            {/* 题目 */}
            <h2 className="text-lg font-medium text-gray-900 mb-5 leading-relaxed">
              {currentQuestion.question}
            </h2>

            {/* 选项/输入 */}
            {(currentQuestion.type === 'single' || currentQuestion.type === 'scenario') ? (
              <div className="space-y-3">
                {(currentQuestion as ChoiceQuestion).options.map(option => {
                  const optionLetter = option.charAt(0);
                  const userAnswerRecord = answers.find(a => a.questionId === currentQuestion.id);
                  const isSelected = hasAnswered && userAnswerRecord?.userAnswer === optionLetter;
                  const isCorrect = optionLetter === (currentQuestion as ChoiceQuestion).answer;
                  
                  let className = 'w-full p-4 text-left rounded-xl border-2 transition-all ';
                  if (hasAnswered) {
                    if (isCorrect) {
                      className += 'bg-green-50 border-green-400 text-green-800';
                    } else if (isSelected) {
                      className += 'bg-red-50 border-red-400 text-red-800';
                    } else {
                      className += 'bg-gray-50 border-gray-200 text-gray-500';
                    }
                  } else {
                    className += 'bg-white border-gray-200 hover:border-sky-400 hover:bg-sky-50';
                  }
                  
                  return (
                    <button
                      key={option}
                      onClick={() => handleChoiceAnswer(option)}
                      disabled={hasAnswered}
                      className={className}
                    >
                      {option}
                    </button>
                  );
                })}
                
                {/* 解析 */}
                {hasAnswered && (
                  <>
                    <div className="mt-4 p-4 bg-sky-50 border border-sky-200 rounded-xl">
                      <p className="text-sm text-sky-800">
                        <strong>解析：</strong>{currentQuestion.explanation}
                      </p>
                    </div>
                    <button
                      onClick={handleNextQuestion}
                      className="w-full mt-4 py-3 bg-sky-500 text-white rounded-xl font-medium hover:bg-sky-600 transition-colors"
                    >
                      {currentIndex < totalQuestions - 1 ? '下一题 →' : '查看结果'}
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div>
                {/* 简答题输入 */}
                {!showShortAnswerResult ? (
                  <div>
                    <textarea
                      value={shortAnswerInput}
                      onChange={e => setShortAnswerInput(e.target.value)}
                      placeholder="请输入你的回答（不少于30字）..."
                      className="w-full h-32 p-4 border border-gray-300 rounded-xl resize-none focus:outline-none focus:border-sky-400"
                      disabled={hasAnswered}
                    />
                    <div className="flex items-center justify-between mt-3">
                      <span className="text-sm text-gray-500">
                        已输入 {shortAnswerInput.length} 字
                      </span>
                      <button
                        onClick={handleShortAnswerSubmit}
                        disabled={shortAnswerInput.trim().length < 10 || hasAnswered || isEvaluating}
                        className="px-6 py-2 bg-sky-500 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-sky-600"
                      >
                        {isEvaluating ? 'AI评分中...' : '提交答案'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    {/* 简答题结果 */}
                    <div className="p-4 bg-gray-50 rounded-xl mb-4">
                      <p className="text-sm text-gray-600 mb-2">你的回答：</p>
                      <p className="text-gray-800">{shortAnswerInput}</p>
                    </div>
                    
                    <div className="p-4 bg-green-50 border border-green-200 rounded-xl mb-4">
                      <p className="text-sm text-green-700 font-medium mb-2">参考答案：</p>
                      <p className="text-green-800">{(currentQuestion as ShortQuestion).referenceAnswer}</p>
                    </div>
                    
                    <div className="p-4 bg-sky-50 border border-sky-200 rounded-xl mb-4">
                      <p className="text-sm text-sky-700">
                        <strong>解析：</strong>{currentQuestion.explanation}
                      </p>
                      <p className="text-sm text-sky-600 mt-2">
                        <strong>命中关键词：</strong>
                        {answers.find(a => a.questionId === currentQuestion.id)?.matchedKeywords?.join('、') || '无'}
                      </p>
                      {shortAnswerFeedback && (
                        <p className="text-sm text-sky-600 mt-2">
                          <strong>AI评语：</strong>{shortAnswerFeedback}
                        </p>
                      )}
                    </div>
                    
                    <button
                      onClick={handleNextAfterShortAnswer}
                      className="w-full py-3 bg-sky-500 text-white rounded-xl font-medium hover:bg-sky-600 transition-colors"
                    >
                      {currentIndex < totalQuestions - 1 ? '下一题 →' : '查看结果'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
