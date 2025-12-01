import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info, CheckCircle, XCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface EditRequestsPanelProps {
  notes: any[];
  onReview: () => void;
}

export function EditRequestsPanel({ notes, onReview }: EditRequestsPanelProps) {
  const [selectedNote, setSelectedNote] = useState<any>(null);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);

  const handleApprove = async () => {
    if (!selectedNote || !selectedRequest) return;

    try {
      const editRequests = selectedNote.edit_requests.map((req: any) =>
        req.id === selectedRequest.id ? { ...req, status: 'approved' } : req
      );

      const { error } = await supabase
        .from('notes')
        .update({
          title: selectedRequest.proposed_title,
          content: selectedRequest.proposed_content,
          edit_requests: editRequests,
        })
        .eq('id', selectedNote.id);

      if (error) throw error;

      // Create notification using secure function
      // Get requester user_id from email
      const { data: requesterProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', selectedRequest.requester_email)
        .single();
      
      if (requesterProfile) {
        await supabase.rpc('create_notification', {
          p_user_id: requesterProfile.id,
          p_message: `Your edit request for "${selectedNote.title}" was approved`,
          p_link: `/group/${selectedNote.group_id}`,
        });
      }

      toast({
        title: 'Success',
        description: 'Edit request approved',
      });

      setSelectedNote(null);
      setSelectedRequest(null);
      onReview();
    } catch (error: any) {
      console.error('Error approving edit request:', error);
      toast({
        title: 'Error',
        description: 'Failed to approve edit request',
        variant: 'destructive',
      });
    }
  };

  const handleReject = async () => {
    if (!selectedNote || !selectedRequest) return;

    try {
      const editRequests = selectedNote.edit_requests.map((req: any) =>
        req.id === selectedRequest.id ? { ...req, status: 'rejected' } : req
      );

      const { error } = await supabase
        .from('notes')
        .update({ edit_requests: editRequests })
        .eq('id', selectedNote.id);

      if (error) throw error;

      // Create notification using secure function
      // Get requester user_id from email
      const { data: requesterProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', selectedRequest.requester_email)
        .single();
      
      if (requesterProfile) {
        await supabase.rpc('create_notification', {
          p_user_id: requesterProfile.id,
          p_message: `Your edit request for "${selectedNote.title}" was rejected`,
          p_link: `/group/${selectedNote.group_id}`,
        });
      }

      toast({
        title: 'Success',
        description: 'Edit request rejected',
      });

      setSelectedNote(null);
      setSelectedRequest(null);
      onReview();
    } catch (error: any) {
      console.error('Error rejecting edit request:', error);
      toast({
        title: 'Error',
        description: 'Failed to reject edit request',
        variant: 'destructive',
      });
    }
  };

  const totalPending = notes.reduce(
    (acc, note) =>
      acc + (note.edit_requests?.filter((r: any) => r.status === 'pending').length || 0),
    0
  );

  return (
    <>
      <Alert className="mb-6 bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800">
        <Info className="h-4 w-4" />
        <AlertDescription>
          You have {totalPending} pending edit {totalPending === 1 ? 'request' : 'requests'}
        </AlertDescription>
      </Alert>

      <div className="space-y-3 mb-6">
        {notes.map(note =>
          note.edit_requests
            ?.filter((req: any) => req.status === 'pending')
            .map((request: any) => (
              <Card key={request.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium">{note.title}</p>
                    <p className="text-sm text-muted-foreground">
                      Edit requested by {request.requester_name}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {request.message}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedNote(note);
                      setSelectedRequest(request);
                    }}
                  >
                    Review
                  </Button>
                </div>
              </Card>
            ))
        )}
      </div>

      <Dialog
        open={!!selectedNote}
        onOpenChange={() => {
          setSelectedNote(null);
          setSelectedRequest(null);
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review Edit Request</DialogTitle>
          </DialogHeader>

          {selectedNote && selectedRequest && (
            <div className="space-y-6">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>{selectedRequest.message}</AlertDescription>
              </Alert>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    Current Version
                    <Badge variant="secondary">Before</Badge>
                  </h3>
                  <Card className="p-4">
                    <p className="font-medium mb-2">{selectedNote.title}</p>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {selectedNote.content || 'No content'}
                    </p>
                  </Card>
                </div>

                <div>
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    Proposed Version
                    <Badge>After</Badge>
                  </h3>
                  <Card className="p-4 border-primary">
                    <p className="font-medium mb-2">{selectedRequest.proposed_title}</p>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {selectedRequest.proposed_content || 'No content'}
                    </p>
                  </Card>
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-4">
                <Button variant="outline" onClick={handleReject}>
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject
                </Button>
                <Button
                  onClick={handleApprove}
                  className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
