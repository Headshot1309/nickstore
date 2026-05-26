const palettes = [
  ['#1d4ed8', '#7c3aed'],
  ['#dc2626', '#f59e0b'],
  ['#0891b2', '#8b5cf6'],
  ['#0f766e', '#22c55e'],
  ['#b91c1c', '#2563eb'],
  ['#7c3aed', '#db2777'],
];

const escapeXml = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const getInitials = (name = '') =>
  String(name)
    .split(/[\s:()-]+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((word) => word[0]?.toUpperCase())
    .join('');

const getTheme = (name = '') => {
  const key = name.toLowerCase();
  if (/mobile legends|magic chess|honor of kings|ml/.test(key)) return { label: 'MOBA', icon: 'sword', colors: palettes[0] };
  if (/free fire|pubg|valorant|arena|blood|delta|point blank/.test(key)) return { label: 'BATTLE', icon: 'crosshair', colors: palettes[1] };
  if (/genshin|honkai|wuthering|zenless|dragon|winds/.test(key)) return { label: 'RPG', icon: 'crystal', colors: palettes[2] };
  if (/roblox|robux|eggy/.test(key)) return { label: 'PLAY', icon: 'blocks', colors: palettes[3] };
  if (/marvel/.test(key)) return { label: 'HERO', icon: 'star', colors: palettes[4] };
  return { label: 'TOP UP', icon: 'diamond', colors: palettes[5] };
};

const iconSvg = (icon: string) => {
  const stroke = 'stroke="#fff" stroke-width="18" stroke-linecap="round" stroke-linejoin="round" fill="none"';
  if (icon === 'crosshair') return `<circle cx="450" cy="258" r="90" ${stroke}/><path d="M450 118v70M450 328v70M310 258h70M520 258h70" ${stroke}/><circle cx="450" cy="258" r="18" fill="#fff"/>`;
  if (icon === 'crystal') return '<path d="M450 108 555 205 520 390 450 460 380 390 345 205Z" fill="#fff" opacity=".95"/><path d="M450 108v352M345 205h210M380 390h140" stroke="#0f172a" stroke-width="14" opacity=".45"/>';
  if (icon === 'sword') return `<path d="M545 120 580 155 365 370 330 335Z" fill="#fff"/><path d="M323 334 366 377 315 428 272 385Z" fill="#fde68a"/><path d="M365 370 418 423" ${stroke}/>`;
  if (icon === 'blocks') return '<rect x="335" y="138" width="104" height="104" rx="20" fill="#fff"/><rect x="462" y="138" width="104" height="104" rx="20" fill="#dbeafe"/><rect x="398" y="266" width="104" height="104" rx="20" fill="#bbf7d0"/>';
  if (icon === 'star') return '<path d="m450 112 43 88 97 14-70 68 17 96-87-46-87 46 17-96-70-68 97-14Z" fill="#fff"/>';
  return '<path d="M450 118 586 245 450 445 314 245Z" fill="#fff"/><path d="M314 245h272M450 118v327" stroke="#0f172a" stroke-width="16" opacity=".35"/>';
};

export const createGameVisualDataUrl = (name = 'NickStore') => {
  const theme = getTheme(name);
  const [from, to] = theme.colors;
  const title = escapeXml(name);
  const subtitle = escapeXml(getInitials(name) || 'NS');
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="900" height="675" viewBox="0 0 900 675">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="${from}"/>
          <stop offset="1" stop-color="${to}"/>
        </linearGradient>
        <radialGradient id="glow" cx="70%" cy="20%" r="70%">
          <stop offset="0" stop-color="#ffffff" stop-opacity=".35"/>
          <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="900" height="675" rx="42" fill="#020617"/>
      <rect x="22" y="22" width="856" height="631" rx="34" fill="url(#bg)"/>
      <rect x="22" y="22" width="856" height="631" rx="34" fill="url(#glow)"/>
      <circle cx="735" cy="104" r="178" fill="#fff" opacity=".12"/>
      <circle cx="135" cy="565" r="225" fill="#020617" opacity=".20"/>
      <rect x="92" y="82" width="716" height="512" rx="40" fill="#020617" opacity=".50"/>
      ${iconSvg(theme.icon)}
      <text x="450" y="92" text-anchor="middle" fill="#e0e7ff" font-family="Inter,Arial,sans-serif" font-size="24" font-weight="900" letter-spacing="6">${theme.label}</text>
      <text x="450" y="514" text-anchor="middle" fill="#fff" font-family="Inter,Arial,sans-serif" font-size="50" font-weight="900">${title}</text>
      <text x="450" y="560" text-anchor="middle" fill="#dbeafe" font-family="Inter,Arial,sans-serif" font-size="21" font-weight="800" letter-spacing="4">${subtitle}</text>
    </svg>`;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};
