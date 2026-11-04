'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { scoringDimensions } from '@/lib/knowledge-base';
import { ArrowLeft, Home, RotateCcw, AlertCircle, CheckCircle2, Lightbulb, MessageSquare, FileWarning, ClipboardCheck, ChevronDown, ChevronUp } from 'lucide-react';
import { getTrainingProgress, type TrainingProgress } from '@/lib/training-rounds';

// 获取维度颜色
function getDimensionColor(key: string): string {
  const colors: Record<string, string> = {
    inquiry: 'bg-indigo-500',
    analysis: 'bg-purple-500',
    empathy: 'bg-sky-500',
    professionalism: 'bg-teal-500',
    conversion: 'bg-emerald-500',
    compliance: 'bg-amber-500',
    rhythm: 'bg-cyan-500',
  };
  return colors[key] || 'bg-sky-500';
}

interface DimensionScores {
  [key: string]: number;
}

interface DimensionItem {
  name: string;
  priority: string;
  score: number;
  maxScore: number;
  covered: boolean | string;
  detail: string;
  purpose: string;
  notApplicable?: boolean;
}

interface DimensionBlock {
  block: string;
  blockScore: number;
  blockMaxScore: number;
  items: DimensionItem[];
}

interface EvaluationResult {
  totalScore: number;
  dimensions: DimensionBlock[];
  dimensionScores: DimensionScores;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  roundNumber?: number | null;
  roundTitle?: string | null;
  inquiryReview?: {
    questionsAsked: string[];
    questionsMissed: string[];
    logicAssessment: string;
    depthAssessment: string;
  };
  materialAnalysis?: {
    materialsUsed: string[];
    suggestedMaterials: Array<{
      category: string;
      timing: string;
      material: string;
      script: string;
    }>;
    keyMoments: Array<{
      round: number;
      patientSaid: string;
      shouldSend: string;
      reason: string;
    }>;
    missedWarnings: string[];
  };
  excellentReplies?: Array<{
    staffMessage: string;
    reason: string;
  }>;
  workflowCheck?: {
    modules: Array<{
      module: string;
      covered: boolean | string;
      detail: string;
      purpose: string;
      notApplicable?: boolean;
    }>;
    summary: string;
    nextStep: string;
  };
}

// 雷达图组件
function RadarChart({ dimensionScores }: { dimensionScores: DimensionScores }) {
  const size = 300;
  const center = size / 2;
  const radius = 100;
  const levels = 5;

  // 获取每个维度的坐标
  const getPoint = (index: number, value: number) => {
    const angle = (Math.PI * 2 * index) / scoringDimensions.length - Math.PI / 2;
    const r = (value / 100) * radius;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
    };
  };

  // 绘制背景网格
  const gridLines = [];
  for (let level = 1; level <= levels; level++) {
    const points = scoringDimensions
      .map((_, index) => {
        const point = getPoint(index, (level / levels) * 100);
        return `${point.x},${point.y}`;
      })
      .join(' ');
    gridLines.push(
      <polygon
        key={level}
        points={points}
        fill="none"
        stroke="#e2e8f0"
        strokeWidth="1"
      />
    );
  }

  // 绘制维度轴线
  const axisLines = scoringDimensions.map((_, index) => {
    const point = getPoint(index, 100);
    return (
      <line
        key={index}
        x1={center}
        y1={center}
        x2={point.x}
        y2={point.y}
        stroke="#e2e8f0"
        strokeWidth="1"
      />
    );
  });

  // 绘制数据区域
  const dataPoints = scoringDimensions
    .map((dim, index) => {
      const percentage = dimensionScores[dim.key] || 0;
      const point = getPoint(index, percentage);
      return `${point.x},${point.y}`;
    })
    .join(' ');

  // 绘制维度标签
  const labels = scoringDimensions.map((dim, index) => {
    const point = getPoint(index, 100);
    const percentage = dimensionScores[dim.key] || 0;
    const rawScore = Math.round((percentage / 100) * dim.weight);
    return (
      <text
        key={dim.key}
        x={point.x}
        y={point.y}
        textAnchor="middle"
        dominantBaseline="middle"
        className="fill-slate-600 text-xs"
      >
        <tspan x={point.x} dy="-0.5em">
          {dim.name}
        </tspan>
        <tspan x={point.x} dy="1.2em" className="fill-sky-600 font-bold">
          {rawScore}/{dim.weight}
        </tspan>
      </text>
    );
  });

  return (
    <svg width={size} height={size} className="mx-auto">
      {gridLines}
      {axisLines}
      <polygon
        points={dataPoints}
        fill="rgba(14, 165, 233, 0.2)"
        stroke="#0ea5e9"
        strokeWidth="2"
      />
      {scoringDimensions.map((dim, index) => {
        const percentage = dimensionScores[dim.key] || 0;
        const point = getPoint(index, percentage);
        return (
          <circle
            key={dim.key}
            cx={point.x}
            cy={point.y}
            r="4"
            fill="#0ea5e9"
          />
        );
      })}
      {labels}
    </svg>
  );
}

function ReportContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roundParam = searchParams.get('round');
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedModules, setExpandedModules] = useState<Set<number>>(new Set());

  useEffect(() => {
    // 优先从 sessionStorage 读取（刚完成的评分）
    const data = sessionStorage.getItem('evaluationResult');
    if (data) {
      try {
        const result = JSON.parse(data);
        setEvaluation(result);
        // 读取后清除，避免刷新后重复显示旧数据
        sessionStorage.removeItem('evaluationResult');
      } catch (e) {
        console.error('Failed to parse evaluation data:', e);
      }
    } else if (roundParam) {
      // 从 localStorage training_reports 中读取完整历史报告
      try {
        const reports = JSON.parse(localStorage.getItem('training_reports') || '[]');
        const reportEntry = reports.find((r: { round: number }) => r.round === parseInt(roundParam, 10));
        if (reportEntry) {
          // 将完整报告数据转换为 EvaluationResult 格式
          const dimScores: Record<string, number> = reportEntry.dimensionScores || {};
          const ir = reportEntry.inquiryReview || {};
          const ma = reportEntry.materialAnalysis || {};
          setEvaluation({
            totalScore: reportEntry.totalScore,
            dimensions: reportEntry.dimensions || [],
            dimensionScores: dimScores,
            strengths: reportEntry.strengths || [],
            weaknesses: reportEntry.improvements || [],
            suggestions: reportEntry.suggestions || reportEntry.improvements || [],
            inquiryReview: {
              questionsAsked: ir.askedQuestions || ir.questionsAsked || [],
              questionsMissed: ir.missedInfo || ir.questionsMissed || [],
              logicAssessment: ir.logicAssessment || '',
              depthAssessment: ir.depthAssessment || '',
            },
            materialAnalysis: {
              materialsUsed: ma.usedMaterials || ma.materialsUsed || [],
              suggestedMaterials: (ma.suggestedMaterials || []).map((item: Record<string, string>) => ({
                category: item.category || '',
                timing: item.timing || '',
                material: item.content || item.material || '',
                script: item.script || '',
              })),
              keyMoments: (ma.keyTiming || ma.keyMoments || []).map((item: string | Record<string, unknown>, i: number) => {
                if (typeof item === 'string') {
                  return { round: i + 1, patientSaid: '', shouldSend: item, reason: '' };
                }
                return {
                  round: (item.round as number) || i + 1,
                  patientSaid: (item.patientSaid as string) || '',
                  shouldSend: (item.shouldSend as string) || '',
                  reason: (item.reason as string) || '',
                };
              }),
              missedWarnings: ma.missedWarnings || [],
            },
            excellentReplies: reportEntry.excellentReplies || [],
            workflowCheck: reportEntry.workflowCheck || null,
            roundNumber: reportEntry.round,
            roundTitle: reportEntry.title,
          });
        } else {
          // 兜底：从 training_progress 中只读取分数
          const progress = getTrainingProgress();
          const entry = progress.find((p: TrainingProgress) => p.round === parseInt(roundParam, 10));
          if (entry) {
            setEvaluation({
              totalScore: entry.score,
              dimensions: [],
              dimensionScores: entry.dimensionScores || {},
              strengths: [],
              weaknesses: [],
              suggestions: [],
              roundNumber: entry.round,
              roundTitle: entry.title,
            });
          }
        }
      } catch (e) {
        console.error('Failed to read training reports:', e);
      }
    }
    setLoading(false);
  }, [roundParam]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white flex items-center justify-center">
        <div className="text-slate-500">加载中...</div>
      </div>
    );
  }

  if (!evaluation) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-500 mb-4">未找到评分数据</p>
          <Button onClick={() => router.push('/training')}>返回首页</Button>
        </div>
      </div>
    );
  }

  // 检测数据格式：新版（15项环节）vs 旧版（6维度）
  const isNewFormat = evaluation.dimensions && evaluation.dimensions.length > 0 && 'block' in evaluation.dimensions[0];
  const isOldFormat = !isNewFormat && evaluation.dimensionScores && Object.keys(evaluation.dimensionScores).length > 0;
  const isLegacyData = !isNewFormat && !isOldFormat;

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-emerald-600';
    if (score >= 80) return 'text-sky-600';
    if (score >= 70) return 'text-amber-600';
    return 'text-red-600';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 90) return '优秀';
    if (score >= 80) return '良好';
    if (score >= 70) return '合格';
    return '待提升';
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white pb-8">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/training')}
            className="mr-3"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            返回
          </Button>
          <h1 className="text-lg font-bold text-slate-800">
            {evaluation?.roundNumber
              ? `第${evaluation.roundNumber}轮评分报告`
              : '训练评分报告'}
          </h1>
        </div>
      </div>

      {/* 轮次信息 */}
      {evaluation?.roundTitle && (
        <div className="bg-sky-50 border-b border-sky-100">
          <div className="max-w-4xl mx-auto px-4 py-2">
            <p className="text-sm text-sky-700">
              本轮主题：<span className="font-medium">{evaluation.roundTitle}</span>
            </p>
          </div>
        </div>
      )}

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* 总分卡片 */}
        <Card className="border-sky-200 bg-gradient-to-br from-white to-sky-50">
          <CardContent className="pt-6 text-center">
            <div className="text-6xl font-bold text-sky-600 mb-2">
              {evaluation.totalScore}<span className="text-2xl text-slate-400 font-normal"> / 100分</span>
            </div>
            <div className={`text-xl font-semibold ${getScoreColor(evaluation.totalScore)}`}>
              {getScoreLabel(evaluation.totalScore)}
            </div>
            <p className="text-slate-500 text-sm mt-2">综合评分（满分100分）</p>
          </CardContent>
        </Card>

        {/* 15项环节评分 */}
        {isNewFormat ? (
          (evaluation.dimensions as DimensionBlock[]).map((block, blockIndex) => (
            <Card key={blockIndex}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">
                    {block.block}
                  </CardTitle>
                  <span className={`text-lg font-bold ${getScoreColor((block.blockScore / block.blockMaxScore) * 100)}`}>
                    {block.blockScore}/{block.blockMaxScore}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {block.items?.map((item, itemIndex) => {
                  const isNotApplicable = item.covered === 'notApplicable' || item.notApplicable === true;
                  const isCovered = item.covered === true;
                  const scorePercent = item.maxScore > 0 ? (item.score / item.maxScore) * 100 : 0;
                  return (
                    <div
                      key={itemIndex}
                      className="border rounded-lg overflow-hidden"
                    >
                      <div className={`flex items-center justify-between px-3 py-2 ${isNotApplicable ? 'bg-slate-50' : isCovered ? 'bg-emerald-50' : 'bg-red-50'}`}>
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {isNotApplicable ? (
                            <span className="text-slate-400 text-sm">-</span>
                          ) : isCovered ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                          )}
                          <span className="text-sm font-medium text-slate-700 truncate">{item.name}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${item.priority === '很重要' ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-500'}`}>
                            {item.priority}
                          </span>
                        </div>
                        <span className={`text-sm font-bold ml-2 shrink-0 ${isNotApplicable ? 'text-slate-400' : getScoreColor(scorePercent)}`}>
                          {isNotApplicable ? '不适用' : `${item.score}/${item.maxScore}`}
                        </span>
                      </div>
                      <div className="px-3 py-2 bg-white">
                        <p className="text-xs text-slate-600">{item.detail}</p>
                        <p className="text-xs text-slate-400 mt-1">目的：{item.purpose}</p>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ))
        ) : isOldFormat ? (
          /* 兼容旧版6维度格式 */
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">各维度得分</CardTitle>
            </CardHeader>
            <CardContent>
              <RadarChart dimensionScores={evaluation.dimensionScores} />
              <div className="mt-4 grid grid-cols-2 gap-2">
                {scoringDimensions.map((dim) => {
                  const percentage = evaluation.dimensionScores[dim.key] || 0;
                  const rawScore = Math.round((percentage / 100) * dim.weight);
                  const maxScore = dim.weight;
                  return (
                    <div
                      key={dim.key}
                      className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2"
                    >
                      <span className="text-sm text-slate-600">{dim.name}</span>
                      <span className={`text-sm font-bold ${getScoreColor(percentage)}`}>
                        {rawScore}/{maxScore}
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ) : isLegacyData ? (
          /* 旧版评分体系数据，显示友好提示 */
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="pt-6">
              <div className="text-center">
                <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
                <p className="text-amber-800 font-medium mb-2">此报告为旧版评分体系生成</p>
                <p className="text-amber-600 text-sm mb-4">
                  评分体系已升级为「疾病信息掌握度 + 销售信息掌握度」两大块15项环节检查，建议重新训练体验新版评分。
                </p>
                <div className="text-sm text-amber-700 bg-white rounded-lg p-3 mb-4">
                  <p className="font-medium mb-1">当前报告总分：{evaluation.totalScore} / 100分</p>
                  {evaluation.strengths && evaluation.strengths.length > 0 && (
                    <div className="text-left mt-2">
                      <p className="font-medium">亮点：</p>
                      <ul className="list-disc list-inside text-xs">
                        {evaluation.strengths.map((s, i) => <li key={i}>{s}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
                <Button onClick={() => router.push('/training')} className="bg-amber-600 hover:bg-amber-700">
                  返回训练列表
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {/* 问诊质量回顾 */}
        {evaluation.inquiryReview && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center">
                <MessageSquare className="w-5 h-5 mr-2 text-sky-600" />
                问诊质量回顾
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 已问问题 */}
              <div>
                <h4 className="font-semibold text-slate-700 mb-2 flex items-center">
                  <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-500" />
                  已问问题
                </h4>
                {(evaluation.inquiryReview.questionsAsked || []).length > 0 ? (
                  <ul className="space-y-1">
                    {evaluation.inquiryReview.questionsAsked.map((q: string, i: number) => (
                      <li key={i} className="text-sm text-slate-600 bg-emerald-50 rounded px-3 py-2">
                        {q}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-500 italic">客服未主动询问任何问题</p>
                )}
              </div>

              {/* 漏问问题 */}
              <div>
                <h4 className="font-semibold text-slate-700 mb-2 flex items-center">
                  <AlertCircle className="w-4 h-4 mr-2 text-amber-500" />
                  漏问的重要信息
                </h4>
                {(evaluation.inquiryReview.questionsMissed || []).length > 0 ? (
                  <ul className="space-y-1">
                    {evaluation.inquiryReview.questionsMissed.map((q: string, i: number) => (
                      <li key={i} className="text-sm text-slate-600 bg-amber-50 rounded px-3 py-2">
                        {q}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-emerald-600">问诊全面，未遗漏重要信息</p>
                )}
              </div>

              {/* 问诊逻辑评价 */}
              <div>
                <h4 className="font-semibold text-slate-700 mb-2">问诊逻辑</h4>
                <p className="text-sm text-slate-600 bg-slate-50 rounded px-3 py-2">
                  {evaluation.inquiryReview.logicAssessment}
                </p>
              </div>

              {/* 问诊深度评价 */}
              <div>
                <h4 className="font-semibold text-slate-700 mb-2">问诊深度</h4>
                <p className="text-sm text-slate-600 bg-slate-50 rounded px-3 py-2">
                  {evaluation.inquiryReview.depthAssessment}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 素材使用建议 */}
        {evaluation.materialAnalysis && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center">
                <FileWarning className="w-5 h-5 mr-2 text-sky-600" />
                素材使用建议
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 本次使用的素材 */}
              <div>
                <h4 className="font-semibold text-slate-700 mb-2">本次使用的素材</h4>
                {(evaluation.materialAnalysis.materialsUsed || []).length > 0 ? (
                  <ul className="space-y-1">
                    {evaluation.materialAnalysis.materialsUsed.map((m: string, i: number) => (
                      <li key={i} className="text-sm text-slate-600 bg-sky-50 rounded px-3 py-2">
                        {m}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-500 italic">本次对话未使用任何素材</p>
                )}
              </div>

              {/* 建议发送的素材 */}
              {evaluation.materialAnalysis.suggestedMaterials.length > 0 && (
                <div>
                  <h4 className="font-semibold text-slate-700 mb-2 flex items-center">
                    <Lightbulb className="w-4 h-4 mr-2 text-amber-500" />
                    建议发送的素材
                  </h4>
                  <div className="space-y-2">
                    {evaluation.materialAnalysis.suggestedMaterials.map((item, i) => (
                      <div key={i} className="bg-amber-50 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-amber-700 bg-amber-200 rounded px-2 py-0.5">
                            {item.category}
                          </span>
                          <span className="text-xs text-slate-500">{item.timing}</span>
                        </div>
                        <p className="text-sm font-medium text-slate-700">{item.material}</p>
                        <p className="text-xs text-slate-500 mt-1">话术：{item.script}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 关键时机 */}
              {evaluation.materialAnalysis.keyMoments.length > 0 && (
                <div>
                  <h4 className="font-semibold text-slate-700 mb-2">关键时机提醒</h4>
                  <div className="space-y-2">
                    {evaluation.materialAnalysis.keyMoments.map((moment, i) => (
                      <div key={i} className="bg-slate-50 rounded-lg p-3 border-l-4 border-sky-400">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-sky-700">
                            第{moment.round}轮对话
                          </span>
                        </div>
                        <p className="text-sm text-slate-600">
                          <span className="font-medium">患者说：</span>{moment.patientSaid}
                        </p>
                        <p className="text-sm text-slate-600 mt-1">
                          <span className="font-medium">应发送：</span>{moment.shouldSend}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">原因：{moment.reason}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 漏发警示 */}
              {evaluation.materialAnalysis.missedWarnings.length > 0 && (
                <div>
                  <h4 className="font-semibold text-red-600 mb-2 flex items-center">
                    <AlertCircle className="w-4 h-4 mr-2" />
                    漏发素材警示
                  </h4>
                  <ul className="space-y-1">
                    {evaluation.materialAnalysis.missedWarnings.map((w, i) => (
                      <li key={i} className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">
                        {w}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* 流程覆盖检查 */}
        {evaluation.workflowCheck && evaluation.workflowCheck.modules && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center">
                <ClipboardCheck className="w-5 h-5 mr-2 text-sky-600" />
                流程覆盖检查
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 进度概览 */}
              <div className="bg-slate-50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-700">覆盖进度</span>
                  <span className="text-sm font-bold text-sky-600">
                    {(() => {
                      const applicable = evaluation.workflowCheck.modules.filter(m => m.covered !== 'notApplicable' && m.covered !== 'not_applicable' && !m.notApplicable);
                      const covered = applicable.filter(m => m.covered === true);
                      return `${covered.length}/${applicable.length}`;
                    })()}
                  </span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2.5">
                  <div
                    className="bg-sky-500 h-2.5 rounded-full transition-all"
                    style={{
                      width: `${(() => {
                        const applicable = evaluation.workflowCheck.modules.filter(m => m.covered !== 'notApplicable' && m.covered !== 'not_applicable' && !m.notApplicable);
                        const covered = applicable.filter(m => m.covered === true);
                        return applicable.length > 0 ? (covered.length / applicable.length) * 100 : 0;
                      })()}%`
                    }}
                  />
                </div>
              </div>

              {/* 环节网格 */}
              <div className="grid grid-cols-4 gap-2">
                {evaluation.workflowCheck.modules.map((mod, i) => {
                  const isCovered = mod.covered === true;
                  const isNotApplicable = mod.covered === 'notApplicable' || mod.covered === 'not_applicable' || mod.notApplicable === true;
                  return (
                    <button
                      key={i}
                      onClick={() => {
                        const next = new Set(expandedModules);
                        if (next.has(i)) next.delete(i);
                        else next.add(i);
                        setExpandedModules(next);
                      }}
                      className={`rounded-lg p-2 text-xs font-medium transition-all border ${
                        isNotApplicable
                          ? 'bg-slate-100 text-slate-400 border-slate-200'
                          : isCovered
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                            : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                      } ${expandedModules.has(i) ? 'ring-2 ring-sky-400' : ''}`}
                    >
                      <div className="flex flex-col items-center gap-1">
                        {isNotApplicable ? (
                          <span className="text-base">-</span>
                        ) : isCovered ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-red-500" />
                        )}
                        <span className="text-center leading-tight">{mod.module}</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* 展开的详情 */}
              {Array.from(expandedModules).sort().map((i) => {
                const mod = evaluation.workflowCheck!.modules[i];
                if (!mod) return null;
                const isCovered = mod.covered === true;
                const isNotApplicable = mod.covered === 'notApplicable' || mod.covered === 'not_applicable' || mod.notApplicable === true;
                return (
                  <div
                    key={i}
                    className={`rounded-lg p-3 border ${
                      isNotApplicable ? 'bg-slate-50 border-slate-200' : isCovered ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm text-slate-800">{mod.module}</span>
                      <button
                        onClick={() => {
                          const next = new Set(expandedModules);
                          next.delete(i);
                          setExpandedModules(next);
                        }}
                        className="text-slate-400 hover:text-slate-600"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-sm text-slate-600 mb-1">
                      <span className="font-medium">检查：</span>{mod.detail}
                    </p>
                    <p className="text-xs text-slate-500">
                      <span className="font-medium">目的：</span>{mod.purpose}
                    </p>
                  </div>
                );
              })}

              {/* Summary */}
              {evaluation.workflowCheck.summary && (
                <div className="bg-sky-50 rounded-lg p-3 border border-sky-200">
                  <p className="text-sm text-sky-800">{evaluation.workflowCheck.summary}</p>
                </div>
              )}

              {/* Next Step */}
              {evaluation.workflowCheck.nextStep && (
                <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
                  <p className="text-sm text-amber-800">
                    <span className="font-medium">下一步建议：</span>{evaluation.workflowCheck.nextStep}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* 优势 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center text-emerald-700">
              <CheckCircle2 className="w-5 h-5 mr-2" />
              表现亮点
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {evaluation.strengths.map((s, i) => (
                <li key={i} className="flex items-start">
                  <span className="text-emerald-500 mr-2">•</span>
                  <span className="text-slate-700">{s}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* 不足 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center text-amber-700">
              <AlertCircle className="w-5 h-5 mr-2" />
              待改进项
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {evaluation.weaknesses.map((w, i) => (
                <li key={i} className="flex items-start">
                  <span className="text-amber-500 mr-2">•</span>
                  <span className="text-slate-700">{w}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* 建议 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center text-sky-700">
              <Lightbulb className="w-5 h-5 mr-2" />
              改进建议
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {evaluation.suggestions.map((s, i) => (
                <li key={i} className="flex items-start">
                  <span className="text-sky-500 mr-2">{i + 1}.</span>
                  <span className="text-slate-700">{s}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* 操作按钮 */}
        <div className="flex gap-3 pt-4">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => router.push('/training')}
          >
            <Home className="w-4 h-4 mr-2" />
            返回训练列表
          </Button>
          {evaluation?.roundNumber != null && evaluation.roundNumber < 10 && evaluation.totalScore >= 70 && (
            <Button
              className="flex-1 bg-sky-600 hover:bg-sky-700"
              onClick={() => router.push(`/training/chat?round=${(evaluation.roundNumber ?? 0) + 1}`)}
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              下一轮
            </Button>
          )}
          {(evaluation?.roundNumber == null || evaluation.totalScore < 70) && (
            <Button
              className="flex-1 bg-sky-600 hover:bg-sky-700"
              onClick={() => router.push(`/training/chat${evaluation?.roundNumber != null ? `?round=${evaluation.roundNumber}` : ''}`)}
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              {evaluation?.totalScore !== undefined && evaluation.totalScore < 70 ? '重新挑战' : '再练一次'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ReportPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white flex items-center justify-center">
        <div className="text-slate-500">加载中...</div>
      </div>
    }>
      <ReportContent />
    </Suspense>
  );
}
