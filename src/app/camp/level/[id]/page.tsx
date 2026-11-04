'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ChevronLeft, Lock, PlayCircle, CheckCircle2, Star } from 'lucide-react';
import { LEVELS, getLevel, flattenSubLevels, type SubLevel } from '@/lib/camp-data';
import { getSubLevelRecord, starFromScore, useCampSync, isSubLevelRetaking } from '@/lib/camp-progress';
import { cn } from '@/lib/utils';

const PASS_SCORE = 70;

/** 判断小关是否解锁：第1小关默认解锁；其余需前一小关通关；8-1 需前7章全部通关 */
function isSubLevelUnlockedById(subId: string, orderedIds: string[]): boolean {
  const idx = orderedIds.indexOf(subId);
  if (idx <= 0) return true;
  if (subId === '8-1') {
    const prev = orderedIds.slice(0, idx);
    return prev.every((id) => (getSubLevelRecord(id)?.bestScore || 0) >= PASS_SCORE);
  }
  const prevId = orderedIds[idx - 1];
  return (getSubLevelRecord(prevId)?.bestScore || 0) >= PASS_SCORE;
}

export default function LevelDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [levelId, setLevelId] = useState<number | null>(null);
  // 先从云端回放进度，回放完成后解锁判断才读到恢复后的成绩
  const { synced } = useCampSync();

  useEffect(() => {
    params.then((p) => setLevelId(Number(p.id)));
  }, [params]);

  if (levelId === null || !synced) return <div className="min-h-screen bg-[#F5F7FC]" />;

  const level = getLevel(levelId);
  if (!level) {
    return (
      <div className="min-h-screen bg-[#F5F7FC] flex items-center justify-center">
        <div className="text-center">
          <div className="text-slate-500 mb-3">关卡不存在</div>
          <Link href="/camp" className="text-[#4F6BED] text-sm">
            返回首页
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F7FC]">
      <header className="bg-white border-b border-slate-100 sticky top-0 z-20">
        <div className="max-w-[1000px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link
            href="/camp"
            className="flex items-center gap-1 text-sm text-slate-500 hover:text-[#4F6BED]"
          >
            <ChevronLeft className="w-4 h-4" /> 返回首页
          </Link>
          <div className="text-sm font-semibold text-slate-700">
            第{level.id}关 · {level.name}
          </div>
          <div className="w-16" />
        </div>
      </header>

      <section
        className="relative overflow-hidden"
        style={{
          background: level.boss
            ? 'linear-gradient(135deg,#FF8A3D,#FFB266)'
            : 'linear-gradient(135deg,#4F6BED,#7B61FF)',
        }}
      >
        <div className="max-w-[1000px] mx-auto px-4 sm:px-6 py-10 sm:py-14 text-white relative">
          <div className="text-6xl mb-3">{level.icon}</div>
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">
            第{level.id}关：{level.name}
          </h1>
          <p className="text-white/85 max-w-xl">{level.desc}</p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <span className="px-2.5 py-1 rounded-full bg-white/20">{level.subLevels.length} 小关</span>
            <span className="px-2.5 py-1 rounded-full bg-white/20">
              每关约 {level.subLevels[0]?.duration || 12} 分钟
            </span>
            <span className="px-2.5 py-1 rounded-full bg-white/20">学 20 分 · 练 30 分 · 考 50 分</span>
          </div>
        </div>
      </section>

      <main className="max-w-[1000px] mx-auto px-4 sm:px-6 py-8 space-y-3">
        {level.subLevels.map((sub) => (
          <SubCard
            key={sub.id}
            sub={sub}
            levelId={level.id}
            allOrderedIds={flattenSubLevels().map((x) => x.sub.id)}
          />
        ))}
      </main>

      <footer className="max-w-[1000px] mx-auto px-4 sm:px-6 pb-10 pt-4 text-center text-xs text-slate-400">
        <Link href="/camp" className="hover:text-[#4F6BED]">
          返回闯关地图
        </Link>
        <span className="mx-2">·</span>
        其他关卡正在陆续开放
      </footer>
    </div>
  );
}

