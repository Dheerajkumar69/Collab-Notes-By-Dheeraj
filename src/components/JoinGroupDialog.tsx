import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface JoinGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const JoinGroupDialog = ({ open, onOpenChange, onSuccess }: JoinGroupDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [inviteCode, setInviteCode] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);

    // Email is derived server-side from auth.uid(); client value is ignored.
    const { data, error } = await supabase.rpc('join_group_with_code', {
      p_invite_code: inviteCode.toUpperCase(),
      p_user_email: '',
    });

    setLoading(false);

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    // Type assertion for the RPC response
    const result = data as { success: boolean; error?: string; group_name?: string; group_id?: string };

    if (result && !result.success) {
      toast({
        title: result.error === 'Already a member' ? 'Info' : 'Error',
        description: result.error === 'Already a member' 
          ? `You are already a member of ${result.group_name}`
          : result.error,
        variant: result.error === 'Already a member' ? 'default' : 'destructive',
      });
      return;
    }

    toast({
      title: 'Success',
      description: `Joined ${result.group_name} successfully`,
    });
    setInviteCode('');
    onOpenChange(false);
    onSuccess();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Join Group</DialogTitle>
          <DialogDescription>Enter a 6-character invite code to join a group</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="code">Invite Code</Label>
            <Input
              id="code"
              value={inviteCode}
              onChange={e => setInviteCode(e.target.value.toUpperCase())}
              placeholder="ABC123"
              maxLength={6}
              required
              className="uppercase text-center text-2xl tracking-wider"
            />
          </div>

          <Button type="submit" className="w-full bg-gradient-primary" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Joining...
              </>
            ) : (
              'Join Group'
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
