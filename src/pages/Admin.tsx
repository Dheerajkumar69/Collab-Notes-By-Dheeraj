import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Layout } from '@/components/Layout';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Users, Shield, FolderOpen, FileText, Info, Cloud, Archive, Loader2,
  MessageSquare, Bug, Lightbulb, Wrench, HelpCircle, CheckCircle, XCircle, Eye
} from 'lucide-react';
import { useTelegramSync } from '@/hooks/useTelegramSync';
import { useAllFeedback, useUpdateFeedbackStatus, type Feedback } from '@/hooks/useFeedback';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';

interface StatsCard {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}

interface Profile {
  id: string;
  email: string;
  full_name: string;
}

interface UserRole {
  user_id: string;
  role: string;
}

interface Group {
  id: string;
  name: string;
  created_by: string;
  members?: string[];
}

export default function Admin() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { bulkSyncNotes, autoArchiveOldNotes } = useTelegramSync();
  const { data: allFeedback = [], isLoading: feedbackLoading } = useAllFeedback();
  const updateFeedbackStatus = useUpdateFeedbackStatus();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalAdmins: 0,
    totalGroups: 0,
    totalNotes: 0,
    archivedNotes: 0,
    syncedNotes: 0,
    totalFeedback: 0,
  });
  const [users, setUsers] = useState<Profile[]>([]);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);

  useEffect(() => {
    checkAdminStatus();
  }, [user]);

  const checkAdminStatus = async () => {
    if (!user) {
      navigate('/');
      return;
    }

    // Temporary bypass for the specific test user
    // REMOVE THIS IN PRODUCTION
    if (user.email === 'dksgamery@gmail.com') {
      setIsAdmin(true);
      fetchAdminData();
      return;
    }

    try {
      const { data, error } = await supabase.rpc('has_role', {
        _user_id: user.id,
        _role: 'admin',
      });

      if (error) throw error;

      if (!data) {
        navigate('/dashboard');
        return;
      }

      setIsAdmin(true);
      fetchAdminData();
    } catch (error: any) {
      console.error('Error checking admin status:', error);
      navigate('/dashboard');
    }
  };

  const fetchAdminData = async () => {
    try {
      // Fetch all profiles
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      setUsers(profilesData || []);

      // Fetch all user roles
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('*');

      setUserRoles(rolesData || []);

      // Fetch all groups
      const { data: groupsData } = await supabase
        .from('groups')
        .select('*')
        .order('created_at', { ascending: false });

      setGroups(groupsData || []);

      // Fetch total notes count
      const { count: notesCount } = await supabase
        .from('notes')
        .select('*', { count: 'exact', head: true });

      // Fetch archived notes count
      const { count: archivedCount } = await supabase
        .from('notes')
        .select('*', { count: 'exact', head: true })
        .eq('is_archived', true);

      // Fetch synced notes count
      const { count: syncedCount } = await supabase
        .from('notes')
        .select('*', { count: 'exact', head: true })
        .not('telegram_message_id', 'is', null);

      // Calculate stats
      const adminCount =
        rolesData?.filter(r => r.role === 'admin').length || 0;

      setStats({
        totalUsers: profilesData?.length || 0,
        totalAdmins: adminCount,
        totalGroups: groupsData?.length || 0,
        totalNotes: notesCount || 0,
        archivedNotes: archivedCount || 0,
        syncedNotes: syncedCount || 0,
        totalFeedback: 0, // Will be updated from hook
      });
    } catch (error: any) {
      console.error('Error fetching admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getUserRole = (userId: string): string => {
    const role = userRoles.find(r => r.user_id === userId);
    return role?.role || 'user';
  };

  const getCreatorEmail = (userId: string): string => {
    const user = users.find(u => u.id === userId);
    return user?.email || 'Unknown';
  };

  const handleBulkSync = async () => {
    setSyncing(true);
    await bulkSyncNotes();
    await fetchAdminData();
    setSyncing(false);
  };

  const handleAutoArchive = async () => {
    setArchiving(true);
    await autoArchiveOldNotes();
    await fetchAdminData();
    setArchiving(false);
  };

  const statsCards: StatsCard[] = [
    {
      title: 'Total Users',
      value: stats.totalUsers,
      icon: <Users className="h-6 w-6" />,
      color: 'from-blue-500 to-blue-600',
    },
    {
      title: 'Total Admins',
      value: stats.totalAdmins,
      icon: <Shield className="h-6 w-6" />,
      color: 'from-indigo-500 to-indigo-600',
    },
    {
      title: 'Total Groups',
      value: stats.totalGroups,
      icon: <FolderOpen className="h-6 w-6" />,
      color: 'from-purple-500 to-purple-600',
    },
    {
      title: 'Total Notes',
      value: stats.totalNotes,
      icon: <FileText className="h-6 w-6" />,
      color: 'from-pink-500 to-pink-600',
    },
    {
      title: 'Synced to Telegram',
      value: stats.syncedNotes,
      icon: <Cloud className="h-6 w-6" />,
      color: 'from-cyan-500 to-cyan-600',
    },
    {
      title: 'Archived Notes',
      value: stats.archivedNotes,
      icon: <Archive className="h-6 w-6" />,
      color: 'from-amber-500 to-amber-600',
    },
    {
      title: 'User Feedback',
      value: allFeedback.length,
      icon: <MessageSquare className="h-6 w-6" />,
      color: 'from-green-500 to-green-600',
    },
  ];

  const getFeedbackIcon = (type: Feedback['type']) => {
    switch (type) {
      case 'bug': return <Bug className="h-4 w-4 text-red-500" />;
      case 'feature': return <Lightbulb className="h-4 w-4 text-yellow-500" />;
      case 'improvement': return <Wrench className="h-4 w-4 text-blue-500" />;
      default: return <HelpCircle className="h-4 w-4 text-purple-500" />;
    }
  };

  const getStatusBadge = (status: Feedback['status']) => {
    switch (status) {
      case 'pending': return <Badge variant="secondary">Pending</Badge>;
      case 'reviewed': return <Badge className="bg-blue-500 text-white">Reviewed</Badge>;
      case 'resolved': return <Badge className="bg-green-500 text-white">Resolved</Badge>;
      case 'dismissed': return <Badge variant="outline">Dismissed</Badge>;
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Admin Dashboard</h1>
          <p className="text-muted-foreground">Platform administration and monitoring</p>
        </div>

        {/* Info Alert */}
        <Alert className="mb-6">
          <Info className="h-4 w-4" />
          <AlertDescription>
            Admin role assignment requires a paid subscription. Contact support for more information.
          </AlertDescription>
        </Alert>

        {/* Telegram Sync Controls */}
        <Card className="p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Cloud className="h-5 w-5" />
            Telegram Storage Management
          </h2>
          <p className="text-muted-foreground mb-4">
            Manage note synchronization with Telegram. Notes are automatically synced when created.
          </p>
          <div className="flex gap-4 flex-wrap">
            <Button
              onClick={handleBulkSync}
              disabled={syncing}
              className="bg-gradient-to-r from-cyan-600 to-blue-600"
            >
              {syncing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Cloud className="h-4 w-4 mr-2" />
              )}
              Sync All Notes to Telegram
            </Button>
            <Button
              onClick={handleAutoArchive}
              disabled={archiving}
              variant="outline"
            >
              {archiving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Archive className="h-4 w-4 mr-2" />
              )}
              Archive Notes Older Than 30 Days
            </Button>
          </div>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {statsCards.map(stat => (
            <Card key={stat.title} className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div
                  className={`p-3 rounded-xl bg-gradient-to-br ${stat.color} text-white`}
                >
                  {stat.icon}
                </div>
              </div>
              <p className="text-muted-foreground text-sm mb-1">{stat.title}</p>
              <p className="text-3xl font-bold">{stat.value}</p>
            </Card>
          ))}
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* All Users */}
          <div>
            <h2 className="text-2xl font-semibold mb-4">All Users</h2>
            <div className="space-y-3">
              {users.map(user => {
                const role = getUserRole(user.id);
                return (
                  <Card key={user.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarFallback className="bg-gradient-to-br from-indigo-600 to-purple-600 text-white">
                            {user.full_name?.charAt(0) || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{user.full_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {user.email}
                          </p>
                        </div>
                      </div>
                      <Badge
                        className={
                          role === 'admin'
                            ? 'bg-indigo-600 text-white'
                            : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200'
                        }
                      >
                        {role === 'admin' ? 'Admin' : 'User'}
                      </Badge>
                    </div>
                  </Card>
                );
              })}
              {users.length === 0 && (
                <Card className="p-8 text-center">
                  <p className="text-muted-foreground">No users found</p>
                </Card>
              )}
            </div>
          </div>

          {/* All Groups */}
          <div>
            <h2 className="text-2xl font-semibold mb-4">All Groups</h2>
            <div className="space-y-3">
              {groups.map(group => (
                <Card key={group.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{group.name}</p>
                      <p className="text-sm text-muted-foreground">
                        Created by: {getCreatorEmail(group.created_by)}
                      </p>
                    </div>
                    <Badge variant="secondary">
                      {group.members?.length || 0}{' '}
                      {group.members?.length === 1 ? 'member' : 'members'}
                    </Badge>
                  </div>
                </Card>
              ))}
              {groups.length === 0 && (
                <Card className="p-8 text-center">
                  <p className="text-muted-foreground">No groups found</p>
                </Card>
              )}
            </div>
          </div>
        </div>

        {/* User Feedback Section */}
        <div className="mt-8">
          <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
            <MessageSquare className="h-6 w-6" />
            User Feedback
          </h2>
          
          {feedbackLoading ? (
            <Card className="p-8 text-center">
              <Loader2 className="h-6 w-6 animate-spin mx-auto" />
            </Card>
          ) : allFeedback.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">No feedback received yet</p>
            </Card>
          ) : (
            <Tabs defaultValue="pending" className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="pending">
                  Pending ({allFeedback.filter(f => f.status === 'pending').length})
                </TabsTrigger>
                <TabsTrigger value="reviewed">
                  Reviewed ({allFeedback.filter(f => f.status === 'reviewed').length})
                </TabsTrigger>
                <TabsTrigger value="resolved">
                  Resolved ({allFeedback.filter(f => f.status === 'resolved').length})
                </TabsTrigger>
                <TabsTrigger value="all">All</TabsTrigger>
              </TabsList>

              {['pending', 'reviewed', 'resolved', 'all'].map(tab => (
                <TabsContent key={tab} value={tab} className="space-y-4">
                  {(tab === 'all' ? allFeedback : allFeedback.filter(f => f.status === tab))
                    .map(feedback => (
                      <Card key={feedback.id} className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              {getFeedbackIcon(feedback.type)}
                              <span className="font-semibold">{feedback.subject}</span>
                              {getStatusBadge(feedback.status)}
                            </div>
                            <p className="text-sm text-muted-foreground mb-2">
                              {feedback.message}
                            </p>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span>From: {feedback.user_name || feedback.user_email}</span>
                              <span>{format(new Date(feedback.created_at), 'MMM d, yyyy HH:mm')}</span>
                            </div>
                          </div>
                          <div className="flex gap-2 shrink-0">
                            {feedback.status === 'pending' && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => updateFeedbackStatus.mutate({ id: feedback.id, status: 'reviewed' })}
                                  disabled={updateFeedbackStatus.isPending}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  className="bg-green-600 hover:bg-green-700"
                                  onClick={() => updateFeedbackStatus.mutate({ id: feedback.id, status: 'resolved' })}
                                  disabled={updateFeedbackStatus.isPending}
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => updateFeedbackStatus.mutate({ id: feedback.id, status: 'dismissed' })}
                                  disabled={updateFeedbackStatus.isPending}
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            {feedback.status === 'reviewed' && (
                              <Button
                                size="sm"
                                className="bg-green-600 hover:bg-green-700"
                                onClick={() => updateFeedbackStatus.mutate({ id: feedback.id, status: 'resolved' })}
                                disabled={updateFeedbackStatus.isPending}
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Resolve
                              </Button>
                            )}
                          </div>
                        </div>
                      </Card>
                    ))}
                </TabsContent>
              ))}
            </Tabs>
          )}
        </div>
      </div>
    </Layout>
  );
}