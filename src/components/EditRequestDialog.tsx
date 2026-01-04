import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import type { Note } from '@/types';

interface EditRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  note: Note;
  onSuccess: () => void;
}

export function EditRequestDialog({
  open,
  onOpenChange,
  note,
  onSuccess,
}: EditRequestDialogProps) {
  const { user } = useAuth();
  const [proposedTitle, setProposedTitle] = useState(note.title);
  const [proposedContent, setProposedContent] = useState(note.content || '');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!message.trim()) {
      toast({
        title: 'Error',
        description: 'Please provide a message explaining your changes',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmitting(true);

      const { data: profile } = await supabase
        .from('profiles')
        .select('email, full_name')
        .eq('id', user?.id)
        .single();

      const editRequests = note.edit_requests || [];
      const newRequest = {
        id: crypto.randomUUID(),
        status: 'pending',
        requester_email: profile?.email,
        requester_name: profile?.full_name,
        message,
        proposed_title: proposedTitle,
        proposed_content: proposedContent,
        created_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('notes')
        .update({ edit_requests: JSON.parse(JSON.stringify([...editRequests, newRequest])) })
        .eq('id', note.id);

      if (error) throw error;

      // Create notification for note creator
      const { data: creatorProfile } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', note.created_by)
        .single();

      if (creatorProfile) {
        await supabase.rpc('create_notification', {
          p_recipient_email: creatorProfile.email,
          p_message: `${profile?.full_name} requested to edit your note "${note.title}"`,
          p_link: `/group/${note.group_id}`,
        });
      }

      toast({
        title: 'Success',
        description: 'Edit request sent',
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error submitting edit request:', error);
      toast({
        title: 'Error',
        description: 'Failed to send edit request',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Request Edit</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Current Title</Label>
            <Input value={note.title} disabled className="bg-muted" />
          </div>

          <div>
            <Label>Proposed Title</Label>
            <Input
              value={proposedTitle}
              onChange={e => setProposedTitle(e.target.value)}
              placeholder="Proposed title"
            />
          </div>

          <div>
            <Label>Current Content</Label>
            <Textarea
              value={note.content || 'No content'}
              disabled
              className="bg-muted"
              rows={4}
            />
          </div>

          <div>
            <Label>Proposed Content</Label>
            <Textarea
              value={proposedContent}
              onChange={e => setProposedContent(e.target.value)}
              placeholder="Proposed content"
              rows={4}
            />
          </div>

          <div>
            <Label>Message *</Label>
            <Textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Explain why you want to make these changes..."
              rows={3}
            />
          </div>

          <div className="flex gap-2 justify-end pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
            >
              {submitting ? 'Sending...' : 'Send Request'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
