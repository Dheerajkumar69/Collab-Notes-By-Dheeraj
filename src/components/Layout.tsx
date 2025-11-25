import { ReactNode, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, Home, FileText, Shield, Sun, Moon, Menu, User, LogOut } from 'lucide-react';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from './ui/sheet';
import { Badge } from './ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';

interface Notification {
  id: string;
  message: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

export const Layout = ({ children }: { children: ReactNode }) => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    if (savedTheme) {
      setTheme(savedTheme);
      if (savedTheme === 'dark') {
        document.documentElement.classList.add('dark');
      }
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchNotifications();
      checkAdminStatus();
      fetchUserProfile();
    }
  }, [user]);

  const fetchUserProfile = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    setUserProfile(data);
  };

  const fetchNotifications = async () => {
    if (!user) return;
    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', user.id)
      .single();

    if (profile) {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('recipient_email', profile.email)
        .order('created_at', { ascending: false })
        .limit(10);

      if (data) setNotifications(data);
    }
  };

  const checkAdminStatus = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    setIsAdmin(!!data);
  };

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const markAsRead = async (notificationId: string, link: string | null) => {
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId);

    setNotifications(prev =>
      prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
    );

    if (link) navigate(link);
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const NavLinks = () => (
    <>
      <Link to="/dashboard">
        <Button variant="ghost" className="gap-2">
          <Home size={18} />
          Dashboard
        </Button>
      </Link>
      <Link to="/all-notes">
        <Button variant="ghost" className="gap-2">
          <FileText size={18} />
          All Notes
        </Button>
      </Link>
      {isAdmin && (
        <Link to="/admin">
          <Button variant="ghost" className="gap-2">
            <Shield size={18} />
            Admin
          </Button>
        </Link>
      )}
    </>
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/dashboard" className="flex items-center gap-2">
              <img src="/logo.png" alt="CollabNotes Logo" className="h-8 w-8 rounded-lg object-contain" />
              <span className="text-xl font-bold">CollabNotes</span>
            </Link>
            <nav className="hidden md:flex items-center gap-2">
              <NavLinks />
            </nav>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={toggleTheme}>
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                  <Bell size={18} />
                  {unreadCount > 0 && (
                    <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
                      {unreadCount}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <div className="p-2 font-semibold">Notifications</div>
                <DropdownMenuSeparator />
                {notifications.length === 0 ? (
                  <div className="p-4 text-sm text-muted-foreground text-center">
                    No notifications
                  </div>
                ) : (
                  notifications.map(notification => (
                    <DropdownMenuItem
                      key={notification.id}
                      className={`p-3 cursor-pointer ${!notification.is_read ? 'bg-muted/50' : ''}`}
                      onClick={() => markAsRead(notification.id, notification.link)}
                    >
                      <div className="flex flex-col gap-1">
                        <p className="text-sm">{notification.message}</p>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                        </span>
                      </div>
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <div className="h-8 w-8 rounded-full bg-gradient-primary flex items-center justify-center text-white font-semibold">
                    {userProfile?.full_name?.[0] || user?.email?.[0].toUpperCase()}
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <div className="p-2">
                  <p className="text-sm font-medium">{userProfile?.full_name}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
                <DropdownMenuSeparator />
                <Link to="/profile">
                  <DropdownMenuItem>
                    <User size={16} className="mr-2" />
                    Profile
                  </DropdownMenuItem>
                </Link>
                <DropdownMenuItem onClick={signOut}>
                  <LogOut size={16} className="mr-2" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Sheet>
              <SheetTrigger asChild className="md:hidden">
                <Button variant="ghost" size="icon">
                  <Menu size={18} />
                </Button>
              </SheetTrigger>
              <SheetContent>
                <nav className="flex flex-col gap-4 mt-8">
                  <NavLinks />
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <main>{children}</main>
    </div>
  );
};
