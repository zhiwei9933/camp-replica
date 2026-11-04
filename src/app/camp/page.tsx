'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  MessageCircle,
  Trophy,
  ChevronRight,
  Flame,
  Award,
  ScrollText,
  Mic,
  NotebookPen,
  Lock,
  CheckCircle2,
  PlayCircle,
} from 'lucide-react';
import { LEVELS, RANKS, flattenSubLevels, getRank, getNextRank, type Level } from '@/lib/camp-data';
import { getCampProgress, getStreakDays, getSubLevelRecord, starFromScore, useCampSync, clearLocalCampIdentity, isSubLevelRetaking } from '@/lib/camp-progress';
import { getUserInfo, PROJECT_NAMES } from '@/lib/user-info';
import { cn } from '@/lib/utils';
import { UserCog } from 'lucide-react';

interface LbEntry {
  name: string;
  city: string;
  score: number;
}

const REWARDS: Record<number, string> = {
  1: '168元红包',
  2: '88元红包',
  3: '奶茶咖啡券',
};

function cityLabel(city: string): string {
  return (PROJECT_NAMES as Record<string, string>)[city] || city;
}

export default function CampHomePage() {
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<{ name?: string; project?: string } | null>(null);
  const [totalScore, setTotalScore] = useState(0);
  const [completed, setCompleted] = useState(0);
  const [streak, setStreak] = useState(0);
  const [board, setBoard] = useState<LbEntry[]>([]);
  const [boardLoading, setBoardLoading] = useState(true);

  // 进入首页先从云端回放该员工进度（换电脑恢复），回放完成后再读本地数据渲染
  const { synced } = useCampSync();

  const refreshLocalStats = () => {
    const p = getCampProgress();
    setTotalScore(p.totalScore);
    setCompleted(
      flattenSubLevels().filter(({ sub }) => (p.records[sub.id]?.bestScore || 0) >= 70).length,
    );
    setStreak(getStreakDays());
  };

  useEffect(() => {
    setMounted(true);
    setUser(getUserInfo());
  }, []);

  useEffect(() => {
    if (synced) refreshLocalStats();
  }, [synced]);

  useEffect(() => {
    let cancelled = false;
    setBoardLoading(true);
    fetch('/api/camp/leaderboard?period=total')
      .then((r) => r.json())
      .then((data: { success: boolean; entries?: Array<{ name: string; city: string; totalScore: number }> }) => {
        if (cancelled) return;
        setBoard((data.entries || []).map((e) => ({ name: e.name, city: e.city, score: e.totalScore })));
        setBoardLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setBoard([]);
        setBoardLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const allSubs = useMemo(() => flattenSubLevels(), []);
  const totalSubs = allSubs.length;
  const progressPct = totalSubs ? Math.round((completed / totalSubs) * 100) : 0;
  const rank = getRank(totalScore);
  const nextRank = getNextRank(totalScore);

  // 第一个未通关的小关作为"继续学习"
  const continueItem = useMemo(() => {
    const p = getCampProgress();
    return allSubs.find(({ sub }) => {
      if (sub.status !== 'available') return false;
      const r = p.records[sub.id];
      return !r || r.bestScore < 70;
    });
  }, [allSubs, synced]);

  const handleSwitchAccount = () => {
    if (typeof window === 'undefined') return;
    const ok = window.confirm(
      '切换账号将清空本机的训练营进度缓存（成绩已保存在云端，用同一姓名+城市重新进入即可恢复）。确定继续吗？',
    );
    if (!ok) return;
    clearLocalCampIdentity();
    window.location.href = '/quiz/setup?from=camp';
  };

  if (!mounted) {
    return <div className="min-h-screen bg-[#F5F7FC]" />;
  }

  const topThree = board.slice(0, 3);
  const rest = board.slice(3, 8);
  // 领奖台顺序：2nd, 1st, 3rd
  const podiumOrder = [topThree[1], topThree[0], topThree[2]].filter(Boolean);

  return (
    <div className="min-h-screen bg-[#F5F7FC] text-slate-800">
      {/* 顶部导航 */}
      <TopNav user={user} streak={streak} />

      {/* 当前身份条：显示姓名+城市，支持切换账号（一台电脑多人轮班） */}
      {user?.name && (
        <div className="bg-white border-b border-[#E8EBF5]">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-2 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="w-7 h-7 rounded-full bg-[#EBF0FF] text-[#4F6BED] flex items-center justify-center text-xs font-bold shrink-0">
                {user.name.slice(0, 1)}
              </span>
              <span className="text-slate-500 shrink-0">当前身份</span>
              <span className="font-bold text-slate-800 truncate">{user.name}</span>
              <span className="px-1.5 py-0.5 rounded bg-[#EBF0FF] text-[#4F6BED] text-xs font-medium shrink-0">
                {cityLabel(user.project || '')}
              </span>
              {!synced && <span className="text-xs text-slate-400">正在恢复云端进度…</span>}
            </div>
            <button
              onClick={handleSwitchAccount}
              className="shrink-0 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-[#4F6BED] border border-[#E8EBF5] hover:border-[#4F6BED] rounded-lg px-2.5 py-1.5 transition-colors"
            >
              <UserCog className="w-3.5 h-3.5" />
              切换账号
            </button>
          </div>
        </div>
      )}

      {/* Hero */}
      <section
        className="relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #4F6BED 0%, #6B7FF0 50%, #7B61FF 100%)',
        }}
      >
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.4) 0, transparent 40%), radial-gradient(circle at 80% 60%, rgba(255,255,255,0.25) 0, transparent 35%)',
          }}
        />
        <div className="relative max-w-[1200px] mx-auto px-4 sm:px-6 py-10 sm:py-14 grid md:grid-cols-2 gap-8 items-center">
          <div className="text-white">
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white/20 backdrop-blur text-xs font-medium mb-4">
              <SparkleIcon /> V2.0 游戏化闯关训练营
            </span>
            <h1 className="text-3xl sm:text-4xl font-bold leading-tight mb-3">
              专业训练 · 游戏化闯关
            </h1>
            <p className="text-white/80 text-sm sm:text-base mb-6 max-w-md">
              8大关卡 · 16小关 · 每关12分钟&ldquo;学+练+考&rdquo;闭环
              <br />
              把白癜风知识从&ldquo;听懂&rdquo;练成&ldquo;会说&rdquo;
            </p>
            <div className="grid grid-cols-4 gap-3 max-w-md">
              {[
                { n: '8', l: '大关卡' },
                { n: '16', l: '小关卡' },
                { n: '100+', l: '道题' },
                { n: 'AI', l: '模拟实战' },
              ].map((s) => (
                <div
                  key={s.l}
                  className="bg-white/15 backdrop-blur rounded-xl px-2 py-3 text-center"
                >
                  <div className="text-xl sm:text-2xl font-bold">{s.n}</div>
                  <div className="text-[11px] text-white/80 mt-0.5">{s.l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 进度卡 */}
          <div className="bg-white/15 backdrop-blur-md rounded-2xl p-6 text-white border border-white/20 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm text-white/80">我的训练营进度</div>
              <div className="text-xs px-2 py-0.5 rounded-full bg-white/20">
                {streak > 0 ? `已连续学习 ${streak} 天` : '开启连续学习'}
              </div>
            </div>
            <div className="flex items-baseline gap-1 mb-2">
              <span className="text-4xl font-bold">{completed}</span>
              <span className="text-lg text-white/70">/ {totalSubs} 关</span>
            </div>
            <div className="h-2 rounded-full bg-white/20 overflow-hidden mb-4">
              <div
                className="h-full bg-gradient-to-r from-yellow-300 to-amber-400 transition-all duration-700"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-white/10 rounded-lg p-3">
                <div className="text-white/70 text-xs mb-1">当前段位</div>
                <div className="font-semibold">
                  {rank.icon} {rank.name}
                </div>
              </div>
              <div className="bg-white/10 rounded-lg p-3">
                <div className="text-white/70 text-xs mb-1">累计积分</div>
                <div className="font-semibold">{totalScore} 分</div>
              </div>
            </div>
            {nextRank && (
              <div className="mt-3 text-xs text-white/80">
                距离 <b className="text-white">{nextRank.icon} {nextRank.name}</b> 还差{' '}
                <b className="text-white">{nextRank.minScore - totalScore}</b> 分
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 全宽排行榜 */}
      <section className="max-w-[1200px] mx-auto px-4 sm:px-6 -mt-6 relative z-10">
        <div className="bg-white rounded-2xl shadow-[0_4px_24px_rgba(79,107,237,0.08)] p-5 sm:p-7">
          <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Trophy className="w-5 h-5 text-[#FFB800]" />
              积分排行榜
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[#EBF0FF] text-[#4F6BED]">总榜</span>
            </h2>
            <Link href="/camp/leaderboard" className="text-sm text-[#4F6BED] hover:underline font-medium">
              查看完整排行榜 →
            </Link>
          </div>

          {boardLoading ? (
            <div className="text-center py-12 text-sm text-slate-400">排行榜加载中...</div>
          ) : board.length === 0 ? (
            <div className="text-center py-12 px-4">
              <div className="text-5xl mb-3">🏆</div>
              <div className="text-base font-medium text-slate-700 mb-1">
                暂无积分记录，快去训练营闯关吧
              </div>
              <div className="text-sm text-slate-400">
                完成小关考核并提交成绩，你的名字就会出现在这里
              </div>
            </div>
          ) : (
            <>
              {/* 领奖台 */}
              {topThree.length > 0 && (
                <div className="grid grid-cols-3 gap-3 sm:gap-6 items-end mb-5 max-w-[720px] mx-auto">
                  {podiumOrder.map((e) => {
                    const rank = topThree.indexOf(e) + 1;
                    const isFirst = rank === 1;
                    const isSecond = rank === 2;
                    const isThird = rank === 3;
                    const heightClass = isFirst ? 'h-28 sm:h-32' : isSecond ? 'h-20 sm:h-24' : 'h-14 sm:h-18';
                    const orderClass = isSecond ? 'order-1' : isFirst ? 'order-2' : 'order-3';
                    const medal = isFirst ? '🥇' : isSecond ? '🥈' : '🥉';
                    const bgColor = isFirst
                      ? 'from-[#FFB800] to-[#FFD666]'
                      : isSecond
                        ? 'from-[#B0BEC5] to-[#D5DDE0]'
                        : 'from-[#CD7F32] to-[#E5A472]';
                    const avatar = isFirst ? '👑' : isSecond ? '⭐' : '✨';
                    return (
                      <div key={`${e.name}-${e.city}`} className={cn('flex flex-col items-center', orderClass)}>
                        <div
                          className={cn(
                            'relative w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center text-2xl mb-2 ring-4',
                            isFirst ? 'ring-[#FFB800]/30' : isSecond ? 'ring-[#B0BEC5]/30' : 'ring-[#CD7F32]/30',
                          )}
                          style={{ background: 'linear-gradient(135deg,#4F6BED,#7B61FF)' }}
                        >
                          {avatar}
                          {isFirst && <div className="absolute -top-3 text-2xl">👑</div>}
                        </div>
                        <div className="font-semibold text-sm text-center truncate w-full">{e.name}</div>
                        <div className="text-xs text-slate-400 mb-2">{cityLabel(e.city)}</div>
                        <div className="text-[#4F6BED] font-bold text-sm mb-2">{e.score}分</div>
                        <div
                          className={cn(
                            'w-full rounded-t-xl bg-gradient-to-t flex flex-col items-center justify-start pt-2 text-white',
                            heightClass, bgColor,
                          )}
                        >
                          <div className="text-2xl">{medal}</div>
                          <div className="text-xs font-semibold mt-1">第{rank}名</div>
                          {REWARDS[rank] && (
                            <div className="text-[10px] sm:text-xs opacity-90 mt-0.5">{REWARDS[rank]}</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* 4-8 名 */}
              {rest.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 mb-3">
                  {rest.map((e, i) => {
                    const rank = topThree.length + i + 1;
                    return (
                      <div
                        key={`${e.name}-${e.city}-${i}`}
                        className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-slate-50"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold flex items-center justify-center flex-shrink-0">
                            {rank}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">{e.name}</div>
                            <div className="text-xs text-slate-400">{cityLabel(e.city)}</div>
                          </div>
                        </div>
                        <div className="text-sm font-semibold text-[#4F6BED] flex-shrink-0">{e.score}分</div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* 当前用户排名行 */}
              <div className="bg-[#4F6BED] text-white rounded-lg py-2.5 px-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-white/20 text-white text-xs font-semibold flex items-center justify-center">
                    —
                  </div>
                  <div>
                    <div className="text-sm font-medium">
                      {user?.name || '未登录'} <span className="text-white/70 text-xs ml-1">(我)</span>
                    </div>
                    <div className="text-xs text-white/70">
                      {totalScore > 0 ? `当前${totalScore}分` : '完成第一关即可上榜'}
                    </div>
                  </div>
                </div>
                <div className="text-xs text-white/80">
                  {totalScore > 0 && board[0] && board[0].score > totalScore
                    ? `距第1名差 ${board[0].score - totalScore}分`
                    : totalScore > 0
                      ? '你就是榜首！'
                      : '加油冲榜 🚀'}
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      {/* 继续学习横幅 */}
      {continueItem && (
        <section className="max-w-[1200px] mx-auto px-4 sm:px-6 mt-6">
          <Link
            href={`/camp/learn/${continueItem.sub.id}`}
            className="block bg-white rounded-2xl shadow-[0_4px_20px_rgba(79,107,237,0.06)] border-l-4 border-[#4F6BED] p-5 sm:p-6 hover:shadow-lg transition-all group"
          >
            <div className="flex items-center gap-4">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                style={{ background: 'linear-gradient(135deg,#4F6BED,#7B61FF)' }}
              >
                ⚔️
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-[#4F6BED] font-medium mb-1">继续学习</div>
                <div className="font-semibold text-slate-800 truncate">
                  第{continueItem.level.id}关 · {continueItem.sub.title}
                </div>
                <div className="text-sm text-slate-500 truncate">{continueItem.sub.desc}</div>
              </div>
              <div className="hidden sm:flex flex-col items-end gap-1">
                <div className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                  约 {continueItem.sub.duration} 分钟
                </div>
                <div className="text-sm font-medium text-[#4F6BED] flex items-center gap-1 group-hover:gap-2 transition-all">
                  开始学习 <ChevronRight className="w-4 h-4" />
                </div>
              </div>
              <PlayCircle className="w-6 h-6 text-[#4F6BED] sm:hidden flex-shrink-0" />
            </div>
          </Link>
        </section>
      )}

      {/* 闯关地图 */}
      <section className="max-w-[1200px] mx-auto px-4 sm:px-6 mt-8">
        <div className="flex items-end justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800">闯关地图</h2>
            <p className="text-sm text-slate-500 mt-1">8大关卡 · 16小关 · 从入门到上线</p>
          </div>
          <Link
            href="/camp/leaderboard"
            className="text-sm text-[#4F6BED] font-medium flex items-center gap-1 hover:underline"
          >
            查看完整榜单 <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          {LEVELS.map((level, idx) => {
            const prevLevel = idx > 0 ? LEVELS[idx - 1] : null;
            const prevPassed = prevLevel
              ? prevLevel.subLevels.every(
                  (s) => (getSubLevelRecord(s.id)?.bestScore || 0) >= 70,
                )
              : true;
            return (
              <LevelCard
                key={level.id}
                level={level}
                totalScore={totalScore}
                prevPassed={prevPassed}
              />
            );
          })}
        </div>
      </section>

      {/* 两栏布局 */}
      <section className="max-w-[1200px] mx-auto px-4 sm:px-6 mt-8 grid md:grid-cols-3 gap-4 sm:gap-6">
        {/* 左：训练中心 */}
        <div className="md:col-span-2 bg-white rounded-2xl p-5 sm:p-6 shadow-[0_4px_20px_rgba(79,107,237,0.06)]">
          <h2 className="text-lg font-bold mb-1">训练中心</h2>
          <p className="text-sm text-slate-500 mb-4">保留原有核心模块，随开随练</p>
          <div className="grid sm:grid-cols-2 gap-4">
            <Link
              href="/quiz"
              className="group block rounded-xl border border-slate-100 p-4 hover:border-[#4F6BED]/30 hover:bg-slate-50/60 transition-all"
            >
              <div className="w-11 h-11 rounded-xl bg-[#EBF0FF] text-[#4F6BED] flex items-center justify-center mb-3">
                <BookOpen className="w-5 h-5" />
              </div>
              <div className="font-semibold mb-1">知识考核</div>
              <div className="text-xs text-slate-500 leading-relaxed">
                6章节210道题，章节顺序解锁，90分通过
              </div>
              <div className="text-xs text-[#4F6BED] font-medium mt-3 flex items-center gap-1">
                进入考核 <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </Link>
            <Link
              href="/training"
              className="group block rounded-xl border border-slate-100 p-4 hover:border-[#4F6BED]/30 hover:bg-slate-50/60 transition-all"
            >
              <div className="w-11 h-11 rounded-xl bg-[#FFEAF4] text-[#E5478F] flex items-center justify-center mb-3">
                <MessageCircle className="w-5 h-5" />
              </div>
              <div className="font-semibold mb-1">AI 模拟对话</div>
              <div className="text-xs text-slate-500 leading-relaxed">
                10轮进阶训练，AI扮演真实患者，多维度评分
              </div>
              <div className="text-xs text-[#4F6BED] font-medium mt-3 flex items-center gap-1">
                开始训练 <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </Link>
          </div>
        </div>

        {/* 右：段位 + 快捷入口 */}
        <div className="space-y-4 sm:space-y-6">
          <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-[0_4px_20px_rgba(79,107,237,0.06)]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold">我的段位</h3>
              <span className="text-xs text-slate-400">{rank.name}</span>
            </div>
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl mb-3"
              style={{ background: `${rank.color}1A`, color: rank.color }}
            >
              {rank.icon}
            </div>
            <div className="flex items-baseline justify-between mb-2">
              <div className="text-2xl font-bold">{totalScore}</div>
              <div className="text-xs text-slate-400">总积分</div>
            </div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden mb-2">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${nextRank ? Math.min(100, (totalScore / nextRank.minScore) * 100) : 100}%`,
                  background: 'linear-gradient(90deg,#4F6BED,#7B61FF)',
                }}
              />
            </div>
            {nextRank ? (
              <div className="text-xs text-slate-500">
                再得 <b className="text-slate-700">{nextRank.minScore - totalScore}</b> 分升级到{' '}
                {nextRank.icon} {nextRank.name}
              </div>
            ) : (
              <div className="text-xs text-[#FFB800] font-medium">🏆 已达最高段位</div>
            )}
          </div>

          <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-[0_4px_20px_rgba(79,107,237,0.06)]">
            <h3 className="font-bold mb-3">快捷入口</h3>
            <div className="grid grid-cols-4 gap-2 text-center">
              {[
                { icon: NotebookPen, label: '错题本', href: '/camp/wrong-book' },
                { icon: Mic, label: '口试记录', href: '/training/report' },
                { icon: Award, label: '证书', href: '/camp' },
              ].map((q) => (
                <Link
                  key={q.label}
                  href={q.href}
                  className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-slate-50"
                >
                  <q.icon className="w-5 h-5 text-slate-500" />
                  <span className="text-xs text-slate-600">{q.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="max-w-[1200px] mx-auto px-4 sm:px-6 py-10 text-center text-xs text-slate-400">
        基于《白癜风诊疗共识（2024版）》设计 · 内部训练使用
      </footer>
    </div>
  );
}

function TopNav({ user, streak }: { user: { name?: string; project?: string } | null; streak: number }) {
  const links = [
    { href: '/camp', label: '首页' },
    { href: '/camp#levels', label: '闯关学习' },
    { href: '/quiz', label: '知识考核' },
    { href: '/training', label: '模拟对话' },
    { href: '/camp/leaderboard', label: '排行榜' },
  ];
  return (
    <header className="sticky top-0 z-30 bg-white/80 backdrop-blur border-b border-slate-100">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <Link href="/camp" className="flex items-center gap-2">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-lg"
            style={{ background: 'linear-gradient(135deg,#4F6BED,#7B61FF)' }}
          >
            🏥
          </div>
          <div className="hidden sm:block">
            <div className="font-bold text-sm leading-tight">白癜风客服训练营</div>
            <div className="text-[11px] text-slate-400 leading-tight">专业训练 · 游戏化闯关</div>
          </div>
        </Link>
        <nav className="hidden md:flex items-center gap-1 text-sm">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="px-3 py-1.5 rounded-lg text-slate-600 hover:text-[#4F6BED] hover:bg-slate-50 transition-colors"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2 sm:gap-3">
          {streak > 0 && (
            <div className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-50 text-[#FF8A3D] text-xs font-medium">
              <Flame className="w-3.5 h-3.5" />
              {streak}天
            </div>
          )}
          {user?.name ? (
            <Link
              href="/quiz/setup?from=camp"
              className="flex items-center gap-2 pl-1 pr-2 sm:pr-3 py-1 rounded-full hover:bg-slate-50"
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
                style={{ background: 'linear-gradient(135deg,#4F6BED,#7B61FF)' }}
              >
                {user.name.slice(0, 1)}
              </div>
              <div className="hidden sm:block text-left">
                <div className="text-sm font-medium leading-tight">{user.name}</div>
                <div className="text-[11px] text-slate-400 leading-tight">
                  {(user.project || '').toUpperCase()}
                </div>
              </div>
            </Link>
          ) : (
            <Link
              href="/quiz/setup?from=camp"
              className="text-sm px-3 py-1.5 rounded-lg bg-[#4F6BED] text-white hover:opacity-90"
            >
              登录
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

function LevelCard({ level, totalScore, prevPassed }: { level: Level; totalScore: number; prevPassed: boolean }) {
  const subs = level.subLevels;
  const passedCount = subs.filter((s) => (getSubLevelRecord(s.id)?.bestScore || 0) >= 70).length;
  const allPassed = passedCount === subs.length;
  const hasAvailable = subs.some((s) => s.status === 'available');
  const locked = !hasAvailable || !prevPassed;
  const pct = subs.length ? Math.round((passedCount / subs.length) * 100) : 0;

  // 星级：取小关平均星
  const totalStars = subs.reduce(
    (sum, s) => sum + starFromScore(getSubLevelRecord(s.id)?.bestScore || 0),
    0,
  );
  const maxStars = subs.length * 3;
  const retakingCount = subs.filter((s) => isSubLevelRetaking(s.id)).length;

  const statusNode = retakingCount > 0 ? (
    <span className="flex items-center gap-1 text-amber-600 text-xs font-medium">
      🔁 重考中 {retakingCount} 关
    </span>
  ) : allPassed ? (
    <span className="flex items-center gap-1 text-[#00B578] text-xs font-medium">
      <CheckCircle2 className="w-3.5 h-3.5" /> 已通关
    </span>
  ) : locked ? (
    <span className="flex items-center gap-1 text-slate-400 text-xs font-medium">
      <Lock className="w-3.5 h-3.5" /> 锁定
    </span>
  ) : (
    <span className="flex items-center gap-1 text-[#4F6BED] text-xs font-medium">
      <PlayCircle className="w-3.5 h-3.5" /> 进行中
    </span>
  );

  const isBoss = level.boss;
  const cardBg = isBoss ? 'bg-gradient-to-br from-[#FF8A3D] to-[#FFB266]' : level.colorClass;

  return (
    <Link
      href={hasAvailable ? `/camp/level/${level.id}` : '#'}
      onClick={(e) => {
        if (locked) e.preventDefault();
      }}
      className={cn(
        'group relative rounded-2xl p-4 sm:p-5 transition-all border',
        locked ? 'opacity-70 cursor-not-allowed' : 'hover:-translate-y-0.5 hover:shadow-lg',
        isBoss ? 'border-[#FF8A3D]/30' : 'border-slate-100 bg-white',
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div
          className={cn(
            'w-12 h-12 rounded-xl flex items-center justify-center text-2xl',
            !isBoss && cardBg,
          )}
          style={isBoss ? { background: 'linear-gradient(135deg,#FF8A3D,#FFB266)' } : undefined}
        >
          <span className={isBoss ? 'text-white' : ''}>{level.icon}</span>
        </div>
        {statusNode}
      </div>
      <div className="text-[11px] font-bold tracking-wider text-slate-400 mb-1">
        LEVEL {level.id}
      </div>
      <div className={cn('font-bold mb-1', isBoss && 'text-[#C75B1E]')}>{level.name}</div>
      <div className="text-xs text-slate-500 leading-relaxed line-clamp-2 h-8 mb-3">
        {level.desc}
      </div>
      <div className="flex items-center justify-between text-[11px] text-slate-500 mb-2">
        <span>{subs.length}小关</span>
        <StarRow count={3} filled={Math.round((totalStars / maxStars) * 3)} />
      </div>
      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            isBoss ? 'bg-[#FF8A3D]' : 'bg-[#4F6BED]',
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="text-[11px] text-slate-400 mt-1.5">
        {passedCount}/{subs.length} 关 · {pct}%
      </div>
      {isBoss && (
        <div className="absolute top-2 right-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#FF8A3D] text-white">
          BOSS
        </div>
      )}
      {/* totalScore 用于以后扩展，暂未使用到UI */}
      <span className="hidden">{totalScore}</span>
    </Link>
  );
}

function StarRow({ count, filled }: { count: number; filled: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: count }).map((_, i) => (
        <span key={i} className={i < filled ? 'text-[#FFB800]' : 'text-slate-200'}>
          ★
        </span>
      ))}
    </div>
  );
}

function SparkleIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="inline-block">
      <path
        d="M12 2L13.5 9L20 12L13.5 15L12 22L10.5 15L4 12L10.5 9L12 2Z"
        fill="currentColor"
      />
    </svg>
  );
}
