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

const colors = ['blue', 'green', 'purple', 'orange', 'pink', 'indigo'];

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

    const { error } = await supabase.from('groups').insert({
      name: data.name,
      description: data.description,
      color: data.color,
      invite_code: inviteCode,
      members: [profile.email],
      created_by: user.id,
    });

    setLoading(false);

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } else {
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
            <div className="grid grid-cols-6 gap-2 mt-2">
              {colors.map(color => (
                <button
                  key={color}
                  type="button"
                  className={`h-10 rounded-lg border-2 transition-all ${
                    selectedColor === color ? 'border-primary scale-110' : 'border-transparent'
                  }`}
                  style={{
                    background: `linear-gradient(135deg, var(--color-${color}), var(--color-${color}))`,
                  }}
                  onClick={() => setSelectedColor(color)}
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