
import React, { useState, useEffect } from 'react';
import { Smartphone, Download } from 'lucide-react';

const InstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handler = (e: any) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      setIsVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
    } else {
      console.log('User dismissed the install prompt');
    }

    // We've used the prompt, and can't use it again
    setDeferredPrompt(null);
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <button
      onClick={handleInstallClick}
      className="w-full flex items-center gap-4 px-4 py-3 rounded bg-zinc-800 text-[#CCFF00] border border-[#CCFF00]/20 hover:bg-[#CCFF00] hover:text-black transition-all group"
    >
      <Smartphone size={20} className="group-hover:scale-110 transition-transform" />
      <span className="font-heavy uppercase text-[10px] tracking-[0.2em]">Install App</span>
      <Download size={14} className="ml-auto opacity-50" />
    </button>
  );
};

export default InstallPrompt;
