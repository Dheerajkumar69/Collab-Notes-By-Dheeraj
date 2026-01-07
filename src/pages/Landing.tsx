import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Users, FileText, Share2, Lock, Palette, Bell, ArrowRight, Sparkles, Zap, Heart } from 'lucide-react';
import heroImage from '@/assets/hero-bg.jpg';
import logo from '@/assets/collabnotes-logo.png';
import { SEOHead } from '@/components/SEOHead';
import { FadeIn, FloatingElement, StaggerContainer, StaggerItem } from '@/components/motion/PageTransition';

export default function Landing() {
  const features = [
    {
      icon: Users,
      title: 'Collaborative Groups',
      description: 'Create groups and invite team members to collaborate seamlessly on shared notes.',
      gradient: 'from-blue-500 to-cyan-500',
    },
    {
      icon: FileText,
      title: 'Rich Note Taking',
      description: 'Support for markdown, images, files, and organized content with labels and colors.',
      gradient: 'from-purple-500 to-pink-500',
    },
    {
      icon: Share2,
      title: 'Easy Sharing',
      description: 'Share notes instantly with group members using simple invite codes.',
      gradient: 'from-green-500 to-emerald-500',
    },
    {
      icon: Lock,
      title: 'Access Control',
      description: 'Manage who can view and edit your notes with granular permissions.',
      gradient: 'from-orange-500 to-amber-500',
    },
    {
      icon: Palette,
      title: 'Customizable',
      description: 'Personalize your workspace with colors, labels, and custom backgrounds.',
      gradient: 'from-pink-500 to-rose-500',
    },
    {
      icon: Bell,
      title: 'Smart Notifications',
      description: 'Stay updated with real-time notifications for all group activities.',
      gradient: 'from-indigo-500 to-violet-500',
    },
  ];

  const stats = [
    { value: '10K+', label: 'Active Users' },
    { value: '50K+', label: 'Notes Created' },
    { value: '99.9%', label: 'Uptime' },
    { value: '4.9', label: 'User Rating' },
  ];

  return (
    <>
      <SEOHead />
      <div className="min-h-screen overflow-hidden">
        {/* Header */}
        <motion.header
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="fixed top-0 left-0 right-0 z-50 border-b bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60"
        >
          <div className="container flex h-16 items-center justify-between">
            <motion.div 
              className="flex items-center gap-3"
              whileHover={{ scale: 1.05 }}
            >
              <img src={logo} alt="CollabNotes" className="h-10 w-10 rounded-full object-cover shadow-lg" />
              <span className="font-bold text-xl bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                CollabNotes
              </span>
            </motion.div>
            <Link to="/auth">
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button className="bg-gradient-to-r from-primary to-secondary hover:opacity-90 shadow-lg shadow-primary/25">
                  <Sparkles className="h-4 w-4 mr-2" />
                  Sign In
                </Button>
              </motion.div>
            </Link>
          </div>
        </motion.header>

        {/* Hero Section */}
        <section className="relative min-h-screen flex items-center justify-center pt-16">
          {/* Animated background */}
          <div className="absolute inset-0 overflow-hidden">
            <div
              className="absolute inset-0 bg-cover bg-center opacity-5"
              style={{ backgroundImage: `url(${heroImage})` }}
            />
            {/* Gradient orbs */}
            <motion.div
              className="absolute top-1/4 -left-32 w-96 h-96 bg-primary/30 rounded-full blur-3xl"
              animate={{
                x: [0, 50, 0],
                y: [0, 30, 0],
              }}
              transition={{
                duration: 8,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
            <motion.div
              className="absolute bottom-1/4 -right-32 w-96 h-96 bg-secondary/30 rounded-full blur-3xl"
              animate={{
                x: [0, -50, 0],
                y: [0, -30, 0],
              }}
              transition={{
                duration: 10,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
            <motion.div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-r from-primary/10 to-secondary/10 rounded-full blur-3xl"
              animate={{
                scale: [1, 1.2, 1],
                rotate: [0, 180, 360],
              }}
              transition={{
                duration: 20,
                repeat: Infinity,
                ease: 'linear',
              }}
            />
          </div>

          {/* Floating decorative elements */}
          <FloatingElement className="absolute top-32 left-[15%] hidden lg:block" duration={4}>
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 shadow-xl flex items-center justify-center">
              <FileText className="h-8 w-8 text-white" />
            </div>
          </FloatingElement>
          <FloatingElement className="absolute top-48 right-[15%] hidden lg:block" duration={5} delay={1}>
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-500 shadow-xl flex items-center justify-center">
              <Heart className="h-7 w-7 text-white" />
            </div>
          </FloatingElement>
          <FloatingElement className="absolute bottom-32 left-[20%] hidden lg:block" duration={6} delay={2}>
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-500 shadow-xl flex items-center justify-center">
              <Users className="h-6 w-6 text-white" />
            </div>
          </FloatingElement>
          <FloatingElement className="absolute bottom-48 right-[20%] hidden lg:block" duration={4.5} delay={0.5}>
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 shadow-xl flex items-center justify-center">
              <Zap className="h-7 w-7 text-white" />
            </div>
          </FloatingElement>

          <div className="container relative py-24 md:py-32">
            <div className="mx-auto max-w-4xl text-center">
              <FadeIn>
                <motion.div
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-8"
                  whileHover={{ scale: 1.05 }}
                >
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium text-primary">The future of collaboration is here</span>
                </motion.div>
              </FadeIn>

              <FadeIn delay={0.1}>
                <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6">
                  <span className="bg-gradient-to-r from-foreground via-foreground to-foreground/80 bg-clip-text text-transparent">
                    Share Notes,
                  </span>
                  <br />
                  <span className="bg-gradient-to-r from-primary via-purple-500 to-secondary bg-clip-text text-transparent animate-gradient">
                    Seamlessly
                  </span>
                </h1>
              </FadeIn>

              <FadeIn delay={0.2}>
                <p className="text-xl md:text-2xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
                  Create collaborative workspaces, share rich notes with your team, and manage content together in{' '}
                  <span className="text-foreground font-semibold">real-time</span>.
                </p>
              </FadeIn>

              <FadeIn delay={0.3}>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Link to="/auth">
                    <motion.div whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.95 }}>
                      <Button size="lg" className="bg-gradient-to-r from-primary to-secondary hover:opacity-90 shadow-xl shadow-primary/30 text-lg px-8 h-14 gap-3">
                        Get Started for Free
                        <motion.div
                          animate={{ x: [0, 5, 0] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                        >
                          <ArrowRight className="h-5 w-5" />
                        </motion.div>
                      </Button>
                    </motion.div>
                  </Link>
                  <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                    <Button
                      size="lg"
                      variant="outline"
                      className="text-lg px-8 h-14 border-2"
                      onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
                    >
                      See How It Works
                    </Button>
                  </motion.div>
                </div>
              </FadeIn>

              {/* Stats */}
              <FadeIn delay={0.5}>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mt-20 pt-12 border-t border-border/50">
                  {stats.map((stat, index) => (
                    <motion.div
                      key={stat.label}
                      className="text-center"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.6 + index * 0.1 }}
                    >
                      <div className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                        {stat.value}
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">{stat.label}</div>
                    </motion.div>
                  ))}
                </div>
              </FadeIn>
            </div>
          </div>

          {/* Scroll indicator */}
          <motion.div
            className="absolute bottom-8 left-1/2 -translate-x-1/2"
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <div className="w-6 h-10 rounded-full border-2 border-muted-foreground/30 flex justify-center pt-2">
              <motion.div
                className="w-1.5 h-1.5 rounded-full bg-muted-foreground"
                animate={{ y: [0, 12, 0], opacity: [1, 0.5, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </div>
          </motion.div>
        </section>

        {/* Features Grid */}
        <section id="features" className="py-32 relative">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-muted/30 to-transparent" />
          <div className="container relative">
            <FadeIn>
              <div className="text-center mb-16">
                <motion.div
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/10 border border-secondary/20 mb-6"
                  whileHover={{ scale: 1.05 }}
                >
                  <Zap className="h-4 w-4 text-secondary" />
                  <span className="text-sm font-medium text-secondary">Powerful Features</span>
                </motion.div>
                <h2 className="text-4xl md:text-5xl font-bold mb-6">
                  Everything you need to{' '}
                  <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                    collaborate
                  </span>
                </h2>
                <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                  Powerful features designed to make team collaboration effortless and productive.
                </p>
              </div>
            </FadeIn>

            <StaggerContainer className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {features.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <StaggerItem key={index}>
                    <motion.div
                      className="bg-card rounded-2xl p-8 border hover:border-primary/50 transition-all duration-300 group cursor-pointer h-full"
                      whileHover={{ y: -8, boxShadow: '0 20px 40px -20px hsl(243 75% 59% / 0.3)' }}
                    >
                      <motion.div
                        className={`h-14 w-14 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-6 shadow-lg`}
                        whileHover={{ scale: 1.1, rotate: 5 }}
                        transition={{ type: 'spring', stiffness: 300 }}
                      >
                        <Icon className="text-white" size={28} />
                      </motion.div>
                      <h3 className="text-xl font-bold mb-3 group-hover:text-primary transition-colors">
                        {feature.title}
                      </h3>
                      <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
                    </motion.div>
                  </StaggerItem>
                );
              })}
            </StaggerContainer>
          </div>
        </section>

        {/* Social Proof */}
        <section className="py-24">
          <div className="container">
            <FadeIn>
              <div className="text-center mb-12">
                <h2 className="text-2xl font-bold text-muted-foreground mb-8">
                  Trusted by teams at
                </h2>
                <div className="flex flex-wrap justify-center items-center gap-12 opacity-50">
                  {['Google', 'Microsoft', 'Apple', 'Amazon', 'Meta'].map((company, i) => (
                    <motion.div
                      key={company}
                      className="text-2xl font-bold"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 0.5, y: 0 }}
                      transition={{ delay: i * 0.1 }}
                      whileHover={{ opacity: 1, scale: 1.1 }}
                    >
                      {company}
                    </motion.div>
                  ))}
                </div>
              </div>
            </FadeIn>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-24 relative">
          <div className="container">
            <motion.div
              className="relative rounded-3xl overflow-hidden"
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
            >
              {/* Animated background */}
              <div className="absolute inset-0 bg-gradient-to-r from-primary via-purple-600 to-secondary" />
              <motion.div
                className="absolute inset-0 opacity-30"
                style={{
                  background: 'radial-gradient(circle at 20% 50%, white 0%, transparent 50%)',
                }}
                animate={{
                  x: ['-20%', '120%'],
                }}
                transition={{
                  duration: 8,
                  repeat: Infinity,
                  ease: 'linear',
                }}
              />

              <div className="relative p-12 md:p-20 text-center text-white">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                >
                  <h2 className="text-4xl md:text-5xl font-bold mb-6">
                    Ready to transform your collaboration?
                  </h2>
                  <p className="text-xl mb-10 opacity-90 max-w-2xl mx-auto">
                    Join thousands of teams already using CollabNotes to work better together.
                  </p>
                  <Link to="/auth">
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="inline-block"
                    >
                      <Button size="lg" variant="secondary" className="text-lg px-8 h-14 gap-3 shadow-xl">
                        <Sparkles className="h-5 w-5" />
                        Start for Free Today
                        <ArrowRight className="h-5 w-5" />
                      </Button>
                    </motion.div>
                  </Link>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t py-12 bg-muted/20">
          <div className="container">
            <div className="flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="flex items-center gap-3">
                <img src={logo} alt="CollabNotes" className="h-8 w-8 rounded-full object-cover" />
                <span className="text-sm text-muted-foreground">
                  © 2025 CollabNotes. Made with <Heart className="h-4 w-4 inline text-red-500 fill-red-500" /> for teams everywhere.
                </span>
              </div>
              <div className="flex gap-8 text-sm">
                <Link to="/terms" className="text-muted-foreground hover:text-foreground transition-colors">
                  Terms
                </Link>
                <Link to="/privacy" className="text-muted-foreground hover:text-foreground transition-colors">
                  Privacy
                </Link>
                <Link to="/help" className="text-muted-foreground hover:text-foreground transition-colors">
                  Help
                </Link>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
