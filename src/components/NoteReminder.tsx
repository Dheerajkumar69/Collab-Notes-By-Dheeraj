import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Bell, BellRing, Check, X } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { format, isPast, isFuture } from 'date-fns';

interface NoteReminderProps {
  noteId: string;
  groupId: string;
  noteTitle: string;
}

interface Reminder {
  id: string;
  due_date: string;
  is_completed: boolean;
}

export function NoteReminder({ noteId, groupId, noteTitle }: NoteReminderProps) {
  const { user } = useAuth();
  const [reminder, setReminder] = useState<Reminder | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetchReminder();
  }, [noteId]);

  const fetchReminder = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('note_reminders')
      .select('id, due_date, is_completed')
      .eq('note_id', noteId)
      .eq('user_id', user.id)
      .maybeSingle();
    setReminder(data);
    if (data) setSelectedDate(new Date(data.due_date));
  };

  const setReminderDate = async (date: Date) => {
    if (!user) return;
    try {
      if (reminder) {
        await supabase.from('note_reminders')
          .update({ due_date: date.toISOString(), is_completed: false })
          .eq('id', reminder.id);
      } else {
        await supabase.from('note_reminders').insert({
          note_id: noteId,
          group_id: groupId,
          user_id: user.id,
          title: noteTitle,
          due_date: date.toISOString(),
        });
      }
      setSelectedDate(date);
      await fetchReminder();
      setOpen(false);
      toast({ title: 'Reminder set', description: `Due ${format(date, 'MMM d, yyyy')}` });
    } catch (e) {
      toast({ title: 'Error', description: 'Failed to set reminder', variant: 'destructive' });
    }
  };

  const completeReminder = async () => {
    if (!reminder) return;
    await supabase.from('note_reminders')
      .update({ is_completed: true })
      .eq('id', reminder.id);
    await fetchReminder();
    toast({ title: 'Completed', description: 'Reminder marked as done' });
  };

  const removeReminder = async () => {
    if (!reminder) return;
    await supabase.from('note_reminders').delete().eq('id', reminder.id);
    setReminder(null);
    setSelectedDate(undefined);
    toast({ title: 'Removed', description: 'Reminder removed' });
  };

  const isOverdue = reminder && !reminder.is_completed && isPast(new Date(reminder.due_date));

  return (
    <div className="flex items-center gap-2">
      {reminder && !reminder.is_completed ? (
        <div className="flex items-center gap-2">
          <Badge variant={isOverdue ? 'destructive' : 'secondary'} className="gap-1">
            <BellRing className="h-3 w-3" />
            {isOverdue ? 'Overdue: ' : 'Due: '}
            {format(new Date(reminder.due_date), 'MMM d')}
          </Badge>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={completeReminder}>
            <Check className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={removeReminder}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : reminder?.is_completed ? (
        <Badge variant="outline" className="gap-1 text-green-600">
          <Check className="h-3 w-3" />
          Completed
        </Badge>
      ) : null}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
            <Bell className="h-3.5 w-3.5" />
            {!reminder && 'Set reminder'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(date) => date && setReminderDate(date)}
            disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

// Dashboard reminders widget
export function UpcomingReminders() {
  const { user } = useAuth();
  const [reminders, setReminders] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data } = await supabase
        .from('note_reminders')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_completed', false)
        .order('due_date', { ascending: true })
        .limit(5);
      setReminders(data || []);
    };
    fetch();
  }, [user]);

  if (reminders.length === 0) return null;

  return (
    <div className="mb-6">
      <h3 className="font-semibold mb-3 flex items-center gap-2">
        <BellRing className="h-4 w-4" />
        Upcoming Reminders
      </h3>
      <div className="space-y-2">
        {reminders.map(r => (
          <div key={r.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div>
              <p className="text-sm font-medium">{r.title}</p>
              <p className={`text-xs ${isPast(new Date(r.due_date)) ? 'text-destructive' : 'text-muted-foreground'}`}>
                {isPast(new Date(r.due_date)) ? 'Overdue: ' : 'Due: '}
                {format(new Date(r.due_date), 'MMM d, yyyy')}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
