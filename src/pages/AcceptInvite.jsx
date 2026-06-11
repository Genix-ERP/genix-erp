import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '@/components/contexts/AuthContext';
import { authService } from '@/api/services/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Lock, CheckCircle2, XCircle, Building2, User } from 'lucide-react';
import { readStoredBrandLogo, resolveBrandLogoUrl } from '@/utils/brandLogo';

export default function AcceptInvite() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [brandLogoUrl] = useState(() => resolveBrandLogoUrl(readStoredBrandLogo()));

  const [inviteInfo, setInviteInfo] = useState(null);
  const [isValidating, setIsValidating] = useState(true);
  const [isValid, setIsValid] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { setUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    validateToken();
  }, [token]);

  const validateToken = async () => {
    if (!token) {
      setIsValid(false);
      setIsValidating(false);
      return;
    }

    try {
      const result = await authService.validateInvite(token);
      if (result.valid) {
        setInviteInfo(result);
        setIsValid(true);
      } else {
        setIsValid(false);
      }
    } catch (err) {
      console.error('Failed to validate invite:', err);
      setIsValid(false);
    } finally {
      setIsValidating(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    setIsLoading(true);

    try {
      const result = await authService.acceptInvite(token, password);

      // Update auth context
      if (result.user) {
        setUser(result.user);
      }

      navigate('/');
    } catch (err) {
      console.error('Failed to accept invite:', err);
      setError(err.response?.data?.error?.message || 'Failed to set password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Loading state
  if (isValidating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <Card className="w-full max-w-md shadow-xl border-0 bg-white/90 backdrop-blur-xl">
          <CardContent className="pt-8 pb-8 text-center">
            <Loader2 className="h-12 w-12 animate-spin mx-auto text-[var(--genix-blue)]" />
            <p className="mt-4 text-slate-600">Validating invitation...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Invalid token state
  if (!isValid) {
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
          <CardContent className="pt-8 pb-8 text-center">
            <XCircle className="h-16 w-16 mx-auto text-red-500" />
            <h2 className="mt-4 text-xl font-semibold text-slate-800">Invalid Invitation</h2>
            <p className="mt-2 text-slate-600">
              This invitation link is invalid or has expired. Please contact your administrator for a new invitation.
            </p>
            <Link to="/login">
              <Button className="mt-6 bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]">
                Go to Login
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Valid token - show password form
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
            src={brandLogoUrl}
            alt="Genix Logo"
            className="h-20 w-auto object-contain mx-auto mb-4"
          />
          <CardTitle className="text-2xl font-bold text-[var(--genix-navy)]">
            Welcome to GenixERP
          </CardTitle>
          <CardDescription className="text-slate-500">
            Set your password to complete your account setup
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-4">
          {/* User Info */}
          <div className="mb-6 p-4 bg-slate-50 rounded-lg space-y-2">
            <div className="flex items-center text-slate-700">
              <User className="w-4 h-4 mr-2 text-[var(--genix-blue)]" />
              <span className="font-medium">{inviteInfo?.first_name} {inviteInfo?.last_name}</span>
            </div>
            <div className="flex items-center text-slate-600 text-sm">
              <Building2 className="w-4 h-4 mr-2 text-[var(--genix-purple)]" />
              <span>{inviteInfo?.tenant_name}</span>
            </div>
            <div className="text-slate-500 text-sm pl-6">
              {inviteInfo?.email}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive" className="bg-red-50 border-red-200">
                <AlertDescription className="text-red-700">
                  {error}
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-700">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  id="password"
                  type="password"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 h-11 bg-slate-50/50 border-slate-200 focus:ring-2 focus:ring-[var(--genix-blue)]/20 focus:border-[var(--genix-blue)]"
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
                  type="password"
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
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
                  Setting up account...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Complete Setup
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
