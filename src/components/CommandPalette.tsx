import { useState, useEffect, useCallback } from 'react';
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
  Keyboard
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useGroups } from '@/hooks/supabase-hooks';
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

  const handleSelect = useCallback((callback: () => void) => {
    onOpenChange(false);
    // Small delay to allow dialog to close
    setTimeout(callback, 150);
  }, [onOpenChange]);

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
        <CommandInput placeholder="Type a command or search..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          
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
