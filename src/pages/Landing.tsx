import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Users, FileText, Share2, Lock, Palette, Bell, ArrowRight } from 'lucide-react';
import heroImage from '@/assets/hero-bg.jpg';

export default function Landing() {
  const features = [
    {
      icon: Users,
      title: 'Collaborative Groups',
      description: 'Create groups and invite team members to collaborate seamlessly on shared notes.',
    },
    {
      icon: FileText,
      title: 'Rich Note Taking',
      description: 'Support for markdown, images, files, and organized content with labels and colors.',
    },
    {
      icon: Share2,
      title: 'Easy Sharing',
      description: 'Share notes instantly with group members using simple invite codes.',
    },
    {
      icon: Lock,
      title: 'Access Control',
      description: 'Manage who can view and edit your notes with granular permissions.',
    },
    {
      icon: Palette,
      title: 'Customizable',
      description: 'Personalize your workspace with colors, labels, and custom backgrounds.',
    },
    {
      icon: Bell,
      title: 'Smart Notifications',
      description: 'Stay updated with real-time notifications for all group activities.',
    },
  ];

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-primary" />
            <span className="text-xl font-bold">CollabNotes</span>
          </div>
          <Link to="/auth">
            <Button variant="default" className="bg-gradient-primary">
              Sign In
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-10"
          style={{ backgroundImage: `url(${heroImage})` }}
        />
        <div className="container relative py-24 md:py-32">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-6 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Share Notes, Seamlessly
            </h1>
            <p className="text-xl text-muted-foreground mb-8">
              Create collaborative workspaces, share rich notes with your team, and manage content together in real-time. Perfect for teams, projects, and knowledge sharing.
            </p>
            <div className="flex gap-4 justify-center">
              <Link to="/auth">
                <Button size="lg" className="bg-gradient-primary gap-2">
                  Get Started for Free
                  <ArrowRight size={18} />
                </Button>
              </Link>
              <Button 
                size="lg" 
                variant="outline"
                onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
              >
                Learn More
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 bg-muted/30">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Everything you need to collaborate</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Powerful features designed to make team collaboration effortless and productive.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div
                  key={index}
                  className="bg-card rounded-xl p-6 border hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
                >
                  <div className="h-12 w-12 rounded-lg bg-gradient-primary flex items-center justify-center mb-4">
                    <Icon className="text-white" size={24} />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24">
        <div className="container">
          <div className="rounded-2xl bg-gradient-primary p-12 text-center text-white">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Ready to transform your collaboration?
            </h2>
            <p className="text-xl mb-8 opacity-90">
              Join thousands of teams already using CollabNotes to work better together.
            </p>
            <Link to="/auth">
              <Button size="lg" variant="secondary" className="gap-2">
                Start for Free
                <ArrowRight size={18} />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container text-center text-sm text-muted-foreground">
          © 2025 CollabNotes. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
