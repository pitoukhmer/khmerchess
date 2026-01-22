
import React from 'react';
import { Trophy, Swords, Zap, Layout, ArrowRight, ShieldCheck, Globe, Cpu } from 'lucide-react';

interface LandingPageProps {
  onGoogleLogin: () => void;
  onShowEmailAuth: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onGoogleLogin, onShowEmailAuth }) => {
  return (
    <div className="min-h-screen bg-[#0C0C0C] text-white flex flex-col selection:bg-[#CCFF00] selection:text-black">
      {/* Navbar */}
      <nav className="fixed top-0 w-full z-50 bg-[#0C0C0C]/80 backdrop-blur-md border-b border-zinc-800">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#CCFF00] rounded flex items-center justify-center text-black">
              <Trophy size={18} />
            </div>
            <span className="font-heavy text-xl uppercase tracking-tighter italic">Khmer Chess</span>
          </div>
          <div className="flex items-center gap-6">
            <button 
              onClick={onShowEmailAuth}
              className="hidden md:block text-zinc-400 hover:text-white font-heavy uppercase text-[10px] tracking-widest transition-colors"
            >
              Email Login
            </button>
            <button 
              onClick={onGoogleLogin}
              className="btn-primary px-6 py-2.5 text-[10px] shadow-neon"
            >
              Login
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-40 pb-20 px-6 overflow-hidden">
        {/* Background Gradients */}
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-[#CCFF00]/5 blur-[120px] rounded-full -z-10" />
        
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#CCFF00]/20 bg-[#CCFF00]/5 text-[#CCFF00] mb-8">
            <Zap size={12} className="animate-pulse" />
            <span className="text-[9px] font-heavy uppercase tracking-[0.2em]">Project Mothership v1.0 Live</span>
          </div>
          
          <h1 className="text-5xl md:text-8xl font-heavy mb-8 leading-[0.9] tracking-tighter uppercase italic">
            The Future of <br />
            <span className="text-[#CCFF00]">Cambodian Chess.</span>
          </h1>
          
          <p className="max-w-2xl mx-auto text-zinc-500 text-lg md:text-xl font-medium mb-12 leading-relaxed">
            Join the fastest-growing community. Play real-time matches, 
            analyze with AI, and rise through the ranks on the world's most advanced Khmer Chess engine.
          </p>
          
          <div className="flex flex-col md:flex-row items-center justify-center gap-4">
            <button 
              onClick={onGoogleLogin}
              className="btn-primary px-10 py-5 text-sm w-full md:w-auto flex items-center justify-center gap-3 group"
            >
              Play Now - Free
              <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </button>
            <button 
              onClick={onShowEmailAuth}
              className="px-10 py-5 text-sm w-full md:w-auto bg-transparent border border-zinc-800 hover:border-zinc-600 transition-all font-heavy uppercase tracking-widest rounded-lg"
            >
              View Roadmap
            </button>
          </div>
        </div>
      </section>

      {/* Board Preview Placeholder */}
      <section className="px-6 mb-32">
        <div className="max-w-6xl mx-auto">
          <div className="bg-[#1F1F1F] rounded-2xl border border-zinc-800 p-4 shadow-2xl relative">
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-32 h-2 bg-[#CCFF00] rounded-full blur-sm opacity-50" />
            <div className="aspect-video bg-black rounded-lg overflow-hidden flex items-center justify-center border border-zinc-800 relative group">
              <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent z-10" />
              <img 
                src="https://images.unsplash.com/photo-1528819622765-d6bcf132f793?q=80&w=2070&auto=format&fit=crop" 
                className="w-full h-full object-cover opacity-30 grayscale group-hover:grayscale-0 transition-all duration-700"
                alt="Tactical Board"
              />
              <div className="absolute z-20 text-center">
                 <Swords size={48} className="text-[#CCFF00] mx-auto mb-4 animate-bounce" />
                 <p className="font-heavy uppercase tracking-[0.5em] text-[#CCFF00] text-sm">Titanium Core Active</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="px-6 py-20 bg-[#121212]/50">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-[#1F1F1F] p-10 border border-zinc-800 hover:border-[#CCFF00]/40 transition-all group">
              <div className="w-12 h-12 bg-[#CCFF00]/10 rounded flex items-center justify-center text-[#CCFF00] mb-8 group-hover:scale-110 transition-transform">
                <Globe size={24} />
              </div>
              <h3 className="text-xl font-heavy uppercase italic mb-4">Real-Time Battles</h3>
              <p className="text-zinc-500 text-sm leading-relaxed">
                Lag-free multiplayer servers optimized for Phnom Penh and beyond. Every millisecond counts.
              </p>
            </div>

            <div className="bg-[#1F1F1F] p-10 border border-zinc-800 hover:border-[#CCFF00]/40 transition-all group">
              <div className="w-12 h-12 bg-[#CCFF00]/10 rounded flex items-center justify-center text-[#CCFF00] mb-8 group-hover:scale-110 transition-transform">
                <Cpu size={24} />
              </div>
              <h3 className="text-xl font-heavy uppercase italic mb-4">Titanium AI</h3>
              <p className="text-zinc-500 text-sm leading-relaxed">
                Analyze your games with our advanced Gemini-powered engine. Receive technical coaching after every move.
              </p>
            </div>

            <div className="bg-[#1F1F1F] p-10 border border-zinc-800 hover:border-[#CCFF00]/40 transition-all group">
              <div className="w-12 h-12 bg-[#CCFF00]/10 rounded flex items-center justify-center text-[#CCFF00] mb-8 group-hover:scale-110 transition-transform">
                <Layout size={24} />
              </div>
              <h3 className="text-xl font-heavy uppercase italic mb-4">Pro Library</h3>
              <p className="text-zinc-500 text-sm leading-relaxed">
                Save and study your greatest tactical dossiers. Build your legacy on the permanent ledger.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto py-12 border-t border-zinc-800/50">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-3 opacity-50">
            <Trophy size={20} />
            <span className="font-heavy uppercase text-xs tracking-widest">Titanium Technologies</span>
          </div>
          <p className="text-zinc-600 text-[10px] font-heavy uppercase tracking-[0.3em]">
            © 2026 Mothership. Built for Cambodia.
          </p>
          <div className="flex gap-8">
            <a href="#" className="text-zinc-600 hover:text-white text-[10px] font-heavy uppercase tracking-widest transition-colors">Twitter</a>
            <a href="#" className="text-zinc-600 hover:text-white text-[10px] font-heavy uppercase tracking-widest transition-colors">Discord</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
