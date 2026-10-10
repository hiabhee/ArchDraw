import Link from 'next/link';
import { Clock, Tag, ArrowRight } from 'lucide-react';
import { blogs } from '@/data/blogs';
import { LandingNav } from '@/components/landing/LandingNav';
import { Footer } from '@/components/landing/Footer';

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

export default function BlogsPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#f7f7f5] text-[#1c1c1a]">
      <LandingNav />

      <main className="flex-1 max-w-[1160px] w-full mx-auto px-6 pt-24 pb-16 space-y-10">
        {/* Hero — matches RevampedLanding editorial style */}
        <div className="max-w-3xl pt-4">
          <p className="inline-flex items-center gap-2 text-[11px] font-bold tracking-[2px] uppercase text-[#5a6066] mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-[#1E90FF]" />
            Engineering Blog · {blogs.length} chapters
          </p>

          <h1 className="font-bold tracking-tight leading-[0.95]" style={{ fontFamily: 'var(--font-instrument-serif), Georgia, serif', fontSize: 'clamp(2.25rem, 5vw, 3rem)', letterSpacing: '-0.05em' }}>
            ArchDraw <em className="text-[#155e9c] font-normal">Engineering</em>
          </h1>

          <p className="mt-4 text-sm leading-relaxed max-w-2xl text-[#5a6066]">
            Deep breakdowns of how we built an interactive diagramming canvas, AI layout compilation, and database sync — the same papers that power the editor you use.
          </p>
        </div>

        {/* Grid — paper cards with single hairline #e4e4df, like landing proof/workflow */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {blogs.map((post) => (
            <Link
              key={post.slug}
              href={`/blogs/${post.slug}`}
              className="group relative block rounded-xl p-5 transition-all duration-200 border border-[#e4e4df] bg-white hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(28,28,26,0.06)] flex flex-col justify-between min-h-[220px]"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-mono font-medium bg-[#f1f1eb] text-[#5a6066] border border-[#e4e4df]">
                    <Tag className="w-3 h-3" />
                    {post.category}
                  </span>
                  <span className="flex items-center gap-1 text-[10px] text-[#5a6066] font-mono">
                    <Clock className="w-3 h-3" />
                    {post.readTime}
                  </span>
                </div>

                <h3 className="text-[15px] font-bold text-[#1c1c1a] mb-2 leading-snug group-hover:text-[#155e9c] transition-colors">
                  {post.title}
                </h3>

                <p className="text-xs text-[#5a6066] leading-relaxed mb-4 line-clamp-3">
                  {post.summary}
                </p>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-[#e4e4df]/70 text-[10px] font-mono">
                <span className="text-[#5a6066]">{post.date}</span>
                <span className="inline-flex items-center gap-1 font-semibold text-[#5a6066] group-hover:text-[#1c1c1a] transition-colors">
                  Read more
                  <ArrowRight className="w-3 h-3 transition-transform duration-200 group-hover:translate-x-0.5" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
