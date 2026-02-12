import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  FolderOpen,
  Folder,
  FolderPlus,
  ChevronRight,
  ChevronDown,
  MoreHorizontal,
  Pencil,
  Trash2,
  FileText,
  Plus,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface FolderType {
  id: string;
  group_id: string;
  parent_id: string | null;
  name: string;
  color: string;
  created_by: string;
}

interface FolderTreeProps {
  groupId: string;
  selectedFolderId: string | null;
  onSelectFolder: (folderId: string | null) => void;
  noteCountByFolder: Record<string, number>;
  totalUnfoldered: number;
}

export function FolderTree({
  groupId,
  selectedFolderId,
  onSelectFolder,
  noteCountByFolder,
  totalUnfoldered,
}: FolderTreeProps) {
  const { user } = useAuth();
  const [folders, setFolders] = useState<FolderType[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [creatingFolder, setCreatingFolder] = useState<string | null>(null); // parent_id or 'root'
  const [newFolderName, setNewFolderName] = useState('');
  const [editingFolder, setEditingFolder] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  useEffect(() => {
    fetchFolders();
  }, [groupId]);

  const fetchFolders = async () => {
    const { data, error } = await supabase
      .from('folders')
      .select('*')
      .eq('group_id', groupId)
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching folders:', error);
      return;
    }
    setFolders(data || []);
  };

  const handleCreateFolder = async (parentId: string | null) => {
    if (!newFolderName.trim() || !user) return;

    try {
      const { error } = await supabase.from('folders').insert({
        group_id: groupId,
        parent_id: parentId,
        name: newFolderName.trim(),
        created_by: user.id,
      });

      if (error) throw error;
      setNewFolderName('');
      setCreatingFolder(null);
      fetchFolders();
      toast({ title: 'Folder created' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to create folder', variant: 'destructive' });
    }
  };

  const handleRenameFolder = async (folderId: string) => {
    if (!editName.trim()) return;

    try {
      const { error } = await supabase
        .from('folders')
        .update({ name: editName.trim() })
        .eq('id', folderId);

      if (error) throw error;
      setEditingFolder(null);
      setEditName('');
      fetchFolders();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to rename folder', variant: 'destructive' });
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    try {
      // Move notes in this folder to unfiled
      await supabase
        .from('notes')
        .update({ folder_id: null })
        .eq('folder_id', folderId);

      const { error } = await supabase.from('folders').delete().eq('id', folderId);
      if (error) throw error;

      if (selectedFolderId === folderId) {
        onSelectFolder(null);
      }
      fetchFolders();
      toast({ title: 'Folder deleted' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete folder', variant: 'destructive' });
    }
  };

  const toggleExpanded = (folderId: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  const rootFolders = folders.filter((f) => !f.parent_id);
  const getChildren = (parentId: string) => folders.filter((f) => f.parent_id === parentId);

  const renderFolder = (folder: FolderType, depth: number = 0) => {
    const children = getChildren(folder.id);
    const isExpanded = expandedFolders.has(folder.id);
    const isSelected = selectedFolderId === folder.id;
    const noteCount = noteCountByFolder[folder.id] || 0;

    return (
      <div key={folder.id}>
        <div
          className={`flex items-center gap-1 px-2 py-1.5 rounded-md cursor-pointer transition-colors group ${
            isSelected ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
          }`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
        >
          {children.length > 0 ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleExpanded(folder.id);
              }}
              className="p-0.5"
            >
              {isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </button>
          ) : (
            <span className="w-4" />
          )}

          <div
            className="flex items-center gap-2 flex-1 min-w-0"
            onClick={() => onSelectFolder(isSelected ? null : folder.id)}
          >
            {isExpanded ? (
              <FolderOpen className="h-4 w-4 flex-shrink-0" />
            ) : (
              <Folder className="h-4 w-4 flex-shrink-0" />
            )}

            {editingFolder === folder.id ? (
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRenameFolder(folder.id);
                  if (e.key === 'Escape') setEditingFolder(null);
                }}
                onBlur={() => handleRenameFolder(folder.id)}
                className="h-6 text-xs px-1"
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className="text-sm truncate">{folder.name}</span>
            )}

            {noteCount > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-auto">
                {noteCount}
              </Badge>
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => {
                  setCreatingFolder(folder.id);
                  toggleExpanded(folder.id);
                }}
              >
                <FolderPlus className="h-4 w-4 mr-2" />
                New Subfolder
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setEditingFolder(folder.id);
                  setEditName(folder.name);
                }}
              >
                <Pencil className="h-4 w-4 mr-2" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleDeleteFolder(folder.id)}
                className="text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Children & Create Subfolder */}
        {isExpanded && (
          <div>
            {children.map((child) => renderFolder(child, depth + 1))}
            {creatingFolder === folder.id && (
              <div
                className="flex items-center gap-2 px-2 py-1"
                style={{ paddingLeft: `${(depth + 1) * 16 + 8}px` }}
              >
                <Folder className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <Input
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateFolder(folder.id);
                    if (e.key === 'Escape') setCreatingFolder(null);
                  }}
                  placeholder="Folder name"
                  className="h-6 text-xs px-1"
                  autoFocus
                />
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between px-2 mb-2">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Folders
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={() => setCreatingFolder('root')}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* All Notes (unfiled) */}
      <div
        className={`flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors ${
          selectedFolderId === null ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
        }`}
        onClick={() => onSelectFolder(null)}
      >
        <FileText className="h-4 w-4" />
        <span className="text-sm">All Notes</span>
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-auto">
          {totalUnfoldered}
        </Badge>
      </div>

      {/* Folder Tree */}
      {rootFolders.map((folder) => renderFolder(folder))}

      {/* Create Root Folder */}
      {creatingFolder === 'root' && (
        <div className="flex items-center gap-2 px-2 py-1">
          <Folder className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <Input
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateFolder(null);
              if (e.key === 'Escape') setCreatingFolder(null);
            }}
            placeholder="Folder name"
            className="h-6 text-xs px-1"
            autoFocus
          />
        </div>
      )}
    </div>
  );
}
