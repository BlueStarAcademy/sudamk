/**
 * Register page
 */

import { RegisterForm } from '@/components/auth/register-form';

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md space-y-8 rounded-lg border border-gray-200 p-8">
        <h1 className="text-2xl font-bold text-center">회원가입</h1>
        <RegisterForm />
      </div>
    </div>
  );
}

