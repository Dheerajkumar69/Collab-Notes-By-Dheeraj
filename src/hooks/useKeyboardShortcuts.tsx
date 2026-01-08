import { useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

interface ShortcutHandlers {
    onNewNote?: () => void;
    onSearch?: () => void;
    onCreateGroup?: () => void;
}

/**
 * Global keyboard shortcuts hook
 * - Ctrl/Cmd + N: New note (when onNewNote provided) or navigate to Dashboard
 * - Ctrl/Cmd + K: Focus search
 * - Escape: Close dialogs/modals
 */
export function useKeyboardShortcuts(handlers: ShortcutHandlers = {}) {
    const navigate = useNavigate();
    const location = useLocation();

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        // Check if user is typing in an input/textarea
        const target = e.target as HTMLElement;
        const isTyping = target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.isContentEditable;

        // Ctrl/Cmd + N: New note or navigate to dashboard
        if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
            e.preventDefault();
            if (handlers.onNewNote) {
                handlers.onNewNote();
            } else if (handlers.onCreateGroup) {
                handlers.onCreateGroup();
            } else {
                navigate('/dashboard');
            }
            return;
        }

        // Ctrl/Cmd + K: Focus search
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            if (handlers.onSearch) {
                handlers.onSearch();
            } else {
                // Try to focus the search input on the page
                const searchInput = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement;
                if (searchInput) {
                    searchInput.focus();
                    searchInput.select();
                }
            }
            return;
        }

        // Escape: Blur current element (closes dialogs via Radix)
        if (e.key === 'Escape' && !isTyping) {
            // Let Radix UI handle dialog closing
            // Blur any focused element to help with modal cleanup
            if (document.activeElement instanceof HTMLElement) {
                document.activeElement.blur();
            }
            return;
        }
    }, [handlers, navigate]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);
}

/**
 * Display keyboard shortcuts hint
 */
export function KeyboardShortcutsHint() {
    return (
        <div className="text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 text-[10px] font-semibold bg-muted border border-border rounded">Ctrl</kbd>
                <span>+</span>
                <kbd className="px-1.5 py-0.5 text-[10px] font-semibold bg-muted border border-border rounded">K</kbd>
                <span className="ml-1">to search</span>
            </span>
        </div>
    );
}
