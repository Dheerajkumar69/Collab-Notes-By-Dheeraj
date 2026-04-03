import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Search, Users, FileText, TrendingUp, Folder, Download } from 'lucide-react';
import { CreateGroupDialog } from '@/components/CreateGroupDialog';
import { JoinGroupDialog } from '@/components/JoinGroupDialog';
import { FeedbackDialog } from '@/components/FeedbackDialog';
import { ExportNotesDialog } from '@/components/ExportNotesDialog';
import { ArchivedNotesSection } from '@/components/ArchivedNotesSection';
import { CommandPalette } from '@/components/CommandPalette';
import { GlobalSearch } from '@/components/GlobalSearch';
import { UpcomingReminders } from '@/components/NoteReminder';
import { useGroups, useProfile, useStats } from '@/hooks/supabase-hooks';
import { useRealtimeGroups } from '@/hooks/useRealtimeSubscription';
import { ErrorState } from '@/components/ErrorState';
import { SEOHead } from '@/components/SEOHead';
import { DashboardSkeleton } from '@/components/motion/Skeleton';
import { EmptyState } from '@/components/motion/EmptyState';
import { FadeIn, StaggerContainer, StaggerItem, ScaleOnHover } from '@/components/motion/PageTransition';
import { useKeyboardShortcuts, KeyboardShortcutsHint } from '@/hooks/useKeyboardShortcuts';
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
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const GROUPS_PER_PAGE = 9;

  // Keyboard shortcuts with command palette
  useKeyboardShortcuts({
    onCreateGroup: () => setCreateDialogOpen(true),
    onSearch: () => searchInputRef.current?.focus(),
    onOpenCommandPalette: () => setCommandPaletteOpen(true),
  });

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
        <DashboardSkeleton />
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
        <FadeIn>
          <div className="mb-8">
            <motion.h1
              className="text-4xl font-bold mb-2"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
            >
              Welcome back,{' '}
              <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                {userProfile?.full_name?.split(' ')[0] || 'there'}
              </span>
              ! 👋
            </motion.h1>
            <p className="text-muted-foreground text-lg">Manage your collaborative workspaces</p>
            <div className="flex flex-wrap gap-3 mt-4">
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                  className="bg-gradient-to-r from-primary to-secondary hover:opacity-90 gap-2 shadow-lg shadow-primary/25"
                  onClick={() => setCreateDialogOpen(true)}
                >
                  <Plus size={18} />
                  Create Group
                </Button>
              </motion.div>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button variant="outline" onClick={() => setJoinDialogOpen(true)}>
                  Join Group
                </Button>
              </motion.div>
              <ExportNotesDialog />
              <FeedbackDialog />
              <KeyboardShortcutsHint />
            </div>
          </div>
        </FadeIn>

        {/* Stats Cards */}
        <StaggerContainer className="grid md:grid-cols-3 gap-6 mb-8">
          <StaggerItem>
            <ScaleOnHover>
              <Card className="hover:shadow-xl transition-all border-2 hover:border-blue-500/30 overflow-hidden group">
                <CardContent className="p-6 relative">
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"
                  />
                  <div className="flex items-center gap-4 relative z-10">
                    <motion.div
                      className="h-14 w-14 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30"
                      whileHover={{ rotate: [0, -10, 10, 0], scale: 1.1 }}
                      transition={{ duration: 0.5 }}
                    >
                      <Folder className="text-white" size={28} />
                    </motion.div>
                    <div>
                      <p className="text-sm text-muted-foreground font-medium">Your Groups</p>
                      <motion.p
                        className="text-3xl font-bold"
                        key={stats.groups}
                        initial={{ scale: 1.2, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                      >
                        {stats.groups}
                      </motion.p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </ScaleOnHover>
          </StaggerItem>

          <StaggerItem>
            <ScaleOnHover>
              <Card className="hover:shadow-xl transition-all border-2 hover:border-green-500/30 overflow-hidden group">
                <CardContent className="p-6 relative">
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"
                  />
                  <div className="flex items-center gap-4 relative z-10">
                    <motion.div
                      className="h-14 w-14 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center shadow-lg shadow-green-500/30"
                      whileHover={{ rotate: [0, -10, 10, 0], scale: 1.1 }}
                      transition={{ duration: 0.5 }}
                    >
                      <FileText className="text-white" size={28} />
                    </motion.div>
                    <div>
                      <p className="text-sm text-muted-foreground font-medium">Total Notes</p>
                      <motion.p
                        className="text-3xl font-bold"
                        key={stats.notes}
                        initial={{ scale: 1.2, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                      >
                        {stats.notes}
                      </motion.p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </ScaleOnHover>
          </StaggerItem>

          <StaggerItem>
            <ScaleOnHover>
              <Card className="hover:shadow-xl transition-all border-2 hover:border-purple-500/30 overflow-hidden group">
                <CardContent className="p-6 relative">
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"
                  />
                  <div className="flex items-center gap-4 relative z-10">
                    <motion.div
                      className="h-14 w-14 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/30"
                      whileHover={{ rotate: [0, -10, 10, 0], scale: 1.1 }}
                      transition={{ duration: 0.5 }}
                    >
                      <TrendingUp className="text-white" size={28} />
                    </motion.div>
                    <div>
                      <p className="text-sm text-muted-foreground font-medium">This Week</p>
                      <motion.p
                        className="text-3xl font-bold"
                        key={stats.thisWeek}
                        initial={{ scale: 1.2, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                      >
                        {stats.thisWeek || 0}
                      </motion.p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </ScaleOnHover>
          </StaggerItem>
        </StaggerContainer>

        {/* Search & Sort */}
        <FadeIn delay={0.2}>
          <motion.div
            className="flex flex-col md:flex-row gap-4 mb-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
              <Input
                ref={searchInputRef}
                placeholder="Search groups... (Ctrl+K)"
                value={searchTerm}
                onChange={e => handleSearchChange(e.target.value)}
                className="pl-10 h-12 text-base border-2 focus:border-primary/50 transition-colors"
              />
            </div>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="px-4 py-2 rounded-lg border-2 bg-background h-12 focus:border-primary/50 transition-colors cursor-pointer"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="name-asc">Name (A-Z)</option>
              <option value="name-desc">Name (Z-A)</option>
            </select>
          </motion.div>
        </FadeIn>

        {/* Groups Grid */}
        {filteredGroups.length === 0 ? (
          <Card className="border-2 border-dashed">
            <EmptyState
              type="groups"
              title="No groups yet"
              description="Create your first group to start collaborating with your team. It only takes a few seconds!"
              action={{
                label: "Create Your First Group",
                onClick: () => setCreateDialogOpen(true),
              }}
            />
          </Card>
        ) : (
          <>
            <StaggerContainer className="grid md:grid-cols-2 lg:grid-cols-3 gap-6" staggerDelay={0.05}>
              {paginatedGroups.map(group => (
                <StaggerItem key={group.id}>
                  <Link to={`/group/${group.id}`}>
                    <motion.div
                      whileHover={{ y: -8, boxShadow: '0 20px 40px -15px hsl(243 75% 59% / 0.2)' }}
                      whileTap={{ scale: 0.98 }}
                      className="h-full"
                    >
                      <Card className="h-full overflow-hidden border-2 hover:border-primary/30 transition-all group cursor-pointer">
                        <motion.div
                          className={`h-32 bg-gradient-to-br ${getColorClass(group.color)} flex items-center justify-center relative overflow-hidden`}
                          style={
                            group.background_image_url
                              ? { backgroundImage: `url(${group.background_image_url})`, backgroundSize: 'cover' }
                              : {}
                          }
                        >
                          {/* Animated overlay on hover */}
                          <motion.div
                            className="absolute inset-0 bg-white/10"
                            initial={{ x: '-100%' }}
                            whileHover={{ x: '100%' }}
                            transition={{ duration: 0.5 }}
                          />
                          <motion.div
                            whileHover={{ scale: 1.2, rotate: 10 }}
                            transition={{ type: 'spring', stiffness: 300 }}
                          >
                            <Folder className="text-white drop-shadow-lg" size={48} />
                          </motion.div>
                        </motion.div>
                        <CardContent className="p-6">
                          <h3 className="text-xl font-bold mb-2 group-hover:text-primary transition-colors">{group.name}</h3>
                          <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                            {group.description || 'No description'}
                          </p>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1.5">
                              <FileText size={14} />
                              <span>Notes</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Users size={14} />
                              <span>{(group.members?.length || 0) + 1} members</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  </Link>
                </StaggerItem>
              ))}
            </StaggerContainer>

            {/* Pagination */}
            {totalPages > 1 && (
              <motion.div
                className="flex justify-center items-center gap-4 mt-8"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
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
              </motion.div>
            )}
          </>
        )}

        {/* Archived Notes Section */}
        <FadeIn delay={0.4}>
          <div className="mt-8">
            <ArchivedNotesSection />
          </div>
        </FadeIn>
      </div>

      <CreateGroupDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} onSuccess={() => { }} />
      <JoinGroupDialog open={joinDialogOpen} onOpenChange={setJoinDialogOpen} onSuccess={() => { }} />
      <CommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        onCreateGroup={() => setCreateDialogOpen(true)}
      />
    </Layout>
  );
}
