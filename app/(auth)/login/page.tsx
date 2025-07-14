'use client'
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AppContext';
import { SiWebmoney } from 'react-icons/si';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const success = await login(email, password);
      if (success) {
        router.push('/dashboard');
      } else {
        setError('Invalid credentials');
      }
    } catch (err) {
      setError('Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-orange-50 flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="max-w-md w-full space-y-6 sm:space-y-8">
        <form onSubmit={handleSubmit} className="mt-6 sm:mt-8 space-y-4 sm:space-y-6 bg-white p-6 sm:p-8 rounded-lg shadow-lg">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 sm:px-4 py-2 sm:py-3 rounded-md text-sm">
              {error}
            </div>
          )}

          <div className="text-center mb-6 sm:mb-9">
            <div className="flex items-center justify-center space-x-2 mb-4">
              <SiWebmoney className="text-2xl sm:text-3xl text-black-600" />
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">BillBuzz</h1>
            </div>
            <h2 className="text-lg sm:text-xl text-gray-600">Sign in to your account</h2>
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email address *
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="block w-full px-3 py-2 sm:py-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-gray-500 text-sm sm:text-base"
              placeholder="Enter your email"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password *
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="block w-full px-3 py-2 sm:py-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-gray-500 text-sm sm:text-base"
              placeholder="Enter your password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full primary-button py-3 sm:py-4 text-base sm:text-lg font-semibold disabled:opacity-50 mt-6"
          >
            {loading ? 'Signing in...' : 'Log In'}
          </button>

          <div className="text-center pt-2">
            <span className="text-gray-600 text-sm sm:text-base">Don't have an account? </span>
            <Link href="/signup" className="text-[#da8700] hover:text-[#ffb53d] font-medium text-sm sm:text-base">
              Sign up
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}