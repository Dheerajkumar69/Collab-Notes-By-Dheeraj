import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, CheckCheck, X, Inbox } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useDismissNotification,
} from '@/hooks/supabase-hooks';
import { cn } from '@/lib/utils';

type Filter = 'all' | 'unread';

export function NotificationsPanel() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>('all');
  const { data: notifications = [] } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const dismiss = useDismissNotification();

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.is_read).length,
    [notifications]
  );

  const filtered = useMemo(
    () => (filter === 'unread' ? notifications.filter((n) => !n.is_read) : notifications),
    [notifications, filter]
  );

  const handleClick = (id: string, link: string | null, isRead: boolean | null) => {
    if (!isRead) markRead.mutate(id);
    if (link) navigate(link);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell size={18} />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 min-w-[1.25rem] rounded-full p-0 flex items-center justify-center text-[10px] px-1">
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <div className="flex items-center gap-2">
            <Inbox size={16} className="text-muted-foreground" />
            <span className="font-semibold text-sm">Inbox</span>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="text-[10px]">
                {unreadCount} unread
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs"
            disabled={unreadCount === 0 || markAllRead.isPending}
            onClick={() => markAllRead.mutate()}
          >
            <CheckCheck size={14} />
            Mark all read
          </Button>
        </div>

        <div className="flex gap-1 px-2 py-2 border-b">
          {(['all', 'unread'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'text-xs px-3 py-1 rounded-full capitalize transition-colors',
                filter === f
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted'
              )}
            >
              {f}
            </button>
          ))}
        </div>

        <ScrollArea className="max-h-96">
          {filtered.length === 0 ? (
            <div className="p-8 text-center">
              <Inbox className="mx-auto mb-2 text-muted-foreground" size={32} />
              <p className="text-sm text-muted-foreground">
                {filter === 'unread' ? "You're all caught up" : 'No notifications yet'}
              </p>
            </div>
          ) : (
            <ul className="divide-y">
              {filtered.map((n) => {
                const count = (n as { count?: number }).count ?? 1;
                const timestamp = (n as { updated_at?: string }).updated_at ?? n.created_at;
                return (
                  <li
                    key={n.id}
                    className={cn(
                      'group relative flex items-start gap-2 px-3 py-3 hover:bg-muted/50 transition-colors',
                      !n.is_read && 'bg-primary/5'
                    )}
                  >
                    <button
                      className="flex-1 text-left min-w-0"
                      onClick={() => handleClick(n.id, n.link, n.is_read)}
                    >
                      <div className="flex items-start gap-2">
                        {!n.is_read && (
                          <span className="mt-1.5 h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm break-words">
                            {n.message}
                            {count > 1 && (
                              <Badge variant="secondary" className="ml-2 text-[10px]">
                                ×{count}
                              </Badge>
                            )}
                          </p>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(timestamp!), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                    </button>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!n.is_read && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            markRead.mutate(n.id);
                          }}
                          aria-label="Mark read"
                        >
                          <Check size={14} />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => {
                          e.stopPropagation();
                          dismiss.mutate(n.id);
                        }}
                        aria-label="Dismiss"
                      >
                        <X size={14} />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}