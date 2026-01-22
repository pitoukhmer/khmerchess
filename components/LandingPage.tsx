
import React from 'react';
import { Trophy, Swords, Zap, Layout, ArrowRight, Globe, Cpu, ShieldCheck } from 'lucide-react';

interface LandingPageProps {
  onGoogleLogin: () => void;
  onShowEmailAuth: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onGoogleLogin, onShowEmailAuth }) => {
  return (
    <div className="min-h-screen bg-[#0C0C0C] text-white flex flex-col selection:bg-[#CCFF00] selection:text-black font-sans">
      {/* Navbar: The Command Bar */}
      <nav className="fixed top-0 w-full z-50 bg-[#0C0C0C]/80 backdrop-blur-md border-b border-zinc-800/50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#CCFF00] rounded flex items-center justify-center text-black shadow-neon">
              <Trophy size={20} />
            </div>
            <span className="font-heavy text-xl uppercase tracking-tighter italic">Khmer Chess</span>
          </div>
          <div className="flex items-center gap-8">
            <button 
              onClick={onShowEmailAuth}
              className="hidden md:block text-zinc-500 hover:text-white font-heavy uppercase text-[10px] tracking-widest transition-colors"
            >
              Secondary Handshake
            </button>
            <button 
              onClick={onGoogleLogin}
              className="btn-primary px-8 py-3 text-[10px] shadow-neon-glow"
            >
              Login
            </button>
          </div>
        </div>
      </nav>

      {/* Hero: The Impact Zone */}
      <section className="relative pt-48 pb-24 px-6 overflow-hidden min-h-[90vh] flex flex-col justify-center">
        {/* Mothership Background Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#CCFF00]/5 blur-[160px] rounded-full -z-10 animate-pulse" />
        
        <div className="max-w-6xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#CCFF00]/20 bg-[#CCFF00]/5 text-[#CCFF00] mb-10">
            <ShieldCheck size={14} className="animate-pulse" />
            <span className="text-[10px] font-heavy uppercase tracking-[0.3em]">Titanium Protocol Active</span>
          </div>
          
          <h1 className="text-6xl md:text-9xl font-heavy mb-8 leading-[0.85] tracking-tighter uppercase italic">
            The Future of <br />
            <span className="text-[#CCFF00]">Cambodian Chess.</span>
          </h1>
          
          <p className="max-w-3xl mx-auto text-zinc-500 text-lg md:text-2xl font-medium mb-14 leading-relaxed">
            Join the world's most advanced e-sports platform built for Cambodia. 
            Analyze with Titanium AI, play real-time matches, and dominate the ledger.
          </p>
          
          <div className="flex flex-col md:flex-row items-center justify-center gap-6">
            <button 
              onClick={onGoogleLogin}
              className="btn-primary px-12 py-6 text-sm w-full md:w-auto flex items-center justify-center gap-4 group shadow-neon-glow"
            >
              PLAY NOW - FREE
              <ArrowRight size={20} className="group-hover:translate-x-2 transition-transform" />
            </button>
            <button 
              onClick={onShowEmailAuth}
              className="px-12 py-6 text-sm w-full md:w-auto bg-transparent border-2 border-zinc-800 hover:border-white text-zinc-400 hover:text-white transition-all font-heavy uppercase tracking-widest rounded-lg"
            >
              View Roadmap
            </button>
          </div>
        </div>
      </section>

      {/* Feature Grid: Tactical Advantages */}
      <section className="px-6 py-32 bg-[#0A0A0A] border-y border-zinc-900">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-3 gap-10">
            <div className="bg-[#111111] p-12 border border-zinc-800 hover:border-[#CCFF00]/50 transition-all group relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-0 bg-[#CCFF00] group-hover:h-full transition-all duration-500" />
              <div className="w-14 h-14 bg-[#CCFF00]/5 rounded-lg flex items-center justify-center text-[#CCFF00] mb-10 group-hover:scale-110 transition-transform border border-[#CCFF00]/10">
                <Globe size={28} />
              </div>
              <h3 className="text-2xl font-heavy uppercase italic mb-6">Real-Time Battles</h3>
              <p className="text-zinc-500 text-base leading-relaxed">
                Lag-free multiplayer servers in Phnom Penh. Experience zero-latency engagement with pilots across the kingdom.
              </p>
            </div>

            <div className="bg-[#111111] p-12 border border-zinc-800 hover:border-[#CCFF00]/50 transition-all group relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-0 bg-[#CCFF00] group-hover:h-full transition-all duration-500" />
              <div className="w-14 h-14 bg-[#CCFF00]/5 rounded-lg flex items-center justify-center text-[#CCFF00] mb-10 group-hover:scale-110 transition-transform border border-[#CCFF00]/10">
                <Cpu size={28} />
              </div>
              <h3 className="text-2xl font-heavy uppercase italic mb-6">Titanium AI</h3>
              <p className="text-zinc-500 text-base leading-relaxed">
                Analyze your games with our advanced Gemini-powered coach. Technical feedback for every tactical maneuver.
              </p>
            </div>

            <div className="bg-[#111111] p-12 border border-zinc-800 hover:border-[#CCFF00]/50 transition-all group relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-0 bg-[#CCFF00] group-hover:h-full transition-all duration-500" />
              <div className="w-14 h-14 bg-[#CCFF00]/5 rounded-lg flex items-center justify-center text-[#CCFF00] mb-10 group-hover:scale-110 transition-transform border border-[#CCFF00]/10">
                <Layout size={28} />
              </div>
              <h3 className="text-2xl font-heavy uppercase italic mb-6">Pro Library</h3>
              <p className="text-zinc-500 text-base leading-relaxed">
                Save and study your greatest games. Build a permanent archive of your tactical evolution on the ledger.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer: Final Signature */}
      <footer className="mt-auto py-16 px-6 border-t border-zinc-900">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-10">
          <div className="flex items-center gap-4">
            <Trophy size={24} className="text-[#CCFF00]" />
            <div>
              <span className="block font-heavy uppercase text-xs tracking-[0.4em]">Titanium Tech</span>
              <span className="block text-zinc-700 text-[10px] font-heavy uppercase mt-1">Project Mothership v1.0</span>
            </div>
          </div>
          
          <p className="text-zinc-600 text-[11px] font-heavy uppercase tracking-[0.3em] text-center">
            © 2026 Titanium Technologies. Built for Cambodia.
          </p>
          
          <div className="flex gap-10">
            {['Twitter', 'Discord', 'Telegram'].map(platform => (
              <a key={platform} href="#" className="text-zinc-600 hover:text-[#CCFF00] text-[11px] font-heavy uppercase tracking-widest transition-colors">
                {platform}
              </a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
