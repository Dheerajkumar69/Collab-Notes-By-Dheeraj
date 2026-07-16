import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Sparkles,
  Users,
  Mail,
  ArrowRight,
  ArrowLeft,
  Check,
  Loader2,
  PartyPopper,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type Step = 0 | 1 | 2 | 3;

const colors = [
  { name: 'blue', gradient: 'linear-gradient(135deg,#3b82f6,#2563eb)' },
  { name: 'purple', gradient: 'linear-gradient(135deg,#a855f7,#9333ea)' },
  { name: 'green', gradient: 'linear-gradient(135deg,#22c55e,#16a34a)' },
  { name: 'orange', gradient: 'linear-gradient(135deg,#f97316,#ea580c)' },
  { name: 'pink', gradient: 'linear-gradient(135deg,#ec4899,#db2777)' },
  { name: 'indigo', gradient: 'linear-gradient(135deg,#6366f1,#4f46e5)' },
];

function randomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export default function Onboarding() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>(0);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'create' | 'join'>('create');

  // Create-group fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('blue');

  // Join fields
  const [inviteCode, setInviteCode] = useState('');

  // Invite step
  const [inviteEmails, setInviteEmails] = useState('');
  const [createdGroup, setCreatedGroup] = useState<{ id: string; name: string; code?: string } | null>(null);

  // Skip onboarding if the user already completed it or already has a group
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) return;
      const [{ data: profile }, { data: groups }] = await Promise.all([
        supabase.from('profiles').select('onboarded_at, email').eq('id', user.id).single(),
        supabase.from('groups').select('id').limit(1),
      ]);
      if (cancelled) return;
      if (profile?.onboarded_at || (groups && groups.length > 0)) {
        navigate('/dashboard', { replace: true });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, navigate]);

  const finish = async (redirectTo?: string) => {
    if (user) {
      await supabase
        .from('profiles')
        .update({ onboarded_at: new Date().toISOString() })
        .eq('id', user.id);
    }
    navigate(redirectTo ?? '/dashboard', { replace: true });
  };

  const handleCreateGroup = async () => {
    if (!user || !name.trim()) return;
    setLoading(true);
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', user.id)
        .single();
      if (!profile) throw new Error('Profile not found');

      const code = randomCode();
      const { data: g, error } = await supabase
        .from('groups')
        .insert({
          name: name.trim(),
          description: description.trim(),
          color,
          members: [profile.email],
          created_by: user.id,
        })
        .select('id, name')
        .single();
      if (error) throw error;

      await supabase.from('group_invite_codes').insert({ group_id: g.id, invite_code: code });
      setCreatedGroup({ id: g.id, name: g.name, code });
      setStep(2);
    } catch (e) {
      toast({
        title: "Couldn't create group",
        description: e instanceof Error ? e.message : 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!inviteCode.trim()) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('join_group_with_code', {
        p_invite_code: inviteCode.trim(),
      });
      if (error) throw error;
      const res = data as { success: boolean; group_id?: string; group_name?: string; error?: string };
      if (!res.success) throw new Error(res.error || 'Invalid invite code');
      setCreatedGroup({ id: res.group_id!, name: res.group_name || 'Group' });
      setStep(3);
    } catch (e) {
      toast({
        title: "Couldn't join group",
        description: e instanceof Error ? e.message : 'Please check the invite code',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async () => {
    if (!createdGroup || !inviteEmails.trim()) {
      setStep(3);
      return;
    }
    const emails = inviteEmails
      .split(/[\s,;]+/)
      .map((e) => e.trim().toLowerCase())
      .filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));

    if (emails.length === 0) {
      setStep(3);
      return;
    }

    setLoading(true);
    // Send a notification for each invitee that has an account; ignore others silently.
    for (const email of emails) {
      await supabase.rpc('create_notification', {
        p_recipient_email: email,
        p_message: `You were invited to join "${createdGroup.name}". Use code ${createdGroup.code ?? ''} to join.`,
        p_link: '/dashboard',
      });
    }
    setLoading(false);
    toast({ title: 'Invites sent', description: `Notified ${emails.length} teammate(s).` });
    setStep(3);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      <Card className="w-full max-w-xl p-8 shadow-xl">
        {/* Progress */}
        <div className="flex items-center gap-2 mb-6">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={cn(
                'h-1.5 flex-1 rounded-full transition-colors',
                i <= step ? 'bg-primary' : 'bg-muted'
              )}
            />
          ))}
        </div>

        {step === 0 && (
          <div className="text-center space-y-4">
            <div className="mx-auto h-16 w-16 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
              <Sparkles className="text-primary-foreground" size={32} />
            </div>
            <h1 className="text-2xl font-bold">Welcome to CollabNotes</h1>
            <p className="text-muted-foreground">
              Take notes together in real time, share ideas, and stay in sync with your team. Let's
              get you set up in under a minute.
            </p>
            <div className="flex gap-2 justify-center pt-4">
              <Button variant="ghost" onClick={() => finish()}>
                Skip for now
              </Button>
              <Button onClick={() => setStep(1)} className="gap-2">
                Get started <ArrowRight size={16} />
              </Button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold">Start collaborating</h2>
              <p className="text-sm text-muted-foreground">
                Create your first workspace or join an existing one.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setMode('create')}
                className={cn(
                  'flex-1 rounded-lg border p-4 text-left transition-all',
                  mode === 'create' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
                )}
              >
                <Users size={18} className="mb-2 text-primary" />
                <div className="font-medium text-sm">Create a group</div>
                <div className="text-xs text-muted-foreground">Start fresh with your team</div>
              </button>
              <button
                onClick={() => setMode('join')}
                className={cn(
                  'flex-1 rounded-lg border p-4 text-left transition-all',
                  mode === 'join' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
                )}
              >
                <Mail size={18} className="mb-2 text-primary" />
                <div className="font-medium text-sm">Join with a code</div>
                <div className="text-xs text-muted-foreground">Got an invite? Enter it here</div>
              </button>
            </div>

            {mode === 'create' ? (
              <div className="space-y-3">
                <div>
                  <Label htmlFor="group-name">Group name</Label>
                  <Input
                    id="group-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Design Team, CS 101, Product…"
                    autoFocus
                  />
                </div>
                <div>
                  <Label htmlFor="group-desc">Description (optional)</Label>
                  <Textarea
                    id="group-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                    placeholder="What's this group about?"
                  />
                </div>
                <div>
                  <Label>Color</Label>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {colors.map((c) => (
                      <button
                        key={c.name}
                        type="button"
                        onClick={() => setColor(c.name)}
                        style={{ background: c.gradient }}
                        className={cn(
                          'h-9 w-9 rounded-lg border-2 transition-all',
                          color === c.name
                            ? 'border-primary ring-2 ring-primary/40'
                            : 'border-transparent hover:scale-105'
                        )}
                        aria-label={c.name}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <Label htmlFor="invite-code">Invite code</Label>
                <Input
                  id="invite-code"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  placeholder="ABC123"
                  maxLength={12}
                  className="uppercase tracking-widest text-center font-mono"
                  autoFocus
                />
              </div>
            )}

            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={() => setStep(0)} className="gap-2">
                <ArrowLeft size={16} /> Back
              </Button>
              <Button
                onClick={mode === 'create' ? handleCreateGroup : handleJoin}
                disabled={loading || (mode === 'create' ? !name.trim() : !inviteCode.trim())}
                className="gap-2"
              >
                {loading && <Loader2 size={16} className="animate-spin" />}
                {mode === 'create' ? 'Create group' : 'Join'}
                {!loading && <ArrowRight size={16} />}
              </Button>
            </div>
          </div>
        )}

        {step === 2 && createdGroup && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold">Invite your team</h2>
              <p className="text-sm text-muted-foreground">
                Share the invite code, or add teammates by email. You can always do this later.
              </p>
            </div>

            {createdGroup.code && (
              <div className="rounded-lg border border-dashed p-4 text-center bg-muted/40">
                <div className="text-xs text-muted-foreground mb-1">Invite code</div>
                <div className="font-mono text-2xl font-bold tracking-widest">
                  {createdGroup.code}
                </div>
                <Button
                  variant="link"
                  size="sm"
                  className="mt-1"
                  onClick={() => {
                    navigator.clipboard.writeText(createdGroup.code!);
                    toast({ title: 'Copied', description: 'Invite code copied to clipboard' });
                  }}
                >
                  Copy code
                </Button>
              </div>
            )}

            <div>
              <Label htmlFor="invite-emails">Emails (comma or space separated)</Label>
              <Textarea
                id="invite-emails"
                value={inviteEmails}
                onChange={(e) => setInviteEmails(e.target.value)}
                rows={3}
                placeholder="alice@team.com, bob@team.com"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Only teammates already on CollabNotes will be notified. Others should use the code
                above.
              </p>
            </div>

            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={() => setStep(3)}>
                Skip
              </Button>
              <Button onClick={handleInvite} disabled={loading} className="gap-2">
                {loading && <Loader2 size={16} className="animate-spin" />}
                Send invites <ArrowRight size={16} />
              </Button>
            </div>
          </div>
        )}

        {step === 3 && createdGroup && (
          <div className="text-center space-y-4">
            <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <PartyPopper className="text-primary" size={32} />
            </div>
            <h2 className="text-2xl font-bold">You're all set</h2>
            <p className="text-muted-foreground">
              Welcome to <Badge variant="secondary">{createdGroup.name}</Badge>. Start taking notes
              or invite more teammates any time from the group page.
            </p>
            <div className="flex gap-2 justify-center pt-4">
              <Button variant="outline" onClick={() => finish()} className="gap-2">
                Go to dashboard
              </Button>
              <Button
                onClick={() => finish(`/group/${createdGroup.id}`)}
                className="gap-2"
              >
                <Check size={16} /> Open group
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}