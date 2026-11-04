'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  NotebookPen,
  FileText,
  ListChecks,
  CheckCircle2,
  XCircle,
  Sparkles,
  BookOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getUserInfo, PROJECT_NAMES } from '@/lib/user-info';
import { LEVELS } from '@/lib/camp-data';

type QType = 'single' | 'judge' | 'text';
type TypeFilter = 'all' | 'text' | 'objective';

interface WrongEntry {
  id: string;
  staffName: string;
  city: string;
  subId: string;
  subTitle: string;
  questionId: string;
  qType: QType;
  questionText: string;
  submittedAt: string;
  answer?: string;
  referencePoints?: string[];
  keyPointGroups?: string[][];
  ratio?: number;
  hitCount?: number;
  totalPoints?: number;
  score?: number;
  maxScore?: number;
  options?: string[];
  chosen?: number;
  correct?: number;
  explanation?: string;
  llmReason?: string;
}

const TYPE_META: Record<QType, { label: string; cls: string }> = {
  single: { label: '选择题', cls: 'bg-[#EBF0FF] text-[#4F6BED]' },
  judge: { label: '判断题', cls: 'bg-[#FFF1E8] text-[#FF8A3D]' },
  text: { label: '简答题', cls: 'bg-[#F3EFFF] text-[#7B61FF]' },
};

function chapterOf(subId: string): number {
  const n = parseInt((subId || '').split('-')[0], 10);
  return Number.isFinite(n) ? n : 0;
}

const CHAPTER_NAMES: Record<number, string> = {};
for (const lv of LEVELS) {
  CHAPTER_NAMES[lv.id] = lv.name;
}

