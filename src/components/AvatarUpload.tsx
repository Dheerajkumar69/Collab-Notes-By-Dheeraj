import { useState, useRef } from 'react';
import { Camera, Loader2, Trash2, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface AvatarUploadProps {
    currentAvatarUrl?: string | null;
    fullName?: string;
    onUploadComplete?: (url: string) => void;
}

export function AvatarUpload({ currentAvatarUrl, fullName, onUploadComplete }: AvatarUploadProps) {
    const { user } = useAuth();
    const { toast } = useToast();
    const [uploading, setUploading] = useState(false);
    const [avatarUrl, setAvatarUrl] = useState(currentAvatarUrl);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            toast({
                title: 'Invalid file type',
                description: 'Please select an image file (JPG, PNG, GIF)',
                variant: 'destructive',
            });
            return;
        }

        // Validate file size (max 2MB)
        if (file.size > 2 * 1024 * 1024) {
            toast({
                title: 'File too large',
                description: 'Please select an image under 2MB',
                variant: 'destructive',
            });
            return;
        }

        setUploading(true);

        try {
            // Create unique filename
            const fileExt = file.name.split('.').pop();
            const fileName = `avatar-${Date.now()}.${fileExt}`;
            const filePath = `${user.id}/${fileName}`;

            // Upload to Supabase Storage
            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, file, { upsert: true });

            if (uploadError) throw uploadError;

            // Get public URL
            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath);

            // Update profile with new avatar URL
            const { error: updateError } = await supabase
                .from('profiles')
                .update({ avatar_url: publicUrl })
                .eq('id', user.id);

            if (updateError) throw updateError;

            setAvatarUrl(publicUrl);
            onUploadComplete?.(publicUrl);

            toast({
                title: 'Avatar updated!',
                description: 'Your profile picture has been changed.',
            });
        } catch (error: any) {
            console.error('Avatar upload error:', error);
            toast({
                title: 'Upload failed',
                description: error.message || 'Could not upload avatar',
                variant: 'destructive',
            });
        } finally {
            setUploading(false);
            // Reset input
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const handleRemoveAvatar = async () => {
        if (!user) return;

        setUploading(true);
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ avatar_url: null })
                .eq('id', user.id);

            if (error) throw error;

            setAvatarUrl(null);
            onUploadComplete?.('');

            toast({
                title: 'Avatar removed',
                description: 'Your profile picture has been removed.',
            });
        } catch (error: any) {
            toast({
                title: 'Error',
                description: 'Could not remove avatar',
                variant: 'destructive',
            });
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="flex items-center gap-4">
            <div className="relative group">
                <Avatar className="h-20 w-20">
                    <AvatarImage src={avatarUrl || undefined} alt={fullName} />
                    <AvatarFallback className="bg-gradient-to-br from-primary to-secondary text-white text-2xl">
                        {fullName?.[0]?.toUpperCase() || <User className="h-8 w-8" />}
                    </AvatarFallback>
                </Avatar>

                {/* Overlay on hover */}
                <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                >
                    {uploading ? (
                        <Loader2 className="h-6 w-6 text-white animate-spin" />
                    ) : (
                        <Camera className="h-6 w-6 text-white" />
                    )}
                </button>
            </div>

            <div className="space-y-2">
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                />
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="gap-2"
                >
                    {uploading ? (
                        <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Uploading...
                        </>
                    ) : (
                        <>
                            <Camera className="h-4 w-4" />
                            Change Photo
                        </>
                    )}
                </Button>
                {avatarUrl && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleRemoveAvatar}
                        disabled={uploading}
                        className="gap-2 text-muted-foreground hover:text-destructive"
                    >
                        <Trash2 className="h-4 w-4" />
                        Remove
                    </Button>
                )}
                <p className="text-xs text-muted-foreground">
                    JPG, PNG or GIF. Max 2MB.
                </p>
            </div>
        </div>
    );
}
