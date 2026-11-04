'use client';

import { useState, useEffect, useMemo } from 'react';
import { flattenSubLevels } from '@/lib/camp-data';
import { judgeQuestions as finalJudgeQuestions } from '@/lib/camp/chapter8';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';

interface QuizResult {
  staffName: string;
  city: string;
  chapterId: number;
  chapterName: string;
  score: number;
  passed: boolean;
  improvementPoints?: string[];
  submittedAt: string;
}

interface TrainingResult {
  staffName: string;
  city: string;
  roundNumber: number;
  roundTitle: string;
  totalScore: number;
  dimensionScores?: Record<string, number>;
  coachingPoints?: string[];
  dialogues?: { role: string; content: string }[];
  submittedAt: string;
}

interface CampResult {
  staffName: string;
  city: string;
  subId: string;
  bestScore: number;
  stars?: number;
  learnScore?: number;
  practiceScore?: number;
  examScore?: number;
  attempts?: number;
  maxAttempts?: number;
  attemptsList?: Array<{ score?: number; examScore?: number; stars?: number; submittedAt?: string; passed?: boolean }>;
  firstPassBonus?: boolean;
  graded?: boolean;
  examBreakdown?: {
    kind?: 'standard' | 'final';
    totalQuestions?: number;
    objectiveCorrect?: number;
    objectiveTotal?: number;
    objectivePerPoint?: number;
    objectiveScores?: Array<{
      questionId?: string;
      type?: 'single' | 'judge';
      chosen?: number;
      correct?: number;
      isCorrect?: boolean;
      score?: number;
      maxScore?: number;
    }>;
    textQuestionIds?: string[];
    textPerPoint?: number;
    textAnswers?: Record<string, string>;
    textScores?: Array<{
      questionId?: string;
      answer?: string;
      hitCount?: number;
      totalPoints?: number;
      ratio?: number;
      awarded?: number;
      maxScore?: number;
      matchedKeywords?: string[];
    }>;
  } | null;
  submittedAt: string;
}

interface WeakRow {
  id: string; // 唯一 id（staffName|city|subId|questionId|submittedAt），删除时用
  staffName: string;
  city: string;
  subId: string;
  subTitle: string;
  questionId: string;
  qType: 'single' | 'judge' | 'text';
  questionText: string;
  submittedAt: string;
  // 简答题
  answer?: string;
  referencePoints?: string[];
  keyPointGroups?: string[][];
  ratio?: number;
  hitCount?: number;
  totalPoints?: number;
  score?: number;
  maxScore?: number;
  // 客观题
  options?: string[];
  chosen?: number;
  correct?: number;
  explanation?: string;
  /** 服务端 LLM 语义评阅理由（新评分逻辑提交的简答题） */
  llmReason?: string;
}

interface TextAnswerRow {
  staffName: string;
  city: string;
  subId: string;
  questionId: string;
  questionText: string;
  answer: string;
  ratio: number;
  hitCount: number;
  totalPoints: number;
  submittedAt: string;
}

interface CampEmployeeSummary {
  staffName?: string;
  city?: string;
  totalSubLevels?: number;
  completedCount?: number;
  passedCount?: number;
  totalScore?: number;
  bestScoreSum?: number;
  stars?: number;
  textAnswerCount?: number;
  pendingReviewCount?: number;
  weakAnswers?: unknown[];
  lastSubmittedAt?: string | null;
}

const CITY_SLUG_TO_ZH: Record<string, string> = {
  hefei: '合肥',
  hangzhou: '杭州',
};
const CITY_ZH_TO_SLUG: Record<string, string> = Object.fromEntries(
  Object.entries(CITY_SLUG_TO_ZH).map(([k, v]) => [v, k]),
);
const CITY_OPTIONS = ['全部', '合肥', '杭州'];
const CHAPTER_OPTIONS = ['全部', '第1章', '第2章', '第3章', '第4章', '第5章', '第6章'];

const DIM_LABELS: Record<string, string> = {
  inquiry: '问诊',
  analysis: '分析',
  empathy: '共情',
  professional: '专业',
  conversion: '转化',
  communication: '话术',
};

