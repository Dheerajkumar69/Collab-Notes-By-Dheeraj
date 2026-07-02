import { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Copy, Settings, Trash2, UserX, Plus, Search, Activity } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { CreateNoteDialog } from '@/components/CreateNoteDialog';
import { GroupSettings } from '@/components/GroupSettings';
import { NoteCard } from '@/components/NoteCard';
import { EditRequestsPanel } from '@/components/EditRequestsPanel';
import { GroupChat } from '@/components/GroupChat';
import { useRealtimeNotes } from '@/hooks/useRealtimeSubscription';
import { useIsMobile } from '@/hooks/use-mobile';
import { QuickNoteInput } from '@/components/QuickNoteInput';
import { FolderTree } from '@/components/FolderTree';
import { useUserPresence, OnlineDot } from '@/components/UserPresence';
import { ActivityFeed } from '@/components/ActivityFeed';
import { htmlToPlainText } from '@/lib/sanitize';
import type { Attachment, EditRequest, Reaction, Profile as ProfileT } from '@/types';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Group {
  id: string;
  name: string;
  description?: string;
  color?: string;
  members?: string[];
  background_image_url?: string;
  created_by: string;
}

interface Note {
  id: string;
  title: string;
  content?: string | null;
  group_id: string;
  labels?: string[];
  author_name?: string | null;
  attachments?: Attachment[];
  is_pinned?: boolean;
  is_archived?: boolean;
  color?: string | null;
  edit_requests?: EditRequest[];
  reactions?: Reaction[];
  created_by: string;
  created_at: string;
  lecture_number?: number | null;
  topic?: string | null;
  folder_id?: string | null;
}

type Profile = ProfileT;

