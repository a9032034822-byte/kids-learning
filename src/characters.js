// Свои персонажи: панда (старшая), капибара (младший), медвежонок (запасной)
// и большой медведь в очках (родители).
// Нарисованы вручную простыми фигурами SVG. mood: happy | cheer | think

const EYES = {
  happy: (x, y) => `<circle cx="${x}" cy="${y}" r="6.5" fill="#2B1B0E"/><circle cx="${x + 2.2}" cy="${y - 2.2}" r="2.2" fill="#fff"/>`,
  cheer: (x, y) => `<path d="M${x - 7} ${y + 2} Q${x} ${y - 8} ${x + 7} ${y + 2}" stroke="#2B1B0E" stroke-width="4" fill="none" stroke-linecap="round"/>`,
  think: (x, y) => `<circle cx="${x}" cy="${y}" r="6" fill="#2B1B0E"/><circle cx="${x + 1.5}" cy="${y - 3}" r="2" fill="#fff"/>`,
};

function arms(mood, color, y) {
  if (mood === 'cheer') {
    return `<ellipse cx="42" cy="${y - 34}" rx="11" ry="22" fill="${color}" transform="rotate(-32 42 ${y - 34})"/>
            <ellipse cx="158" cy="${y - 34}" rx="11" ry="22" fill="${color}" transform="rotate(32 158 ${y - 34})"/>`;
  }
  if (mood === 'think') {
    return `<ellipse cx="50" cy="${y}" rx="11" ry="19" fill="${color}" transform="rotate(18 50 ${y})"/>
            <ellipse cx="136" cy="${y - 28}" rx="10" ry="18" fill="${color}" transform="rotate(-40 136 ${y - 28})"/>`;
  }
  return `<ellipse cx="50" cy="${y}" rx="11" ry="19" fill="${color}" transform="rotate(18 50 ${y})"/>
          <ellipse cx="150" cy="${y}" rx="11" ry="19" fill="${color}" transform="rotate(-18 150 ${y})"/>`;
}

function mouth(mood, x, y) {
  if (mood === 'cheer') return `<path d="M${x - 11} ${y - 2} Q${x} ${y + 16} ${x + 11} ${y - 2} Z" fill="#8C2F39"/><path d="M${x - 6} ${y + 6} Q${x} ${y + 11} ${x + 6} ${y + 6}" fill="#FF8FA3"/>`;
  if (mood === 'think') return `<ellipse cx="${x + 3}" cy="${y + 2}" rx="4" ry="3.5" fill="#5A2A1A"/>`;
  return `<path d="M${x - 9} ${y} Q${x} ${y + 8} ${x + 9} ${y}" stroke="#3D2412" stroke-width="3.5" fill="none" stroke-linecap="round"/>`;
}

function thinkBubble(mood) {
  return mood === 'think' ? `<circle cx="170" cy="36" r="5" fill="#fff" stroke="#C9B8A6" stroke-width="2"/><circle cx="182" cy="20" r="8" fill="#fff" stroke="#C9B8A6" stroke-width="2"/>` : '';
}

export function capybara({ mood = 'happy', accent = '#FF9F1C' } = {}) {
  const fur = '#B9793F', dark = '#9A6031', belly = '#DDAA72';
  return `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <ellipse cx="100" cy="190" rx="60" ry="8" fill="#000" opacity=".08"/>
  <path d="M42 152 C42 114 68 104 100 104 C132 104 158 114 158 152 C158 178 136 188 100 188 C64 188 42 178 42 152Z" fill="${fur}"/>
  <ellipse cx="100" cy="158" rx="34" ry="25" fill="${belly}"/>
  ${arms(mood, dark, 146)}
  <ellipse cx="74" cy="186" rx="16" ry="8" fill="${dark}"/><ellipse cx="126" cy="186" rx="16" ry="8" fill="${dark}"/>
  <circle cx="58" cy="44" r="13" fill="${dark}"/><circle cx="58" cy="46" r="6" fill="#6E4120"/>
  <circle cx="142" cy="44" r="13" fill="${dark}"/><circle cx="142" cy="46" r="6" fill="#6E4120"/>
  <rect x="40" y="34" width="120" height="94" rx="46" fill="${fur}"/>
  <rect x="60" y="82" width="80" height="46" rx="23" fill="${dark}"/>
  <ellipse cx="86" cy="94" rx="5.5" ry="4" fill="#3D2412"/><ellipse cx="114" cy="94" rx="5.5" ry="4" fill="#3D2412"/>
  ${mouth(mood, 100, 112)}
  ${EYES[mood](72, 68)}${EYES[mood](128, 68)}
  <ellipse cx="54" cy="90" rx="9" ry="6" fill="#FF8FA3" opacity=".55"/><ellipse cx="146" cy="90" rx="9" ry="6" fill="#FF8FA3" opacity=".55"/>
  <circle cx="100" cy="28" r="17" fill="${accent}"/><circle cx="94" cy="22" r="4" fill="#fff" opacity=".45"/>
  <path d="M100 12 Q112 2 120 10 Q110 16 100 12Z" fill="#52B788"/>
  ${thinkBubble(mood)}
</svg>`;
}

