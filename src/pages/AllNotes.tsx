import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, FileText, Image as ImageIcon, File, ExternalLink, X, Loader2 } from 'lucide-react';
import { format, isToday, isThisWeek, isThisMonth } from 'date-fns';
import { useGroups } from '@/hooks/supabase-hooks';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ErrorState } from '@/components/ErrorState';
import { SEOHead } from '@/components/SEOHead';
import type { Tables } from '@/integrations/supabase/types';

type Note = Tables<'notes'>;
type Group = Tables<'groups'>;

const NOTES_PER_PAGE = 12;

export default function AllNotes() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedLabel, setSelectedLabel] = useState('all');
  const [selectedTimeframe, setSelectedTimeframe] = useState('all');
  const [page, setPage] = useState(1);

  // Use the shared groups hook
  const { data: groups = [], isLoading: groupsLoading, isError: groupsError, refetch: refetchGroups } = useGroups();

  // Fetch notes for all user groups
  const { data: notes = [], isLoading: notesLoading, isError: notesError, refetch: refetchNotes } = useQuery({
    queryKey: ['all-notes', groups],
    queryFn: async () => {
      const groupIds = (groups as Group[]).map(g => g.id);
      if (groupIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .in('group_id', groupIds)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: (groups as Group[]).length > 0,
  });

  const isLoading = groupsLoading || notesLoading;
  const isError = groupsError || notesError;

  const allLabels = Array.from(
    new Set((notes as Note[]).flatMap(note => note.labels || []))
  );

  const filteredNotes = (notes as Note[]).filter(note => {
    // Search filter
    const matchesSearch =
      note.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      note.content?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (groups as Group[])
        .find(g => g.id === note.group_id)
        ?.name.toLowerCase()
        .includes(searchTerm.toLowerCase());

    // Group filter
    const matchesGroup =
      selectedGroup === 'all' || note.group_id === selectedGroup;

    // Type filter
    let matchesType = true;
    if (selectedType !== 'all') {
      const attachments = note.attachments as Array<{ type?: string }> | null;
      const hasImage = attachments?.some(a => a.type?.startsWith('image/'));
      const hasFile = attachments?.some(a => !a.type?.startsWith('image/'));
      if (selectedType === 'image') matchesType = hasImage || false;
      else if (selectedType === 'file') matchesType = hasFile || false;
      else matchesType = !hasImage && !hasFile;
    }

    // Label filter
    const matchesLabel =
      selectedLabel === 'all' || note.labels?.includes(selectedLabel);

    // Timeframe filter
    let matchesTimeframe = true;
    if (selectedTimeframe !== 'all' && note.created_at) {
      const noteDate = new Date(note.created_at);
      if (selectedTimeframe === 'today') matchesTimeframe = isToday(noteDate);
      else if (selectedTimeframe === 'week')
        matchesTimeframe = isThisWeek(noteDate);
      else if (selectedTimeframe === 'month')
        matchesTimeframe = isThisMonth(noteDate);
    }

    return (
      matchesSearch &&
      matchesGroup &&
      matchesType &&
      matchesLabel &&
      matchesTimeframe
    );
  });

  const getColorClass = (color?: string | null) => {
    switch (color) {
      case 'blue': return 'from-blue-500 to-blue-600';
      case 'green': return 'from-green-500 to-green-600';
      case 'purple': return 'from-purple-500 to-purple-600';
      case 'orange': return 'from-orange-500 to-orange-600';
      case 'pink': return 'from-pink-500 to-pink-600';
      case 'indigo': return 'from-indigo-500 to-indigo-600';
      default: return 'from-blue-500 to-blue-600';
    }
  };

  const getNoteTypeIcon = (note: Note) => {
    const attachments = note.attachments as Array<{ type?: string }> | null;
    const hasImage = attachments?.some(a => a.type?.startsWith('image/'));
    if (hasImage) return <ImageIcon className="h-4 w-4" />;
    const hasFile = attachments?.some(a => a);
    if (hasFile) return <File className="h-4 w-4" />;
    return <FileText className="h-4 w-4" />;
  };

  const hasActiveFilters =
    selectedGroup !== 'all' ||
    selectedType !== 'all' ||
    selectedLabel !== 'all' ||
    selectedTimeframe !== 'all';

  const resetFilters = () => {
    setSelectedGroup('all');
    setSelectedType('all');
    setSelectedLabel('all');
    setSelectedTimeframe('all');
    setPage(1);
  };

  // Pagination
  const totalPages = Math.ceil(filteredNotes.length / NOTES_PER_PAGE);
  const paginatedNotes = filteredNotes.slice(
    (page - 1) * NOTES_PER_PAGE,
    page * NOTES_PER_PAGE
  );

  const handleRetry = () => {
    refetchGroups();
    refetchNotes();
  };

  if (isError) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto px-4 py-8">
          <ErrorState 
            title="Failed to load notes"
            message="We couldn't load your notes. Please check your connection and try again."
            onRetry={handleRetry}
          />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <SEOHead title="All Notes" description="Browse and search notes from all your groups." />
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">All Notes</h1>
          <p className="text-muted-foreground">
            Browse notes from all your groups
          </p>
          <Badge variant="secondary" className="mt-2">
            {filteredNotes.length} {filteredNotes.length === 1 ? 'note' : 'notes'}
          </Badge>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search notes by title, content, or group name..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-wrap gap-3">
          <Select value={selectedGroup} onValueChange={(v) => { setSelectedGroup(v); setPage(1); }}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Groups" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Groups</SelectItem>
              {(groups as Group[]).map(group => (
                <SelectItem key={group.id} value={group.id}>
                  {group.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedType} onValueChange={(v) => { setSelectedType(v); setPage(1); }}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="text">Text</SelectItem>
              <SelectItem value="image">Image</SelectItem>
              <SelectItem value="file">File</SelectItem>
            </SelectContent>
          </Select>

          {allLabels.length > 0 && (
            <Select value={selectedLabel} onValueChange={(v) => { setSelectedLabel(v); setPage(1); }}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Labels" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Labels</SelectItem>
                {allLabels.map(label => (
                  <SelectItem key={label} value={label}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Select value={selectedTimeframe} onValueChange={(v) => { setSelectedTimeframe(v); setPage(1); }}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Time" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button variant="outline" onClick={resetFilters}>
              <X className="h-4 w-4 mr-2" />
              Reset
            </Button>
          )}
        </div>

        {/* Notes Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : paginatedNotes.length > 0 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {paginatedNotes.map(note => {
                const group = (groups as Group[]).find(g => g.id === note.group_id);
              return (
                <Card
                  key={note.id}
                  className="p-4 hover:shadow-lg transition-shadow cursor-pointer group"
                  onClick={() => navigate(`/group/${note.group_id}`)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <Badge
                      className={`bg-gradient-to-r ${getColorClass(
                        group?.color
                      )} text-white border-0`}
                    >
                      {group?.name}
                    </Badge>
                    {getNoteTypeIcon(note)}
                  </div>

                  <h3 className="font-semibold text-lg mb-2 line-clamp-2">
                    {note.title}
                  </h3>

                  {note.content && (
                    <p className="text-muted-foreground text-sm mb-3 line-clamp-3">
                      {note.content}
                    </p>
                  )}

                  {note.labels && note.labels.length > 0 && (
                    <div className="flex gap-2 flex-wrap mb-3">
                      {note.labels.slice(0, 3).map(label => (
                        <Badge key={label} variant="secondary" className="text-xs">
                          {label}
                        </Badge>
                      ))}
                      {note.labels.length > 3 && (
                        <Badge variant="secondary" className="text-xs">
                          +{note.labels.length - 3}
                        </Badge>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{note.author_name}</span>
                    <span>{note.created_at ? format(new Date(note.created_at), 'MMM d, yyyy') : ''}</span>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full mt-3 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/group/${note.group_id}`);
                    }}
                  >
                    <ExternalLink className="h-3 w-3 mr-2" />
                    Go to {group?.name}
                  </Button>
                </Card>
              );
            })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Next
                </Button>
              </div>
            )}
          </>
        ) : (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground mb-4">
              {searchTerm || hasActiveFilters
                ? 'No notes match your search or filters'
                : 'No notes found'}
            </p>
            {!searchTerm && !hasActiveFilters && (
              <Button onClick={() => navigate('/dashboard')}>
                Go to Dashboard
              </Button>
            )}
          </Card>
        )}
      </div>
    </Layout>
  );
}
