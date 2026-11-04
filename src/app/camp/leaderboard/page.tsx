'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ChevronLeft, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getUserInfo, PROJECT_NAMES } from '@/lib/user-info';
import { getCampProgress, useCampSync } from '@/lib/camp-progress';

interface LbEntry {
  name: string;
  city: string;
  totalScore: number;
  updatedAt: string;
}

function cityLabel(city?: string): string {
  if (!city) return '未知';
  return (PROJECT_NAMES as Record<string, string>)[city] || city;
}

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LbEntry[]>([]);
  const [me, setMe] = useState<{ name?: string; city?: string; score: number } | null>(null);
  const [loading, setLoading] = useState(true);
  // 先回放云端进度，个人积分高亮才准确
  const { synced } = useCampSync();

  useEffect(() => {
    if (!synced) return;
    const u = getUserInfo();
    const p = getCampProgress();
    setMe(u ? { name: u.name, city: u.project, score: p.totalScore } : null);
  }, [synced]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    // 仅保留总榜口径：累计积分，始终反映全员历史成绩
    fetch('/api/camp/leaderboard?period=total')
      .then((r) => r.json())
      .then((data: { success: boolean; entries?: LbEntry[] }) => {
        if (cancelled) return;
        setEntries(data.entries || []);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setEntries([]);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const topThree = entries.slice(0, 3);
  const rest = entries.slice(3);
  const myRank = me
    ? entries.findIndex((e) => e.name === me.name && e.city === me.city) + 1
    : 0;
  const podiumOrder = [topThree[1], topThree[0], topThree[2]].filter(Boolean);

  return (
    <div className="min-h-screen bg-[#F5F7FC]">
      <header className="bg-white border-b border-slate-100 sticky top-0 z-20">
        <div className="max-w-[1000px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/camp" className="flex items-center gap-1 text-sm text-slate-500 hover:text-[#4F6BED]">
            <ChevronLeft className="w-4 h-4" /> 返回首页
          </Link>
          <div className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
            <Trophy className="w-4 h-4 text-[#FFB800]" /> 积分排行榜
          </div>
          <div className="w-16" />
        </div>
      </header>

      <main className="max-w-[1000px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="bg-white rounded-2xl shadow-[0_4px_24px_rgba(79,107,237,0.08)] p-5 sm:p-7">
          <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Trophy className="w-5 h-5 text-[#FFB800]" />
              积分排行榜
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[#EBF0FF] text-[#4F6BED]">总榜</span>
            </h1>
            <div className="text-xs text-slate-400">全员累计积分排名</div>
          </div>

          {loading ? (
            <div className="text-center py-16 text-slate-400 text-sm">加载中...</div>
          ) : entries.length === 0 ? (
            <div className="text-center py-16 text-slate-400 text-sm">
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
              {topThree.length >= 3 && (
                <div className="grid grid-cols-3 gap-3 sm:gap-6 items-end mb-6 max-w-[720px] mx-auto">
                  {podiumOrder.map((e) => {
                    const isFirst = e === topThree[0];
                    const isSecond = e === topThree[1];
                    const isThird = e === topThree[2];
                    const heightClass = isFirst
                      ? 'h-28 sm:h-36'
                      : isSecond
                        ? 'h-20 sm:h-28'
                        : 'h-14 sm:h-20';
                    const orderClass = isSecond ? 'order-1' : isFirst ? 'order-2' : 'order-3';
                    const medal = isFirst ? '🥇' : isSecond ? '🥈' : '🥉';
                    const bgColor = isFirst
                      ? 'from-[#FFB800] to-[#FFD666]'
                      : isSecond
                        ? 'from-[#B0BEC5] to-[#D5DDE0]'
                        : 'from-[#CD7F32] to-[#E5A472]';
                    const rank = isFirst ? 1 : isSecond ? 2 : 3;
                    return (
                      <div key={e.name} className={cn('flex flex-col items-center', orderClass)}>
                        <div
                          className={cn(
                            'relative w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center text-2xl mb-2 ring-4',
                            isFirst ? 'ring-[#FFB800]/30' : isSecond ? 'ring-[#B0BEC5]/30' : 'ring-[#CD7F32]/30',
                          )}
                          style={{ background: 'linear-gradient(135deg,#4F6BED,#7B61FF)' }}
                        >
                          {e.name.slice(0, 1)}
                          {isFirst && <div className="absolute -top-3 text-2xl">👑</div>}
                        </div>
                        <div className="font-semibold text-sm text-center truncate w-full">{e.name}</div>
                        <div className="text-xs text-slate-400 mb-2">{cityLabel(e.city)}</div>
                        <div className="text-[#4F6BED] font-bold text-sm mb-2">{e.totalScore}分</div>
                        <div
                          className={cn(
                            'w-full rounded-t-xl bg-gradient-to-t flex flex-col items-center justify-start pt-2 text-white',
                            heightClass,
                            bgColor,
                          )}
                        >
                          <div className="text-2xl">{medal}</div>
                          <div className="text-xs font-semibold mt-1">第{rank}名</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {rest.length > 0 && (
                <div className="border-t border-slate-100 pt-4 space-y-1">
                  {rest.map((e, i) => {
                    const rank = i + 4;
                    const isMe = me?.name === e.name && me?.city === e.city;
                    return (
                      <div
                        key={`${e.name}-${i}`}
                        className={cn(
                          'flex items-center justify-between py-2.5 px-3 rounded-lg',
                          isMe ? 'bg-[#4F6BED]/10' : 'hover:bg-slate-50',
                        )}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold flex items-center justify-center flex-shrink-0">
                            {rank}
                          </div>
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm flex-shrink-0"
                            style={{ background: 'linear-gradient(135deg,#4F6BED,#7B61FF)' }}
                          >
                            {e.name.slice(0, 1)}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate flex items-center gap-1.5">
                              {e.name}
                              {isMe && <span className="text-[10px] text-[#4F6BED] font-bold">(我)</span>}
                            </div>
                            <div className="text-xs text-slate-400">{cityLabel(e.city)}</div>
                          </div>
                        </div>
                        <div className="text-sm font-semibold text-[#4F6BED] flex-shrink-0">
                          {e.totalScore}分
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* 未上榜的我 */}
              {me && myRank === 0 && me.score > 0 && (
                <div className="mt-4 bg-[#4F6BED] text-white rounded-lg py-2.5 px-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-white/20 text-white text-xs font-semibold flex items-center justify-center">
                      —
                    </div>
                    <div>
                      <div className="text-sm font-medium">{me.name} (我)</div>
                      <div className="text-xs text-white/70">{cityLabel(me.city)} · {me.score}分</div>
                    </div>
                  </div>
                  <div className="text-xs text-white/80">继续努力冲榜 🚀</div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="text-center mt-6 text-xs text-slate-400">
          通关越多积分越高 · 成绩永久累计
        </div>
      </main>
    </div>
  );
}