const PANDA_EYES = {
  happy: (x, y) => `<circle cx="${x}" cy="${y}" r="7.5" fill="#fff"/><circle cx="${x + 0.5}" cy="${y + 0.5}" r="4.6" fill="#1B1B1F"/><circle cx="${x + 2}" cy="${y - 1.5}" r="1.7" fill="#fff"/>`,
  cheer: (x, y) => `<path d="M${x - 7} ${y + 2} Q${x} ${y - 8} ${x + 7} ${y + 2}" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round"/>`,
  think: (x, y) => `<circle cx="${x}" cy="${y}" r="7" fill="#fff"/><circle cx="${x + 1.5}" cy="${y - 2}" r="4.2" fill="#1B1B1F"/><circle cx="${x + 2.6}" cy="${y - 3.4}" r="1.4" fill="#fff"/>`,
};

export function panda({ mood = 'happy', accent = '#9B5DE5' } = {}) {
  const white = '#FBFAF6', shade = '#ECE9E1', black = '#26262B';
  return `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <ellipse cx="100" cy="190" rx="58" ry="8" fill="#000" opacity=".08"/>
  <path d="M46 154 C46 116 70 106 100 106 C130 106 154 116 154 154 C154 178 134 188 100 188 C66 188 46 178 46 154Z" fill="${white}" stroke="${shade}" stroke-width="3"/>
  <ellipse cx="100" cy="160" rx="30" ry="23" fill="${shade}"/>
  ${arms(mood, black, 148)}
  <ellipse cx="76" cy="186" rx="16" ry="9" fill="${black}"/><ellipse cx="124" cy="186" rx="16" ry="9" fill="${black}"/>
  <circle cx="54" cy="44" r="20" fill="${black}"/><circle cx="146" cy="44" r="20" fill="${black}"/>
  <circle cx="100" cy="84" r="56" fill="${white}" stroke="${shade}" stroke-width="3"/>
  <ellipse cx="75" cy="80" rx="16" ry="21" fill="${black}" transform="rotate(-28 75 80)"/>
  <ellipse cx="125" cy="80" rx="16" ry="21" fill="${black}" transform="rotate(28 125 80)"/>
  ${PANDA_EYES[mood](77, 78)}${PANDA_EYES[mood](123, 78)}
  <path d="M91 97 Q100 91 109 97 Q106 104 100 105 Q94 104 91 97Z" fill="${black}"/>
  <path d="M100 105 L100 109" stroke="#3D2412" stroke-width="3" stroke-linecap="round"/>
  ${mouth(mood, 100, 112)}
  <ellipse cx="60" cy="102" rx="9" ry="6" fill="#FF8FA3" opacity=".6"/><ellipse cx="140" cy="102" rx="9" ry="6" fill="#FF8FA3" opacity=".6"/>
  <path d="M140 26 L126 16 L128 36Z M140 26 L156 18 L152 38Z" fill="${accent}"/><circle cx="140" cy="27" r="5" fill="${accent}" stroke="#fff" stroke-width="2"/>
  ${thinkBubble(mood)}
</svg>`;
}