type Tab = 'overview' | 'camp' | 'quiz' | 'training';

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('overview');
  const [quizResults, setQuizResults] = useState<QuizResult[]>([]);
  const [trainingResults, setTrainingResults] = useState<TrainingResult[]>([]);
  const [campResults, setCampResults] = useState<CampResult[]>([]);
  const [summary, setSummary] = useState<CampEmployeeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cityFilter, setCityFilter] = useState('全部');
  const [chapterFilter, setChapterFilter] = useState('全部');
  const [campSubFilter, setCampSubFilter] = useState('全部');
  const [staffFilter, setStaffFilter] = useState('');
  const [expandedTraining, setExpandedTraining] = useState<number | null>(null);
  const [expandedWeak, setExpandedWeak] = useState<Record<string, boolean>>({});
  const [weakEntries, setWeakEntries] = useState<WeakRow[]>([]);

  // 管理口令（仅用于删除学员等危险操作），会话内留存于 sessionStorage
  const [adminToken, setAdminToken] = useState('');
  const [tokenChecked, setTokenChecked] = useState(false);
  // 删除离职学员对话框
  const [deleteTarget, setDeleteTarget] = useState<CampEmployeeSummary | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [deletePreview, setDeletePreview] = useState<{
    resultCount: number;
    subIds: string[];
    bestScoreSum: number;
    weakCount: number;
    hasProgress: boolean;
  } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [tokenInput, setTokenInput] = useState('');

  useEffect(() => {
    const t = typeof window !== 'undefined' ? sessionStorage.getItem('camp_admin_token') || '' : '';
    setAdminToken(t);
    setTokenChecked(true);
  }, []);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    setError('');
    try {
      const [quizRes, trainRes, campRes, overviewRes] = await Promise.all([
        fetch('/api/admin/results'),
        fetch('/api/admin/training-results'),
        fetch('/api/camp/submit-result'),
        fetch('/api/admin/camp-overview'),
      ]);
      const [quizData, trainData, campData, overviewData] = await Promise.all([
        quizRes.json(),
        trainRes.json(),
        campRes.json(),
        overviewRes.json(),
      ]);
      if (quizData?.success) setQuizResults(Array.isArray(quizData.results) ? quizData.results : []);
      if (trainData?.success) setTrainingResults(Array.isArray(trainData.results) ? trainData.results : []);
      if (campData?.success) setCampResults(Array.isArray(campData.results) ? campData.results : []);
      if (overviewData?.success) {
        const rawSummary = Array.isArray(overviewData.summary) ? overviewData.summary : [];
        setSummary(
          rawSummary.filter((s: unknown): s is CampEmployeeSummary => typeof s === 'object' && s !== null),
        );
        const rawWeak = Array.isArray(overviewData.weakEntries) ? overviewData.weakEntries : [];
        setWeakEntries(
          rawWeak.filter((w: unknown): w is WeakRow => typeof w === 'object' && w !== null && 'id' in w),
        );
      }
      const failures: string[] = [];
      if (!quizData?.success) failures.push('考核成绩');
      if (!trainData?.success) failures.push('训练成绩');
      if (!campData?.success) failures.push('训练营成绩');
      if (!overviewData?.success) failures.push('数据总览');
      if (failures.length > 0) {
        setError(`以下数据加载失败：${failures.join('、')}，请刷新重试`);
      }
    } catch {
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const matchCity = (city: unknown, filter: string) => {
    if (filter === '全部') return true;
    const c = String(city ?? '');
    if (!c) return false;
    const zh = CITY_SLUG_TO_ZH[c] || c;
    return zh === filter || c === CITY_ZH_TO_SLUG[filter];
  };

  const matchStaff = (name: unknown) => {
    if (!staffFilter.trim()) return true;
    return String(name ?? '').toLowerCase().includes(staffFilter.trim().toLowerCase());
  };

  const filteredQuiz = quizResults.filter(
    (r) => matchCity(r.city, cityFilter) && matchStaff(r.staffName) && (chapterFilter === '全部' || r.chapterId === parseInt(chapterFilter.replace('第', '').replace('章', ''))),
  );

  const filteredTraining = trainingResults.filter(
    (r) => matchCity(r.city, cityFilter) && matchStaff(r.staffName),
  );

  const filteredCamp = campResults.filter(
    (r) => matchCity(r.city, cityFilter) && matchStaff(r.staffName) && (campSubFilter === '全部' || r.subId === campSubFilter),
  );

  const filteredSummary = summary.filter(
    (s) => matchCity(s.city, cityFilter) && matchStaff(s.staffName),
  );

  // 题目详情库：标准小关题（含选择/判断/简答）+ 结业考题库，供总览薄弱作答展开时匹配题干 / 选项 / 得分点 / 参考要点
  const questionDetailMap = useMemo(() => {
    const m = new Map<
      string,
      {
        question: string;
        referencePoints: string[];
        keyPoints: string[][];
        subTitle: string;
        type?: 'single' | 'judge' | 'text';
        options?: string[];
        answer?: number;
        explanation?: string;
      }
    >();
    for (const { level, sub } of flattenSubLevels()) {
      const subTitle = `${level.name} · ${sub.title || sub.desc || ''}`.replace(/\s+/g, '').trim();
      for (const q of sub.exam || []) {
        if (q.type === 'single' || q.type === 'judge') {
          m.set(q.id, {
            question: q.question,
            referencePoints: [],
            keyPoints: [],
            subTitle,
            type: q.type,
            options: q.options,
            answer: q.answer,
            explanation: q.explanation,
          });
        } else if (q.type === 'text') {
          m.set(q.id, {
            question: q.question,
            referencePoints: q.referencePoints || [],
            keyPoints: q.keyPoints || [],
            subTitle,
            type: 'text',
          });
        }
        // oral 旧题型不进薄弱作答
      }
    }
    for (const q of finalJudgeQuestions) {
      if (!m.has(q.id)) {
        m.set(q.id, {
          question: q.question,
          referencePoints: [],
          keyPoints: [],
          subTitle: '第 8 章 · 结业考核',
          type: 'judge',
          options: ['正确', '错误'],
          answer: q.answer,
          explanation: q.explanation || '',
        });
      }
    }
    return m;
  }, []);

  const textAnswerRows: TextAnswerRow[] = useMemo(() => {
    const rows: TextAnswerRow[] = [];
    for (const r of campResults) {
      const bd = r.examBreakdown;
      if (!bd) continue;
      const ids = bd.textQuestionIds || [];
      const answers = bd.textAnswers || {};
      const scores = Array.isArray(bd.textScores) ? bd.textScores : [];
      for (const qid of ids) {
        const ans = (answers[qid] || '').trim();
        if (!ans) continue;
        const ts = scores.find((x) => x && x.questionId === qid);
        rows.push({
          staffName: r.staffName || '—',
          city: r.city || '',
          subId: r.subId,
          questionId: qid,
          questionText: questionDetailMap.get(qid)?.question || qid,
          answer: ans,
          ratio: typeof ts?.ratio === 'number' ? ts.ratio : 0,
          hitCount: typeof ts?.hitCount === 'number' ? ts.hitCount : 0,
          totalPoints: typeof ts?.totalPoints === 'number' ? ts.totalPoints : 0,
          submittedAt: r.submittedAt || '',
        });
      }
    }
    return rows.sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1));
  }, [campResults, questionDetailMap]);

  // 薄弱作答：服务端按人分 key（camp_weak:{city}:{staffName}）聚合后下发；
  // 前端仅做城市/姓名/小关筛选联动；条目只展示，暂无删除操作。
  const weakRows: WeakRow[] = useMemo(() => {
    const staffKw = staffFilter.trim().toLowerCase();
    return weakEntries.filter((w) => {
      if (campSubFilter !== '全部' && w.subId !== campSubFilter) return false;
      if (cityFilter !== '全部') {
        const c = String(w.city ?? '');
        const zh = CITY_SLUG_TO_ZH[c] || c;
        if (zh !== cityFilter && c !== CITY_ZH_TO_SLUG[cityFilter]) return false;
      }
      if (staffKw && !String(w.staffName ?? '').toLowerCase().includes(staffKw)) return false;
      return true;
    });
  }, [weakEntries, cityFilter, staffFilter, campSubFilter]);

  const toggleWeak = (id: string) =>
    setExpandedWeak((prev) => ({ ...prev, [id]: !prev[id] }));
  const expandAllWeak = () =>
    setExpandedWeak(Object.fromEntries(weakRows.map((w) => [w.id, true])));
  const collapseAllWeak = () => setExpandedWeak({});

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  const cityZh = (city: string) => CITY_SLUG_TO_ZH[city] || city;

  const quizPeople = new Set(filteredQuiz.map((r) => r.staffName)).size;
  const quizAvg = filteredQuiz.length > 0 ? Math.round(filteredQuiz.reduce((s, r) => s + r.score, 0) / filteredQuiz.length) : 0;
  const quizPassRate = filteredQuiz.length > 0 ? Math.round((filteredQuiz.filter((r) => r.passed).length / filteredQuiz.length) * 100) : 0;

  const trainPeople = new Set(filteredTraining.map((r) => r.staffName)).size;
  const trainAvg = filteredTraining.length > 0 ? Math.round(filteredTraining.reduce((s, r) => s + r.totalScore, 0) / filteredTraining.length) : 0;

  const campPeople = new Set(filteredCamp.map((r) => r.staffName)).size;
  const campPassRate = filteredCamp.length > 0 ? Math.round((filteredCamp.filter((r) => r.bestScore >= 70).length / filteredCamp.length) * 100) : 0;
  const campAvg = filteredCamp.length > 0 ? Math.round(filteredCamp.reduce((s, r) => s + r.bestScore, 0) / filteredCamp.length) : 0;

  const campSubOptions = useMemo(() => {
    const set = new Set(campResults.map((r) => r.subId));
    return ['全部', ...Array.from(set).sort()];
  }, [campResults]);

  const openDeleteDialog = async (s: CampEmployeeSummary) => {
    setDeleteError('');
    setDeleteConfirmName('');
    setDeletePreview(null);
    setDeleteTarget(s);
    if (!s.city || !s.staffName) return;
    try {
      const res = await fetch(
        `/api/admin/delete-student?city=${encodeURIComponent(s.city)}&staffName=${encodeURIComponent(s.staffName)}`,
        { headers: { 'x-admin-token': adminToken } },
      );
      const data = await res.json();
      if (res.status === 401) {
        setDeleteError('管理口令错误或缺失，请重新输入管理口令');
        return;
      }
      if (!data?.success) {
        setDeleteError(data?.error || '读取删除预览失败');
        return;
      }
      setDeletePreview({
        resultCount: data.resultCount ?? 0,
        subIds: Array.isArray(data.subIds) ? data.subIds : [],
        bestScoreSum: data.bestScoreSum ?? 0,
        weakCount: data.weakCount ?? 0,
        hasProgress: !!data.hasProgress,
      });
    } catch {
      setDeleteError('网络错误，无法读取删除预览');
    }
  };

  const closeDeleteDialog = () => {
    if (deleteLoading) return;
    setDeleteTarget(null);
    setDeletePreview(null);
    setDeleteConfirmName('');
    setDeleteError('');
  };

  const confirmDelete = async () => {
    if (!deleteTarget?.city || !deleteTarget.staffName) return;
    setDeleteError('');
    if (deleteConfirmName.trim() !== deleteTarget.staffName) {
      setDeleteError('输入的姓名与该学员不一致');
      return;
    }
    setDeleteLoading(true);
    try {
      const res = await fetch('/api/admin/delete-student', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
        body: JSON.stringify({
          city: deleteTarget.city,
          staffName: deleteTarget.staffName,
          confirmName: deleteConfirmName.trim(),
          operator: '后台管理员',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        setDeleteError(data?.error || `删除失败（${res.status}）`);
        return;
      }
      // 删除成功：关闭弹窗并刷新数据
      setDeleteTarget(null);
      setDeletePreview(null);
      setDeleteConfirmName('');
      await fetchAll();
    } catch {
      setDeleteError('网络错误，删除未完成');
    } finally {
      setDeleteLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-500">加载中...</div>
      </div>
    );
  }

  // 危险操作（删除学员）需要管理口令；未输入口令时仅展示只读数据，并在尝试删除时要求口令
  const adminTokenGate = (
    <AlertDialog open={!!deleteTarget && !adminToken} onOpenChange={(o) => !o && closeDeleteDialog()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>需要管理口令</AlertDialogTitle>
          <AlertDialogDescription>
            删除离职学员是不可恢复的危险操作，必须先输入管理口令。学员的「姓名+城市」免密身份不能用于删除。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AdminTokenGateBody
          value={tokenInput}
          onChange={setTokenInput}
          onConfirm={() => {
            const t = tokenInput.trim();
            if (!t) return;
            setAdminToken(t);
            sessionStorage.setItem('camp_admin_token', t);
            if (deleteTarget) void openDeleteDialog(deleteTarget);
          }}
        />
        <AlertDialogFooter>
          <AlertDialogCancel onClick={closeDeleteDialog}>取消</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-xl font-bold text-slate-800">培训成绩管理</h1>
            <p className="text-sm text-slate-500">训练营闯关 / 知识考核 / 模拟对话 一站式管理</p>
          </div>
          <button
            onClick={fetchAll}
            className="px-4 py-2 bg-sky-500 text-white rounded-lg text-sm font-medium hover:bg-sky-600"
          >
            刷新数据
          </button>
        </div>
      </header>

      <div className="w-full max-w-7xl mx-auto px-4 py-6">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm whitespace-pre-line">
            {error}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-white rounded-xl p-1 border border-slate-200 w-fit flex-wrap">
          <TabBtn active={tab === 'overview'} onClick={() => setTab('overview')}>
            数据总览
          </TabBtn>
          <TabBtn active={tab === 'camp'} onClick={() => setTab('camp')}>
            训练营成绩 ({campResults.length})
          </TabBtn>
          <TabBtn active={tab === 'quiz'} onClick={() => setTab('quiz')}>
            知识考核 ({quizResults.length})
          </TabBtn>
          <TabBtn active={tab === 'training'} onClick={() => setTab('training')}>
            模拟对话 ({trainingResults.length})
          </TabBtn>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 mb-6">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-600 font-medium">城市</label>
              <select value={cityFilter} onChange={(e) => setCityFilter(e.target.value)} className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white">
                {CITY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-600 font-medium">员工</label>
              <input
                type="text"
                value={staffFilter}
                onChange={(e) => setStaffFilter(e.target.value)}
                placeholder="输入姓名搜索"
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white w-40"
              />
            </div>
            {tab === 'quiz' && (
              <div className="flex items-center gap-2">
                <label className="text-sm text-slate-600 font-medium">章节</label>
                <select value={chapterFilter} onChange={(e) => setChapterFilter(e.target.value)} className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white">
                  {CHAPTER_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            )}
            {tab === 'camp' && (
              <div className="flex items-center gap-2">
                <label className="text-sm text-slate-600 font-medium">小关</label>
                <select value={campSubFilter} onChange={(e) => setCampSubFilter(e.target.value)} className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white">
                  {campSubOptions.map((c) => <option key={c} value={c}>{c === '全部' ? '全部小关' : c}</option>)}
                </select>
              </div>
            )}
            <div className="ml-auto text-sm text-slate-500">
              {tab === 'overview' && `共 ${filteredSummary.length} 名员工`}
              {tab === 'camp' && `共 ${filteredCamp.length} 条成绩`}
              {tab === 'quiz' && `共 ${filteredQuiz.length} 条记录`}
              {tab === 'training' && `共 ${filteredTraining.length} 条记录`}
            </div>
          </div>
        </div>

        {/* Overview Tab */}
        {tab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="训练营员工" value={filteredSummary.length} />
              <StatCard label="已提交小关" value={filteredCamp.length} />
              <StatCard label="通过小关" value={filteredCamp.filter((r) => (r.bestScore || 0) >= 70).length} accent="green" />
              <StatCard label="简答题作答" value={textAnswerRows.length} accent="sky" />
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h3 className="font-bold text-slate-800">员工完成情况总览</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                    <tr>
                      <th className="px-4 py-3 text-left">员工</th>
                      <th className="px-4 py-3 text-left">城市</th>
                      <th className="px-4 py-3 text-center">完成小关</th>
                      <th className="px-4 py-3 text-center">通过</th>
                      <th className="px-4 py-3 text-center">总积分</th>
                      <th className="px-4 py-3 text-center">星级</th>
                      <th className="px-4 py-3 text-center">简答</th>
                      <th className="px-4 py-3 text-left">最后提交</th>
                      <th className="px-4 py-3 text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredSummary.length === 0 ? (
                      <tr><td colSpan={9} className="px-4 py-12 text-center text-slate-400">暂无训练营数据</td></tr>
                    ) : (
                      filteredSummary.map((s, idx) => {
                        const completed = Number(s.completedCount) || 0;
                        const total = Number(s.totalSubLevels) || 16;
                        const passed = Number(s.passedCount) || 0;
                        const score = Number(s.totalScore) || 0;
                        const stars = Math.max(0, Number(s.stars) || 0);
                        const textCount = Number(s.textAnswerCount) || 0;
                        const starGroups = Math.floor(stars / 3);
                        const rem = stars % 3;
                        return (
                          <tr key={`${s.city || 'x'}-${s.staffName || idx}`} className="hover:bg-slate-50">
                            <td className="px-4 py-3 font-medium text-slate-800">{s.staffName || '—'}</td>
                            <td className="px-4 py-3 text-slate-500">{s.city ? cityZh(s.city) : '—'}</td>
                            <td className="px-4 py-3 text-center">{completed}/{total}</td>
                            <td className="px-4 py-3 text-center">
                              <span className={passed > 0 ? 'text-green-600 font-medium' : 'text-slate-400'}>{passed}</span>
                            </td>
                            <td className="px-4 py-3 text-center font-bold text-[#4F6BED]">{score}</td>
                            <td className="px-4 py-3 text-center">
                              <span className="text-[#FFB800]">{'★'.repeat(rem)}</span>
                              <span className="text-slate-300">{'★'.repeat(3 - rem)}</span>
                              <span className="ml-1.5 text-xs text-slate-400">共 {starGroups > 0 ? `${stars}★` : stars}（{completed} 关）</span>
                            </td>
                            <td className="px-4 py-3 text-center text-slate-600">{textCount}</td>
                            <td className="px-4 py-3 text-xs text-slate-400">{s.lastSubmittedAt ? formatTime(s.lastSubmittedAt) : '—'}</td>
                            <td className="px-4 py-3 text-right whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => void openDeleteDialog(s)}
                                className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium text-red-600 border border-red-200 bg-red-50 hover:bg-red-100 transition-colors"
                              >
                                删除账号
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center gap-2 justify-between">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-slate-800">薄弱作答提醒</h3>
                    <span className="text-xs text-slate-400">
                      每次考核中未拿满分的题（选择/判断答错、简答未满分），按提交时间倒序，共 {weakRows.length} 条
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={expandAllWeak}
                      className="text-xs px-2.5 py-1 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
                    >
                      全部展开
                    </button>
                    <button
                      type="button"
                      onClick={collapseAllWeak}
                      className="text-xs px-2.5 py-1 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
                    >
                      全部收起
                    </button>
                  </div>
                </div>
                <div className="divide-y divide-slate-100">
                  {weakRows.slice(0, 100).map((w) => {
                    const open = !!expandedWeak[w.id];
                    const isObjective = w.qType !== 'text';
                    const ans = w.answer || '';
                    const preview = isObjective
                      ? w.questionText
                      : ans.length > 30
                        ? `${ans.slice(0, 30)}…`
                        : ans;
                    const ratio = typeof w.ratio === 'number' ? w.ratio : 0;
                    const hitCount = typeof w.hitCount === 'number' ? w.hitCount : 0;
                    const totalPoints = typeof w.totalPoints === 'number' ? w.totalPoints : 0;
                    const score = typeof w.score === 'number' ? w.score : 0;
                    const refs = w.referencePoints || [];
                    const groups = w.keyPointGroups || [];
                    const qTypeLabel =
                      w.qType === 'single' ? '选择题' : w.qType === 'judge' ? '判断题' : '简答题';
                    return (
                      <div key={w.id} className="px-5 py-3">
                        <div className="flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                              <span className="font-medium text-slate-800">{w.staffName}</span>
                              {w.city && (
                                <span className="text-xs text-slate-500">{cityZh(w.city)}</span>
                              )}
                              <span className="text-xs px-2 py-0.5 rounded-full bg-sky-50 text-sky-700">
                                {w.subId} · {w.subTitle}
                              </span>
                              <span className="text-xs px-2 py-0.5 rounded-full bg-violet-50 text-violet-700">
                                {qTypeLabel}
                              </span>
                              <span
                                className={cn(
                                  'text-xs px-2 py-0.5 rounded-full font-medium',
                                  isObjective
                                    ? 'bg-red-50 text-red-600'
                                    : ratio >= 0.5
                                      ? 'bg-amber-50 text-amber-700'
                                      : 'bg-red-50 text-red-600',
                                )}
                              >
                                {isObjective
                                  ? `答错 · 0/${w.maxScore ?? '?'} 分`
                                  : `命中 ${hitCount}/${totalPoints} · ${Math.round(ratio * 100)}% · ${score}/${w.maxScore ?? '?'} 分`}
                              </span>
                              {w.submittedAt && (
                                <span className="text-[11px] text-slate-400">
                                  {formatTime(w.submittedAt)}
                                </span>
                              )}
                              {!open && (
                                <span className="text-sm text-slate-500 truncate">
                                  {preview || '（未作答）'}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <button
                              type="button"
                              onClick={() => toggleWeak(w.id)}
                              className="text-xs px-3 py-1.5 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
                            >
                              {open ? '收起' : '展开'}
                            </button>
                          </div>
                        </div>

                        {open && (
                          <div className="mt-3 ml-1 space-y-3">
                            <div className="rounded-lg bg-slate-50 ring-1 ring-slate-100 p-3">
                              <div className="text-[11px] font-bold text-slate-400 mb-1">题目</div>
                              <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                                {w.questionText}
                              </p>
                            </div>

                            {isObjective ? (
                              <>
                                {Array.isArray(w.options) && w.options.length > 0 && (
                                  <div className="rounded-lg bg-slate-50 ring-1 ring-slate-100 p-3">
                                    <div className="text-[11px] font-bold text-slate-400 mb-1.5">
                                      选项
                                    </div>
                                    <ul className="space-y-1">
                                      {w.options.map((opt, i) => {
                                        const isChosen = i === w.chosen;
                                        const isCorrect = i === w.correct;
                                        return (
                                          <li
                                            key={i}
                                            className={cn(
                                              'text-sm rounded-md px-2.5 py-1.5 ring-1',
                                              isCorrect
                                                ? 'bg-emerald-50 text-emerald-800 ring-emerald-200'
                                                : isChosen
                                                  ? 'bg-red-50 text-red-700 ring-red-200'
                                                  : 'bg-white text-slate-600 ring-slate-200',
                                            )}
                                          >
                                            {String.fromCharCode(65 + i)}. {opt}
                                            {isCorrect && <span className="ml-1.5 text-xs font-bold">（正确答案）</span>}
                                            {isChosen && !isCorrect && (
                                              <span className="ml-1.5 text-xs font-bold">（学员所选）</span>
                                            )}
                                          </li>
                                        );
                                      })}
                                    </ul>
                                  </div>
                                )}
                                {w.chosen === -1 && (
                                  <div className="rounded-lg bg-red-50/60 ring-1 ring-red-100 p-3">
                                    <div className="text-[11px] font-bold text-red-400 mb-1">
                                      学员作答
                                    </div>
                                    <p className="text-sm text-slate-800">未作答</p>
                                  </div>
                                )}
                                {w.explanation && (
                                  <div className="rounded-lg bg-emerald-50/60 ring-1 ring-emerald-100 p-3">
                                    <div className="text-[11px] font-bold text-emerald-600 mb-1">
                                      答案解析（带教参考）
                                    </div>
                                    <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                                      {w.explanation}
                                    </p>
                                  </div>
                                )}
                              </>
                            ) : (
                              <>
                                <div className="rounded-lg bg-red-50/60 ring-1 ring-red-100 p-3">
                                  <div className="text-[11px] font-bold text-red-400 mb-1">
                                    学员作答原文（{ans.length} 字，完整不截断）
                                  </div>
                                  <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap break-words max-h-72 overflow-y-auto">
                                    {ans || '（未作答）'}
                                  </p>
                                </div>

                                {refs.length > 0 && (
                                  <div className="rounded-lg bg-emerald-50/60 ring-1 ring-emerald-100 p-3">
                                    <div className="text-[11px] font-bold text-emerald-600 mb-1">
                                      参考答案要点（带教参考）
                                    </div>
                                    <ul className="text-sm text-slate-700 leading-relaxed list-disc pl-5 space-y-1">
                                      {refs.map((p, i) => (
                                        <li key={i} className="whitespace-pre-wrap break-words">
                                          {p}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}

                                {groups.length > 0 && (
                                  <div className="rounded-lg bg-slate-50 ring-1 ring-slate-100 p-3">
                                    <div className="text-[11px] font-bold text-slate-400 mb-1.5">
                                      得分点关键词（命中任一近义词即可）
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                      {groups.map((group, gi) => {
                                        const hit = group.some(
                                          (kw) =>
                                            kw &&
                                            ans
                                              .toLowerCase()
                                              .replace(/\s+/g, '')
                                              .includes(kw.toLowerCase().replace(/\s+/g, '')),
                                        );
                                        return (
                                          <span
                                            key={gi}
                                            className={cn(
                                              'text-xs px-2 py-0.5 rounded-full border',
                                              hit
                                                ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                                                : 'bg-white text-slate-500 border-slate-200',
                                            )}
                                          >
                                            {hit ? '✓ ' : ''}
                                            {group.join(' / ')}
                                          </span>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}

                                {w.llmReason ? (
                                  <div className="rounded-lg bg-indigo-50/60 ring-1 ring-indigo-100 p-3">
                                    <div className="text-[11px] font-bold text-indigo-500 mb-1">
                                      AI 语义评阅
                                    </div>
                                    <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                                      {w.llmReason}
                                    </p>
                                  </div>
                                ) : (
                                  <p className="px-1 text-[11px] leading-relaxed text-amber-600">
                                    该条按提交时的评分规则自动评阅，仅供带教参考，以答案原文为准。
                                  </p>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {weakRows.length > 100 && (
                    <div className="px-5 py-3 text-xs text-slate-400">
                      仅显示前 100 条，可通过上方城市 / 员工筛选缩小范围
                    </div>
                  )}
                </div>
              </div>
          </div>
        )}

        {/* Camp Results Tab */}
        {tab === 'camp' && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <StatCard label="参考人数" value={campPeople} />
              <StatCard label="提交次数" value={filteredCamp.length} />
              <StatCard label="通过率" value={`${campPassRate}%`} accent="green" />
              <StatCard label="平均分" value={campAvg} />
            </div>
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                    <tr>
                      <th className="px-4 py-3 text-left">员工</th>
                      <th className="px-4 py-3 text-left">城市</th>
                      <th className="px-4 py-3 text-left">小关</th>
                      <th className="px-4 py-3 text-center">学</th>
                      <th className="px-4 py-3 text-center">练</th>
                      <th className="px-4 py-3 text-center">考</th>
                      <th className="px-4 py-3 text-center">成绩明细</th>
                      <th className="px-4 py-3 text-center">最终成绩</th>
                      <th className="px-4 py-3 text-center">星级</th>
                      <th className="px-4 py-3 text-center">状态</th>
                      <th className="px-4 py-3 text-left">提交时间</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredCamp.length === 0 ? (
                      <tr><td colSpan={11} className="px-4 py-12 text-center text-slate-400">暂无训练营成绩</td></tr>
                    ) : (
                      [...filteredCamp]
                        .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
                        .map((r, i) => {
                          const bestScore = Number(r.bestScore) || 0;
                          const passed = bestScore >= 70;
                          const starCount = Math.min(3, Math.max(0, Number(r.stars) || 0));
                          const attList = Array.isArray(r.attemptsList) ? r.attemptsList : [];
                          return (
                            <tr key={`${r.subId}-${r.submittedAt}-${i}`} className="hover:bg-slate-50">
                              <td className="px-4 py-3 font-medium text-slate-800">{r.staffName || '—'}</td>
                              <td className="px-4 py-3 text-slate-500">{r.city ? cityZh(r.city) : '—'}</td>
                              <td className="px-4 py-3 font-medium">{r.subId || '—'}</td>
                              <td className="px-4 py-3 text-center text-slate-500">{r.learnScore ?? '—'}</td>
                              <td className="px-4 py-3 text-center text-slate-500">{r.practiceScore ?? '—'}</td>
                              <td className="px-4 py-3 text-center text-slate-500">{r.examScore ?? '—'}</td>
                              <td className="px-4 py-3 text-center text-xs text-slate-500">
                                {attList.length >= 2 ? (
                                  <span>
                                    {attList.map((a, ai) => (
                                      <span key={ai} className="block">
                                        第{ai + 1}次 <b className="text-slate-700">{Number(a.score) || 0}</b>
                                      </span>
                                    ))}
                                    <span className="text-amber-600">平均→</span>
                                  </span>
                                ) : (
                                  <span className="text-slate-400">仅 1 次</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={`font-bold ${passed ? 'text-green-600' : 'text-red-500'}`}>{bestScore}</span>
                              </td>
                              <td className="px-4 py-3 text-center text-[#FFB800]">
                                <span>{'★'.repeat(starCount)}</span>
                                <span className="text-slate-200">{'★'.repeat(3 - starCount)}</span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                {r.graded ? (
                                  <span className="inline-flex px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700">已评分</span>
                                ) : (
                                  <span className="inline-flex px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-500">待评分</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-xs text-slate-400">{formatTime(r.submittedAt)}</td>
                            </tr>
                          );
                        })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* Quiz Tab */}
        {tab === 'quiz' && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <StatCard label="参考人数" value={quizPeople} />
              <StatCard label="考核次数" value={filteredQuiz.length} />
              <StatCard label="通过率" value={`${quizPassRate}%`} accent="green" />
              <StatCard label="平均分" value={quizAvg} />
            </div>
            <div className="flex flex-col gap-3">
              {filteredQuiz.length === 0 ? (
                <div className="bg-white rounded-xl p-12 border border-slate-200 text-center text-slate-400">暂无考核记录</div>
              ) : (
                filteredQuiz.map((r, i) => (
                  <div key={i} className="w-full bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-3">
                      <span className="text-base font-bold text-slate-800">{r.staffName}</span>
                      <span className="text-sm text-slate-500">{cityZh(r.city)}</span>
                      <span className="text-sm text-slate-500">第{r.chapterId}章</span>
                      <span className={`text-lg font-bold ${r.score >= 90 ? 'text-green-600' : r.score >= 70 ? 'text-orange-500' : 'text-red-500'}`}>{r.score}分</span>
                      {r.passed ? <Badge color="green">通过</Badge> : <Badge color="red">未通过</Badge>}
                    </div>
                    <p className="text-xs text-slate-400 mb-3">提交时间：{formatTime(r.submittedAt)}</p>
                    <div className="w-full">
                      <p className="text-xs font-medium text-slate-500 mb-1.5">加强建议：</p>
                      {r.improvementPoints && r.improvementPoints.length > 0 ? (
                        <div className="flex flex-col gap-2">
                          {r.improvementPoints.map((p, j) => (
                            <p key={j} className="text-sm text-slate-700 leading-relaxed"><span className="text-sky-500 mr-1.5">•</span>{p}</p>
                          ))}
                        </div>
                      ) : <p className="text-sm text-slate-400">—</p>}
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {/* Training Tab */}
        {tab === 'training' && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
              <StatCard label="训练人数" value={trainPeople} />
              <StatCard label="训练次数" value={filteredTraining.length} />
              <StatCard label="平均分" value={trainAvg} accent="sky" />
            </div>
            <div className="flex flex-col gap-3">
              {filteredTraining.length === 0 ? (
                <div className="bg-white rounded-xl p-12 border border-slate-200 text-center text-slate-400">暂无训练记录</div>
              ) : (
                filteredTraining.map((r, i) => (
                  <div key={i} className="w-full bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-3">
                      <span className="text-base font-bold text-slate-800">{r.staffName}</span>
                      <span className="text-sm text-slate-500">{cityZh(r.city)}</span>
                      <span className="text-sm text-slate-600">第{r.roundNumber}轮 - {r.roundTitle}</span>
                      <span className={`text-lg font-bold ${r.totalScore >= 80 ? 'text-green-600' : r.totalScore >= 70 ? 'text-orange-500' : 'text-red-500'}`}>{r.totalScore}分</span>
                    </div>
                    <p className="text-xs text-slate-400 mb-3">提交时间：{formatTime(r.submittedAt)}</p>
                    <div className="mb-3">
                      <p className="text-xs font-medium text-slate-500 mb-1.5">各维度得分：</p>
                      {r.dimensionScores ? (
                        <div className="flex flex-wrap gap-1.5">
                          {Object.entries(r.dimensionScores).map(([key, val]) => (
                            <span key={key} className="bg-slate-100 px-2 py-0.5 rounded text-xs text-slate-700">{DIM_LABELS[key] || key} {val}</span>
                          ))}
                        </div>
                      ) : <p className="text-sm text-slate-400">—</p>}
                    </div>
                    <div className="w-full">
                      <p className="text-xs font-medium text-slate-500 mb-1.5">带教建议：</p>
                      {r.coachingPoints && r.coachingPoints.length > 0 ? (
                        <div className="flex flex-col gap-2">
                          {r.coachingPoints.map((p, j) => (
                            <p key={j} className="text-sm text-slate-700 leading-relaxed"><span className="text-sky-500 mr-1.5">•</span>{p}</p>
                          ))}
                        </div>
                      ) : <p className="text-sm text-slate-400">—</p>}
                    </div>
                    {r.dialogues && r.dialogues.length > 0 && (
                      <div className="w-full mt-3">
                        <button onClick={() => setExpandedTraining(expandedTraining === i ? null : i)} className="text-xs text-sky-600 hover:text-sky-700 underline">
                          {expandedTraining === i ? '收起对话' : `查看对话（${r.dialogues.length}条）`}
                        </button>
                        {expandedTraining === i && (
                          <div className="mt-2 flex flex-col gap-1.5">
                            {r.dialogues.map((d, j) => (
                              <div key={j} className={`w-full rounded-lg px-3 py-2 text-sm leading-relaxed ${d.role === 'patient' ? 'bg-slate-100 text-slate-700' : 'bg-sky-50 text-sky-800'}`}>
                                <span className={`text-xs font-medium mr-1.5 ${d.role === 'patient' ? 'text-slate-500' : 'text-sky-500'}`}>{d.role === 'patient' ? '患者' : '客服'}：</span>
                                {d.content}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </>
        )}

      </div>

      {/* 删除离职学员：无管理口令时先要求口令 */}
      {deleteTarget && !adminToken && adminTokenGate}

      {/* 删除离职学员：二次确认（手动输入姓名完全匹配） */}
      <AlertDialog open={!!deleteTarget && !!adminToken} onOpenChange={(o) => !o && closeDeleteDialog()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600">删除离职学员账号（不可恢复）</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-slate-600">
                <p>
                  即将彻底删除学员
                  <span className="font-bold text-slate-900">
                    {' '}
                    {deleteTarget?.staffName}（{deleteTarget?.city ? cityZh(deleteTarget.city) : '—'}）
                  </span>{' '}
                  在专业知识考核系统中的全部数据。
                </p>
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm space-y-1">
                  <p className="font-medium text-red-700">将永久删除：</p>
                  {deletePreview ? (
                    <ul className="list-disc pl-5 space-y-0.5 text-slate-700">
                      <li>各关考核成绩 {deletePreview.resultCount} 条（{deletePreview.subIds.join('、') || '—'}），删除前总分合计 {deletePreview.bestScoreSum}</li>
                      <li>错题本 / 薄弱收录 {deletePreview.weakCount} 条{deletePreview.weakCount === 0 ? '（无）' : ''}</li>
                      <li>学习 / 练习打点与解锁进度{deletePreview.hasProgress ? '' : '（无）'}</li>
                      <li>排行榜、后台名单、错题统计中的该学员条目</li>
                    </ul>
                  ) : deleteError ? (
                    <p className="text-red-600">{deleteError}</p>
                  ) : (
                    <p className="text-slate-500">正在读取将删除的数据清单…</p>
                  )}
                </div>
                <p className="text-sm">
                  此操作<strong className="text-red-600">不可撤销、不可恢复</strong>，且只删除该学员，不会影响其他任何人。请手动输入其姓名
                  <span className="font-bold text-slate-900"> {deleteTarget?.staffName} </span>
                  以确认：
                </p>
                <Input
                  value={deleteConfirmName}
                  onChange={(e) => setDeleteConfirmName(e.target.value)}
                  placeholder="输入姓名完全匹配后才可删除"
                  autoFocus
                  disabled={deleteLoading}
                />
                {deleteError && <p className="text-sm text-red-600">{deleteError}</p>}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={closeDeleteDialog} disabled={deleteLoading}>
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
              disabled={
                deleteLoading ||
                !deletePreview ||
                deleteConfirmName.trim() !== deleteTarget?.staffName
              }
              className="bg-red-600 hover:bg-red-700 focus:ring-red-500 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {deleteLoading ? '删除中…' : '确认彻底删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function TabBtn({ active, onClick, children, badge }: { active: boolean; onClick: () => void; children: React.ReactNode; badge?: number }) {  return (
    <button onClick={onClick} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors relative flex items-center gap-1 ${active ? 'bg-sky-500 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
      {children}
      {badge !== undefined && badge > 0 && (
        <span className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold ${active ? 'bg-white text-red-500' : 'bg-red-500 text-white'}`}>{badge}</span>
      )}
    </button>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number | string; accent?: 'sky' | 'green' | 'amber' }) {
  const color = accent === 'sky' ? 'text-sky-600' : accent === 'green' ? 'text-green-600' : accent === 'amber' ? 'text-amber-500' : 'text-slate-800';
  return (
    <div className="bg-white rounded-xl p-4 border border-slate-200">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

function Badge({ color, children }: { color: 'green' | 'red' | 'amber'; children: React.ReactNode }) {
  const cls = color === 'green' ? 'bg-green-100 text-green-700' : color === 'red' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700';
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{children}</span>;
}

function AdminTokenGateBody({
  value,
  onChange,
  onConfirm,
}: {
  value: string;
  onChange: (v: string) => void;
  onConfirm: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 py-1">
      <Input
        type="password"
        autoFocus
        placeholder="请输入管理口令"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onConfirm();
        }}
      />
      <button
        type="button"
        onClick={onConfirm}
        className="self-end px-4 py-2 rounded-lg text-sm font-medium bg-slate-800 text-white hover:bg-slate-900"
      >
        确认口令
      </button>
    </div>
  );
}
