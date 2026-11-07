import Link from 'next/link';
import { BrandMark } from '@/components/ui/BrandMark';

const COLUMNS: Array<{ title: string; links: Array<{ label: string; href: string; external?: boolean }> }> = [
  {
    title: 'Product',
    links: [
      { label: 'Editor', href: '/editor' },
      { label: 'Templates', href: '/templates' },
      { label: 'Repo to diagram', href: '/repo-diagram' },
      { label: 'Pricing', href: '/pricing' },
    ],
  },
  {
    title: 'Agents',
    links: [
      { label: 'Connect a coding agent', href: '/docs/connect-agents' },
      { label: 'Agent skill', href: '/agent-skill' },
      { label: 'MCP server', href: '/mcp' },
    ],
  },
  {
    title: 'Learn',
    links: [
      { label: 'Docs', href: '/docs' },
      { label: 'Tutorials', href: '/tutorials' },
      { label: 'Blog', href: '/blogs' },
      { label: 'FAQ', href: '/faq' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', href: '/about' },
      { label: 'Contact', href: '/contact' },
      { label: 'GitHub', href: 'https://github.com/hiabhee/ArchDraw', external: true },
      { label: 'Privacy', href: '/privacy' },
      { label: 'Terms', href: '/terms' },
    ],
  },
];

/** The site footer: night palette (the landing's), built only from the shared tokens. */
export function Footer() {
  return (
    <footer className="border-t border-text-primary/10 bg-surface-page px-4 pb-8 pt-12 text-text-secondary sm:px-6">
      <div className="mx-auto grid max-w-[1200px] gap-10 md:grid-cols-[1.2fr_repeat(4,1fr)]">
        <div className="flex flex-col gap-3">
          <Link href="/" className="flex items-center gap-2 text-sm font-semibold text-text-primary">
            <BrandMark size={24} />
            ArchDraw
          </Link>
          <p className="max-w-[240px] text-xs leading-5">A live architecture map of your codebase for coding agents, and diagrams you can edit.</p>
        </div>
        {COLUMNS.map((column) => (
          <nav key={column.title} aria-label={column.title} className="flex flex-col gap-1 text-xs">
            <p className="mb-1 font-mono text-[10px] font-bold uppercase tracking-[.14em] text-text-primary">{column.title}</p>
            {column.links.map((link) =>
              link.external ? (
                <a key={link.href} href={link.href} rel="noopener" className="py-1 transition-colors hover:text-text-primary">{link.label}</a>
              ) : (
                <Link key={link.href} href={link.href} className="py-1 transition-colors hover:text-text-primary">{link.label}</Link>
              ),
            )}
          </nav>
        ))}
      </div>
      <div className="mx-auto mt-10 flex max-w-[1200px] flex-col gap-2 border-t border-text-primary/10 pt-6 text-xs sm:flex-row sm:items-center sm:justify-between">
        <span>© {new Date().getFullYear()} ArchDraw</span>
        <span className="font-mono text-[11px]">archdraw.hiabhee.online</span>
      </div>
    </footer>
  );
}
