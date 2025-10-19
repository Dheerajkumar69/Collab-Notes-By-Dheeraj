import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Layout } from '@/components/Layout';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Users, Shield, FolderOpen, FileText, Info } from 'lucide-react';

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
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalAdmins: 0,
    totalGroups: 0,
    totalNotes: 0,
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

      // Calculate stats
      const adminCount =
        rolesData?.filter(r => r.role === 'admin').length || 0;

      setStats({
        totalUsers: profilesData?.length || 0,
        totalAdmins: adminCount,
        totalGroups: groupsData?.length || 0,
        totalNotes: notesCount || 0,
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
  ];

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

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
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
      </div>
    </Layout>
  );
}
