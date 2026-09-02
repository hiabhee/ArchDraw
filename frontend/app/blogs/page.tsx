import Link from 'next/link';
import { Clock, Tag, ArrowRight } from 'lucide-react';
import { blogs } from '@/data/blogs';

export const metadata = {
  title: 'Engineering Blog — ArchDraw',
  description: 'Deep explanations of how we built our interactive diagramming canvas, AI layout compilation, and database synchronization.',
  openGraph: {
    type: 'website',
    url: 'https://archdraw.hiabhee.online/blogs',
    title: 'Engineering Blog — ArchDraw',
    description: 'Deep explanations of how we built our interactive diagramming canvas, AI layout compilation, and database synchronization.',
    images: [{ url: '/api/og/home', width: 1200, height: 630, alt: 'ArchDraw Engineering Blog' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Engineering Blog — ArchDraw',
    images: ['/api/og/home'],
  },
};

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

export default function BlogsPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
      <BlogDocsHeader activeTab="blogs" />
      
      <main className="flex-1 max-w-[1200px] w-full mx-auto px-6 py-12 space-y-10">
        {/* Hero Section */}
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mb-4"
            style={{ 
              background: 'hsl(var(--muted)/0.5)', 
              border: '1px solid hsl(var(--border)/0.12)', 
              color: 'hsl(var(--muted-foreground))' 
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--muted-foreground))]" />
            {blogs.length} Chapters Published
          </div>
          
          <h2 className="text-4xl font-bold tracking-tight text-[hsl(var(--foreground))] mb-4">
            ArchDraw Engineering
          </h2>
          
          <p className="text-sm text-[hsl(var(--muted-foreground))] leading-relaxed max-w-2xl">
            Deep architectural breakdowns of our system design. Learn the principles of building complex interactive editors, AI graph pipelines, dynamic edge routing, and responsive previews.
          </p>
        </div>

        {/* Grid Layout of Blog Posts */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {blogs.map((post) => (
            <Link
              key={post.slug}
              href={`/blogs/${post.slug}`}
              className="group relative block rounded-xl p-5 transition-all duration-300 border border-[hsl(var(--border)/0.16)] bg-[hsl(var(--card))] hover:bg-[hsl(var(--muted)/0.3)] hover:-translate-y-1 flex flex-col justify-between min-h-[220px]"
              style={{
                boxShadow: '0 8px 24px hsl(var(--foreground) / 0.03)',
              }}
            >
              <div>
                {/* Category & Read Time */}
                <div className="flex items-center justify-between mb-3">
                  <span 
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-mono font-medium bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"
                  >
                    <Tag className="w-3 h-3" />
                    {post.category}
                  </span>
                  <span className="flex items-center gap-1 text-[10px] text-[hsl(var(--muted-foreground))] font-mono">
                    <Clock className="w-3.5 h-3.5" />
                    {post.readTime}
                  </span>
                </div>

                {/* Title */}
                <h3 
                  className="text-base font-bold text-[hsl(var(--foreground))] mb-2 group-hover:underline transition-all leading-snug"
                >
                  {post.title}
                </h3>

                {/* Short Description */}
                <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed mb-4 line-clamp-3">
                  {post.summary}
                </p>
              </div>

              {/* Footer of the card */}
              <div className="flex items-center justify-between pt-3 border-t border-[hsl(var(--border)/0.1)] text-[10px] font-mono">
                <span className="text-[hsl(var(--muted-foreground))]">{post.date}</span>
                <span className="inline-flex items-center gap-1 font-semibold text-[hsl(var(--muted-foreground))] group-hover:text-[hsl(var(--foreground))] transition-colors">
                  Read more
                  <ArrowRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-1" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
