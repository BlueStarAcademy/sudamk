import type { Metadata } from 'next';
import { ToastContainer } from '../components/common/toast';
import './globals.css';
import { TRPCProvider } from '../providers/trpc-provider';
import { Header } from '../components/layout/header';

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
      <body>
        <TRPCProvider>
          <Header />
          {children}
          <ToastContainer />
        </TRPCProvider>
      </body>
    </html>
  );
}

