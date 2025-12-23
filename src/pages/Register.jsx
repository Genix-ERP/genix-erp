import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/components/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Mail, Lock, User, Building2, ArrowLeft } from 'lucide-react';

export default function Register() {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    companyName: '',
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { register, backendAvailable } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    setIsLoading(true);

    const result = await register({
      firstName: formData.firstName,
      lastName: formData.lastName,
      email: formData.email,
      password: formData.password,
      companyName: formData.companyName,
    });

    if (result.success) {
      navigate('/');
    } else {
      setError(result.error);
    }

    setIsLoading(false);
  };

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
            Create Account
          </CardTitle>
          <CardDescription className="text-slate-500">
            {backendAvailable
              ? 'Sign up to get started with GenixERP'
              : 'Demo mode - registration will be local only'
            }
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

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="firstName" className="text-slate-700">First Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    id="firstName"
                    name="firstName"
                    type="text"
                    placeholder="John"
                    value={formData.firstName}
                    onChange={handleChange}
                    className="pl-10 h-10 bg-slate-50/50 border-slate-200 focus:ring-2 focus:ring-[var(--genix-blue)]/20 focus:border-[var(--genix-blue)]"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName" className="text-slate-700">Last Name</Label>
                <Input
                  id="lastName"
                  name="lastName"
                  type="text"
                  placeholder="Doe"
                  value={formData.lastName}
                  onChange={handleChange}
                  className="h-10 bg-slate-50/50 border-slate-200 focus:ring-2 focus:ring-[var(--genix-blue)]/20 focus:border-[var(--genix-blue)]"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-700">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="john@company.com"
                  value={formData.email}
                  onChange={handleChange}
                  className="pl-10 h-10 bg-slate-50/50 border-slate-200 focus:ring-2 focus:ring-[var(--genix-blue)]/20 focus:border-[var(--genix-blue)]"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="companyName" className="text-slate-700">Company Name</Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  id="companyName"
                  name="companyName"
                  type="text"
                  placeholder="Your Company Inc."
                  value={formData.companyName}
                  onChange={handleChange}
                  className="pl-10 h-10 bg-slate-50/50 border-slate-200 focus:ring-2 focus:ring-[var(--genix-blue)]/20 focus:border-[var(--genix-blue)]"
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
                  name="password"
                  type="password"
                  placeholder="At least 8 characters"
                  value={formData.password}
                  onChange={handleChange}
                  className="pl-10 h-10 bg-slate-50/50 border-slate-200 focus:ring-2 focus:ring-[var(--genix-blue)]/20 focus:border-[var(--genix-blue)]"
                  required
                  minLength={8}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-slate-700">Confirm Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  placeholder="Confirm your password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="pl-10 h-10 bg-slate-50/50 border-slate-200 focus:ring-2 focus:ring-[var(--genix-blue)]/20 focus:border-[var(--genix-blue)]"
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
                  Creating account...
                </>
              ) : (
                'Create Account'
              )}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <Link
              to="/login"
              className="inline-flex items-center text-sm text-slate-600 hover:text-[var(--genix-blue)] transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to Sign In
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
