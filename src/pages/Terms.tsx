import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import logo from '@/assets/collabnotes-logo.png';

export default function Terms() {
  return (
    <>
      <SEOHead 
        title="Terms of Service" 
        description="Read the terms and conditions for using CollabNotes."
      />
      <div className="min-h-screen bg-background">
        <header className="border-b bg-background/95 backdrop-blur">
          <div className="container flex h-16 items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <img src={logo} alt="CollabNotes" className="h-10 w-10 rounded-full object-cover" />
              <span className="font-semibold">CollabNotes</span>
            </Link>
            <Link to="/">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft size={16} />
                Back
              </Button>
            </Link>
          </div>
        </header>

        <main className="container max-w-3xl py-12">
          <h1 className="text-4xl font-bold mb-8">Terms of Service</h1>
          
          <div className="prose prose-slate dark:prose-invert max-w-none space-y-6">
            <p className="text-muted-foreground">Last updated: January 2025</p>

            <section>
              <h2 className="text-2xl font-semibold mt-8 mb-4">1. Acceptance of Terms</h2>
              <p className="text-muted-foreground">
                By accessing and using CollabNotes, you accept and agree to be bound by the terms and conditions of this agreement. If you do not agree to these terms, please do not use our service.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mt-8 mb-4">2. Description of Service</h2>
              <p className="text-muted-foreground">
                CollabNotes provides a collaborative note-taking platform that allows users to create, share, and manage notes within groups. Our service includes real-time collaboration features, file attachments, and team communication tools.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mt-8 mb-4">3. User Accounts</h2>
              <p className="text-muted-foreground">
                You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to notify us immediately of any unauthorized use of your account.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mt-8 mb-4">4. User Content</h2>
              <p className="text-muted-foreground">
                You retain ownership of content you create using CollabNotes. By using our service, you grant us a license to store, display, and share your content as necessary to provide the service. You are responsible for ensuring you have the rights to any content you upload.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mt-8 mb-4">5. Acceptable Use</h2>
              <p className="text-muted-foreground">
                You agree not to use CollabNotes for any unlawful purpose or in any way that could damage, disable, or impair the service. You may not attempt to gain unauthorized access to any part of the service or its related systems.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mt-8 mb-4">6. Termination</h2>
              <p className="text-muted-foreground">
                We reserve the right to terminate or suspend your account at any time for violations of these terms or for any other reason at our discretion. Upon termination, your right to use the service will immediately cease.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mt-8 mb-4">7. Limitation of Liability</h2>
              <p className="text-muted-foreground">
                CollabNotes is provided "as is" without warranties of any kind. We shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the service.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mt-8 mb-4">8. Changes to Terms</h2>
              <p className="text-muted-foreground">
                We may modify these terms at any time. Continued use of the service after changes constitutes acceptance of the modified terms.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mt-8 mb-4">9. Contact</h2>
              <p className="text-muted-foreground">
                If you have any questions about these Terms of Service, please contact us through the application.
              </p>
            </section>
          </div>
        </main>

        <footer className="border-t py-8">
          <div className="container flex justify-center gap-6 text-sm text-muted-foreground">
            <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
            <Link to="/help" className="hover:text-foreground transition-colors">Help</Link>
          </div>
        </footer>
      </div>
    </>
  );
}