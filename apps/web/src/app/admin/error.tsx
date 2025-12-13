/**
 * Admin Page Error Boundary
 * 관리자 페이지에서 발생하는 에러를 처리합니다.
 */

'use client';

import { useEffect } from 'react';
import Link from 'next/link';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function AdminError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('Admin page error:', error);
  }, [error]);

  return (
    <div className="container mx-auto flex min-h-screen flex-col items-center justify-center p-8">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-lg">
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 rounded-full bg-red-100 p-4">
            <svg
              className="h-12 w-12 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          
          <h1 className="mb-2 text-2xl font-bold text-gray-900">
            관리자 페이지를 불러올 수 없습니다
          </h1>
          
          <p className="mb-6 text-gray-600">
            관리자 페이지를 불러오는 중 문제가 발생했습니다.
            관리자 권한이 있는지 확인하거나 잠시 후 다시 시도해주세요.
          </p>

          <div className="flex w-full flex-col gap-3">
            <button
              onClick={reset}
              className="w-full rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 transition-colors"
            >
              다시 시도
            </button>
            <Link
              href="/"
              className="w-full rounded-md bg-gray-600 px-4 py-2 text-center text-white hover:bg-gray-700 transition-colors"
            >
              홈으로 가기
            </Link>
          </div>

          {process.env.NODE_ENV === 'development' && (
            <details className="mt-6 w-full">
              <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
                개발자 정보 (개발 모드에서만 표시)
              </summary>
              <pre className="mt-2 max-h-48 overflow-auto rounded bg-gray-100 p-4 text-xs text-left">
                {error.message}
                {'\n\n'}
                {error.stack}
              </pre>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}

