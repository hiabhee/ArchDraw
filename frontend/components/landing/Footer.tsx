import Link from 'next/link';

const COLUMNS = [
  {
    title: 'Product',
    links: [
      { label: 'Features', href: '#why' },
      { label: 'How it works', href: '#how-it-works' },
      { label: 'Canvas', href: '/editor' },
      { label: 'Pricing', href: '#pricing' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Docs', href: '/docs' },
      { label: 'Examples', href: '/dashboard/templates' },
      { label: 'Tutorials', href: '/tutorials' },
      { label: 'Blog', href: '/blogs' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', href: '#founder' },
      { label: 'GitHub', href: 'https://github.com' },
      { label: 'Twitter', href: 'https://twitter.com' },
      { label: 'Contact', href: 'mailto:hello@archdraw.app' },
    ],
  },
];

export function Footer() {
  return (
    <footer className="py-16 px-6 bg-[#f1f1eb] border-t border-[#e4e4df] relative">
      <div className="max-w-[1280px] mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 md:gap-10">
          <div className="col-span-2">
            <Link href="/" className="flex items-center gap-2 mb-4 group">
              <div className="w-7 h-7 rounded-lg bg-brand flex items-center justify-center shadow-[0_0_15px_rgba(30,144,255,0.3)] transition-transform duration-200 group-hover:scale-105">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#fff"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
              </div>
              <span className="text-sm font-bold text-[#1c1c1a] tracking-tight">ArchDraw</span>
            </Link>
            <p className="text-sm text-[#575752] max-w-[280px] leading-relaxed">
              A diagramming tool for engineers who think in systems.
            </p>

            <div className="mt-6 flex items-center gap-2">
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="GitHub"
                className="w-8 h-8 rounded-lg bg-white border border-[#e4e4df] hover:border-[#1E90FF] hover:text-[#1E90FF] text-[#575752] flex items-center justify-center transition-all duration-200"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                </svg>
              </a>
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Twitter"
                className="w-8 h-8 rounded-lg bg-white border border-[#e4e4df] hover:border-[#1E90FF] hover:text-[#1E90FF] text-[#575752] flex items-center justify-center transition-all duration-200"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
            </div>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h4 className="text-[11px] font-bold uppercase tracking-[1.5px] text-[#1c1c1a] mb-4">
                {col.title}
              </h4>
              <ul className="flex flex-col gap-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-[#575752] hover:text-[#1c1c1a] transition-colors duration-150"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 pt-6 border-t border-[#e4e4df] flex flex-col md:flex-row items-center justify-between gap-3">
          <span className="text-xs text-[#8a8f98]">
            &copy; 2026 ArchDraw. Built for engineers who think in systems.
          </span>
          <div className="flex items-center gap-5 text-xs text-[#8a8f98]">
            <a href="/privacy" className="hover:text-[#1c1c1a] transition-colors">Privacy</a>
            <a href="/terms" className="hover:text-[#1c1c1a] transition-colors">Terms</a>
            <span>Crafted in public by Abhishek</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
