import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/lib/auth';
import { LoginForm } from '@/components/auth/login-form';

export default function Login() {
  const [, navigate] = useLocation();
  const { isAuthenticated, loading } = useAuth();
  
  useEffect(() => {
    // Redirect to dashboard if already authenticated
    if (isAuthenticated && !loading) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, loading, navigate]);
  
  // Don't render anything while checking authentication
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }
  
  // Skip rendering if redirecting
  if (isAuthenticated) {
    return null;
  }
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f5f5] py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 bg-primary rounded-full flex items-center justify-center text-white">
            <span className="text-xl font-bold">P</span>
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">PayrollPro</h2>
          <p className="mt-2 text-sm text-gray-600">
            Employee Payroll Management System
          </p>
        </div>
        
        <LoginForm />
      </div>
    </div>
  );
}
