import type { Metadata } from 'next';
import { Inspector } from 'react-dev-inspector';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: '白癜风客服训练营',
    template: '%s | 白癜风客服训练营',
  },
  description: '专业白癜风医院客服入职训练系统，通过AI模拟对话和知识考核，提升客服专业能力。',
  keywords: ['白癜风', '客服培训', '医疗客服', '模拟对话', '入职培训'],
  authors: [{ name: '医疗培训系统' }],
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isDev = process.env.COZE_PROJECT_ENV === 'DEV';

  return (
    <html lang="zh-CN">
      <body className="antialiased bg-sky-50 min-h-screen">
        {isDev && <Inspector />}
        {children}
      </body>
    </html>
  );
}