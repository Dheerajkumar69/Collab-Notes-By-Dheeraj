import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '@/components/ui/command';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { 
  Home, 
  User, 
  Settings, 
  FileText, 
  HelpCircle, 
  LogOut, 
  Plus, 
  Search,
  Users,
  Bell,
  Shield,
  Keyboard,
  MessageSquare,
  Clock
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useGroups } from '@/hooks/supabase-hooks';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateGroup?: () => void;
  onCreateNote?: () => void;
  onOpenFeedback?: () => void;
}

export function CommandPalette({ 
  open, 
  onOpenChange,
  onCreateGroup,
  onCreateNote,
  onOpenFeedback
}: CommandPaletteProps) {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { data: groups } = useGroups();
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<
    Array<{ kind: 'note' | 'message'; id: string; group_id: string; group_name: string; title: string }>
  >([]);
  const [recent, setRecent] = useState<
    Array<{ kind: 'note' | 'group'; id: string; title: string; groupId?: string }>
  >(() => {
    try {
      return JSON.parse(localStorage.getItem('cmdk:recent') || '[]');
    } catch {
      return [];
    }
  });

  // Debounced full-text search across notes + messages
  useEffect(() => {
    if (!open || !query.trim()) {
      setSearchResults([]);
      return;
    }
    const q = query.trim();
    const handle = setTimeout(async () => {
      const { data } = await supabase.rpc('search_all', { q });
      setSearchResults((data as typeof searchResults) || []);
    }, 200);
    return () => clearTimeout(handle);
  }, [query, open]);

  const pushRecent = useCallback(
    (item: { kind: 'note' | 'group'; id: string; title: string; groupId?: string }) => {
      setRecent((prev) => {
        const next = [item, ...prev.filter((r) => !(r.id === item.id && r.kind === item.kind))].slice(0, 5);
        localStorage.setItem('cmdk:recent', JSON.stringify(next));
        return next;
      });
    },
    []
  );

  const handleSelect = useCallback((callback: () => void) => {
    onOpenChange(false);
    // Small delay to allow dialog to close
    setTimeout(callback, 150);
  }, [onOpenChange]);

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  const shortcuts = [
    { keys: ['⌘', 'K'], description: 'Open command palette' },
    { keys: ['/'], description: 'Open command palette' },
    { keys: ['⌘', 'H'], description: 'Go to Dashboard' },
    { keys: ['⌘', '⇧', 'P'], description: 'Go to Profile' },
    { keys: ['⇧', '?'], description: 'Open Help' },
    { keys: ['Esc'], description: 'Close dialog' },
  ];

  if (showShortcuts) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
          <div className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Keyboard className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">Keyboard Shortcuts</h2>
            </div>
            <div className="space-y-3">
              {shortcuts.map((shortcut, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{shortcut.description}</span>
                  <div className="flex gap-1">
                    {shortcut.keys.map((key, j) => (
                      <kbd
                        key={j}
                        className="px-2 py-1 text-xs font-semibold bg-muted rounded border border-border"
                      >
                        {key}
                      </kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => setShowShortcuts(false)}
              className="mt-6 w-full py-2 text-sm text-primary hover:underline"
            >
              ← Back to commands
            </button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <Command className="rounded-lg border shadow-md">
        <CommandInput
          placeholder="Search notes, messages, groups — or type a command…"
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>

          {/* Full-text search results */}
          {query.trim() && searchResults.length > 0 && (
            <>
              <CommandGroup heading="Search results">
                {searchResults.slice(0, 8).map((r) => (
                  <CommandItem
                    key={`${r.kind}-${r.id}`}
                    onSelect={() =>
                      handleSelect(() => {
                        if (r.kind === 'note') {
                          pushRecent({ kind: 'note', id: r.id, title: r.title, groupId: r.group_id });
                          navigate(`/group/${r.group_id}/note/${r.id}`);
                        } else {
                          navigate(`/group/${r.group_id}`);
                        }
                      })
                    }
                  >
                    {r.kind === 'note' ? (
                      <FileText className="mr-2 h-4 w-4" />
                    ) : (
                      <MessageSquare className="mr-2 h-4 w-4" />
                    )}
                    <span className="truncate">{r.title}</span>
                    <Badge variant="outline" className="ml-auto text-[10px]">
                      {r.group_name}
                    </Badge>
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
            </>
          )}

          {/* Recent */}
          {!query.trim() && recent.length > 0 && (
            <>
              <CommandGroup heading="Recent">
                {recent.map((r) => (
                  <CommandItem
                    key={`recent-${r.kind}-${r.id}`}
                    onSelect={() =>
                      handleSelect(() =>
                        navigate(r.kind === 'note' ? `/group/${r.groupId}/note/${r.id}` : `/group/${r.id}`)
                      )
                    }
                  >
                    <Clock className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span className="truncate">{r.title}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
            </>
          )}

          {/* Quick Actions */}
          <CommandGroup heading="Quick Actions">
            {onCreateGroup && (
              <CommandItem onSelect={() => handleSelect(onCreateGroup)}>
                <Plus className="mr-2 h-4 w-4" />
                <span>Create New Group</span>
                <Badge variant="secondary" className="ml-auto text-xs">Action</Badge>
              </CommandItem>
            )}
            {onCreateNote && (
              <CommandItem onSelect={() => handleSelect(onCreateNote)}>
                <FileText className="mr-2 h-4 w-4" />
                <span>Create New Note</span>
                <Badge variant="secondary" className="ml-auto text-xs">Action</Badge>
              </CommandItem>
            )}
            {onOpenFeedback && (
              <CommandItem onSelect={() => handleSelect(onOpenFeedback)}>
                <Bell className="mr-2 h-4 w-4" />
                <span>Send Feedback</span>
                <Badge variant="secondary" className="ml-auto text-xs">Action</Badge>
              </CommandItem>
            )}
          </CommandGroup>

          <CommandSeparator />

          {/* Navigation */}
          <CommandGroup heading="Navigation">
            <CommandItem onSelect={() => handleSelect(() => navigate('/dashboard'))}>
              <Home className="mr-2 h-4 w-4" />
              <span>Dashboard</span>
              <kbd className="ml-auto text-xs bg-muted px-1.5 py-0.5 rounded">⌘H</kbd>
            </CommandItem>
            <CommandItem onSelect={() => handleSelect(() => navigate('/all-notes'))}>
              <FileText className="mr-2 h-4 w-4" />
              <span>All Notes</span>
            </CommandItem>
            <CommandItem onSelect={() => handleSelect(() => navigate('/profile'))}>
              <User className="mr-2 h-4 w-4" />
              <span>Profile Settings</span>
              <kbd className="ml-auto text-xs bg-muted px-1.5 py-0.5 rounded">⌘⇧P</kbd>
            </CommandItem>
            <CommandItem onSelect={() => handleSelect(() => navigate('/help'))}>
              <HelpCircle className="mr-2 h-4 w-4" />
              <span>Help Center</span>
              <kbd className="ml-auto text-xs bg-muted px-1.5 py-0.5 rounded">⇧?</kbd>
            </CommandItem>
          </CommandGroup>

          {/* Groups */}
          {groups && groups.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Your Groups">
                {groups.slice(0, 5).map((group) => (
                  <CommandItem 
                    key={group.id}
                    onSelect={() => handleSelect(() => navigate(`/group/${group.id}`))}
                  >
                    <Users className="mr-2 h-4 w-4" />
                    <span>{group.name}</span>
                    <Badge 
                      variant="outline" 
                      className={cn(
                        "ml-auto text-xs",
                        group.color === 'blue' && "border-blue-500 text-blue-500",
                        group.color === 'green' && "border-green-500 text-green-500",
                        group.color === 'purple' && "border-purple-500 text-purple-500",
                        group.color === 'orange' && "border-orange-500 text-orange-500",
                        group.color === 'pink' && "border-pink-500 text-pink-500",
                      )}
                    >
                      {group.members?.length || 1} members
                    </Badge>
                  </CommandItem>
                ))}
                {groups.length > 5 && (
                  <CommandItem onSelect={() => handleSelect(() => navigate('/dashboard'))}>
                    <span className="text-muted-foreground">View all {groups.length} groups...</span>
                  </CommandItem>
                )}
              </CommandGroup>
            </>
          )}

          <CommandSeparator />

          {/* Utilities */}
          <CommandGroup heading="Utilities">
            <CommandItem onSelect={() => setShowShortcuts(true)}>
              <Keyboard className="mr-2 h-4 w-4" />
              <span>Keyboard Shortcuts</span>
            </CommandItem>
            <CommandItem 
              onSelect={() => handleSelect(async () => {
                await signOut();
                navigate('/');
              })}
              className="text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span>Sign Out</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
        
        <div className="border-t p-2 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex gap-2">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>Esc Close</span>
          </div>
          <span>⌘K to open</span>
        </div>
      </Command>
    </CommandDialog>
  );
}
