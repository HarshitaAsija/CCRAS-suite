import Link from "next/link";
import { Network, Search, Microscope, Users, ArrowRight } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col font-sans selection:bg-primary/20">
      
      {/* Navigation */}
      <nav className="w-full border-b border-border-light bg-surface/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="font-bold text-foreground text-sm tracking-widest uppercase">
              CCRAS <span className="text-text-muted font-medium ml-1">Research Intelligence Suite</span>
            </div>
          </div>
          
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-text-muted">
            <a href="#what-it-does" className="hover:text-foreground transition-colors">What it does</a>
            <a href="#how-it-works" className="hover:text-foreground transition-colors">How it works</a>
          </div>
          
          <div className="flex items-center gap-4 text-sm font-medium">
            <Link href="/login" className="text-foreground hover:text-primary transition-colors">Log in</Link>
            <Link href="/signup" className="px-4 py-2 bg-primary text-white rounded-full hover:bg-primary/90 transition-colors shadow-sm">
              Sign up
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="w-full pt-20 pb-24 overflow-hidden relative">
        {/* Subtle background pattern/gradient */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-7xl overflow-hidden -z-10 opacity-30 pointer-events-none">
          <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-primary-light blur-3xl" />
          <div className="absolute bottom-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-accent-light blur-3xl opacity-50" />
        </div>

        <div className="max-w-7xl mx-auto px-6 flex flex-col lg:flex-row items-center gap-12 lg:gap-8">
          
          {/* Hero Content */}
          <div className="flex-1 max-w-2xl text-center lg:text-left z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface border border-border-light text-[10px] font-bold uppercase tracking-wider text-text-muted mb-6">
              Discover Module
            </div>
            
            <h1 className="text-5xl lg:text-6xl font-extrabold text-foreground tracking-tight leading-[1.1] mb-6">
              From research gaps to <span className="text-accent italic pr-2">evidence-backed</span> study protocols.
            </h1>
            
            <p className="text-base lg:text-lg text-text-muted leading-relaxed mb-8 max-w-xl mx-auto lg:mx-0">
              The CCRAS Research Intelligence Suite is an integrated platform for literature intelligence, knowledge graphs, hypothesis generation, trend analysis, collaboration, and AI-powered scientific workflows—built for modern research teams.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
              <Link href="/signup" className="w-full sm:w-auto px-8 py-3.5 bg-primary text-white rounded-full hover:bg-primary/90 transition-all shadow-md hover:shadow-lg font-medium text-sm flex items-center justify-center gap-2">
                Sign up free <ArrowRight size={16} />
              </Link>
              <Link href="/login" className="w-full sm:w-auto px-8 py-3.5 bg-surface text-foreground border border-border-med rounded-full hover:bg-surface-hover hover:border-text-muted transition-all font-medium text-sm text-center">
                Log in
              </Link>
            </div>
            
            <div className="mt-6 text-xs text-text-dim uppercase tracking-widest font-semibold">
              The CCRAS Research Intelligence Suite
            </div>
          </div>
          
          {/* Hero Visual */}
          <div className="flex-1 w-full max-w-lg lg:max-w-none relative z-10 flex justify-center lg:justify-end">
            <div className="relative w-full aspect-square max-w-[500px] bg-white rounded-3xl shadow-xl border border-border-light p-8 flex items-center justify-center overflow-hidden">
              {/* Decorative nodes for knowledge graph visualization */}
              <div className="absolute top-12 left-12 w-3 h-3 rounded-full bg-primary" />
              <div className="absolute top-24 left-32 w-2 h-2 rounded-full bg-accent" />
              <div className="absolute top-16 right-20 w-4 h-4 rounded-full bg-primary/40" />
              <div className="absolute bottom-20 left-16 w-2.5 h-2.5 rounded-full bg-text-dim" />
              <div className="absolute bottom-32 right-12 w-3 h-3 rounded-full bg-accent" />
              <div className="absolute bottom-12 right-32 w-2 h-2 rounded-full bg-primary" />
              
              {/* SVG Connecting Lines */}
              <svg className="absolute inset-0 w-full h-full stroke-border-med stroke-[1.5] z-0 opacity-50" style={{ strokeDasharray: "4 4" }}>
                <path d="M 60 60 L 140 100 L 350 80 L 400 280 L 300 350 L 100 320 Z" fill="none" />
                <path d="M 140 100 L 250 250 L 400 280" fill="none" />
                <path d="M 250 250 L 100 320" fill="none" />
              </svg>

              {/* Central highlighted node */}
              <div className="relative z-10 w-32 h-32 rounded-full bg-accent/10 border-2 border-dashed border-accent flex flex-col items-center justify-center animate-pulse">
                <Network className="text-accent mb-1" size={24} />
                <span className="text-[9px] font-bold text-accent uppercase tracking-wider">Unexplored Gap</span>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* Features Section */}
      <section id="what-it-does" className="w-full py-20 bg-surface border-y border-border-light">
        <div className="max-w-7xl mx-auto px-6">
          <div className="mb-12">
            <div className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-3">
              What the suite offers
            </div>
            <h2 className="text-3xl font-bold text-foreground tracking-tight">
              Four ways it reads the literature for you
            </h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <FeatureCard 
              icon={<Search className="text-primary" size={20} />}
              title="Literature Intelligence"
              desc="Search, organize, and analyze scientific literature across multiple repositories through one unified research workspace."
            />
            <FeatureCard 
              icon={<Network className="text-accent" size={20} />}
              title="Knowledge & Trend Analytics"
              desc="Discover emerging topics, hidden relationships, and evolving research patterns through AI-powered knowledge graphs."
            />
            <FeatureCard 
              icon={<Microscope className="text-primary" size={20} />}
              title="Hypothesis & Gap Discovery"
              desc="Generate novel hypotheses, identify unexplored opportunities, and evaluate research feasibility with intelligent scoring systems."
            />
            <FeatureCard 
              icon={<Users className="text-text-muted" size={20} />}
              title="Collaborative Research Workspace"
              desc="Enable teams to share findings, build reports, track projects, and work together inside a unified scientific environment."
            />
          </div>
        </div>
      </section>

      {/* Process Section */}
      <section id="how-it-works" className="w-full py-24 bg-background">
        <div className="max-w-7xl mx-auto px-6">
          <div className="mb-16">
            <div className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-3">
              How the suite works
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight max-w-xl leading-tight">
              From scientific knowledge to actionable research outcomes
            </h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative">
            {/* Connecting line for desktop */}
            <div className="hidden md:block absolute top-6 left-[15%] right-[15%] h-[1px] bg-border-med -z-10" />

            <ProcessStep 
              num="01"
              title="Integrate research sources"
              desc="The platform continuously connects literature repositories, institutional datasets, clinical evidence, and traditional knowledge systems."
            />
            <ProcessStep 
              num="02"
              title="Generate scientific intelligence"
              desc="AI models build knowledge graphs, detect trends, uncover relationships, and transform raw information into structured insights."
            />
            <ProcessStep 
              num="03"
              title="Drive collaborative discovery"
              desc="Researchers can explore hypotheses, identify opportunities, create reports, and collaborate seamlessly across the entire research lifecycle."
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="w-full py-24 bg-primary text-white text-center px-6">
        <h2 className="text-3xl md:text-4xl font-bold mb-8 max-w-2xl mx-auto leading-tight">
          Start your next study from a real gap.
        </h2>
        <Link href="/signup" className="inline-flex items-center px-8 py-3.5 bg-white text-primary rounded-full hover:bg-gray-100 transition-colors shadow-lg font-bold text-sm">
          Sign up free
        </Link>
      </section>

      {/* Footer */}
      <footer className="w-full py-8 bg-foreground text-center border-t border-white/10">
        <p className="text-xs text-text-muted font-medium">
          © 2026 CCRAS Research Intelligence Suite. Empowering researchers with AI-driven Insights.
        </p>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) {
  return (
    <div className="bg-white p-8 rounded-2xl border border-border-light shadow-sm hover:shadow-md transition-shadow flex flex-col">
      <div className="w-10 h-10 rounded-lg bg-surface border border-border-med flex items-center justify-center mb-6">
        {icon}
      </div>
      <h3 className="text-lg font-bold text-foreground mb-3 leading-snug">{title}</h3>
      <p className="text-sm text-text-muted leading-relaxed flex-1">{desc}</p>
    </div>
  );
}

function ProcessStep({ num, title, desc }: { num: string, title: string, desc: string }) {
  return (
    <div className="flex flex-col relative z-10">
      <div className="text-xs font-bold text-accent mb-4 tracking-widest">{num}</div>
      <h3 className="text-lg font-bold text-foreground mb-3">{title}</h3>
      <p className="text-sm text-text-muted leading-relaxed">{desc}</p>
    </div>
  );
}
