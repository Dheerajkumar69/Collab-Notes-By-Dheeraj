import { useState } from 'react';
import { MessageSquarePlus, Bug, Lightbulb, Wrench, HelpCircle, Send, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/supabase-hooks';
import { supabase } from '@/integrations/supabase/client';

const feedbackTypes = [
  { value: 'bug', label: 'Bug Report', icon: Bug, color: 'text-red-500', bgColor: 'bg-red-500/10 hover:bg-red-500/20 border-red-500/30' },
  { value: 'feature', label: 'Feature Request', icon: Lightbulb, color: 'text-yellow-500', bgColor: 'bg-yellow-500/10 hover:bg-yellow-500/20 border-yellow-500/30' },
  { value: 'improvement', label: 'Improvement', icon: Wrench, color: 'text-blue-500', bgColor: 'bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/30' },
  { value: 'other', label: 'Other', icon: HelpCircle, color: 'text-purple-500', bgColor: 'bg-purple-500/10 hover:bg-purple-500/20 border-purple-500/30' },
] as const;

type FeedbackType = typeof feedbackTypes[number]['value'];

export function FeedbackDialog() {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FeedbackType | null>(null);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const { data: profile } = useProfile();

  const resetForm = () => {
    setType(null);
    setSubject('');
    setMessage('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!type || !subject.trim() || !message.trim() || !user) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('feedback').insert({
        user_id: user.id,
        user_email: user.email || '',
        user_name: profile?.full_name || null,
        type,
        subject: subject.trim(),
        message: message.trim(),
      });

      if (error) throw error;

      toast({
        title: '🎉 Feedback sent!',
        description: 'Thank you for helping us improve CollabNotes.',
      });
      resetForm();
      setOpen(false);
    } catch (error: any) {
      toast({
        title: 'Failed to send feedback',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedType = feedbackTypes.find(t => t.value === type);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          className="gap-2 border-dashed hover:border-primary hover:bg-primary/5 transition-all duration-300"
        >
          <MessageSquarePlus size={18} />
          Send Feedback
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <motion.div
              initial={{ rotate: -10 }}
              animate={{ rotate: 0 }}
              transition={{ type: 'spring', stiffness: 200 }}
            >
              <MessageSquarePlus className="h-5 w-5 text-primary" />
            </motion.div>
            Send Feedback
          </DialogTitle>
          <DialogDescription>
            Help us improve CollabNotes. Report bugs, suggest features, or share your thoughts.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Feedback Type Selection */}
          <div className="space-y-3">
            <Label>What type of feedback?</Label>
            <div className="grid grid-cols-2 gap-3">
              {feedbackTypes.map((feedbackType) => {
                const Icon = feedbackType.icon;
                const isSelected = type === feedbackType.value;
                return (
                  <motion.button
                    key={feedbackType.value}
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setType(feedbackType.value)}
                    className={`
                      p-4 rounded-xl border-2 transition-all duration-200 text-left
                      ${isSelected 
                        ? `${feedbackType.bgColor} border-current ${feedbackType.color}` 
                        : 'border-border hover:border-muted-foreground/30 bg-muted/30'
                      }
                    `}
                  >
                    <Icon className={`h-5 w-5 mb-2 ${isSelected ? feedbackType.color : 'text-muted-foreground'}`} />
                    <span className={`text-sm font-medium ${isSelected ? '' : 'text-foreground'}`}>
                      {feedbackType.label}
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </div>

          <AnimatePresence mode="wait">
            {type && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-4 overflow-hidden"
              >
                {/* Subject */}
                <div className="space-y-2">
                  <Label htmlFor="subject">Subject</Label>
                  <Input
                    id="subject"
                    placeholder={
                      type === 'bug' 
                        ? 'e.g., Notes not saving properly' 
                        : type === 'feature'
                        ? 'e.g., Add dark mode support'
                        : 'Brief summary of your feedback'
                    }
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    maxLength={100}
                  />
                </div>

                {/* Message */}
                <div className="space-y-2">
                  <Label htmlFor="message">
                    {type === 'bug' ? 'Describe the issue' : 'Your feedback'}
                  </Label>
                  <Textarea
                    id="message"
                    placeholder={
                      type === 'bug'
                        ? 'Please describe what happened, what you expected, and steps to reproduce...'
                        : type === 'feature'
                        ? 'Describe the feature you\'d like to see and how it would help you...'
                        : 'Share your thoughts, suggestions, or ideas...'
                    }
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={4}
                    maxLength={2000}
                  />
                  <p className="text-xs text-muted-foreground text-right">
                    {message.length}/2000
                  </p>
                </div>

                {/* Submit */}
                <div className="flex gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      resetForm();
                      setOpen(false);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 gap-2"
                    disabled={!subject.trim() || !message.trim() || isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        Send Feedback
                      </>
                    )}
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </form>
      </DialogContent>
    </Dialog>
  );
}
