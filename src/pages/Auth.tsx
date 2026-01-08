import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { signInSchema, signUpSchema, SignInFormData, SignUpFormData } from '@/lib/validation';
import { supabase } from '@/integrations/supabase/client';
import { SEOHead } from '@/components/SEOHead';
import { PasswordStrengthIndicator } from '@/components/PasswordStrengthIndicator';
import logo from '@/assets/collabnotes-logo.png';

export default function Auth() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, signUp, user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('signin');
  const [passwordValue, setPasswordValue] = useState('');

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard';

  const { register: registerSignIn, handleSubmit: handleSignInSubmit, formState: { errors: signInErrors } } = useForm<SignInFormData>({
    resolver: zodResolver(signInSchema),
  });

  const { register: registerSignUp, handleSubmit: handleSignUpSubmit, formState: { errors: signUpErrors } } = useForm<SignUpFormData>({
    resolver: zodResolver(signUpSchema),
  });

  const { register: registerForgot, handleSubmit: handleForgotSubmit, formState: { errors: forgotErrors }, reset: resetForgot } = useForm<{ email: string }>({
    resolver: zodResolver(signInSchema.pick({ email: true })),
  });

  useEffect(() => {
    if (!authLoading && user) {
      navigate(from, { replace: true });
    }
  }, [user, authLoading, navigate, from]);

  // Show loading while checking auth state
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-hero">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  const handleSignIn = async (data: SignInFormData) => {
    setIsLoading(true);

    const { error } = await signIn(data.email, data.password);

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Success',
        description: 'Signed in successfully',
      });
      navigate(from, { replace: true });
    }

    setIsLoading(false);
  };

  const handleSignUp = async (data: SignUpFormData) => {
    setIsLoading(true);

    const { error } = await signUp(data.email, data.password, data.fullName);

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: '📧 Check your email!',
        description: 'We sent you a verification link. Please verify your email to continue.',
      });
      // Don't navigate immediately - let user verify email first
      // The verification link will redirect them to dashboard
    }

    setIsLoading(false);
  };

  const handleForgotPassword = async (data: { email: string }) => {
    setIsLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${window.location.origin}/auth`,
    });

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Success',
        description: 'Password reset email sent. Check your inbox.',
      });
      resetForgot();
    }

    setIsLoading(false);
  };

  return (
    <>
      <SEOHead title="Sign In" description="Sign in or create an account to access CollabNotes." />
      <div className="min-h-screen flex items-center justify-center bg-gradient-hero p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <img src={logo} alt="CollabNotes" className="h-10 w-10 rounded-full object-cover" />
              <CardTitle className="text-2xl">CollabNotes</CardTitle>
            </div>
            <CardDescription>Sign in or create an account to get started</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="signin">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
                <TabsTrigger value="forgot">Forgot Password</TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <form onSubmit={handleSignInSubmit(handleSignIn)} className="space-y-4">
                  <div>
                    <Label htmlFor="signin-email">Email</Label>
                    <Input
                      id="signin-email"
                      type="email"
                      placeholder="you@example.com"
                      {...registerSignIn('email')}
                    />
                    {signInErrors.email && (
                      <p className="text-sm text-red-500 mt-1">{signInErrors.email.message}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="signin-password">Password</Label>
                    <Input
                      id="signin-password"
                      type="password"
                      {...registerSignIn('password')}
                    />
                    {signInErrors.password && (
                      <p className="text-sm text-red-500 mt-1">{signInErrors.password.message}</p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="link"
                    className="p-0 h-auto text-sm"
                    onClick={() => setActiveTab('forgot')}
                  >
                    Forgot password?
                  </Button>
                  <Button type="submit" className="w-full bg-gradient-primary" disabled={isLoading}>
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
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignUpSubmit(handleSignUp)} className="space-y-4">
                  <div>
                    <Label htmlFor="signup-name">Full Name</Label>
                    <Input
                      id="signup-name"
                      type="text"
                      placeholder="John Doe"
                      {...registerSignUp('fullName')}
                    />
                    {signUpErrors.fullName && (
                      <p className="text-sm text-red-500 mt-1">{signUpErrors.fullName.message}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="you@example.com"
                      {...registerSignUp('email')}
                    />
                    {signUpErrors.email && (
                      <p className="text-sm text-red-500 mt-1">{signUpErrors.email.message}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="signup-password">Password</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      {...registerSignUp('password', {
                        onChange: (e) => setPasswordValue(e.target.value),
                      })}
                    />
                    <PasswordStrengthIndicator password={passwordValue} />
                    {signUpErrors.password && (
                      <p className="text-sm text-destructive mt-1">{signUpErrors.password.message}</p>
                    )}
                  </div>
                  <Button type="submit" className="w-full bg-gradient-primary" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating account...
                      </>
                    ) : (
                      'Sign Up'
                    )}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="forgot">
                <form onSubmit={handleForgotSubmit(handleForgotPassword)} className="space-y-4">
                  <div>
                    <Label htmlFor="forgot-email">Email</Label>
                    <Input
                      id="forgot-email"
                      type="email"
                      placeholder="you@example.com"
                      {...registerForgot('email')}
                    />
                    {forgotErrors.email && (
                      <p className="text-sm text-red-500 mt-1">{forgotErrors.email.message}</p>
                    )}
                  </div>
                  <Button type="submit" className="w-full bg-gradient-primary" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      'Send Reset Link'
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="link"
                    className="p-0 h-auto text-sm w-full"
                    onClick={() => setActiveTab('signin')}
                  >
                    Back to Sign In
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
        <div className="absolute bottom-4 text-center w-full">
          <div className="flex justify-center gap-4 text-xs text-muted-foreground">
            <Link to="/terms" className="hover:text-foreground">Terms</Link>
            <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link to="/help" className="hover:text-foreground">Help</Link>
          </div>
        </div>
      </div>
    </>
  );
}