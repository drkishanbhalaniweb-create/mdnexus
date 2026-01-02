import { Helmet } from 'react-helmet-async';

// Production site URL - used for canonical URLs and OG tags
const SITE_URL = 'https://www.militarydisabilitynexus.com';

const SEO = ({ 
  title = 'Medical Consulting for Veterans',
  description = 'Professional medical documentation services for VA disability claims. Expert nexus letters, DBQs, and medical consultations for veterans seeking disability benefits and compensation.',
  keywords = 'VA nexus letter, DBQ, disability benefits questionnaire, aid and attendance, C&P exam, veteran medical documentation',
  ogImage = '/android-chrome-512x512.png',
  article = false,
  publishedTime,
  modifiedTime,
  author = 'Military Disability Nexus',
  canonical,
  structuredData,
  faqSchema,
  breadcrumbs
}) => {
  // Always use production URL for SEO purposes
  const siteUrl = SITE_URL;
  const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/';
  const currentUrl = `${siteUrl}${currentPath}`;
  const canonicalUrl = canonical || currentUrl;

  return (
    <Helmet>
      {/* Basic Meta Tags */}
      <title>{title} | Military Disability Nexus</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      <link rel="canonical" href={canonicalUrl} />

      {/* Open Graph */}
      <meta property="og:type" content={article ? 'article' : 'website'} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:image" content={`${siteUrl}${ogImage}`} />
      <meta property="og:site_name" content="Military Disability Nexus" />

      {/* Article specific */}
      {article && (
        <>
          <meta property="article:author" content={author} />
          {publishedTime && <meta property="article:published_time" content={publishedTime} />}
          {modifiedTime && <meta property="article:modified_time" content={modifiedTime} />}
        </>
      )}

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={`${siteUrl}${ogImage}`} />

      {/* Additional SEO */}
      <meta name="robots" content="index, follow" />
      <meta name="author" content={author} />
      <meta name="language" content="English" />

      {/* Structured Data (JSON-LD) */}
      {structuredData && (
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      )}

      {/* FAQ Schema */}
      {faqSchema && faqSchema.length > 0 && (
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": faqSchema.map(faq => ({
              "@type": "Question",
              "name": faq.question,
              "acceptedAnswer": {
                "@type": "Answer",
                "text": faq.answer
              }
            }))
          })}
        </script>
      )}

      {/* Breadcrumb Schema */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": breadcrumbs.map((crumb, index) => ({
              "@type": "ListItem",
              "position": index + 1,
              "name": crumb.name,
              "item": `${siteUrl}${crumb.path}`
            }))
          })}
        </script>
      )}
    </Helmet>
  );
};

export default SEO;
