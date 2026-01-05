import { Link, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Home, ArrowLeft, Search } from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import logo from '@/assets/collabnotes-logo.png';

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error('404 Error: User attempted to access non-existent route:', location.pathname);
  }, [location.pathname]);

  return (
    <>
      <SEOHead 
        title="Page Not Found" 
        description="The page you're looking for doesn't exist or has been moved."
      />
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <div className="text-center max-w-md">
          <img src={logo} alt="CollabNotes" className="h-16 w-16 rounded-full object-cover mx-auto mb-6" />
          
          <div className="relative mb-6">
            <h1 className="text-8xl font-bold text-primary/20">404</h1>
            <div className="absolute inset-0 flex items-center justify-center">
              <Search className="h-12 w-12 text-muted-foreground" />
            </div>
          </div>
          
          <h2 className="text-2xl font-bold mb-2">Page not found</h2>
          <p className="text-muted-foreground mb-8">
            Sorry, we couldn't find the page you're looking for. It might have been moved or doesn't exist.
          </p>
          
          <div className="flex gap-3 justify-center">
            <Button onClick={() => window.history.back()} variant="outline" className="gap-2">
              <ArrowLeft size={16} />
              Go Back
            </Button>
            <Link to="/">
              <Button className="bg-gradient-primary gap-2">
                <Home size={16} />
                Home
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </>
  );
};

export default NotFound;