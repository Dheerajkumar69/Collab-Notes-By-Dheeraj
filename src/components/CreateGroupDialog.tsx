import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createGroupSchema, CreateGroupFormData } from '@/lib/validation';

const colorOptions = [
  { name: 'blue', gradient: 'linear-gradient(135deg, #3b82f6, #2563eb)' },
  { name: 'green', gradient: 'linear-gradient(135deg, #22c55e, #16a34a)' },
  { name: 'purple', gradient: 'linear-gradient(135deg, #a855f7, #9333ea)' },
  { name: 'orange', gradient: 'linear-gradient(135deg, #f97316, #ea580c)' },
  { name: 'pink', gradient: 'linear-gradient(135deg, #ec4899, #db2777)' },
  { name: 'indigo', gradient: 'linear-gradient(135deg, #6366f1, #4f46e5)' },
];

interface CreateGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const CreateGroupDialog = ({ open, onOpenChange, onSuccess }: CreateGroupDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [selectedColor, setSelectedColor] = useState('blue');

  const { register, handleSubmit, formState: { errors }, reset } = useForm<CreateGroupFormData>({
    resolver: zodResolver(createGroupSchema),
    defaultValues: {
      name: '',
      description: '',
      color: 'blue',
    }
  });

  const generateInviteCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const onSubmit = async (data: CreateGroupFormData) => {
    if (!user) return;

    setLoading(true);

    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', user.id)
      .single();

    if (!profile) {
      toast({
        title: 'Error',
        description: 'User profile not found',
        variant: 'destructive',
      });
      setLoading(false);
      return;
    }

    const inviteCode = generateInviteCode();

    const { data: newGroup, error } = await supabase.from('groups').insert({
      name: data.name,
      description: data.description,
      color: data.color,
      members: [profile.email],
      created_by: user.id,
    }).select('id').single();

    setLoading(false);

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      await supabase.from('group_invite_codes').insert({
        group_id: newGroup.id,
        invite_code: inviteCode,
      });
      toast({
        title: 'Success',
        description: 'Group created successfully',
      });
      reset();
      setSelectedColor('blue');
      onOpenChange(false);
      onSuccess();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Group</DialogTitle>
          <DialogDescription>Create a collaborative workspace for your team</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="name">Group Name</Label>
            <Input
              id="name"
              placeholder="My Awesome Team"
              {...register('name')}
            />
            {errors.name && (
              <p className="text-sm text-red-500 mt-1">{errors.name.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="What's this group about?"
              rows={3}
              {...register('description')}
            />
            {errors.description && (
              <p className="text-sm text-red-500 mt-1">{errors.description.message}</p>
            )}
          </div>

          <div>
            <Label>Color Theme</Label>
            <div className="flex gap-2 mt-2 flex-wrap">
              {colorOptions.map(({ name, gradient }) => (
                <button
                  key={name}
                  type="button"
                  className={`h-10 w-10 rounded-lg border-2 transition-all ${selectedColor === name ? 'border-primary ring-2 ring-primary ring-offset-2' : 'border-transparent hover:scale-105'
                    }`}
                  style={{ background: gradient }}
                  onClick={() => setSelectedColor(name)}
                  title={name}
                />
              ))}
            </div>
            <input type="hidden" {...register('color')} value={selectedColor} />
          </div>

          <Button type="submit" className="w-full bg-gradient-primary" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Group'
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};