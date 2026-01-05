import { Helmet } from 'react-helmet-async';

interface SEOHeadProps {
  title?: string;
  description?: string;
  keywords?: string;
  ogImage?: string;
  ogType?: string;
  canonical?: string;
}

export const SEOHead = ({
  title = 'CollabNotes',
  description = 'Create collaborative workspaces, share rich notes with your team, and manage content together in real-time. Perfect for teams, projects, and knowledge sharing.',
  keywords = 'notes, collaboration, team, workspace, sharing, productivity',
  ogImage = '/favicon.png',
  ogType = 'website',
  canonical,
}: SEOHeadProps) => {
  const fullTitle = title === 'CollabNotes' ? title : `${title} | CollabNotes`;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      
      {/* Open Graph */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={ogType} />
      <meta property="og:image" content={ogImage} />
      
      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />
      
      {canonical && <link rel="canonical" href={canonical} />}
    </Helmet>
  );
};