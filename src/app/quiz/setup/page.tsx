'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  type ProjectType,
  PROJECT_OPTIONS,
  saveUserInfo,
  getUserInfo,
} from '@/lib/user-info';

export default function QuizSetupPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [project, setProject] = useState<ProjectType | ''>('');
  const [loading, setLoading] = useState(true);
  // 是否从训练营体系进入（提交后回 /camp）；知识考核独立入口默认回 /quiz
  const [fromCamp, setFromCamp] = useState(false);

  // 加载已保存的用户信息
  useEffect(() => {
    const info = getUserInfo();
    if (info) {
      setName(info.name);
      setProject(info.project);
    }
    setFromCamp(new URLSearchParams(window.location.search).get('from') === 'camp');
    setLoading(false);
  }, []);

  const handleSubmit = () => {
    if (!name.trim()) {
      alert('请输入姓名');
      return;
    }
    if (!project) {
      alert('请选择项目城市');
      return;
    }

    saveUserInfo({ name: name.trim(), project });
    router.push(fromCamp ? '/camp' : '/quiz');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white flex items-center justify-center">
        <div className="text-sky-600">加载中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white">
      {/* 头部 */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/')}
              className="text-sky-600 hover:text-sky-700"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-xl font-bold text-slate-800">
              {fromCamp ? '训练营身份填写' : '考核信息填写'}
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-sm p-6 md:p-8">
          {/* 姓名输入 */}
          <div className="mb-8">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              姓名 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="请输入您的姓名"
              className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none transition-all"
            />
          </div>

          {/* 项目选择 */}
          <div className="mb-8">
            <label className="block text-sm font-medium text-slate-700 mb-3">
              项目城市 <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              {PROJECT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setProject(opt.value)}
                  className={`
                    p-4 rounded-xl border-2 text-left transition-all
                    ${project === opt.value
                      ? 'border-sky-500 bg-sky-50'
                      : 'border-slate-200 hover:border-sky-300 hover:bg-sky-50/50'
                    }
                  `}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`
                      w-5 h-5 rounded-full border-2 flex items-center justify-center
                      ${project === opt.value ? 'border-sky-500' : 'border-slate-300'}
                    `}>
                      {project === opt.value && (
                        <div className="w-3 h-3 rounded-full bg-sky-500" />
                      )}
                    </div>
                    <span className="font-medium text-slate-800">{opt.label}</span>
                  </div>
                  <p className="text-xs text-slate-500 ml-7">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* 提交按钮 */}
          <button
            onClick={handleSubmit}
            disabled={!name.trim() || !project}
            className="w-full py-4 bg-sky-500 hover:bg-sky-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-all active:scale-[0.98]"
          >
            {fromCamp ? '进入训练营' : '开始考核'}
          </button>

          {/* 提示信息 */}
          <p className="mt-4 text-center text-xs text-slate-400">
            {fromCamp
              ? '填写信息后将进入训练营首页（姓名+城市即为你的学习身份）'
              : '填写信息后将进入考核章节列表'}
          </p>
        </div>
      </main>
    </div>
  );
}