function SubCard({
  sub,
  levelId,
  allOrderedIds,
}: {
  sub: SubLevel;
  levelId: number;
  allOrderedIds: string[];
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const record = mounted ? getSubLevelRecord(sub.id) : null;
  const stars = record ? starFromScore(record.bestScore) : 0;
  const passed = (record?.bestScore || 0) >= PASS_SCORE;
  const retaking = mounted ? isSubLevelRetaking(sub.id) : false;
  const contentLocked = sub.status === 'coming-soon';
  const prereqLocked = mounted
    ? !isSubLevelUnlockedById(sub.id, allOrderedIds)
    : sub.index !== 1;
  const locked = contentLocked || prereqLocked;

  return (
    <div
      className={cn(
        'bg-white rounded-2xl p-5 sm:p-6 border transition-all',
        locked
          ? 'border-slate-100 opacity-70'
          : 'border-slate-100 hover:border-[#4F6BED]/30 hover:shadow-[0_4px_20px_rgba(79,107,237,0.08)]',
      )}
    >
      <div className="flex items-start gap-4">
        <div
          className={cn(
            'w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold flex-shrink-0',
            passed
              ? 'bg-[#E6F9F1] text-[#00B578]'
              : locked
                ? 'bg-slate-100 text-slate-400'
                : 'bg-[#EBF0FF] text-[#4F6BED]',
          )}
        >
          {passed ? <CheckCircle2 className="w-6 h-6" /> : locked ? <Lock className="w-5 h-5" /> : sub.index}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-slate-800">
              {sub.id} · {sub.title}
            </h3>
            {retaking && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium animate-pulse">
                🔁 重考中 · 需重走学练
              </span>
            )}
            {passed && !retaking && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#E6F9F1] text-[#00B578] font-medium">
                已通关 · {record!.bestScore}分
              </span>
            )}
            {locked && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium">
                {contentLocked ? '敬请期待' : '通关前一关解锁'}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-1">{sub.desc}</p>

          <div className="flex items-center gap-4 mt-3 flex-wrap">
            <StageDot label="学" score={20} done={!!record} />
            <StageDot label="练" score={30} done={!!record && (record?.practiceScore || 0) > 0} />
            <StageDot label="考" score={50} done={passed} />
            <div className="flex items-center gap-0.5 ml-auto">
              {[0, 1, 2].map((i) => (
                <Star
                  key={i}
                  className={cn('w-4 h-4', i < stars ? 'fill-[#FFB800] text-[#FFB800]' : 'text-slate-200')}
                />
              ))}
            </div>
          </div>
        </div>
        {!locked && (
          <Link
            href={`/camp/learn/${sub.id}`}
            className={cn(
              'hidden sm:flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-medium transition-colors flex-shrink-0',
              passed
                ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                : 'text-white',
            )}
            style={
              !passed
                ? { background: 'linear-gradient(135deg,#4F6BED,#7B61FF)' }
                : undefined
            }
          >
            <PlayCircle className="w-4 h-4" />
            {passed ? '再练一次' : '开始学习'}
          </Link>
        )}
      </div>
      {!locked && (
        <Link
          href={`/camp/learn/${sub.id}`}
          className="sm:hidden mt-4 flex items-center justify-center gap-1 w-full py-2 rounded-xl text-sm font-medium text-white"
          style={{ background: 'linear-gradient(135deg,#4F6BED,#7B61FF)' }}
        >
          <PlayCircle className="w-4 h-4" />
          {passed ? '再练一次' : '开始学习'}
        </Link>
      )}
    </div>
  );
}

function StageDot({ label, score, done }: { label: string; score: number; done: boolean }) {
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <div
        className={cn(
          'w-6 h-6 rounded-full flex items-center justify-center font-semibold',
          done ? 'bg-[#4F6BED] text-white' : 'bg-slate-100 text-slate-500',
        )}
      >
        {label}
      </div>
      <span className="text-slate-500">{score}分</span>
    </div>
  );
}
