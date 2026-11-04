'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  trainingRounds,
  getTrainingProgress,
  getCurrentRound,
  isRoundUnlocked,
  isAllRoundsCompleted,
  resetTrainingProgress,
  setAllRoundsUnlocked,
  isAllRoundsUnlocked,
  type TrainingProgress,
} from '@/lib/training-rounds';
import { Lock, CheckCircle2, Circle, Play, Trophy, RotateCcw, AlertCircle } from 'lucide-react';
import { getUserInfo, PROJECT_NAMES, type ProjectType } from '@/lib/user-info';

export default function TrainingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-500">加载中...</div>}>
      <TrainingPageContent />
    </Suspense>
  );
}

function TrainingPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState<TrainingProgress[]>([]);
  const [currentRound, setCurrentRound] = useState(1);
  const [allCompleted, setAllCompleted] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [hasUserInfo, setHasUserInfo] = useState(true);
  const [userName, setUserName] = useState('');
  const [unlockBanner, setUnlockBanner] = useState(false);

  useEffect(() => {
    // 检测URL参数解锁
    const unlock = searchParams.get('unlock');
    if (unlock === 'zk2024') {
      setAllRoundsUnlocked();
      setUnlockBanner(true);
      // 清除URL参数
      const url = new URL(window.location.href);
      url.searchParams.delete('unlock');
      window.history.replaceState({}, '', url.toString());
    }

    setProgress(getTrainingProgress());
    setCurrentRound(getCurrentRound());
    setAllCompleted(isAllRoundsCompleted());
    const info = getUserInfo();
    if (!info) {
      setHasUserInfo(false);
    } else {
      setUserName(`${info.name}（${PROJECT_NAMES[info.project as ProjectType] || info.project}）`);
    }
  }, []);

  const handleStartRound = (roundNumber: number) => {
    if (!hasUserInfo) {
      router.push('/quiz/setup');
      return;
    }
    router.push(`/training/chat?round=${roundNumber}`);
  };

  const handleViewReport = (roundNumber: number) => {
    router.push(`/training/report?round=${roundNumber}`);
  };

  const handleReset = () => {
    resetTrainingProgress();
    setProgress([]);
    setCurrentRound(1);
    setAllCompleted(false);
    setShowResetConfirm(false);
  };

  const getRoundStatus = (roundNumber: number) => {
    const entry = progress.find(p => p.round === roundNumber);
    if (entry) return 'completed';
    if (roundNumber === currentRound) return 'current';
    if (isRoundUnlocked(roundNumber)) return 'unlocked';
    return 'locked';
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-emerald-600';
    if (score >= 70) return 'text-sky-600';
    return 'text-amber-600';
  };

  const stages = [
    { name: '基础问诊', rounds: [1, 2, 3], color: 'sky' },
    { name: '深度转化', rounds: [4, 5, 6, 7], color: 'purple' },
    { name: '难点攻坚', rounds: [8, 9, 10], color: 'rose' },
  ];

  const totalScore = progress.reduce((sum, p) => sum + p.score, 0);
  const avgScore = progress.length > 0 ? Math.round(totalScore / progress.length) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-sky-100">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* 返回按钮 */}
        <button
          onClick={() => router.push('/')}
          className="flex items-center text-sky-600 hover:text-sky-700 mb-6"
        >
          <span className="mr-2">&larr;</span>
          返回首页
        </button>

        {/* 页面标题 */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-sky-900 mb-3">
            客服进阶训练计划
          </h1>
          <p className="text-slate-600">
            10轮进阶训练，从基础问诊到难点攻坚，全面提升你的专业能力
          </p>
          {hasUserInfo && userName && (
            <p className="text-xs text-slate-400 mt-2">当前身份：{userName}</p>
          )}
        </div>

        {/* 解锁提示 */}
        {unlockBanner && (
          <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 mb-6 text-green-800 text-sm font-medium text-center">
            所有训练轮次已解锁
          </div>
        )}

        {/* 用户信息缺失警告 */}
        {!hasUserInfo && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-700 mb-1">请先填写个人信息</p>
              <p className="text-xs text-red-600 mb-3">
                训练成绩需要关联您的姓名和项目才能提交到管理后台。请先完成个人信息填写。
              </p>
              <button
                onClick={() => router.push('/quiz/setup')}
                className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors"
              >
                前往填写个人信息
              </button>
            </div>
          </div>
        )}

        {/* 进度概览 */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-sky-900">训练进度</h2>
            <button
              onClick={() => setShowResetConfirm(true)}
              className="flex items-center text-sm text-slate-500 hover:text-red-500 transition-colors"
            >
              <RotateCcw className="w-4 h-4 mr-1" />
              重新开始
            </button>
          </div>

          {/* 进度条 */}
          <div className="mb-4">
            <div className="flex items-center justify-between text-sm text-slate-600 mb-2">
              <span>已完成 {progress.filter(p => p.passed).length}/10 轮</span>
              <span>平均分 {avgScore}</span>
            </div>
            <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-sky-400 to-sky-600 rounded-full transition-all duration-500"
                style={{ width: `${(progress.filter(p => p.passed).length / 10) * 100}%` }}
              />
            </div>
          </div>

          {/* 毕业标识 */}
          {allCompleted && (
            <div className="bg-gradient-to-r from-amber-50 to-yellow-50 rounded-lg p-4 flex items-center">
              <Trophy className="w-8 h-8 text-amber-500 mr-3" />
              <div>
                <p className="font-bold text-amber-900">恭喜毕业！</p>
                <p className="text-sm text-amber-700">你已完成全部10轮训练，总分 {totalScore} 分，平均分 {avgScore} 分</p>
              </div>
            </div>
          )}
        </div>

        {/* 训练轮次列表 */}
        {stages.map((stage) => (
          <div key={stage.name} className="mb-8">
            <div className="flex items-center mb-4">
              <div className={`w-2 h-6 rounded-full mr-3 ${
                stage.color === 'sky' ? 'bg-sky-500' :
                stage.color === 'purple' ? 'bg-purple-500' : 'bg-rose-500'
              }`} />
              <h3 className="text-lg font-bold text-slate-800">{stage.name}</h3>
              <span className="ml-2 text-sm text-slate-500">
                ({stage.rounds.length}轮)
              </span>
            </div>

            <div className="space-y-3">
              {stage.rounds.map((roundNum) => {
                const round = trainingRounds.find(r => r.round === roundNum)!;
                const status = getRoundStatus(roundNum);
                const entry = progress.find(p => p.round === roundNum);

                return (
                  <div
                    key={roundNum}
                    className={`bg-white rounded-xl shadow-sm border-2 transition-all ${
                      status === 'current'
                        ? 'border-sky-400 shadow-sky-100'
                        : status === 'completed'
                        ? 'border-emerald-200'
                        : status === 'locked'
                        ? 'border-slate-100 opacity-60'
                        : 'border-slate-200'
                    }`}
                  >
                    <div className="p-4 flex items-center">
                      {/* 状态图标 */}
                      <div className="mr-4 flex-shrink-0">
                        {status === 'completed' && (
                          <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                            <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                          </div>
                        )}
                        {status === 'current' && (
                          <div className="w-10 h-10 bg-sky-100 rounded-full flex items-center justify-center animate-pulse">
                            <Play className="w-6 h-6 text-sky-600" />
                          </div>
                        )}
                        {status === 'unlocked' && (
                          <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center">
                            <Circle className="w-6 h-6 text-slate-400" />
                          </div>
                        )}
                        {status === 'locked' && (
                          <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center">
                            <Lock className="w-5 h-5 text-slate-400" />
                          </div>
                        )}
                      </div>

                      {/* 内容 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-slate-500">
                            第{roundNum}轮
                          </span>
                          <h4 className="font-bold text-slate-800">
                            {round.title}
                          </h4>
                          {status === 'current' && (
                            <span className="text-xs bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full">
                              当前
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-600 mb-1">
                          {round.description}
                        </p>
                        <p className="text-xs text-slate-500">
                          考察重点：{round.focus}
                        </p>
                      </div>

                      {/* 右侧操作 */}
                      <div className="ml-4 flex-shrink-0 flex items-center gap-3">
                        {status === 'completed' && entry && (
                          <>
                            <span className={`text-lg font-bold ${getScoreColor(entry.score)}`}>
                              {entry.score}分
                            </span>
                            <button
                              onClick={() => handleViewReport(roundNum)}
                              className="text-sm text-sky-600 hover:text-sky-700 font-medium"
                            >
                              查看报告
                            </button>
                          </>
                        )}
                        {(status === 'current' || status === 'unlocked') && (
                          <button
                            onClick={() => handleStartRound(roundNum)}
                            className="bg-sky-500 hover:bg-sky-600 text-white px-4 py-2 rounded-lg font-medium text-sm transition-all hover:scale-105"
                          >
                            开始训练
                          </button>
                        )}
                        {status === 'locked' && (
                          <span className="text-sm text-slate-400">
                            需通过上一轮
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* 评分维度说明 */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-bold text-sky-900 mb-4">
            评分维度
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="bg-purple-50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-purple-900">问诊能力</span>
                <span className="text-xs text-purple-600">25%</span>
              </div>
              <p className="text-xs text-purple-700">主动询问病情、病史、治疗经历</p>
            </div>
            <div className="bg-sky-50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-sky-900">分析能力</span>
                <span className="text-xs text-sky-600">20%</span>
              </div>
              <p className="text-xs text-sky-700">分析既往治疗无效的原因</p>
            </div>
            <div className="bg-green-50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-green-900">共情能力</span>
                <span className="text-xs text-green-600">15%</span>
              </div>
              <p className="text-xs text-green-700">理解患者情绪，给予情感支持</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-blue-900">专业度</span>
                <span className="text-xs text-blue-600">15%</span>
              </div>
              <p className="text-xs text-blue-700">医学知识准确，方案合理</p>
            </div>
            <div className="bg-orange-50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-orange-900">转化引导</span>
                <span className="text-xs text-orange-600">15%</span>
              </div>
              <p className="text-xs text-orange-700">自然引导到院，降低门槛</p>
            </div>
            <div className="bg-red-50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-red-900">话术规范</span>
                <span className="text-xs text-red-600">10%</span>
              </div>
              <p className="text-xs text-red-700">避免违禁词，合规表达</p>
            </div>
          </div>
          <p className="text-sm text-slate-500 mt-4">
            * 每轮需达到70分视为通过
          </p>
        </div>
      </div>

      {/* 重置确认弹窗 */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-sm mx-4 shadow-xl">
            <h3 className="text-lg font-bold text-slate-800 mb-3">
              确认重新开始？
            </h3>
            <p className="text-slate-600 mb-6">
              这将清空所有训练进度和评分记录，从第1轮重新开始。此操作不可撤销。
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
              >
                取消
              </button>
              <button
                onClick={handleReset}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
              >
                确认重置
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