function fmtTime(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function WrongBookPage() {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<{ name: string; project: string } | null>(null);
  const [entries, setEntries] = useState<WrongEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [chapterFilter, setChapterFilter] = useState<number>(0); // 0 = 全部章节

  useEffect(() => {
    const u = getUserInfo();
    setUser(u);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoading(true);
    setLoadError('');
    fetch(`/api/camp/my-weak?city=${encodeURIComponent(user.project)}&staffName=${encodeURIComponent(user.name)}`)
      .then((r) => r.json())
      .then((data: { success: boolean; entries?: WrongEntry[]; error?: string }) => {
        if (cancelled) return;
        if (!data.success) {
          setEntries([]);
          setLoadError(data.error || '读取失败');
        } else {
          setEntries(Array.isArray(data.entries) ? data.entries : []);
        }
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setEntries([]);
        setLoadError('网络异常，请稍后重试');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const chapters = useMemo(() => {
    const set = new Set<number>();
    for (const e of entries) {
      const c = chapterOf(e.subId);
      if (c) set.add(c);
    }
    return Array.from(set).sort((a, b) => a - b);
  }, [entries]);

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (typeFilter === 'text' && e.qType !== 'text') return false;
      if (typeFilter === 'objective' && e.qType === 'text') return false;
      if (chapterFilter !== 0 && chapterOf(e.subId) !== chapterFilter) return false;
      return true;
    });
  }, [entries, typeFilter, chapterFilter]);

  const textCount = entries.filter((e) => e.qType === 'text').length;
  const objectiveCount = entries.length - textCount;

  const grouped = useMemo(() => {
    const map = new Map<number, WrongEntry[]>();
    for (const e of filtered) {
      const c = chapterOf(e.subId);
      const list = map.get(c) || [];
      list.push(e);
      map.set(c, list);
    }
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [filtered]);

  if (!ready) {
    return <div className="min-h-screen bg-[#F5F7FC]" />;
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#F5F7FC]">
        <header className="bg-white border-b border-slate-100 sticky top-0 z-20">
          <div className="max-w-[800px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
            <Link href="/camp" className="flex items-center gap-1 text-sm text-slate-500 hover:text-[#4F6BED]">
              <ChevronLeft className="w-4 h-4" /> 返回首页
            </Link>
            <div className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
              <NotebookPen className="w-4 h-4 text-[#4F6BED]" /> 错题复习
            </div>
            <div className="w-16" />
          </div>
        </header>
        <main className="max-w-[800px] mx-auto px-4 sm:px-6 py-16">
          <div className="bg-white rounded-2xl shadow-[0_4px_24px_rgba(79,107,237,0.08)] p-8 text-center">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-[#EBF0FF] flex items-center justify-center">
              <BookOpen className="w-7 h-7 text-[#4F6BED]" />
            </div>
            <h2 className="text-lg font-bold text-slate-800 mb-2">请先填写你的身份</h2>
            <p className="text-sm text-slate-500 mb-5">填写城市和姓名后，即可查看属于你的错题复习本</p>
            <Link
              href="/quiz/setup?from=camp"
              className="inline-flex items-center px-5 py-2.5 rounded-xl text-white text-sm font-medium shadow-[0_4px_14px_rgba(79,107,237,0.3)]"
              style={{ background: 'linear-gradient(90deg,#4F6BED,#7B61FF)' }}
            >
              去填写身份
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F7FC]">
      <header className="bg-white border-b border-slate-100 sticky top-0 z-20">
        <div className="max-w-[800px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/camp" className="flex items-center gap-1 text-sm text-slate-500 hover:text-[#4F6BED]">
            <ChevronLeft className="w-4 h-4" /> 返回首页
          </Link>
          <div className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
            <NotebookPen className="w-4 h-4 text-[#4F6BED]" /> 错题复习
          </div>
          <div className="w-16" />
        </div>
      </header>

      <main className="max-w-[800px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* 顶部汇总卡片 */}
        <div className="rounded-2xl p-5 sm:p-6 mb-5 text-white shadow-[0_8px_24px_rgba(79,107,237,0.2)]"
          style={{ background: 'linear-gradient(120deg,#4F6BED,#7B61FF)' }}>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className="text-xs text-white/80 mb-1">
                {PROJECT_NAMES[user.project as keyof typeof PROJECT_NAMES] || user.project} · {user.name}
              </div>
              <h1 className="text-xl font-bold">错题复习本</h1>
              <p className="text-xs text-white/80 mt-1">复盘考核中未拿满分的题目，把知识点补回来</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-extrabold leading-none">{entries.length}</div>
              <div className="text-xs text-white/80 mt-1">道错题</div>
            </div>
          </div>
          <div className="flex gap-4 mt-4 text-xs text-white/90">
            <span className="inline-flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> 简答 {textCount}</span>
            <span className="inline-flex items-center gap-1"><ListChecks className="w-3.5 h-3.5" /> 选择/判断 {objectiveCount}</span>
          </div>
        </div>

        {/* 筛选 */}
        {entries.length > 0 && (
          <div className="bg-white rounded-2xl p-3 sm:p-4 mb-5 shadow-[0_1px_3px_rgba(16,24,40,0.06)] space-y-2.5">
            <div className="flex items-center gap-2 flex-wrap">
              <FilterTab active={typeFilter === 'all'} onClick={() => setTypeFilter('all')}>全部 {entries.length}</FilterTab>
              <FilterTab active={typeFilter === 'text'} onClick={() => setTypeFilter('text')}>
                只看简答 {textCount}
              </FilterTab>
              <FilterTab active={typeFilter === 'objective'} onClick={() => setTypeFilter('objective')}>
                只看客观题 {objectiveCount}
              </FilterTab>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <FilterTab small active={chapterFilter === 0} onClick={() => setChapterFilter(0)}>全部章节</FilterTab>
              {chapters.map((c) => (
                <FilterTab
                  key={c}
                  small
                  active={chapterFilter === c}
                  onClick={() => setChapterFilter(c)}
                >
                  第{c}章 · {CHAPTER_NAMES[c] || ''}
                </FilterTab>
              ))}
            </div>
          </div>
        )}

        {/* 内容区 */}
        {loading ? (
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="bg-white rounded-2xl p-5 shadow-[0_1px_3px_rgba(16,24,40,0.06)] animate-pulse">
                <div className="h-4 bg-slate-100 rounded w-1/3 mb-3" />
                <div className="h-4 bg-slate-100 rounded w-full mb-2" />
                <div className="h-4 bg-slate-100 rounded w-2/3" />
              </div>
            ))}
          </div>
        ) : loadError ? (
          <div className="bg-white rounded-2xl p-10 text-center text-sm text-slate-500">
            {loadError}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 sm:p-14 text-center shadow-[0_4px_24px_rgba(79,107,237,0.06)]">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#E6F9F1] flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-[#00B578]" />
            </div>
            <p className="text-base font-bold text-slate-700 mb-1">
              {entries.length === 0 ? '还没有错题，继续保持！' : '当前筛选下没有错题'}
            </p>
            <p className="text-xs text-slate-400">
              {entries.length === 0 ? '考核中未拿满分的题目会自动收集到这里，方便日后复习' : '换个筛选条件看看吧'}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {grouped.map(([chapter, list]) => (
              <section key={chapter}>
                <h2 className="text-sm font-bold text-slate-600 mb-2.5 px-1 flex items-center gap-1.5">
                  <span className="inline-block w-1 h-3.5 rounded bg-[#4F6BED]" />
                  第{chapter}章 · {CHAPTER_NAMES[chapter] || '考核'}
                  <span className="text-slate-400 font-normal">（{list.length}）</span>
                </h2>
                <div className="space-y-3">
                  {list.map((e) => (
                    <WrongCard key={e.id} entry={e} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function FilterTab({
  active,
  onClick,
  small,
  children,
}: {
  active: boolean;
  onClick: () => void;
  small?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full font-medium transition-colors',
        small ? 'text-xs px-3 py-1' : 'text-xs px-3.5 py-1.5',
        active
          ? 'bg-[#4F6BED] text-white'
          : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
      )}
    >
      {children}
    </button>
  );
}

function WrongCard({ entry: e }: { entry: WrongEntry }) {
  const meta = TYPE_META[e.qType] || TYPE_META.single;
  const hasScore = typeof e.score === 'number' && typeof e.maxScore === 'number';
  const isObjective = e.qType !== 'text';

  return (
    <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-[0_1px_3px_rgba(16,24,40,0.06)]">
      {/* 卡片头 */}
      <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-slate-700">{e.subId}</span>
          <span className="text-xs text-slate-400">{e.subTitle}</span>
          <span className={cn('text-[11px] px-2 py-0.5 rounded-full font-medium', meta.cls)}>
            {meta.label}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {hasScore && (
            <span
              className={cn(
                'text-xs font-bold px-2 py-0.5 rounded-md',
                (e.score as number) < (e.maxScore as number) / 2
                  ? 'bg-red-50 text-[#FF5D5D]'
                  : 'bg-amber-50 text-amber-600',
              )}
            >
              {e.score}/{e.maxScore} 分
            </span>
          )}
          {e.submittedAt && <span className="text-[11px] text-slate-400">{fmtTime(e.submittedAt)}</span>}
        </div>
      </div>

      {/* 题干 */}
      <p className="text-sm font-medium text-slate-800 leading-relaxed mb-3 whitespace-pre-wrap">
        {e.questionText || '（题干缺失）'}
      </p>

      {/* 客观题：选项对照 */}
      {isObjective && Array.isArray(e.options) && e.options.length > 0 && (
        <div className="space-y-1.5 mb-3">
          {e.options.map((opt, idx) => {
            const isChosen = e.chosen === idx;
            const isCorrect = e.correct === idx;
            return (
              <div
                key={idx}
                className={cn(
                  'flex items-start gap-2 text-xs sm:text-sm rounded-lg px-3 py-2 border',
                  isCorrect
                    ? 'border-[#00B578]/30 bg-[#E6F9F1] text-slate-700'
                    : isChosen
                      ? 'border-[#FF5D5D]/30 bg-red-50 text-slate-700'
                      : 'border-slate-100 bg-slate-50/60 text-slate-500',
                )}
              >
                <span className="font-semibold shrink-0">{String.fromCharCode(65 + idx)}.</span>
                <span className="flex-1">{opt}</span>
                {isCorrect && <CheckCircle2 className="w-4 h-4 text-[#00B578] shrink-0" />}
                {isChosen && !isCorrect && <XCircle className="w-4 h-4 text-[#FF5D5D] shrink-0" />}
              </div>
            );
          })}
          {typeof e.chosen === 'number' && e.chosen < 0 && (
            <p className="text-xs text-[#FF5D5D]">本题未作答</p>
          )}
          {e.explanation && (
            <p className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2 mt-1">
              <b className="text-slate-600">解析：</b>{e.explanation}
            </p>
          )}
        </div>
      )}

      {/* 简答题：我的作答 + 参考要点 */}
      {e.qType === 'text' && (
        <div className="space-y-3">
          <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
            <div className="text-[11px] font-semibold text-slate-500 mb-1">我的作答</div>
            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap break-words">
              {e.answer || '（未作答）'}
            </p>
            {typeof e.hitCount === 'number' && typeof e.totalPoints === 'number' && (
              <div className="text-[11px] text-slate-400 mt-2">
                命中得分点 {e.hitCount}/{e.totalPoints}
              </div>
            )}
          </div>

          {Array.isArray(e.referencePoints) && e.referencePoints.length > 0 && (
            <div className="rounded-lg border border-[#EBF0FF] bg-[#F8FAFF] p-3">
              <div className="text-[11px] font-semibold text-[#4F6BED] mb-1.5">参考答案要点</div>
              <ul className="space-y-1">
                {e.referencePoints.map((p, i) => {
                  const hit =
                    Array.isArray(e.keyPointGroups) &&
                    e.keyPointGroups[i] &&
                    e.keyPointGroups[i].length > 0;
                  return (
                    <li key={i} className="flex items-start gap-1.5 text-xs sm:text-sm text-slate-600">
                      <CheckCircle2
                        className={cn(
                          'w-3.5 h-3.5 mt-0.5 shrink-0',
                          hit ? 'text-[#00B578]' : 'text-slate-300',
                        )}
                      />
                      <span>{p}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* AI 评阅说明 */}
      {e.llmReason && (
        <div className="mt-3 flex items-start gap-1.5 text-xs text-[#7B61FF] bg-[#F3EFFF] rounded-lg px-3 py-2">
          <Sparkles className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span><b>AI 评阅：</b>{e.llmReason}</span>
        </div>
      )}
    </div>
  );
}
