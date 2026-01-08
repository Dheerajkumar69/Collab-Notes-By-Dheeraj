import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2, Mail, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading, signOut } = useAuth();
  const location = useLocation();
  const { toast } = useToast();
  const [resending, setResending] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // Check if email is verified
  const isEmailVerified = user.email_confirmed_at !== null;

  if (!isEmailVerified) {
    const handleResendVerification = async () => {
      setResending(true);
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: user.email!,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      });

      if (error) {
        toast({
          title: 'Error',
          description: error.message,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Email sent!',
          description: 'Check your inbox for the verification link.',
        });
      }
      setResending(false);
    };

    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-hero p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Mail className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Verify Your Email</CardTitle>
            <CardDescription>
              We sent a verification link to <strong>{user.email}</strong>.
              Please check your inbox and click the link to continue.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={handleResendVerification}
              className="w-full gap-2"
              disabled={resending}
            >
              {resending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Resend Verification Email
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={signOut}
              className="w-full"
            >
              Sign Out
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              Didn't receive the email? Check your spam folder or try resending.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}

