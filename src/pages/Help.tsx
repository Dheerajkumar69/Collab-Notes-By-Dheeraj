import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ArrowLeft, Users, FileText, Share2, MessageSquare, Bell, Settings } from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import logo from '@/assets/collabnotes-logo.png';

const faqs = [
  {
    question: 'How do I create a new group?',
    answer: 'From your dashboard, click the "Create Group" button. Enter a name, optional description, and choose a color theme. Once created, you can invite members using the invite code.'
  },
  {
    question: 'How do I invite members to my group?',
    answer: 'Each group has a unique invite code displayed in the group header. Share this code with others, and they can join by clicking "Join Group" on their dashboard and entering the code.'
  },
  {
    question: 'Can I edit notes created by other members?',
    answer: 'Only the note creator can directly edit a note. However, you can submit an edit request that the note creator can review and approve.'
  },
  {
    question: 'How do I delete a note or group?',
    answer: 'To delete a note, click the menu icon on the note card and select "Delete". Only the note creator can delete it. To delete a group, you must be the group creator - click the trash icon in the group header.'
  },
  {
    question: 'Are my notes private?',
    answer: 'Notes are only visible to members of the group they belong to. We use row-level security to ensure your data is protected and only accessible to authorized users.'
  },
  {
    question: 'How do I change my profile information?',
    answer: 'Click on your profile avatar in the header and select "Profile". From there you can update your name and email address.'
  },
  {
    question: 'What file types can I attach to notes?',
    answer: 'You can attach images (PNG, JPG, GIF, WebP), PDFs, and common document formats. Each file has a maximum size limit of 10MB.'
  },
  {
    question: 'How do notifications work?',
    answer: 'You receive notifications when someone joins your group, submits an edit request, or mentions you in a message. Click the bell icon in the header to view all notifications.'
  },
];

const guides = [
  {
    icon: Users,
    title: 'Creating & Managing Groups',
    description: 'Learn how to create groups, invite members, and manage group settings.'
  },
  {
    icon: FileText,
    title: 'Working with Notes',
    description: 'Create rich notes with markdown, labels, colors, and file attachments.'
  },
  {
    icon: Share2,
    title: 'Sharing & Collaboration',
    description: 'Share notes with your team and collaborate in real-time.'
  },
  {
    icon: MessageSquare,
    title: 'Group Chat',
    description: 'Communicate with team members using the built-in group chat feature.'
  },
  {
    icon: Bell,
    title: 'Notifications',
    description: 'Stay updated with real-time notifications for all group activities.'
  },
  {
    icon: Settings,
    title: 'Account Settings',
    description: 'Manage your profile, preferences, and security settings.'
  },
];

export default function Help() {
  return (
    <>
      <SEOHead 
        title="Help Center" 
        description="Get help with CollabNotes. Find answers to common questions and learn how to use all features."
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

        <main className="container max-w-4xl py-12">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4">Help Center</h1>
            <p className="text-lg text-muted-foreground">
              Find answers to common questions and learn how to get the most out of CollabNotes.
            </p>
          </div>

          {/* Quick Guides */}
          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-6">Quick Guides</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {guides.map((guide, index) => {
                const Icon = guide.icon;
                return (
                  <Card key={index} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-2">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <CardTitle className="text-lg">{guide.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">{guide.description}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>

          {/* FAQ */}
          <section>
            <h2 className="text-2xl font-semibold mb-6">Frequently Asked Questions</h2>
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((faq, index) => (
                <AccordionItem key={index} value={`item-${index}`}>
                  <AccordionTrigger className="text-left">{faq.question}</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </section>

          {/* Contact */}
          <section className="mt-12 p-8 bg-muted/30 rounded-xl text-center">
            <h2 className="text-xl font-semibold mb-2">Still need help?</h2>
            <p className="text-muted-foreground mb-4">
              Can't find what you're looking for? We're here to help.
            </p>
            <Button className="bg-gradient-primary">
              Contact Support
            </Button>
          </section>
        </main>

        <footer className="border-t py-8 mt-12">
          <div className="container flex justify-center gap-6 text-sm text-muted-foreground">
            <Link to="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link>
            <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
          </div>
        </footer>
      </div>
    </>
  );
}