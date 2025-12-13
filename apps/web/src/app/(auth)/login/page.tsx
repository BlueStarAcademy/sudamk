/**
 * Login page
 */

import { LoginForm } from '../../components/auth/login-form.tsx';

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md space-y-8 rounded-lg border border-gray-200 p-8">
        <h1 className="text-2xl font-bold text-center">로그인</h1>
        <LoginForm />
      </div>
    </div>
  );
}

