import { Logo } from "./Logo";

const cols = [
  { title: "Product", links: ["Canvas", "Task Board", "AI Extraction", "Replay", "Permissions"] },
  { title: "Resources", links: ["Templates", "Docs", "Changelog", "Blog", "Roadmap"] },
  { title: "Community", links: ["Discord", "GitHub", "X / Twitter", "Showcase", "Brand Kit"] },
  { title: "Legal", links: ["Terms", "Privacy", "Security", "DPA", "Cookies"] },
];

export function Footer() {
  return (
    <footer className="border-t-2 border-foreground bg-foreground text-background relative overflow-hidden">
      <div className="container py-12 md:py-16 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8 md:gap-10">
        {/* Brand — full width on mobile, 2 cols on lg */}
        <div className="col-span-2 md:col-span-3 lg:col-span-2 space-y-4">
          <Logo className="text-background [&_span:first-child]:bg-background [&_span:first-child]:text-foreground" />
          <p className="text-sm text-background/70 max-w-xs">
            Brainstorm together. Leave with action, not chaos. The collaborative canvas built for execution.
          </p>
          <p className="font-hand text-xl md:text-2xl text-warning">made with restless ideas ✦</p>
        </div>

        {/* Link columns — 2-col grid on mobile, 4 cols on lg */}
        {cols.map(c => (
          <div key={c.title}>
            <h4 className="font-mono text-xs uppercase tracking-widest text-background/50 mb-3">{c.title}</h4>
            <ul className="space-y-2">
              {c.links.map(l => (
                <li key={l}>
                  <a href="#" className="text-sm text-background/80 hover:text-warning transition-colors">{l}</a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-background/10">
        <div className="container py-4 md:py-5 flex flex-col sm:flex-row items-center justify-between gap-2 md:gap-3 text-[10px] md:text-xs text-background/50 font-mono uppercase tracking-wider">
          <span>© 2026 Fluxnote Labs · Issue 09</span>
          <span className="text-center sm:text-right">Fluxnote — where ideas become action</span>
        </div>
      </div>
    </footer>
  );
}