export default function GroupPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [group, setGroup] = useState<Group | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [members, setMembers] = useState<Profile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLabel, setSelectedLabel] = useState('All');
  const [showCreateNote, setShowCreateNote] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  
  // Presence tracking
  const onlineUsers = useUserPresence(id || '');

  // Enable realtime updates for notes in this group
  useRealtimeNotes(id);

  const isCreator = group?.created_by === user?.id;

  // Stable fetcher refs (no deps so they don't re-create across renders)
  const fetchGroup = useCallback(async () => {
    if (!id) return;
    const { data, error } = await supabase
      .from('groups')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      // PGRST116 = no rows; treat as 404, otherwise let caller decide
      if (error.code === 'PGRST116') {
        setGroup(null);
        return;
      }
      throw error;
    }
    setGroup(data as unknown as Group);
  }, [id]);

  const fetchMembersFor = useCallback(async (groupRow: { members?: string[] | null; created_by: string }) => {
    const allEmails = [...(groupRow.members || [])];
    const memberProfiles = allEmails.length > 0
      ? (await supabase.from('profiles').select('*').in('email', allEmails)).data || []
      : [];
    const { data: creatorProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', groupRow.created_by)
      .single();
    const allProfiles = [...memberProfiles] as Profile[];
    if (creatorProfile && !allProfiles.some(p => p.id === creatorProfile.id)) {
      allProfiles.unshift(creatorProfile as Profile);
    }
    setMembers(allProfiles);
  }, []);

  // Combined initial loader — parallelises queries and uses a single loading state
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const [groupRes, notesRes] = await Promise.all([
          supabase.from('groups').select('*').eq('id', id).single(),
          supabase
            .from('notes')
            .select('*')
            .eq('group_id', id)
            .order('is_pinned', { ascending: false })
            .order('lecture_number', { ascending: true, nullsFirst: false })
            .order('created_at', { ascending: false }),
        ]);

        if (cancelled) return;

        if (groupRes.error) {
          if (groupRes.error.code === 'PGRST116') {
            setGroup(null);
          } else {
            toast({ title: 'Error', description: 'Failed to load group', variant: 'destructive' });
            navigate('/dashboard');
            return;
          }
        } else {
          setGroup(groupRes.data as unknown as Group);
          // Reuse the freshly-fetched group row to avoid a duplicate query
          await fetchMembersFor(groupRes.data as unknown as { members?: string[]; created_by: string });
        }

        if (notesRes.error) {
          console.error('Error fetching notes:', notesRes.error);
        } else {
          setNotes((notesRes.data || []) as unknown as Note[]);
        }
      } catch (e) {
        if (!cancelled) {
          console.error('GroupPage initial load failed:', e);
          toast({ title: 'Error', description: 'Failed to load group', variant: 'destructive' });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [id, navigate, fetchMembersFor]);

  const fetchNotes = async () => {
    try {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('group_id', id)
        .order('is_pinned', { ascending: false })
        .order('lecture_number', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotes((data || []) as unknown as Note[]);
    } catch (error: any) {
      console.error('Error fetching notes:', error);
    }
  };

  const fetchMembers = useCallback(async () => {
    if (!id) return;
    const { data: groupData } = await supabase
      .from('groups')
      .select('members, created_by')
      .eq('id', id)
      .single();
    if (groupData) await fetchMembersFor(groupData as { members?: string[]; created_by: string });
  }, [id, fetchMembersFor]);

  const copyInviteCode = async () => {
    try {
      const { data, error } = await supabase.rpc('get_group_invite_code', { p_group_id: id });
      if (error) throw error;
      if (!data) throw new Error('No invite code returned');
      navigator.clipboard.writeText(data);
      toast({
        title: 'Copied!',
        description: 'Invite code copied to clipboard',
      });
    } catch {
      toast({ title: 'Error', description: 'Could not retrieve invite code', variant: 'destructive' });
    }
  };

  const handleDeleteGroup = async () => {
    if (!id) return;
    try {
      // Cascading delete via SECURITY DEFINER RPC — wipes notes/messages/folders/etc atomically
      const { error } = await supabase.rpc('delete_group_cascade', { p_group_id: id });
      if (error) throw error;

      toast({ title: 'Success', description: 'Group deleted successfully' });
      navigate('/dashboard');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error?.message || 'Failed to delete group',
        variant: 'destructive',
      });
    }
  };

  const handleRemoveMember = async (email: string) => {
    if (!id) return;
    try {
      // Atomic array_remove via RPC — eliminates TOCTOU race when two admins act concurrently
      const { error } = await supabase.rpc('remove_group_member', {
        p_group_id: id,
        p_email: email,
      });
      if (error) throw error;

      toast({ title: 'Success', description: 'Member removed successfully' });
      await Promise.all([fetchMembers(), fetchGroup()]);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error?.message || 'Failed to remove member',
        variant: 'destructive',
      });
    }
  };

  const allLabels = useMemo(
    () => Array.from(new Set(notes.flatMap(note => note.labels || []))),
    [notes]
  );

  const filteredNotes = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return notes.filter(note => {
      if (note.is_archived) return false;
      if (q) {
        const titleMatch = note.title.toLowerCase().includes(q);
        // Search visible text, not raw HTML markup
        const contentText = note.content ? htmlToPlainText(note.content).toLowerCase() : '';
        if (!titleMatch && !contentText.includes(q)) return false;
      }
      if (selectedLabel !== 'All' && !note.labels?.includes(selectedLabel)) return false;
      if (selectedFolderId !== null && note.folder_id !== selectedFolderId) return false;
      return true;
    });
  }, [notes, searchTerm, selectedLabel, selectedFolderId]);

  // Compute note counts per folder (memoized)
  const { noteCountByFolder, totalUnfoldered } = useMemo(() => {
    const counts: Record<string, number> = {};
    let unfoldered = 0;
    for (const n of notes) {
      if (n.is_archived) continue;
      if (n.folder_id) counts[n.folder_id] = (counts[n.folder_id] || 0) + 1;
      else unfoldered += 1;
    }
    return { noteCountByFolder: counts, totalUnfoldered: unfoldered };
  }, [notes]);

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

  const pendingEditRequests = useMemo(
    () => notes.filter(note => note.edit_requests?.some(req => req.status === 'pending')),
    [notes]
  );

  const renderNotesPanel = () => (
    <>
      {isCreator && pendingEditRequests.length > 0 && (
        <EditRequestsPanel
          notes={pendingEditRequests}
          onReview={fetchNotes}
        />
      )}

       {/* Quick Note Input - Simple text-only notepad */}
       <QuickNoteInput groupId={id!} onSuccess={fetchNotes} />

       {/* Folder Sidebar + Notes */}
       <div className="flex gap-4 mb-6">
         <div className="w-48 flex-shrink-0 hidden lg:block">
           <FolderTree
             groupId={id!}
             selectedFolderId={selectedFolderId}
             onSelectFolder={setSelectedFolderId}
             noteCountByFolder={noteCountByFolder}
             totalUnfoldered={totalUnfoldered}
           />
         </div>
         <div className="flex-1">

       {/* Search & Filter */}
      <div className="mb-6 space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search notes..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button
            onClick={() => setShowCreateNote(true)}
            className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Note
          </Button>
        </div>

        {allLabels.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={selectedLabel === 'All' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedLabel('All')}
            >
              All
            </Button>
            {allLabels.map(label => (
              <Button
                key={label}
                variant={selectedLabel === label ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedLabel(label)}
              >
                {label}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Notes Masonry/Bento Grid */}
      {filteredNotes.length > 0 ? (
        <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4 mb-8 [column-fill:_balance]">
          {filteredNotes.map(note => (
            <div key={note.id} className="break-inside-avoid mb-4">
            <NoteCard
              note={note}
              onUpdate={fetchNotes}
              onEdit={() => {
                setEditingNote(note);
                setShowCreateNote(true);
              }}
              isCreator={isCreator}
            />
            </div>
          ))}
        </div>
      ) : (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground mb-4">No notes yet</p>
          <Button
            onClick={() => setShowCreateNote(true)}
            className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
          >
            Create Your First Note
          </Button>
        </Card>
      )}
    </div>
    </div>
    </>
  );

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </Layout>
    );
  }

  if (!group) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-muted-foreground">Group not found</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen">
        {/* Header */}
         <div
           className={`bg-gradient-to-br ${getColorClass(group.color)} text-white p-8 mb-6 rounded-xl relative overflow-hidden min-h-[200px]`}
           style={
             group.background_image_url
               ? {
                 backgroundImage: `url(${group.background_image_url})`,
                 backgroundSize: 'cover',
                 backgroundPosition: 'center',
               }
               : {}
           }
         >
            {/* Dark overlay for background images so buttons stay visible.
                pointer-events-none guarantees clicks always reach the buttons. */}
            {group.background_image_url && (
              <div className="absolute inset-0 bg-black/50 pointer-events-none z-0" />
            )}
            <div className="max-w-4xl mx-auto relative z-20">
             <div className="flex items-start justify-between mb-4">
               <div>
                 <h1 className="text-4xl font-bold mb-2">{group.name}</h1>
                 {group.description && (
                   <p className="text-white/90">{group.description}</p>
                 )}
               </div>
                <div className="flex gap-2 relative z-20">
                 {isCreator && (
                   <>
                     <Button
                       variant="ghost"
                       size="icon"
                       onClick={() => setShowSettings(true)}
                         className="text-white hover:bg-white/25 bg-black/50 backdrop-blur-md border border-white/20 shadow-lg"
                        aria-label="Group settings"
                     >
                       <Settings className="h-5 w-5" />
                     </Button>
                     <Button
                       variant="ghost"
                       size="icon"
                       onClick={() => setShowDeleteDialog(true)}
                        className="text-white hover:bg-white/25 bg-black/50 backdrop-blur-md border border-white/20 shadow-lg"
                        aria-label="Delete group"
                     >
                       <Trash2 className="h-5 w-5" />
                     </Button>
                   </>
                 )}
               </div>
             </div>
             <div className="flex gap-4 text-sm relative z-20 flex-wrap items-center">
              <Badge variant="secondary" className="bg-white/20 text-white border-0">
                {members.length} {members.length === 1 ? 'member' : 'members'}
              </Badge>
              <Badge variant="secondary" className="bg-white/20 text-white border-0">
                {notes.length} {notes.length === 1 ? 'note' : 'notes'}
              </Badge>
              {isCreator && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={copyInviteCode}
                  className="text-white hover:bg-white/25 bg-black/50 backdrop-blur-md border border-white/20 shadow-lg h-7 px-3"
                >
                  <Copy className="h-3 w-3 mr-1" />
                  Copy Invite Code
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-7xl mx-auto px-4">
          {isMobile ? (
            // Mobile: Separate tabs for Chat, Notes, and Members
             <Tabs defaultValue="chat" className="w-full">
              <TabsList className="mb-6 w-full grid grid-cols-4">
                <TabsTrigger value="chat">💬 Chat</TabsTrigger>
                <TabsTrigger value="notes">📝 Notes</TabsTrigger>
                <TabsTrigger value="members">👥 Members</TabsTrigger>
                <TabsTrigger value="activity"><Activity className="h-3 w-3 mr-1 inline" />Activity</TabsTrigger>
              </TabsList>

              <TabsContent value="chat" className="mt-0">
                <div className="h-[calc(100vh-280px)] min-h-[400px]">
                  <GroupChat groupId={id!} />
                </div>
              </TabsContent>

              <TabsContent value="notes" className="mt-0">
                {renderNotesPanel()}
              </TabsContent>

              <TabsContent value="members">
                <div className="space-y-3">
                  {members.map(member => {
                    const isMemberCreator = member.id === group.created_by;
                    return (
                      <Card
                        key={member.id}
                        className={`p-4 ${isMemberCreator ? 'bg-indigo-50 dark:bg-indigo-950' : ''
                          }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                       <Avatar className="relative">
                              <AvatarFallback className="bg-gradient-to-br from-indigo-600 to-purple-600 text-white">
                                {member.full_name?.charAt(0) || 'U'}
                              </AvatarFallback>
                              <OnlineDot isOnline={onlineUsers.has(member.id)} />
                            </Avatar>
                            <div>
                              <p className="font-medium">{member.full_name}</p>
                              {isCreator && (
                                <p className="text-sm text-muted-foreground">
                                  {member.email}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {isMemberCreator && (
                              <Badge className="bg-indigo-600 text-white">Admin</Badge>
                            )}
                            {isCreator && !isMemberCreator && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveMember(member.email)}
                                className="text-destructive hover:text-destructive"
                              >
                                <UserX className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </TabsContent>
              <TabsContent value="activity">
                <ActivityFeed groupId={id!} />
              </TabsContent>
            </Tabs>
          ) : (
            // Desktop: Separate tabs for Chat, Notes, and Members
            <Tabs defaultValue="chat" className="w-full">
              <TabsList className="mb-6">
                <TabsTrigger value="chat">💬 Chat</TabsTrigger>
                <TabsTrigger value="notes">📝 Notes</TabsTrigger>
                <TabsTrigger value="members">👥 Members</TabsTrigger>
                <TabsTrigger value="activity"><Activity className="h-3 w-3 mr-1 inline" />Activity</TabsTrigger>
              </TabsList>

              <TabsContent value="chat" className="mt-0">
                <div className="h-[calc(100vh-280px)] min-h-[500px] rounded-lg border">
                  <GroupChat groupId={id!} />
                </div>
              </TabsContent>

              <TabsContent value="notes" className="mt-0">
                {renderNotesPanel()}
              </TabsContent>

              <TabsContent value="members">
                <div className="space-y-3">
                  {members.map(member => {
                    const isMemberCreator = member.id === group.created_by;
                    return (
                      <Card
                        key={member.id}
                        className={`p-4 ${isMemberCreator ? 'bg-indigo-50 dark:bg-indigo-950' : ''
                          }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Avatar className="relative">
                              <AvatarFallback className="bg-gradient-to-br from-indigo-600 to-purple-600 text-white">
                                {member.full_name?.charAt(0) || 'U'}
                              </AvatarFallback>
                              <OnlineDot isOnline={onlineUsers.has(member.id)} />
                            </Avatar>
                            <div>
                              <p className="font-medium">{member.full_name}</p>
                              {isCreator && (
                                <p className="text-sm text-muted-foreground">
                                  {member.email}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {isMemberCreator && (
                              <Badge className="bg-indigo-600 text-white">Admin</Badge>
                            )}
                            {isCreator && !isMemberCreator && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveMember(member.email)}
                                className="text-destructive hover:text-destructive"
                              >
                                <UserX className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </TabsContent>
              <TabsContent value="activity">
                <ActivityFeed groupId={id!} />
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>

      <CreateNoteDialog
        open={showCreateNote}
        onOpenChange={(open) => {
          setShowCreateNote(open);
          if (!open) setEditingNote(null);
        }}
        groupId={id!}
        onSuccess={() => {
          fetchNotes();
          setShowCreateNote(false);
          setEditingNote(null);
        }}
        editingNote={editingNote}
      />

      {isCreator && (
        <GroupSettings
          open={showSettings}
          onOpenChange={setShowSettings}
          group={group}
          onSuccess={fetchGroup}
        />
      )}

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Group</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the group and all its notes. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteGroup} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
