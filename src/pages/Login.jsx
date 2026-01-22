import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/components/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Mail, Lock, Building2, ArrowLeft } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [tenants, setTenants] = useState(null);
  const [selectedTenantId, setSelectedTenantId] = useState(null);
  const { login, backendAvailable } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const result = await login(email, password, selectedTenantId);

    if (result.success) {
      navigate('/');
    } else if (result.tenantSelectionRequired) {
      // Show tenant selection UI
      setTenants(result.tenants);
      setError('');
    } else {
      setError(result.error);
    }

    setIsLoading(false);
  };

  const handleTenantSelect = async (tenantId) => {
    setSelectedTenantId(tenantId);
    setError('');
    setIsLoading(true);

    const result = await login(email, password, tenantId);

    if (result.success) {
      navigate('/');
    } else {
      setError(result.error);
    }

    setIsLoading(false);
  };

  const handleBackToLogin = () => {
    setTenants(null);
    setSelectedTenantId(null);
    setError('');
  };

  // Tenant selection screen
  if (tenants && tenants.length > 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <style>
          {`
            :root {
              --genix-navy: #0B1426;
              --genix-blue: #0EA5E9;
              --genix-light-blue: #E0F2FE;
              --genix-purple: #8B5CF6;
              --genix-green: #10B981;
            }
          `}
        </style>

        <Card className="w-full max-w-md shadow-xl border-0 bg-white/90 backdrop-blur-xl">
          <CardHeader className="text-center pb-2">
            <img
              src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68d244cb8a392237a5acfbd9/a049d6898_Logo.png"
              alt="Genix Logo"
              className="h-20 w-auto object-contain mx-auto mb-4"
            />
            <CardTitle className="text-2xl font-bold text-[var(--genix-navy)]">
              Select Company
            </CardTitle>
            <CardDescription className="text-slate-500">
              Your email is associated with multiple companies. Please select one to continue.
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-4">
            {error && (
              <Alert variant="destructive" className="bg-red-50 border-red-200 mb-4">
                <AlertDescription className="text-red-700">
                  {error}
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-3">
              {tenants.map((tenant) => (
                <Button
                  key={tenant.id}
                  variant="outline"
                  className="w-full h-auto py-4 px-4 justify-start hover:bg-[var(--genix-light-blue)] hover:border-[var(--genix-blue)] transition-all"
                  onClick={() => handleTenantSelect(tenant.id)}
                  disabled={isLoading}
                >
                  <Building2 className="w-5 h-5 mr-3 text-[var(--genix-blue)]" />
                  <div className="text-left">
                    <div className="font-medium text-slate-800">{tenant.name}</div>
                    <div className="text-xs text-slate-500">Code: {tenant.code}</div>
                  </div>
                </Button>
              ))}
            </div>

            <div className="mt-6">
              <Button
                variant="ghost"
                className="w-full text-slate-600"
                onClick={handleBackToLogin}
                disabled={isLoading}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Login
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Normal login screen
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <style>
        {`
          :root {
            --genix-navy: #0B1426;
            --genix-blue: #0EA5E9;
            --genix-light-blue: #E0F2FE;
            --genix-purple: #8B5CF6;
            --genix-green: #10B981;
          }
        `}
      </style>

      <Card className="w-full max-w-md shadow-xl border-0 bg-white/90 backdrop-blur-xl">
        <CardHeader className="text-center pb-2">
          <img
            src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68d244cb8a392237a5acfbd9/a049d6898_Logo.png"
            alt="Genix Logo"
            className="h-24 w-auto object-contain mx-auto mb-4"
          />
          <CardTitle className="text-2xl font-bold text-[var(--genix-navy)]">
            Welcome Back
          </CardTitle>
          <CardDescription className="text-slate-500">
            Sign in to your account to continue
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive" className="bg-red-50 border-red-200">
                <AlertDescription className="text-red-700">
                  {error}
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-700">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 h-11 bg-slate-50/50 border-slate-200 focus:ring-2 focus:ring-[var(--genix-blue)]/20 focus:border-[var(--genix-blue)]"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-700">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 h-11 bg-slate-50/50 border-slate-200 focus:ring-2 focus:ring-[var(--genix-blue)]/20 focus:border-[var(--genix-blue)]"
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-11 bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] hover:from-[var(--genix-blue)]/90 hover:to-[var(--genix-purple)]/90 text-white font-medium transition-all duration-200"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>

          {/* Register Link - only show when backend is available */}
          {backendAvailable && (
            <div className="mt-4 text-center">
              <p className="text-sm text-slate-600">
                Don't have an account?{' '}
                <Link
                  to="/register"
                  className="font-medium text-[var(--genix-blue)] hover:text-[var(--genix-purple)] transition-colors"
                >
                  Sign up
                </Link>
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
