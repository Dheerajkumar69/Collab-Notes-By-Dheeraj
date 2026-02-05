 import { useState, useRef, useEffect } from 'react';
 import { useAuth } from '@/contexts/AuthContext';
 import { supabase } from '@/integrations/supabase/client';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import { Textarea } from '@/components/ui/textarea';
 import { toast } from '@/hooks/use-toast';
 import { Pin, X, Loader2 } from 'lucide-react';
 
 interface QuickNoteInputProps {
   groupId: string;
   onSuccess: () => void;
 }
 
 export function QuickNoteInput({ groupId, onSuccess }: QuickNoteInputProps) {
   const { user } = useAuth();
   const [isExpanded, setIsExpanded] = useState(false);
   const [title, setTitle] = useState('');
   const [content, setContent] = useState('');
   const [isPinned, setIsPinned] = useState(false);
   const [saving, setSaving] = useState(false);
   const containerRef = useRef<HTMLDivElement>(null);
   const contentRef = useRef<HTMLTextAreaElement>(null);
 
   // Click outside to collapse
   useEffect(() => {
     const handleClickOutside = (e: MouseEvent) => {
       if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
         if (title.trim() || content.trim()) {
           handleSave();
         } else {
           handleClose();
         }
       }
     };
 
     if (isExpanded) {
       document.addEventListener('mousedown', handleClickOutside);
     }
     return () => document.removeEventListener('mousedown', handleClickOutside);
   }, [isExpanded, title, content]);
 
   const handleExpand = () => {
     setIsExpanded(true);
     setTimeout(() => contentRef.current?.focus(), 50);
   };
 
   const handleClose = () => {
     setIsExpanded(false);
     setTitle('');
     setContent('');
     setIsPinned(false);
   };
 
   const handleSave = async () => {
     if (!content.trim() && !title.trim()) {
       handleClose();
       return;
     }
 
     try {
       setSaving(true);
 
       // Get user profile for author name
       const { data: profile } = await supabase
         .from('profiles')
         .select('full_name')
         .eq('id', user?.id)
         .single();
 
       const noteData = {
         title: title.trim() || 'Untitled',
         content: content.trim(),
         group_id: groupId,
         author_name: profile?.full_name || 'User',
         created_by: user?.id,
         is_pinned: isPinned,
         color: 'white',
       };
 
       const { error } = await supabase.from('notes').insert([noteData]);
 
       if (error) throw error;
 
       toast({ title: 'Note saved' });
       handleClose();
       onSuccess();
     } catch (error) {
       console.error('Error saving note:', error);
       toast({
         title: 'Error',
         description: 'Failed to save note',
         variant: 'destructive',
       });
     } finally {
       setSaving(false);
     }
   };
 
   if (!isExpanded) {
     return (
       <div
         className="mb-6 cursor-text"
         onClick={handleExpand}
       >
         <div className="flex items-center gap-3 px-4 py-3 rounded-lg border bg-card hover:shadow-md transition-shadow">
           <span className="text-muted-foreground flex-1">Take a note...</span>
         </div>
       </div>
     );
   }
 
   return (
     <div
       ref={containerRef}
       className="mb-6 rounded-lg border bg-card shadow-lg overflow-hidden"
     >
       {/* Title Row */}
       <div className="flex items-center border-b">
         <Input
           value={title}
           onChange={(e) => setTitle(e.target.value)}
           placeholder="Title"
           className="border-0 text-lg font-medium focus-visible:ring-0 focus-visible:ring-offset-0"
         />
         <Button
           variant="ghost"
           size="icon"
           onClick={() => setIsPinned(!isPinned)}
           className={isPinned ? 'text-primary' : 'text-muted-foreground'}
         >
           <Pin className="h-4 w-4" />
         </Button>
       </div>
 
       {/* Content Area - Notepad style */}
       <Textarea
         ref={contentRef}
         value={content}
         onChange={(e) => setContent(e.target.value)}
         placeholder="Take a note..."
         className="border-0 min-h-[150px] resize-none focus-visible:ring-0 focus-visible:ring-offset-0 font-mono text-sm"
       />
 
       {/* Footer */}
       <div className="flex items-center justify-end gap-2 p-2 border-t bg-muted/30">
         <Button
           variant="ghost"
           size="sm"
           onClick={handleClose}
           disabled={saving}
         >
           Cancel
         </Button>
         <Button
           size="sm"
           onClick={handleSave}
           disabled={saving}
         >
           {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
           Save
         </Button>
       </div>
     </div>
   );
 }