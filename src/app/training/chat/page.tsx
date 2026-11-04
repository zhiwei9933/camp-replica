'use client';

import { useState, useRef, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Send, StopCircle, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { trainingRounds } from '@/lib/training-rounds';
import { getUserInfo, PROJECT_NAMES, type ProjectType } from '@/lib/user-info';

interface Message {
  role: 'patient' | 'staff';
  content: string;
}

function ChatContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roundNumber = parseInt(searchParams.get('round') || '0', 10);
  const currentRound = trainingRounds.find(r => r.round === roundNumber);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [streamError, setStreamError] = useState('');
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'submitting' | 'success' | 'no_user' | 'error'>('idle');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Initialize conversation
  useEffect(() => {
    if (isInitialized) return;

    const initChat = async () => {
      try {
        const res = await fetch('/api/chat/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roundNumber: roundNumber || undefined, city: getUserInfo()?.project || undefined }),
        });
        const data = await res.json();
        if (data.success) {
          setMessages([{ role: 'patient', content: data.message }]);
          setIsInitialized(true);
        }
      } catch (err) {
        console.error('Failed to init chat:', err);
        setMessages([{ role: 'patient', content: '你好，我想咨询一下白癜风的问题。' }]);
        setIsInitialized(true);
      }
    };

    initChat();
  }, [roundNumber, isInitialized]);

  // Send message with streaming
  const sendMessage = useCallback(async () => {
    if (!input.trim() || isStreaming) return;

    const staffMessage = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'staff', content: staffMessage }]);
    setIsStreaming(true);
    setStreamError('');

    const allMessages = [...messages, { role: 'staff', content: staffMessage }];

    try {
      abortRef.current = new AbortController();

      // 整体超时：60秒
      const timeoutId = setTimeout(() => {
        if (abortRef.current) {
          abortRef.current.abort();
          setStreamError('响应超时，请重试');
        }
      }, 60000);

      const res = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: allMessages, roundNumber: roundNumber || undefined, city: getUserInfo()?.project || undefined }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: '服务异常' }));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      if (!res.body) throw new Error('No response body');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let patientReply = '';
      let receivedFirstChunk = false;

      setMessages((prev) => [...prev, { role: 'patient', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              // 检查是否有错误
              if (parsed.error) {
                setStreamError(parsed.error);
                break;
              }
              if (parsed.content) {
                receivedFirstChunk = true;
                patientReply += parsed.content;
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { role: 'patient', content: patientReply };
                  return updated;
                });
              }
            } catch {
              // skip parse errors
            }
          }
        }

        if (patientReply) {
          receivedFirstChunk = true;
        }
      }

      clearTimeout(timeoutId);

      // 如果没有收到任何内容且没有错误，提示超时
      if (!patientReply && !streamError) {
        setStreamError('未收到回复，请重试');
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error('Stream error:', err);
        setStreamError((err as Error).message || '连接失败，请重试');
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [input, isStreaming, messages, roundNumber, streamError]);

  // End training
  const handleEndTraining = useCallback(async () => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    setShowEndConfirm(false);
    setIsStreaming(true); // 复用 loading 状态

    try {
      // 先调用评分 API
      const res = await fetch('/api/chat/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, roundNumber: roundNumber || undefined, city: getUserInfo()?.project || undefined }),
      });
      const result = await res.json();

      if (result.totalScore !== undefined && result.dimensions) {
        // 转换 API 响应格式为报告页期望的格式
        // 新的 dimensions 结构：2个大块，每块含 items 数组
        const dimensions = result.dimensions || [];

        // 兼容旧的 dimensionScores 格式（用于 training_progress）
        const dimensionScores: Record<string, number> = {};
        if (dimensions.length > 0 && dimensions[0].block) {
          // 新格式：从 block 结构中提取
          for (const block of dimensions) {
            const blockKey = block.block === '疾病信息掌握度' ? 'disease' : 'sales';
            dimensionScores[blockKey] = Math.round((block.blockScore / block.blockMaxScore) * 100);
          }
        } else {
          // 旧格式兼容
          dimensions.forEach((d: { name: string; score: number }) => {
            dimensionScores[d.name] = d.score;
          });
        }

        // 2. 转换 inquiryReview 字段名
        const ir = result.inquiryReview || {};
        const inquiryReview = {
          questionsAsked: ir.askedQuestions || ir.questionsAsked || [],
          questionsMissed: ir.missedInfo || ir.questionsMissed || [],
          logicAssessment: ir.logicAssessment || '',
          depthAssessment: ir.depthAssessment || '',
        };

        // 3. 转换 materialAnalysis 字段名
        const ma = result.materialAnalysis || {};
        const materialAnalysis = {
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
            return item;
          }),
          missedWarnings: ma.missedWarnings || [],
        };

        // Debug: 确认 evaluate API 返回的 improvements 和 suggestions 是否不同
        console.log('[Training] evaluate result - improvements:', result.improvements, 'suggestions:', result.suggestions);

        const evaluationResult = {
          totalScore: result.totalScore,
          dimensions,
          dimensionScores,
          strengths: result.strengths || [],
          weaknesses: result.improvements || [],
          suggestions: result.suggestions || result.improvements || [],
          inquiryReview,
          materialAnalysis,
          excellentReplies: result.excellentReplies || [],
          workflowCheck: result.workflowCheck || null,
          roundNumber: roundNumber || null,
          roundTitle: currentRound?.title || null,
        };

        // 将评分结果存入 sessionStorage（供报告页读取）
        sessionStorage.setItem('evaluationResult', JSON.stringify(evaluationResult));

        // 如果有轮次信息，同时存入训练进度 localStorage
        if (roundNumber) {
          try {
            // 1. 更新 training_progress（仅分数和进度信息）
            const progressKey = 'training_progress';
            const existingProgress = JSON.parse(localStorage.getItem(progressKey) || '[]');
            const entry = {
              round: roundNumber,
              title: currentRound?.title || `第${roundNumber}轮`,
              score: result.totalScore,
              date: new Date().toISOString().split('T')[0],
              passed: result.totalScore >= 70,
              dimensionScores,
            };
            const idx = existingProgress.findIndex((p: { round: number }) => p.round === roundNumber);
            if (idx >= 0) {
              existingProgress[idx] = entry;
            } else {
              existingProgress.push(entry);
            }
            existingProgress.sort((a: { round: number }, b: { round: number }) => a.round - b.round);
            localStorage.setItem(progressKey, JSON.stringify(existingProgress));

            // 2. 更新 training_reports（完整报告数据，供二次查看）
            const reportsKey = 'training_reports';
            const existingReports = JSON.parse(localStorage.getItem(reportsKey) || '[]');
            const reportEntry = {
              round: roundNumber,
              title: currentRound?.title || `第${roundNumber}轮`,
              totalScore: result.totalScore,
              dimensions,
              strengths: result.strengths || [],
              improvements: result.improvements || [],
              suggestions: result.suggestions || result.improvements || [],
              excellentReplies: result.excellentReplies || [],
              inquiryReview: result.inquiryReview || { askedQuestions: [], missedInfo: [], logicAssessment: '', depthAssessment: '' },
              materialAnalysis: result.materialAnalysis || { usedMaterials: [], suggestedMaterials: [], keyTiming: [], missedWarnings: [] },
              workflowCheck: result.workflowCheck || null,
              dimensionScores,
              date: new Date().toISOString().split('T')[0],
            };
            const rIdx = existingReports.findIndex((r: { round: number }) => r.round === roundNumber);
            if (rIdx >= 0) {
              existingReports[rIdx] = reportEntry;
            } else {
              existingReports.push(reportEntry);
            }
            localStorage.setItem(reportsKey, JSON.stringify(existingReports));

            // 3. 提交训练成绩到后台（防止重复提交）
            const submitFlagKey = `training_submitted_${roundNumber}`;
            if (!sessionStorage.getItem(submitFlagKey)) {
              setSubmitStatus('submitting');
              try {
                const info = getUserInfo();
                if (info) {
                  const submitData = {
                    staffName: info.name,
                    city: PROJECT_NAMES[info.project as ProjectType] || info.project,
                    roundNumber,
                    roundTitle: currentRound?.title || `第${roundNumber}轮`,
                    totalScore: result.totalScore,
                    dimensionScores,
                    coachingPoints: result.suggestions || result.improvements || [],
                    dialogues: messages.map(m => ({ role: m.role, content: m.content })),
                    submittedAt: new Date().toISOString(),
                  };
                  console.log('[Training] 提交成绩数据:', submitData);
                  const submitRes = await fetch('/api/training/submit-result', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(submitData),
                  });
                  const submitJson = await submitRes.json();
                  console.log('[Training] 提交成绩响应:', submitJson);
                  if (submitJson.success) {
                    sessionStorage.setItem(submitFlagKey, '1');
                    setSubmitStatus('success');
                  } else {
                    console.error('[Training] 提交失败:', submitJson.error);
                    setSubmitStatus('error');
                  }
                } else {
                  console.warn('[Training] 用户信息不存在，跳过成绩提交');
                  setSubmitStatus('no_user');
                }
              } catch (submitErr) {
                console.error('[Training] 成绩提交异常:', submitErr);
                setSubmitStatus('error');
              }
            } else {
              console.log('[Training] 本轮已提交过，跳过重复提交');
              setSubmitStatus('success');
            }
          } catch (e) {
            console.error('Failed to save training progress:', e);
          }
        }

        router.push(`/training/report?round=${roundNumber || ''}`);
      } else {
        console.error('Evaluation failed:', result);
        setStreamError('评分失败，请重试');
        setIsStreaming(false);
      }
    } catch (err) {
      console.error('Evaluation error:', err);
      setStreamError('评分请求失败，请重试');
      setIsStreaming(false);
    }
  }, [messages, router, roundNumber, currentRound]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="h-screen flex flex-col bg-sky-50/50">
      {/* Header */}
      <header className="bg-white border-b border-sky-100 flex-shrink-0">
        <div className="max-w-[1200px] mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/training')} className="p-2 -ml-2 rounded-lg hover:bg-sky-50">
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <div>
              <h1 className="text-sm font-bold text-slate-800">
                {currentRound ? `第${roundNumber}轮：${currentRound.title}` : '模拟对话训练'}
              </h1>
              <p className="text-xs text-slate-400">
                {currentRound ? `考察重点：${currentRound.focus}` : 'AI模拟真实患者，请通过问诊了解病情'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowEndConfirm(true)}
            disabled={isStreaming}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 text-red-500 text-xs font-medium hover:bg-red-100 disabled:opacity-40 transition-all"
          >
            <StopCircle className="w-3.5 h-3.5" />
            结束训练
          </button>
        </div>
      </header>

      {/* Submit Status Banner */}
      {submitStatus === 'success' && (
        <div className="max-w-2xl mx-auto w-full px-4 pt-2">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 border border-green-100">
            <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
            <span className="text-xs text-green-700">成绩已成功提交到管理后台</span>
          </div>
        </div>
      )}
      {submitStatus === 'no_user' && (
        <div className="max-w-2xl mx-auto w-full px-4 pt-2">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-100">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <span className="text-xs text-red-600 flex-1">
              成绩提交失败：未填写个人信息。请先前往
              <button onClick={() => router.push('/quiz/setup')} className="underline font-medium">个人信息页</button>
              填写姓名和项目
            </span>
          </div>
        </div>
      )}
      {submitStatus === 'error' && (
        <div className="max-w-2xl mx-auto w-full px-4 pt-2">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-100">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <span className="text-xs text-red-600">成绩提交失败，请联系管理员或稍后重试</span>
          </div>
        </div>
      )}

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`flex ${msg.role === 'staff' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === 'staff'
                    ? 'bg-sky-500 text-white rounded-br-md'
                    : 'bg-white border border-sky-100 text-slate-700 rounded-bl-md'
                }`}
              >
                {msg.content || (
                  <span className="flex items-center gap-1">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    正在输入...
                  </span>
                )}
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="bg-white border-t border-sky-100 flex-shrink-0">
        {/* Error message */}
        {streamError && (
          <div className="max-w-2xl mx-auto px-4 pt-3">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-100">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <span className="text-xs text-red-600 flex-1">{streamError}</span>
              <button
                onClick={() => setStreamError('')}
                className="text-xs text-red-500 hover:text-red-700 font-medium flex-shrink-0"
              >
                关闭
              </button>
            </div>
          </div>
        )}
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入你的回复..."
              rows={1}
              className="flex-1 resize-none rounded-xl border border-sky-200 px-4 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400 transition-all"
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || isStreaming}
              className="w-10 h-10 rounded-xl bg-sky-500 text-white flex items-center justify-center hover:bg-sky-600 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.95] transition-all flex-shrink-0"
            >
              {isStreaming ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* End Training Confirm Modal */}
      {showEndConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <h3 className="text-base font-bold text-slate-800 mb-2">确认结束训练？</h3>
            <p className="text-sm text-slate-500 mb-6">
              结束后将根据你的对话表现生成评分报告。
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowEndConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border border-sky-200 text-sky-600 text-sm font-medium hover:bg-sky-50 active:scale-[0.98] transition-all"
              >
                继续训练
              </button>
              <button
                onClick={handleEndTraining}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 active:scale-[0.98] transition-all"
              >
                结束并评分
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-sky-50 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-sky-500" /></div>}>
      <ChatContent />
    </Suspense>
  );
}
