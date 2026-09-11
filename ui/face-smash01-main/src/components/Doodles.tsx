import React from 'react';

// Hand-drawn yellow crown
export const CrownDoodle: React.FC<{ className?: string; size?: number; color?: string }> = ({
  className = '',
  size = 28,
  color = '#facc15'
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 40 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`inline-block ${className}`}
  >
    <path
      d="M4 26L7 8L16 19L24 5L31 20L36 9L38 26C38 27.5 36.5 28 35 28H6C4.5 28 4 27.5 4 26Z"
      stroke={color}
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill={color}
      fillOpacity="0.15"
    />
    <line x1="7" y1="28" x2="35" y2="28" stroke={color} strokeWidth="3" strokeLinecap="round" />
    <circle cx="7" cy="8" r="1.5" fill={color} />
    <circle cx="24" cy="5" r="1.5" fill={color} />
    <circle cx="36" cy="9" r="1.5" fill={color} />
  </svg>
);

// Cool Cat with Sunglasses Doodle
export const CoolCatDoodle: React.FC<{ className?: string; size?: number; color?: string }> = ({
  className = '',
  size = 64,
  color = '#0f172a'
}) => (
  <svg
    width={size}
    height={size * 0.9}
    viewBox="0 0 70 60"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path d="M12 26L18 8L30 20" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M58 26L52 8L40 20" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M12 26C8 34 8 46 16 52C24 57 46 57 54 52C62 46 62 34 58 26" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
    <path d="M16 28H54" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <path d="M18 28L21 39C21.5 41 24 42 27 42C30 42 32.5 41 33 39L35 28" fill={color} stroke={color} strokeWidth="1.5" />
    <path d="M37 28L39 39C39.5 41 42 42 45 42C48 42 50.5 41 51 39L53 28" fill={color} stroke={color} strokeWidth="1.5" />
    <line x1="23" y1="31" x2="26" y2="38" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
    <line x1="41" y1="31" x2="44" y2="38" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
    <path d="M35 44L33 46H37L35 44Z" fill={color} />
    <path d="M32 47C33 49 35 49 35 47C35 49 37 49 38 47" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    <path d="M6 34L14 36" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    <path d="M5 40L14 41" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    <path d="M64 34L56 36" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    <path d="M65 40L56 41" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

// Cute Outline Cat Doodle
export const SimpleCatDoodle: React.FC<{ className?: string; size?: number; color?: string }> = ({
  className = '',
  size = 48,
  color = '#38bdf8'
}) => (
  <svg
    width={size}
    height={size * 0.85}
    viewBox="0 0 60 50"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path d="M10 20L15 6L25 15" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M50 20L45 6L35 15" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M10 20C6 28 6 38 14 43C20 47 40 47 46 43C54 38 54 28 50 20" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <circle cx="22" cy="26" r="2" fill={color} />
    <circle cx="38" cy="26" r="2" fill={color} />
    <path d="M27 33C28.5 35 30 35 30 33C30 35 31.5 35 33 33" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

// Hand-drawn Smiley Face Doodle
export const SmileyDoodle: React.FC<{ className?: string; size?: number; color?: string }> = ({
  className = '',
  size = 24,
  color = '#0f172a'
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`inline-block ${className}`}
  >
    <circle cx="16" cy="16" r="13" stroke={color} strokeWidth="2" strokeLinecap="round" strokeDasharray="60 4" />
    <circle cx="11.5" cy="13" r="1.5" fill={color} />
    <circle cx="20.5" cy="13" r="1.5" fill={color} />
    <path d="M10.5 19C12 23 20 23 21.5 19" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </svg>
);

// Curved Sketch Arrow
export const CurvedArrow: React.FC<{
  className?: string;
  direction?: 'right-down' | 'left-down' | 'up-right' | 'left-up';
  color?: string;
  size?: number;
}> = ({ className = '', direction = 'right-down', color = '#ec4899', size = 36 }) => {
  return (
    <svg
      width={size}
      height={size * 0.7}
      viewBox="0 0 60 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {direction === 'right-down' && (
        <>
          <path d="M6 8C20 6 42 12 50 28" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M38 27L51 29L50 17" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      {direction === 'left-down' && (
        <>
          <path d="M54 8C40 6 18 12 10 28" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M22 27L9 29L10 17" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      {direction === 'up-right' && (
        <>
          <path d="M10 32C15 18 35 10 50 10" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M38 4L52 10L42 20" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </svg>
  );
};

// Full-Width Authentic Paintbrush Stroke Top Navbar Header Edge
export const PaintbrushTopNav: React.FC<{ className?: string; children: React.ReactNode }> = ({
  className = '',
  children
}) => (
  <div className={`w-full relative bg-[#101318] text-white z-40 ${className}`}>
    {children}
    {/* Rough Paintbrush Bristle Bottom Edge */}
    <div className="w-full overflow-hidden leading-none absolute top-full left-0 pointer-events-none -mt-0.5">
      <svg
        viewBox="0 0 1440 28"
        preserveAspectRatio="none"
        className="w-full h-4 sm:h-6 block fill-[#101318]"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M0,0 L1440,0 L1440,12 
          C1410,22 1385,6 1350,18 
          C1315,26 1290,4 1260,16 
          C1225,24 1195,8 1165,22 
          C1130,28 1105,6 1070,16 
          C1035,26 1010,4 975,18 
          C940,24 915,8 880,20 
          C845,28 820,6 785,16 
          C750,26 720,4 685,18 
          C650,24 625,8 590,22 
          C555,28 530,6 495,16 
          C460,26 430,4 395,18 
          C360,24 335,8 300,20 
          C265,28 240,6 205,16 
          C170,26 140,4 105,18 
          C70,24 45,8 15,22 L0,12 Z" />
      </svg>
    </div>
  </div>
);

// Authentic Paintbrush Stroke Action Button
export const PaintbrushButton: React.FC<{
  onClick?: () => void;
  color?: 'pink' | 'yellow' | 'dark';
  children: React.ReactNode;
  className?: string;
}> = ({ onClick, color = 'pink', children, className = '' }) => {
  const bgFill = color === 'pink' ? '#eb2f6c' : color === 'yellow' ? '#facc15' : '#101318';
  const textColor = color === 'yellow' ? 'text-black' : 'text-white';

  return (
    <button
      onClick={onClick}
      className={`relative inline-flex items-center justify-center px-6 py-2.5 font-marker text-sm uppercase tracking-wider ${textColor} cursor-pointer transition-transform hover:scale-105 active:scale-95 group select-none ${className}`}
    >
      {/* SVG Paintbrush Stroke Backplate */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none drop-shadow-md group-hover:drop-shadow-lg transition-all"
        viewBox="0 0 220 54"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M8,8 
             C35,4 75,6 115,5 
             C155,4 195,7 212,12 
             C218,14 219,26 215,38 
             C210,48 190,46 150,49 
             C110,52 70,48 30,50 
             C12,51 4,45 6,32 
             C7,20 4,12 8,8 Z"
          fill={bgFill}
        />
        {/* Brush bristles texture highlight */}
        <path
          d="M16,14 C50,11 150,10 200,16"
          stroke="rgba(255,255,255,0.3)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
      <span className="relative z-10 flex items-center gap-2 drop-shadow-[1px_1px_0px_rgba(0,0,0,0.2)]">
        {children}
      </span>
    </button>
  );
};

// Torn Paper Bottom Edge Component
export const TornPaperBottom: React.FC<{ className?: string; color?: string }> = ({
  className = '',
  color = '#0a0d14'
}) => (
  <div className={`w-full overflow-hidden leading-none ${className}`}>
    <svg
      viewBox="0 0 1536 48"
      preserveAspectRatio="none"
      className="w-full h-6 md:h-10 block"
      fill={color}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M0,48 L1536,48 L1536,18 
        C1500,28 1470,8 1430,22 
        C1390,36 1350,12 1310,26 
        C1270,40 1230,16 1190,20 
        C1150,24 1110,6 1070,28 
        C1030,42 990,14 950,22 
        C910,30 870,8 830,25 
        C790,38 750,15 710,24 
        C670,33 630,9 590,28 
        C550,42 510,12 470,20 
        C430,28 390,6 350,26 
        C310,40 270,14 230,22 
        C190,30 150,8 110,25 
        C70,38 30,12 0,22 Z" />
    </svg>
  </div>
);
