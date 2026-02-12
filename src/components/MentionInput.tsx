import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';

interface MentionUser {
  id: string;
  full_name: string;
  email: string;
}

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  onMention: (user: MentionUser) => void;
  groupId: string;
  placeholder?: string;
  disabled?: boolean;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  onBlur?: () => void;
  inputRef?: React.RefObject<HTMLInputElement>;
}

export function MentionInput({
  value,
  onChange,
  onMention,
  groupId,
  placeholder = 'Type a message...',
  disabled = false,
  onKeyDown,
  onBlur,
  inputRef,
}: MentionInputProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<MentionUser[]>([]);
  const [mentionQuery, setMentionQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [cursorPosition, setCursorPosition] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const localInputRef = useRef<HTMLInputElement>(null);
  const effectiveRef = inputRef || localInputRef;

  useEffect(() => {
    if (mentionQuery.length > 0) {
      searchUsers(mentionQuery);
    }
  }, [mentionQuery]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchUsers = async (query: string) => {
    try {
      const { data: group } = await supabase
        .from('groups')
        .select('members, created_by')
        .eq('id', groupId)
        .single();

      if (!group) return;

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('email', group.members || [])
        .ilike('full_name', `%${query}%`);

      setSuggestions(profiles || []);
      setSelectedIndex(0);
    } catch (error) {
      console.error('Error searching users:', error);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    const pos = e.target.selectionStart || 0;
    setCursorPosition(pos);
    onChange(newValue);

    // Check for @ mention trigger
    const textBeforeCursor = newValue.slice(0, pos);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);

    if (mentionMatch) {
      setMentionQuery(mentionMatch[1]);
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
      setMentionQuery('');
    }
  };

  const insertMention = (user: MentionUser) => {
    const textBeforeCursor = value.slice(0, cursorPosition);
    const textAfterCursor = value.slice(cursorPosition);
    const mentionStart = textBeforeCursor.lastIndexOf('@');

    const newValue =
      textBeforeCursor.slice(0, mentionStart) +
      `@${user.full_name} ` +
      textAfterCursor;

    onChange(newValue);
    setShowSuggestions(false);
    setMentionQuery('');
    onMention(user);
    effectiveRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % suggestions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(suggestions[selectedIndex]);
        return;
      }
      if (e.key === 'Escape') {
        setShowSuggestions(false);
        return;
      }
    }
    onKeyDown?.(e);
  };

  return (
    <div ref={containerRef} className="relative flex-1">
      <Input
        ref={effectiveRef as React.RefObject<HTMLInputElement>}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={onBlur}
        placeholder={placeholder}
        disabled={disabled}
        className="flex-1"
      />

      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute bottom-full mb-1 left-0 w-64 bg-popover border rounded-lg shadow-lg z-50 overflow-hidden">
          <ScrollArea className="max-h-48">
            <div className="p-1">
              {suggestions.map((user, index) => (
                <button
                  key={user.id}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                    index === selectedIndex ? 'bg-accent' : 'hover:bg-muted'
                  }`}
                  onClick={() => insertMention(user)}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground text-xs">
                      {user.full_name[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="text-left">
                    <p className="font-medium">{user.full_name}</p>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
