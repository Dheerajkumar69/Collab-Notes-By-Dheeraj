import { useState } from 'react';
import { Archive, RotateCcw, Loader2, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useGroups } from '@/hooks/supabase-hooks';
import { supabase } from '@/integrations/supabase/client';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { Tables } from '@/integrations/supabase/types';

type Note = Tables<'notes'>;
type Group = Tables<'groups'>;

export function ArchivedNotesSection() {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: groups = [] } = useGroups();

  const { data: archivedNotes = [], isLoading } = useQuery({
    queryKey: ['archived-notes'],
    queryFn: async () => {
      const groupIds = (groups as Group[]).map(g => g.id);
      if (groupIds.length === 0) return [];

      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .in('group_id', groupIds)
        .eq('is_archived', true)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: (groups as Group[]).length > 0 && isOpen,
  });

  const unarchiveMutation = useMutation({
    mutationFn: async (noteId: string) => {
      const { error } = await supabase
        .from('notes')
        .update({ is_archived: false })
        .eq('id', noteId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['archived-notes'] });
      queryClient.invalidateQueries({ queryKey: ['all-notes'] });
      toast({
        title: '✅ Note restored',
        description: 'The note has been moved back to your active notes.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to restore note',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const filteredNotes = (archivedNotes as Note[]).filter(note =>
    note.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    note.content?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getGroupName = (groupId: string) => {
    return (groups as Group[]).find(g => g.id === groupId)?.name || 'Unknown';
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="w-full">
      <Card className="p-4">
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full flex items-center justify-between p-0 h-auto hover:bg-transparent"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                <Archive className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="text-left">
                <h3 className="font-semibold">Archived Notes</h3>
                <p className="text-sm text-muted-foreground">
                  {isOpen ? 'Click to collapse' : 'View and restore archived notes'}
                </p>
              </div>
            </div>
            {isOpen ? (
              <ChevronUp className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            )}
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 space-y-4"
            >
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search archived notes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Notes List */}
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredNotes.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {searchTerm ? 'No archived notes match your search' : 'No archived notes'}
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                  {filteredNotes.map((note, index) => (
                    <motion.div
                      key={note.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="p-4 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium truncate">{note.title}</h4>
                          {note.content && (
                            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                              {note.content}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="secondary" className="text-xs">
                              {getGroupName(note.group_id)}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              Archived {note.updated_at ? format(new Date(note.updated_at), 'MMM d, yyyy') : ''}
                            </span>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => unarchiveMutation.mutate(note.id)}
                          disabled={unarchiveMutation.isPending}
                          className="shrink-0"
                        >
                          {unarchiveMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RotateCcw className="h-4 w-4" />
                          )}
                          <span className="ml-2 hidden sm:inline">Restore</span>
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
