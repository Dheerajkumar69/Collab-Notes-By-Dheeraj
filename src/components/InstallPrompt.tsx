import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [showPrompt, setShowPrompt] = useState(false);
    const [isInstalled, setIsInstalled] = useState(false);
    const isMobile = useIsMobile();

    useEffect(() => {
        // Check if already installed
        if (window.matchMedia('(display-mode: standalone)').matches) {
            setIsInstalled(true);
            return;
        }

        // Check if dismissed recently (don't show for 7 days)
        const dismissedAt = localStorage.getItem('pwa-install-dismissed');
        if (dismissedAt) {
            const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
            if (parseInt(dismissedAt) > sevenDaysAgo) {
                return;
            }
        }

        const handleBeforeInstall = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e as BeforeInstallPromptEvent);
            // Show prompt after a short delay
            setTimeout(() => setShowPrompt(true), 2000);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstall);

        // Detect if installed after the fact
        window.addEventListener('appinstalled', () => {
            setIsInstalled(true);
            setShowPrompt(false);
            setDeferredPrompt(null);
        });

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
        };
    }, []);

    const handleInstall = async () => {
        if (!deferredPrompt) return;

        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;

        if (outcome === 'accepted') {
            setShowPrompt(false);
            setDeferredPrompt(null);
        }
    };

    const handleDismiss = () => {
        setShowPrompt(false);
        localStorage.setItem('pwa-install-dismissed', Date.now().toString());
    };

    // Only show on mobile devices and when we have a prompt
    if (!isMobile || isInstalled || !showPrompt || !deferredPrompt) {
        return null;
    }

    return (
        <AnimatePresence>
            <motion.div
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 100, opacity: 0 }}
                className="fixed bottom-0 left-0 right-0 z-50 p-4 safe-area-pb"
            >
                <div className="bg-background border border-border rounded-2xl shadow-2xl p-4 mx-auto max-w-md">
                    <div className="flex items-start gap-4">
                        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center flex-shrink-0">
                            <Smartphone className="h-6 w-6 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-lg">Install CollabNotes</h3>
                            <p className="text-sm text-muted-foreground mt-1">
                                Add to your home screen for quick access and a better experience!
                            </p>
                            <div className="flex gap-2 mt-3">
                                <Button
                                    size="sm"
                                    onClick={handleInstall}
                                    className="gap-2 bg-gradient-to-r from-primary to-secondary"
                                >
                                    <Download className="h-4 w-4" />
                                    Install App
                                </Button>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={handleDismiss}
                                >
                                    Not now
                                </Button>
                            </div>
                        </div>
                        <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 flex-shrink-0"
                            onClick={handleDismiss}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
