'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { chapters, storageUtils, type ChapterScore } from '@/lib/quiz-data';
import { chapter1Questions } from '@/lib/quiz/chapter1';
import { chapter2Questions } from '@/lib/quiz/chapter2';
import { chapter3Questions } from '@/lib/quiz/chapter3';
import { chapter4Questions } from '@/lib/quiz/chapter4';
import { chapter5Questions } from '@/lib/quiz/chapter5';
import { chapter6Questions } from '@/lib/quiz/chapter6';
import { getUserInfo, hasUserInfo, PROJECT_NAMES, type UserInfo } from '@/lib/user-info';

// 获取章节题库
const chapterQuestionMap: Record<number, typeof chapter1Questions> = {
  1: chapter1Questions,
  2: chapter2Questions,
  3: chapter3Questions,
  4: chapter4Questions,
  5: chapter5Questions,
  6: chapter6Questions
};

interface ChapterStatus {
  unlocked: boolean;
  bestScore: ChapterScore | null;
  passed: boolean;
}

export default function QuizPage() {
  const router = useRouter();
  const [chapterStatuses, setChapterStatuses] = useState<Record<number, ChapterStatus>>({});
  const [mounted, setMounted] = useState(false);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [unlockBanner, setUnlockBanner] = useState(false);

  useEffect(() => {
    // 检查URL参数解锁
    const params = new URLSearchParams(window.location.search);
    if (params.get('unlock') === 'zk2024') {
      storageUtils.setAllUnlocked();
      setUnlockBanner(true);
      // 清除URL参数
      window.history.replaceState({}, '', '/quiz');
    }

    // 检查用户信息
    if (!hasUserInfo()) {
      router.push('/quiz/setup');
      return;
    }

    const info = getUserInfo();
    setUserInfo(info);
    setMounted(true);

    // 加载章节状态
    const statuses: Record<number, ChapterStatus> = {};
    const unlockedChapters = storageUtils.getUnlockedChapters();
    
    chapters.forEach(chapter => {
      const bestScore = storageUtils.getBestScore(chapter.id);
      statuses[chapter.id] = {
        unlocked: unlockedChapters.includes(chapter.id),
        bestScore,
        passed: bestScore ? bestScore.passed : false
      };
    });
    
    setChapterStatuses(statuses);
  }, [router]);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white flex items-center justify-center">
        <div className="text-sky-600">加载中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white">
      {/* 头部 */}
      <header className="bg-white border-b border-sky-100 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-sky-700 hover:text-sky-900">
            <span>←</span>
            <span>返回首页</span>
          </Link>
          <h1 className="text-lg font-bold text-sky-900">专业知识考核</h1>
          <button
            onClick={() => router.push('/quiz/setup')}
            className="text-sm text-sky-600 hover:text-sky-800"
          >
            修改信息
          </button>
        </div>
      </header>

      {/* 解锁提示 */}
      {unlockBanner && (
        <div className="max-w-4xl mx-auto px-4 pt-4">
          <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-green-800 text-sm font-medium">
            所有章节已解锁
          </div>
        </div>
      )}

      {/* 用户信息 */}
      {userInfo && (
        <div className="max-w-4xl mx-auto px-4 pt-6">
          <div className="bg-gradient-to-r from-sky-500 to-sky-600 rounded-xl p-4 text-white">
            <p className="text-sm opacity-90">欢迎</p>
            <p className="text-xl font-bold">
              {userInfo.name}
              <span className="text-sm font-normal opacity-90 ml-2">
                （{PROJECT_NAMES[userInfo.project]}项目）
              </span>
            </p>
          </div>
        </div>
      )}

      {/* 说明 */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 mb-6">
          <p className="text-sm text-sky-800">
            <strong>考核规则：</strong>共6个章节，每章30题，90分及格。通过后可解锁下一章。
          </p>
        </div>

        {/* 章节列表 */}
        <div className="space-y-4">
          {chapters.map(chapter => {
            const status = chapterStatuses[chapter.id];
            const isLocked = !status?.unlocked;
            const isPassed = status?.passed;
            const bestScore = status?.bestScore;

            return (
              <Link
                key={chapter.id}
                href={isLocked ? '#' : `/quiz/chapter/${chapter.id}`}
                className={`block p-5 rounded-xl border-2 transition-all ${
                  isLocked
                    ? 'bg-gray-50 border-gray-200 cursor-not-allowed opacity-60'
                    : isPassed
                    ? 'bg-green-50 border-green-300 hover:shadow-md'
                    : 'bg-white border-sky-200 hover:border-sky-400 hover:shadow-md'
                }`}
                onClick={e => isLocked && e.preventDefault()}
              >
                <div className="flex items-start gap-4">
                  {/* 图标/状态 */}
                  <div className="text-3xl">
                    {isLocked ? '🔒' : isPassed ? '✅' : chapter.icon}
                  </div>
                  
                  {/* 内容 */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-sky-600">{chapter.title}</span>
                      {isPassed && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">已通过</span>
                      )}
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-1">{chapter.subtitle}</h3>
                    <p className="text-sm text-gray-600">{chapter.description}</p>
                    
                    {/* 成绩信息 */}
                    {bestScore && (
                      <div className="mt-2 flex items-center gap-4 text-sm">
                        <span className="text-gray-600">
                          最佳成绩：<strong className={bestScore.passed ? 'text-green-600' : 'text-orange-600'}>{bestScore.score}分</strong>
                        </span>
                        <span className="text-gray-400">|</span>
                        <span className="text-gray-500">{bestScore.date}</span>
                      </div>
                    )}
                  </div>
                  
                  {/* 箭头 */}
                  {!isLocked && (
                    <div className="text-sky-400 text-xl">→</div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>

        {/* 底部提示 */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>每章题库45+题，每次随机抽取30题</p>
          <p className="mt-1">未通过可无限次重考</p>
        </div>
      </div>
    </div>
  );
}
