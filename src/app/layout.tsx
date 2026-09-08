import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';

export const metadata: Metadata = {
  title: '통합검색',
  description: 'Jira, Confluence, Google Drive 통합 검색 포털',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full" suppressHydrationWarning>
      <body className="h-full">
        <Script id="theme-init" strategy="beforeInteractive">{`
          try {
            var preference = localStorage.getItem('erp-console-theme') || 'system';
            var dark = preference === 'dark' || (preference === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
            document.documentElement.dataset.theme = dark ? 'dark' : 'light';
            document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
          } catch (_) {}
        `}</Script>
        {children}
      </body>
    </html>
  );
}
