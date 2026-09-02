import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Clock, Tag, ArrowLeft, Calendar } from 'lucide-react';
import { blogs } from '@/data/blogs';

interface BlogDetailProps {
  params: Promise<{
    slug: string;
  }>;
}

export function generateStaticParams() {
  return blogs.map((post) => ({
    slug: post.slug,
  }));
}

export async function generateMetadata({ params }: BlogDetailProps) {
  const { slug } = await params;
  const post = blogs.find((b) => b.slug === slug);
  if (!post) return {};
  
  return {
    title: `${post.title} — ArchDraw`,
    description: post.summary,
    openGraph: {
      type: 'article',
      url: `https://archdraw.hiabhee.online/blogs/${post.slug}`,
      title: `${post.title} — ArchDraw`,
      description: post.summary,
      images: [{ url: '/api/og/home', width: 1200, height: 630, alt: post.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${post.title} — ArchDraw`,
      description: post.summary,
      images: ['/api/og/home'],
    },
  };
}

function BlogDocsHeader({ activeTab }: { activeTab: 'docs' | 'blogs' }) {
  return (
    <header 
      className="sticky top-0 z-30 backdrop-blur-xl border-b border-[hsl(var(--border)/0.12)]"
      style={{ background: 'hsl(var(--background) / 0.8)' }}
    >
      <div className="max-w-[1200px] mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          {/* Logo & Brand */}
          <Link href="/dashboard" className="flex items-center gap-2.5 hover:opacity-90 transition-opacity">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center bg-[hsl(var(--foreground))]"
            >
              <svg className="w-3.5 h-3.5 text-[hsl(var(--background))]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 2l8.66 5v10L12 22l-8.66-5V7L12 2z" />
              </svg>
            </div>
            <span className="font-semibold text-sm text-[hsl(var(--foreground))] tracking-tight">ArchDraw</span>
          </Link>

          <div className="w-px h-4 bg-[hsl(var(--border)/0.2)] hidden sm:block" />

          {/* Navigation Links */}
          <nav className="flex items-center gap-4 text-xs font-semibold">
            <Link
              href="/docs"
              className={`transition-colors ${
                activeTab === 'docs' 
                  ? 'text-[hsl(var(--foreground))] underline underline-offset-4 decoration-2 decoration-[hsl(var(--foreground))]' 
                  : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
              }`}
            >
              Documentation
            </Link>
            <Link
              href="/blogs"
              className={`transition-colors ${
                activeTab === 'blogs' 
                  ? 'text-[hsl(var(--foreground))] underline underline-offset-4 decoration-2 decoration-[hsl(var(--foreground))]' 
                  : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
              }`}
            >
              Engineering Blog
            </Link>
          </nav>
        </div>

        {/* Right Action */}
        <Link
          href="/dashboard"
          className="text-xs font-medium text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors flex items-center gap-1"
        >
          <span>Go to Dashboard</span>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </header>
  );
}

export default async function BlogDetailPage({ params }: BlogDetailProps) {
  const { slug } = await params;
  const post = blogs.find((b) => b.slug === slug);
  
  if (!post) {
    notFound();
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'TechArticle',
        '@id': `https://archdraw.hiabhee.online/blogs/${post.slug}#article`,
        headline: post.title,
        description: post.summary,
        url: `https://archdraw.hiabhee.online/blogs/${post.slug}`,
        datePublished: post.date,
        author: { '@id': 'https://archdraw.hiabhee.online/#organization' },
        publisher: { '@id': 'https://archdraw.hiabhee.online/#organization' },
        articleSection: post.category,
        keywords: [post.kicker, post.category, ...post.sections.map((s) => s.heading)].join(', '),
        inLanguage: 'en-US',
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://archdraw.hiabhee.online/' },
          { '@type': 'ListItem', position: 2, name: 'Engineering Blog', item: 'https://archdraw.hiabhee.online/blogs' },
          { '@type': 'ListItem', position: 3, name: post.title, item: `https://archdraw.hiabhee.online/blogs/${post.slug}` },
        ],
      },
    ],
  };

  return (
    <div className="min-h-screen flex flex-col bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <BlogDocsHeader activeTab="blogs" />

      <main className="flex-1 max-w-[1200px] w-full mx-auto px-6 py-12 space-y-6">
        {/* Back Link */}
        <Link
          href="/blogs"
          className="flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors w-fit"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Blogs</span>
        </Link>

        {/* Content Layout */}
        <div className="grid gap-6 lg:grid-cols-[200px_1fr]">
          {/* Sidebar Metadata */}
          <aside className="space-y-4 lg:sticky lg:top-24 h-fit">
            <div className="rounded-xl border border-[hsl(var(--border)/0.16)] bg-[hsl(var(--card))] p-4 space-y-4" style={{ boxShadow: '0 8px 24px hsl(var(--foreground) / 0.03)' }}>
              <div>
                <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-[hsl(var(--muted-foreground))] mb-1">
                  Published
                </div>
                <div className="text-xs font-medium text-[hsl(var(--foreground))] flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[hsl(var(--muted-foreground))]" />
                  {post.date}
                </div>
              </div>
              
              <div className="border-t border-[hsl(var(--border)/0.1)] pt-3">
                <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-[hsl(var(--muted-foreground))] mb-1">
                  Read Time
                </div>
                <div className="text-xs font-medium text-[hsl(var(--foreground))] flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[hsl(var(--muted-foreground))]" />
                  {post.readTime}
                </div>
              </div>

              <div className="border-t border-[hsl(var(--border)/0.1)] pt-3">
                <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-[hsl(var(--muted-foreground))] mb-1">
                  Category
                </div>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-medium bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] border border-[hsl(var(--border)/0.1)]">
                  <Tag className="w-3 h-3" />
                  {post.category}
                </span>
              </div>
            </div>
          </aside>

          {/* Main Article Content */}
          <article className="space-y-6 max-w-3xl rounded-xl border border-[hsl(var(--border)/0.16)] bg-[hsl(var(--card))] p-6 md:p-8" style={{ boxShadow: '0 8px 24px hsl(var(--foreground) / 0.03)' }}>
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[hsl(var(--muted-foreground))] font-mono mb-2">
                {post.kicker}
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[hsl(var(--foreground))] leading-tight">
                {post.title}
              </h1>
            </div>

            {/* Abstract */}
            <div className="border-l-4 border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.2)] px-4 py-3 rounded-r-lg">
              <p className="text-sm leading-relaxed text-[hsl(var(--foreground))] italic">
                {post.summary}
              </p>
            </div>

            {/* Render Sections */}
            <div className="pt-4 space-y-8">
              {post.sections.map((section, idx) => (
                <section 
                  key={section.heading} 
                  className="space-y-3 pt-6 border-t border-[hsl(var(--border)/0.1)] first:pt-0 first:border-0"
                >
                  <h2 className="text-lg font-bold text-[hsl(var(--foreground))] flex items-start gap-2.5">
                    <span className="text-[10px] font-mono text-[hsl(var(--muted-foreground))] bg-[hsl(var(--muted)/0.5)] border border-[hsl(var(--border)/0.16)] px-1.5 py-0.5 rounded mt-0.5">
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                    <span className="leading-snug">{section.heading}</span>
                  </h2>

                  <p className="text-sm text-[hsl(var(--muted-foreground))] leading-relaxed text-justify">
                    {section.body}
                  </p>

                  {/* Bullets */}
                  {section.bullets && section.bullets.length > 0 && (
                    <ul className="grid gap-2 pt-1 pl-4 border-l border-[hsl(var(--border)/0.16)]">
                      {section.bullets.map((bullet, bIdx) => (
                        <li 
                          key={bIdx}
                          className="text-xs leading-relaxed text-[hsl(var(--muted-foreground))] flex items-start gap-2"
                        >
                          <span className="text-[hsl(var(--muted-foreground))] select-none">•</span>
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* Code Block */}
                  {section.code && (
                    <div className="pt-1">
                      <pre 
                        className="overflow-x-auto rounded-lg border border-[hsl(var(--border)/0.16)] bg-[hsl(var(--muted)/0.3)] p-4 text-xs font-mono leading-relaxed text-[hsl(var(--foreground))] shadow-inner"
                        style={{ borderLeft: '3px solid hsl(var(--border))' }}
                      >
                        <code>{section.code}</code>
                      </pre>
                    </div>
                  )}
                </section>
              ))}
            </div>
          </article>
        </div>
      </main>
    </div>
  );
}
