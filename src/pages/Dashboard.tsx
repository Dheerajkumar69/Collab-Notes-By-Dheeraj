import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Search, Users, FileText, TrendingUp, Folder } from 'lucide-react';
import { CreateGroupDialog } from '@/components/CreateGroupDialog';
import { JoinGroupDialog } from '@/components/JoinGroupDialog';
import { useGroups, useProfile, useStats } from '@/hooks/supabase-hooks';
import { useRealtimeGroups } from '@/hooks/useRealtimeSubscription';
import { ErrorState } from '@/components/ErrorState';
import { SEOHead } from '@/components/SEOHead';
import type { Tables } from '@/integrations/supabase/types';

type Group = Tables<'groups'>;

export default function Dashboard() {
  const { data: groups = [], isLoading: groupsLoading, isError: groupsError, refetch: refetchGroups } = useGroups();
  const { data: userProfile, isLoading: profileLoading, isError: profileError, refetch: refetchProfile } = useProfile();
  const { data: stats = { groups: 0, notes: 0, thisWeek: 0 }, isLoading: statsLoading, isError: statsError, refetch: refetchStats } = useStats();
  
  // Enable realtime updates for groups
  useRealtimeGroups();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const GROUPS_PER_PAGE = 9;

  const getColorClass = (color: string) => {
    const colorMap: Record<string, string> = {
      blue: 'from-blue-500 to-blue-600',
      green: 'from-green-500 to-green-600',
      purple: 'from-purple-500 to-purple-600',
      orange: 'from-orange-500 to-orange-500',
      pink: 'from-pink-500 to-pink-600',
      indigo: 'from-indigo-500 to-indigo-600',
    };
    return colorMap[color] || colorMap.blue;
  };

  const filteredGroups = (groups as Group[])
    .filter(g => g.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      if (sortBy === 'oldest') return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
      if (sortBy === 'name-asc') return a.name.localeCompare(b.name);
      if (sortBy === 'name-desc') return b.name.localeCompare(a.name);
      return 0;
    });

  // Pagination logic
  const totalPages = Math.ceil(filteredGroups.length / GROUPS_PER_PAGE);
  const paginatedGroups = filteredGroups.slice(
    (currentPage - 1) * GROUPS_PER_PAGE,
    currentPage * GROUPS_PER_PAGE
  );

  // Reset page when search changes
  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const handleRetry = () => {
    refetchGroups();
    refetchProfile();
    refetchStats();
  };

  if (groupsLoading || profileLoading || statsLoading) {
    return (
      <Layout>
        <div className="container py-8">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        </div>
      </Layout>
    );
  }

  if (groupsError || profileError || statsError) {
    return (
      <Layout>
        <div className="container py-8">
          <ErrorState 
            title="Failed to load dashboard"
            message="We couldn't load your data. Please check your connection and try again."
            onRetry={handleRetry}
          />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <SEOHead title="Dashboard" description="Manage your collaborative workspaces and notes." />
      <div className="container py-8">
        {/* Welcome Header */}
        <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">
            Welcome back, {userProfile?.full_name?.split(' ')[0] || 'there'}!
          </h1>
          <p className="text-muted-foreground text-lg">Manage your collaborative workspaces</p>
          <div className="flex gap-3 mt-4">
            <Button className="bg-gradient-primary gap-2" onClick={() => setCreateDialogOpen(true)}>
              <Plus size={18} />
              Create Group
            </Button>
            <Button variant="outline" onClick={() => setJoinDialogOpen(true)}>
              Join Group
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                  <Folder className="text-white" size={24} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Your Groups</p>
                  <p className="text-2xl font-bold">{stats.groups}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
                  <FileText className="text-white" size={24} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Recent Notes</p>
                  <p className="text-2xl font-bold">{stats.notes}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
                  <TrendingUp className="text-white" size={24} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">This Week</p>
                  <p className="text-2xl font-bold">{stats.thisWeek || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search & Sort */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <Input
              placeholder="Search groups..."
              value={searchTerm}
              onChange={e => handleSearchChange(e.target.value)}
              className="pl-10"
            />
          </div>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className="px-4 py-2 rounded-lg border bg-background"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="name-asc">Name (A-Z)</option>
            <option value="name-desc">Name (Z-A)</option>
          </select>
        </div>

        {/* Groups Grid */}
        {filteredGroups.length === 0 ? (
          <Card className="p-12 text-center">
            <Folder className="mx-auto mb-4 text-muted-foreground" size={48} />
            <h3 className="text-xl font-semibold mb-2">No groups yet</h3>
            <p className="text-muted-foreground mb-6">
              Create your first group to start collaborating
            </p>
            <Button className="bg-gradient-primary" onClick={() => setCreateDialogOpen(true)}>
              Create Your First Group
            </Button>
          </Card>
        ) : (
          <>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {paginatedGroups.map(group => (
                <Link key={group.id} to={`/group/${group.id}`}>
                  <Card className="h-full hover:shadow-xl transition-all duration-300 hover:-translate-y-1 overflow-hidden">
                    <div
                      className={`h-32 bg-gradient-to-br ${getColorClass(group.color)} flex items-center justify-center relative`}
                      style={
                        group.background_image_url
                          ? { backgroundImage: `url(${group.background_image_url})`, backgroundSize: 'cover' }
                          : {}
                      }
                    >
                      <Folder className="text-white" size={48} />
                    </div>
                    <CardContent className="p-6">
                      <h3 className="text-xl font-bold mb-2">{group.name}</h3>
                      <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                        {group.description || 'No description'}
                      </p>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <FileText size={14} />
                          <span>Notes</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Users size={14} />
                          <span>{(group.members?.length || 0) + 1} members</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-4 mt-8">
                <Button
                  variant="outline"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => prev - 1)}
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => prev + 1)}
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      <CreateGroupDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} onSuccess={() => {}} />
      <JoinGroupDialog open={joinDialogOpen} onOpenChange={setJoinDialogOpen} onSuccess={() => {}} />
    </Layout>
  );
}
