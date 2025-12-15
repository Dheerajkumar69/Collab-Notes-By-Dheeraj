import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ 
  title = 'Something went wrong', 
  message = 'Failed to load data. Please try again.',
  onRetry 
}: ErrorStateProps) {
  return (
    <Card className="p-12 text-center">
      <AlertTriangle className="mx-auto mb-4 text-destructive" size={48} />
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground mb-6">{message}</p>
      {onRetry && (
        <Button onClick={onRetry} variant="outline" className="gap-2">
          <RefreshCw size={16} />
          Try Again
        </Button>
      )}
    </Card>
  );
}
