import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SUDAM - 바둑 게임 플랫폼',
  description: 'SUDAM v2 - Supreme Universe of Dueling Ascending Masters',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}

