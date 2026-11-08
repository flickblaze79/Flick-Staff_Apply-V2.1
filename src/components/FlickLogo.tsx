import React from 'react';

interface FlickLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  showText?: boolean;
  className?: string;
}

export const FlickLogo: React.FC<FlickLogoProps> = ({ size = 'md', showText = true, className = '' }) => {
  const dimensions = {
    sm: { img: 'w-7 h-7', text: 'text-[10px] font-black', v2: 'text-[7px] mt-0' },
    md: { img: 'w-9 h-9', text: 'text-sm font-black', v2: 'text-[9px] mt-0' },
    lg: { img: 'w-12 h-12', text: 'text-lg font-black', v2: 'text-xs -mt-0.5' },
    xl: { img: 'w-20 h-20', text: 'text-2xl font-black', v2: 'text-sm -mt-1' },
    '2xl': { img: 'w-28 h-28', text: 'text-4xl font-black', v2: 'text-lg -mt-2' },
  }[size];

  const logoSrc = `${import.meta.env.BASE_URL}flick-logo.png`;

  return (
    <div className={`inline-flex items-center gap-3 select-none ${className}`}>
      <div className={`relative flex items-center justify-center shrink-0 overflow-hidden ${dimensions.img}`}>
        <img
          src={logoSrc}
          alt="Flick Logo"
          className="w-full h-full object-contain"
          loading="eager"
          fetchPriority="high"
          onError={(e) => {
            const img = e.currentTarget;
            if (!img.dataset.fallback) {
              img.dataset.fallback = 'true';
              img.src = './flick-logo.png';
            }
          }}
        />
      </div>

      {showText && (
        <div className="flex flex-col leading-none justify-center">
          <div className={`${dimensions.text} uppercase italic font-black flex items-center gap-1.5 whitespace-nowrap tracking-tight`}>
            <span className="text-white">FLICK</span>
            <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">STAFF APPLY</span>
            <span className="text-slate-500 font-bold opacity-90">{size === 'sm' ? 'V2' : 'V2'}</span>
          </div>
        </div>
      )}
    </div>
  );
};
