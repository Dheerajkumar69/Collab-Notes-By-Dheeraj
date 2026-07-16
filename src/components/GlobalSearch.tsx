import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Search, FileText, Users, MessageSquare } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface SearchResult {
  type: 'note' | 'message' | 'group';
  id: string;
  title: string;
  groupId?: string;
  groupName?: string;
  labels?: string[];
  snippet?: string;
  rank?: number;
}

interface GlobalSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GlobalSearch({ open, onOpenChange }: GlobalSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setQuery('');
      setResults([]);
    }
  }, [open]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(() => performSearch(query.trim()), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  const performSearch = async (searchQuery: string) => {
    if (!user) return;
    setLoading(true);
    try {
      const [rpcRes, groupsRes] = await Promise.all([
        supabase.rpc('search_all', { q: searchQuery }),
        supabase
          .from('groups')
          .select('id, name, description')
          .or(`name.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`)
          .limit(5),
      ]);
      if (rpcRes.error) console.error('search_all error:', rpcRes.error);

      const groupResults: SearchResult[] = (groupsRes.data || []).map((g) => ({
        type: 'group',
        id: g.id,
        title: g.name,
        snippet: g.description || undefined,
      }));

      const contentResults: SearchResult[] = ((rpcRes.data || []) as Array<{
        kind: 'note' | 'message';
        id: string;
        group_id: string;
        group_name: string;
        title: string;
        snippet: string;
        rank: number;
      }>).map((r) => ({
        type: r.kind,
        id: r.id,
        title: r.title,
        groupId: r.group_id,
        groupName: r.group_name,
        snippet: r.snippet,
        rank: r.rank,
      }));

      setResults([...groupResults, ...contentResults]);
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (result: SearchResult) => {
    onOpenChange(false);
    if (result.type === 'group') {
      navigate(`/group/${result.id}`);
    } else if (result.type === 'message') {
      navigate(`/group/${result.groupId}`);
    } else {
      navigate(`/group/${result.groupId}/note/${result.id}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 gap-0">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="sr-only">Search</DialogTitle>
        </DialogHeader>
        <div className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search notes, groups..."
              className="pl-9"
            />
          </div>
        </div>

        {results.length > 0 && (
          <div className="max-h-80 overflow-y-auto border-t">
            {results.map((result) => (
              <button
                key={`${result.type}-${result.id}`}
                className="w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors flex items-start gap-3 border-b last:border-b-0"
                onClick={() => handleSelect(result)}
              >
                <div className="mt-0.5">
                  {result.type === 'group' ? (
                    <Users className="h-4 w-4 text-muted-foreground" />
                  ) : result.type === 'message' ? (
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">{result.title}</span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {result.type}
                    </Badge>
                  </div>
                  {result.groupName && (
                    <p className="text-xs text-muted-foreground">in {result.groupName}</p>
                  )}
                  {result.snippet && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{result.snippet}</p>
                  )}
                  {result.labels && result.labels.length > 0 && (
                    <div className="flex gap-1 mt-1">
                      {result.labels.slice(0, 3).map(l => (
                        <Badge key={l} variant="secondary" className="text-[10px] px-1 py-0">
                          {l}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        {query.trim() && !loading && results.length === 0 && (
          <div className="p-8 text-center text-muted-foreground text-sm border-t">
            No results found for "{query}"
          </div>
        )}

        {loading && (
          <div className="p-8 text-center text-muted-foreground text-sm border-t">
            Searching...
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
