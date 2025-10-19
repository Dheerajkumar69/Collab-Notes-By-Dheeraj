import { useState, useEffect } from 'react';
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
import { Copy } from 'lucide-react';

interface GroupSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: any;
  onSuccess: () => void;
}

const COLORS = [
  { name: 'Blue', value: 'blue' },
  { name: 'Green', value: 'green' },
  { name: 'Purple', value: 'purple' },
  { name: 'Orange', value: 'orange' },
  { name: 'Pink', value: 'pink' },
  { name: 'Indigo', value: 'indigo' },
];

export function GroupSettings({
  open,
  onOpenChange,
  group,
  onSuccess,
}: GroupSettingsProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('blue');
  const [backgroundImageUrl, setBackgroundImageUrl] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (group) {
      setName(group.name || '');
      setDescription(group.description || '');
      setColor(group.color || 'blue');
      setBackgroundImageUrl(group.background_image_url || '');
    }
  }, [group]);

  const copyInviteCode = () => {
    if (group?.invite_code) {
      navigator.clipboard.writeText(group.invite_code);
      toast({
        title: 'Copied!',
        description: 'Invite code copied to clipboard',
      });
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a group name',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSaving(true);

      const { error } = await supabase
        .from('groups')
        .update({
          name,
          description,
          color,
          background_image_url: backgroundImageUrl || null,
        })
        .eq('id', group.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Group settings updated',
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error updating group:', error);
      toast({
        title: 'Error',
        description: 'Failed to update group settings',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Group Settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Group Name *</Label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Enter group name"
            />
          </div>

          <div>
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Enter group description"
              rows={3}
            />
          </div>

          <div>
            <Label>Color Theme</Label>
            <div className="flex gap-2 mt-2">
              {COLORS.map(c => (
                <button
                  key={c.value}
                  onClick={() => setColor(c.value)}
                  className={`w-12 h-12 rounded-lg border-2 ${
                    color === c.value
                      ? 'border-primary'
                      : 'border-transparent hover:border-muted-foreground'
                  }`}
                  style={{
                    background: `linear-gradient(to bottom right, var(--${c.value}-500), var(--${c.value}-600))`,
                  }}
                  title={c.name}
                />
              ))}
            </div>
          </div>

          <div>
            <Label>Background Image URL (Optional)</Label>
            <Input
              value={backgroundImageUrl}
              onChange={e => setBackgroundImageUrl(e.target.value)}
              placeholder="https://example.com/image.jpg"
            />
          </div>

          <div>
            <Label>Invite Code</Label>
            <div className="flex gap-2">
              <Input value={group?.invite_code || ''} disabled />
              <Button variant="outline" onClick={copyInviteCode}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