export function bear({ mood = 'happy', accent = '#3A86FF' } = {}) {
  const fur = '#A0622D', dark = '#86501F', light = '#F1D3A8';
  return `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <ellipse cx="100" cy="190" rx="58" ry="8" fill="#000" opacity=".08"/>
  <path d="M46 154 C46 116 70 106 100 106 C130 106 154 116 154 154 C154 178 134 188 100 188 C66 188 46 178 46 154Z" fill="${fur}"/>
  <ellipse cx="100" cy="158" rx="32" ry="25" fill="${light}"/>
  ${arms(mood, dark, 148)}
  <ellipse cx="76" cy="186" rx="15" ry="8" fill="${dark}"/><ellipse cx="124" cy="186" rx="15" ry="8" fill="${dark}"/>
  <circle cx="54" cy="46" r="20" fill="${fur}"/><circle cx="54" cy="46" r="10" fill="${light}"/>
  <circle cx="146" cy="46" r="20" fill="${fur}"/><circle cx="146" cy="46" r="10" fill="${light}"/>
  <circle cx="100" cy="84" r="55" fill="${fur}"/>
  <ellipse cx="100" cy="104" rx="29" ry="22" fill="${light}"/>
  <path d="M90 93 Q100 86 110 93 Q107 101 100 102 Q93 101 90 93Z" fill="#2B1B0E"/>
  <path d="M100 102 L100 107" stroke="#3D2412" stroke-width="3" stroke-linecap="round"/>
  ${mouth(mood, 100, 110)}
  ${EYES[mood](78, 74)}${EYES[mood](122, 74)}
  <ellipse cx="62" cy="96" rx="9" ry="6" fill="#FF8FA3" opacity=".55"/><ellipse cx="138" cy="96" rx="9" ry="6" fill="#FF8FA3" opacity=".55"/>
  <path d="M56 58 Q58 22 100 22 Q142 22 144 58 Q100 44 56 58Z" fill="${accent}"/>
  <path d="M54 58 Q100 42 146 58 L146 66 Q100 50 54 66Z" fill="#1D3557" opacity=".35"/>
  <circle cx="100" cy="20" r="11" fill="#FFD166"/>
  ${thinkBubble(mood)}
</svg>`;
}

export function bigBear({ mood = 'happy', accent = '#2A9D8F' } = {}) {
  const fur = '#7B4A26', dark = '#643A1C', light = '#E9C49A';
  return `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <ellipse cx="100" cy="190" rx="64" ry="8" fill="#000" opacity=".08"/>
  <path d="M38 156 C38 114 66 102 100 102 C134 102 162 114 162 156 C162 180 138 190 100 190 C62 190 38 180 38 156Z" fill="${fur}"/>
  <ellipse cx="100" cy="160" rx="36" ry="26" fill="${light}"/>
  <rect x="70" y="134" width="60" height="40" rx="6" fill="#FFD166" transform="rotate(-6 100 154)"/>
  <path d="M100 136 L100 172" stroke="#E09F3E" stroke-width="3" transform="rotate(-6 100 154)"/>
  <ellipse cx="62" cy="152" rx="12" ry="16" fill="${dark}"/><ellipse cx="138" cy="152" rx="12" ry="16" fill="${dark}"/>
  <circle cx="50" cy="42" r="21" fill="${fur}"/><circle cx="50" cy="42" r="10" fill="${light}"/>
  <circle cx="150" cy="42" r="21" fill="${fur}"/><circle cx="150" cy="42" r="10" fill="${light}"/>
  <circle cx="100" cy="80" r="58" fill="${fur}"/>
  <ellipse cx="100" cy="102" rx="30" ry="22" fill="${light}"/>
  <path d="M89 90 Q100 83 111 90 Q108 99 100 100 Q92 99 89 90Z" fill="#2B1B0E"/>
  ${mouth(mood, 100, 108)}
  ${EYES[mood](76, 70)}${EYES[mood](124, 70)}
  <circle cx="76" cy="70" r="15" fill="none" stroke="#2B2D42" stroke-width="4"/>
  <circle cx="124" cy="70" r="15" fill="none" stroke="#2B2D42" stroke-width="4"/>
  <path d="M91 69 Q100 64 109 69" stroke="#2B2D42" stroke-width="4" fill="none"/>
  <path d="M52 118 Q100 136 148 118 L146 130 Q100 148 54 130Z" fill="${accent}"/>
  <path d="M128 128 L138 150 L126 150Z" fill="${accent}"/>
</svg>`;
}

export function avatar(profile, mood = 'happy') {
  if (!profile) return bigBear({ mood });
  if (profile.id === 'parent') return bigBear({ mood });
  if (profile.companion === 'panda') return panda({ mood, accent: profile.accent || '#9B5DE5' });
  if (profile.companion === 'capybara') return capybara({ mood, accent: profile.accent || '#FF9F1C' });
  return bear({ mood, accent: profile.accent || '#3A86FF' });
}
