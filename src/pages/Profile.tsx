import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { updateProfileSchema, UpdateProfileFormData } from '@/lib/validation';
import { SEOHead } from '@/components/SEOHead';
import { AvatarUpload } from '@/components/AvatarUpload';

export default function Profile() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [fullName, setFullName] = useState<string>('');

  const { register, handleSubmit, formState: { errors }, reset } = useForm<UpdateProfileFormData>({
    resolver: zodResolver(updateProfileSchema),
  });

  useEffect(() => {
    // Profile page is now protected by ProtectedRoute, 
    // so we don't need to check for user here
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      reset({
        fullName: data.full_name,
        email: data.email,
      });
      setFullName(data.full_name);
      setAvatarUrl((data as any).avatar_url || null);
    } catch (error: any) {
      console.error('Error fetching profile:', error);
      toast({
        title: 'Error',
        description: 'Failed to load profile',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: UpdateProfileFormData) => {
    if (!user) return;

    setSaving(true);

    try {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: data.fullName,
        })
        .eq('id', user.id);

      if (profileError) throw profileError;

      // Update auth user
      const { error: authError } = await supabase.auth.updateUser({
        email: data.email,
        data: {
          full_name: data.fullName,
        }
      });

      if (authError) throw authError;

      setFullName(data.fullName);
      toast({
        title: 'Success',
        description: 'Profile updated successfully',
      });
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update profile',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <SEOHead title="Profile" description="Manage your account settings and preferences." />
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Profile Settings</h1>
          <p className="text-muted-foreground">Manage your account settings</p>
        </div>

        {/* Avatar Section */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Profile Picture</CardTitle>
            <CardDescription>Upload a photo to personalize your profile</CardDescription>
          </CardHeader>
          <CardContent>
            <AvatarUpload
              currentAvatarUrl={avatarUrl}
              fullName={fullName}
              onUploadComplete={(url) => setAvatarUrl(url || null)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Profile Information</CardTitle>
            <CardDescription>Update your personal information</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div>
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  {...register('fullName')}
                />
                {errors.fullName && (
                  <p className="text-sm text-red-500 mt-1">{errors.fullName.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  {...register('email')}
                />
                {errors.email && (
                  <p className="text-sm text-red-500 mt-1">{errors.email.message}</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  Changing your email will require verification via the new email address.
                </p>
              </div>

              <div className="flex gap-4 pt-4">
                <Button type="submit" disabled={saving} className="bg-gradient-primary">
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Account Security</CardTitle>
            <CardDescription>Manage your account security settings</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h3 className="font-medium mb-2">Sign Out</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Sign out of your account on this device
                </p>
                <Button variant="outline" onClick={handleSignOut}>
                  Sign Out
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}