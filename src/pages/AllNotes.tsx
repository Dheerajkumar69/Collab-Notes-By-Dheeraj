import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
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
import { Search, FileText, Image as ImageIcon, File, ExternalLink, X } from 'lucide-react';
import { format, isToday, isThisWeek, isThisMonth } from 'date-fns';

interface Note {
  id: string;
  title: string;
  content?: string | null;
  group_id: string;
  labels?: string[];
  author_name?: string | null;
  attachments?: any;
  color?: string | null;
  created_at: string;
}

interface Group {
  id: string;
  name: string;
  color?: string;
}

export default function AllNotes() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedLabel, setSelectedLabel] = useState('all');
  const [selectedTimeframe, setSelectedTimeframe] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    try {
      // Fetch groups
      const { data: groupsData } = await supabase
        .from('groups')
        .select('*')
        .or(`created_by.eq.${user?.id},members.cs.{${user?.email}}`);

      setGroups(groupsData || []);

      // Fetch all notes from user's groups
      const groupIds = groupsData?.map(g => g.id) || [];
      if (groupIds.length > 0) {
        const { data: notesData } = await supabase
          .from('notes')
          .select('*')
          .in('group_id', groupIds)
          .order('created_at', { ascending: false });

        setNotes(notesData || []);
      }
    } catch (error: any) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const allLabels = Array.from(
    new Set(notes.flatMap(note => note.labels || []))
  );

  const filteredNotes = notes.filter(note => {
    // Search filter
    const matchesSearch =
      note.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      note.content?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      groups
        .find(g => g.id === note.group_id)
        ?.name.toLowerCase()
        .includes(searchTerm.toLowerCase());

    // Group filter
    const matchesGroup =
      selectedGroup === 'all' || note.group_id === selectedGroup;

    // Type filter
    let matchesType = true;
    if (selectedType !== 'all') {
      const hasImage = note.attachments?.some((a: any) =>
        a.type?.startsWith('image/')
      );
      const hasFile = note.attachments?.some(
        (a: any) => !a.type?.startsWith('image/')
      );
      if (selectedType === 'image') matchesType = hasImage || false;
      else if (selectedType === 'file') matchesType = hasFile || false;
      else matchesType = !hasImage && !hasFile;
    }

    // Label filter
    const matchesLabel =
      selectedLabel === 'all' || note.labels?.includes(selectedLabel);

    // Timeframe filter
    let matchesTimeframe = true;
    if (selectedTimeframe !== 'all') {
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

  const getColorClass = (color?: string) => {
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
    const hasImage = note.attachments?.some((a: any) =>
      a.type?.startsWith('image/')
    );
    if (hasImage) return <ImageIcon className="h-4 w-4" />;
    const hasFile = note.attachments?.some(a => a);
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
  };

  return (
    <Layout>
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
          <Select value={selectedGroup} onValueChange={setSelectedGroup}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Groups" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Groups</SelectItem>
              {groups.map(group => (
                <SelectItem key={group.id} value={group.id}>
                  {group.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedType} onValueChange={setSelectedType}>
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
            <Select value={selectedLabel} onValueChange={setSelectedLabel}>
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

          <Select value={selectedTimeframe} onValueChange={setSelectedTimeframe}>
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
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Loading...</div>
        ) : filteredNotes.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredNotes.map(note => {
              const group = groups.find(g => g.id === note.group_id);
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
                    <span>{format(new Date(note.created_at), 'MMM d, yyyy')}</span>
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
