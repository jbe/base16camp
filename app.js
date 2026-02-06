// Base16 Camp - Theme Previewer

let schemes = {};
let currentScheme = localStorage.getItem('base16camp-theme') || 'everforest-dark-hard';
let currentFilter = localStorage.getItem('base16camp-filter') || 'all';
let favorites = JSON.parse(localStorage.getItem('base16camp-faves') || '[]');
let hideInvalidThemes = localStorage.getItem('base16camp-valid-only') !== 'false';

// Hand-picked curated themes
const curatedThemes = [
  'atelier-plateau-light',
  'ayu-dark',
  'ayu-mirage',
  'black-metal-gorgoroth',
  'catppuccin-frappe',
  'catppuccin-latte',
  'catppuccin-macchiato',
  'catppuccin-mocha',
  'dracula',
  'equilibrium-gray-light',
  'everforest',
  'everforest-dark-hard',
  'flexoki-light',
  'gruvbox-dark',
  'gruvbox-dark-hard',
  'gruvbox-dark-medium',
  'gruvbox-dark-pale',
  'gruvbox-dark-soft',
  'gruvbox-light',
  'gruvbox-light-hard',
  'gruvbox-light-medium',
  'gruvbox-light-soft',
  'ia-dark',
  'ia-light',
  'kanagawa',
  'mocha',
  'nord',
  'rose-pine',
  'rose-pine-dawn',
  'rose-pine-moon',
  'sandcastle',
  'terracotta',
  'tokyo-city-dark',
  'tokyo-city-light',
  'tokyo-night-dark',
  'tokyo-night-moon',
  'tokyo-night-storm',
];

// Calculate relative luminance of a hex color
function getLuminance(hex) {
  const rgb = hexToRgb(hex);
  const [r, g, b] = rgb.map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16)
  ] : [0, 0, 0];
}

// Calculate contrast ratio between two luminances (always returns >= 1)
function getContrastRatio(lum1, lum2) {
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
}

// Check if a theme has valid contrast (base05 should be readable on base00/base01)
function isValidTheme(scheme) {
  const colors = scheme.colors;
  const lum00 = getLuminance(colors.base00);
  const lum01 = getLuminance(colors.base01);
  const lum05 = getLuminance(colors.base05);
  
  // Check contrast ratios
  const contrast00 = getContrastRatio(lum05, lum00);
  const contrast01 = getContrastRatio(lum05, lum01);
  
  // Require at least 3:1 for main bg, 2:1 for secondary bg (WCAG AA large text)
  return contrast00 >= 3 && contrast01 >= 2;
}

// Load schemes and initialize
async function init() {
  try {
    const response = await fetch('schemes.json');
    schemes = await response.json();
    
    populateThemeList();
    populateMockContent();
    setupEventListeners();
    updateClock();
    
    // Initialize Lucide icons
    if (window.lucide) {
      lucide.createIcons();
    }
    
    // Setup radio player
    setupRadioPlayer();
    
    // Setup draggable settings
    setupDraggableSettings();
    
    // Apply default theme
    if (schemes[currentScheme]) {
      applyTheme(currentScheme);
    } else {
      // Fallback to first available scheme
      const firstScheme = Object.keys(schemes)[0];
      if (firstScheme) applyTheme(firstScheme);
    }
  } catch (error) {
    console.error('Failed to load schemes:', error);
  }
}

// Apply a theme by updating CSS variables
function applyTheme(schemeKey) {
  const scheme = schemes[schemeKey];
  if (!scheme) return;
  
  const root = document.documentElement;
  const colors = scheme.colors;
  
  // Update all CSS variables
  Object.entries(colors).forEach(([key, value]) => {
    root.style.setProperty(`--${key}`, value);
  });
  
  currentScheme = schemeKey;
  localStorage.setItem('base16camp-theme', schemeKey);
  
  // Update UI
  document.getElementById('theme-widget-label').textContent = scheme.name;
  
  // Update art overlay
  document.getElementById('art-title').textContent = scheme.name;
  document.getElementById('art-author').textContent = scheme.author || 'Unknown';
  document.getElementById('art-link').href = `https://github.com/tinted-theming/schemes/blob/spec-0.11/base16/${schemeKey}.yaml`;
  
  // Regenerate art for day/night based on variant
  populateArt();
  
  // Refresh icons for new link icon
  if (window.lucide) lucide.createIcons();
  
  // Update active state in theme list
  document.querySelectorAll('.theme-item').forEach(item => {
    item.classList.toggle('active', item.dataset.scheme === schemeKey);
  });
  
  // Show notification
  showNotification(scheme.name);
}

// Toggle favorite
function toggleFavorite(schemeKey, e) {
  e.stopPropagation();
  const idx = favorites.indexOf(schemeKey);
  if (idx === -1) {
    favorites.push(schemeKey);
  } else {
    favorites.splice(idx, 1);
  }
  localStorage.setItem('base16camp-faves', JSON.stringify(favorites));
  populateThemeList();
}

// Populate the theme list
function populateThemeList() {
  const list = document.getElementById('theme-list');
  list.innerHTML = '';
  
  const searchTerm = document.getElementById('theme-search')?.value.toLowerCase() || '';
  
  Object.entries(schemes)
    .filter(([key, scheme]) => {
      // Filter by variant, faves, or curated
      if (currentFilter === 'faves') {
        if (!favorites.includes(key)) return false;
      } else if (currentFilter === 'curated') {
        if (!curatedThemes.includes(key)) return false;
      } else if (currentFilter !== 'all' && scheme.variant !== currentFilter) {
        return false;
      }
      // Filter by search
      if (searchTerm && !scheme.name.toLowerCase().includes(searchTerm)) {
        return false;
      }
      // Filter invalid themes
      if (hideInvalidThemes && !isValidTheme(scheme)) {
        return false;
      }
      return true;
    })
    .sort((a, b) => a[1].name.localeCompare(b[1].name))
    .forEach(([key, scheme]) => {
      const item = document.createElement('div');
      item.className = `theme-item${key === currentScheme ? ' active' : ''}`;
      item.dataset.scheme = key;
      
      const colors = scheme.colors;
      const swatchKeys = ['base00', 'base01', 'base02', 'base03', 'base04', 'base05', 'base06', 'base07',
                         'base08', 'base09', 'base0a', 'base0b', 'base0c', 'base0d', 'base0e', 'base0f'];
      const isFave = favorites.includes(key);
      
      item.innerHTML = `
        <button class="theme-fave${isFave ? ' active' : ''}" title="${isFave ? 'Remove from favorites' : 'Add to favorites'}">
          <i data-lucide="star"></i>
        </button>
        <div class="theme-swatches">
          ${swatchKeys.map(c => `<div class="theme-swatch" style="background: ${colors[c]}"></div>`).join('')}
        </div>
        <div class="theme-info">
          <div class="theme-name">${scheme.name}</div>
          <div class="theme-author">${scheme.author || 'Unknown'}</div>
        </div>
        <span class="theme-variant">${scheme.variant || 'dark'}</span>
      `;
      
      item.querySelector('.theme-fave').addEventListener('click', (e) => toggleFavorite(key, e));
      item.addEventListener('click', () => applyTheme(key));
      list.appendChild(item);
    });
  
  // Re-initialize Lucide for any new icons
  if (window.lucide) {
    lucide.createIcons();
  }
}

// Show notification toast
let notificationTimeout = null;
function showNotification(themeName) {
  const notification = document.getElementById('notification');
  const body = document.getElementById('notification-body');
  
  // Clear any existing timeout
  if (notificationTimeout) {
    clearTimeout(notificationTimeout);
  }
  
  body.textContent = themeName;
  notification.classList.add('show');
  
  notificationTimeout = setTimeout(() => {
    notification.classList.remove('show');
    notificationTimeout = null;
  }, 2000);
}

// Setup event listeners
function setupEventListeners() {
  // Settings panel toggle
  const overlay = document.getElementById('settings-overlay');
  const toggle = document.getElementById('settings-toggle');
  
  toggle.addEventListener('click', () => {
    overlay.classList.toggle('hidden');
  });
  
  // Search
  document.getElementById('theme-search').addEventListener('input', populateThemeList);
  
  // Filter buttons (both .filter-btn and .filter-seg)
  const searchInput = document.getElementById('theme-search');
  const allFilterBtns = document.querySelectorAll('.filter-btn, .filter-seg');
  
  allFilterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      allFilterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      localStorage.setItem('base16camp-filter', currentFilter);
      // Clear search when switching tabs
      searchInput.value = '';
      populateThemeList();
    });
  });
  
  // Restore filter button state
  allFilterBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === currentFilter);
  });
  
  // Valid themes toggle
  const hideInvalidCheckbox = document.getElementById('hide-invalid');
  hideInvalidCheckbox.checked = hideInvalidThemes;
  hideInvalidCheckbox.addEventListener('change', (e) => {
    hideInvalidThemes = e.target.checked;
    localStorage.setItem('base16camp-valid-only', hideInvalidThemes);
    populateThemeList();
  });
  
  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      overlay.classList.add('hidden');
    }
    if (e.key === 't' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      overlay.classList.toggle('hidden');
    }
    // Arrow key navigation in theme list
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !overlay.classList.contains('hidden')) {
      e.preventDefault();
      const items = Array.from(document.querySelectorAll('.theme-item'));
      if (items.length === 0) return;
      
      const currentIndex = items.findIndex(item => item.dataset.scheme === currentScheme);
      let newIndex;
      
      if (e.key === 'ArrowDown') {
        newIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
      } else {
        newIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
      }
      
      const newScheme = items[newIndex].dataset.scheme;
      applyTheme(newScheme);
      
      // Scroll item into view
      items[newIndex].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  });
}

// Update clock
function updateClock() {
  const clock = document.getElementById('clock');
  const now = new Date();
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  clock.textContent = `${days[now.getDay()]} ${now.getDate()} ${months[now.getMonth()]} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  
  setTimeout(updateClock, 60000 - (now.getSeconds() * 1000));
}

// Populate mock content
function populateMockContent() {
  populateEditor();
  populateTerminal();
  populateFileManager();
  populateArt();
}

// Editor content - Hyprland config
function populateEditor() {
  const code = `# Hyprland configuration
# See https://wiki.hyprland.org/

monitor = , preferred, auto, 1

$terminal = kitty
$fileManager = thunar
$menu = wofi --show drun

env = XCURSOR_SIZE, 24
env = QT_QPA_PLATFORMTHEME, qt5ct

input {
    kb_layout = us
    follow_mouse = 1
    sensitivity = 0
    touchpad {
        natural_scroll = true
    }
}

general {
    gaps_in = 4
    gaps_out = 8
    border_size = 2
    col.active_border = rgba(33ccffee) rgba(00ff99ee) 45deg
    col.inactive_border = rgba(595959aa)
    layout = dwindle
}

decoration {
    rounding = 10
    blur {
        enabled = true
        size = 8
        passes = 2
    }
    drop_shadow = true
    shadow_range = 4
    shadow_render_power = 3
}

animations {
    enabled = true
    bezier = myBezier, 0.05, 0.9, 0.1, 1.05
    animation = windows, 1, 7, myBezier
    animation = windowsOut, 1, 7, default, popin 80%
    animation = fade, 1, 7, default
    animation = workspaces, 1, 6, default
}

dwindle {
    pseudotile = true
    preserve_split = true
}

# Keybindings
$mainMod = SUPER

bind = $mainMod, Return, exec, $terminal
bind = $mainMod, Q, killactive,
bind = $mainMod, M, exit,
bind = $mainMod, E, exec, $fileManager
bind = $mainMod, V, togglefloating,
bind = $mainMod, R, exec, $menu
bind = $mainMod, P, pseudo,
bind = $mainMod, J, togglesplit,

# Move focus
bind = $mainMod, left, movefocus, l
bind = $mainMod, right, movefocus, r
bind = $mainMod, up, movefocus, u
bind = $mainMod, down, movefocus, d

# Switch workspaces
bind = $mainMod, 1, workspace, 1
bind = $mainMod, 2, workspace, 2
bind = $mainMod, 3, workspace, 3
bind = $mainMod, 4, workspace, 4
bind = $mainMod, 5, workspace, 5`;

  const lines = code.split('\n');
  const gutter = document.getElementById('editor-gutter');
  const codeEl = document.getElementById('editor-code');
  
  // Line numbers
  gutter.innerHTML = lines.map((_, i) => `<div>${i + 1}</div>`).join('');
  
  // Syntax highlighted code
  codeEl.innerHTML = lines.map(line => highlightLine(line)).join('\n');
}

// Simple syntax highlighter for Hyprland config
function highlightLine(line) {
  // Comments
  if (line.trim().startsWith('#')) {
    return `<span class="syn-comment">${escapeHtml(line)}</span>`;
  }
  
  // Variable definitions
  if (line.includes('$') && line.includes('=')) {
    return line.replace(/(\$\w+)(\s*=\s*)(.*)/, (_, varName, eq, value) => {
      return `<span class="syn-variable">${escapeHtml(varName)}</span><span class="syn-operator">${escapeHtml(eq)}</span>${highlightValue(value)}`;
    });
  }
  
  // env = lines
  if (line.trim().startsWith('env')) {
    return line.replace(/(env)(\s*=\s*)(\w+)(,\s*)(.*)/, (_, env, eq, name, comma, value) => {
      return `<span class="syn-keyword">${env}</span><span class="syn-operator">${eq}</span><span class="syn-property">${name}</span><span class="syn-punctuation">${comma}</span><span class="syn-string">${escapeHtml(value)}</span>`;
    });
  }
  
  // Section headers { }
  if (line.includes('{')) {
    return line.replace(/^(\s*)(\w+)(\s*\{)/, (_, space, name, brace) => {
      return `${space}<span class="syn-type">${name}</span><span class="syn-punctuation">${brace}</span>`;
    });
  }
  
  // Key = value lines
  if (line.includes('=') && !line.trim().startsWith('#')) {
    return line.replace(/^(\s*)(\w+)(\s*=\s*)(.*)/, (_, space, key, eq, value) => {
      return `${space}<span class="syn-property">${key}</span><span class="syn-operator">${eq}</span>${highlightValue(value)}`;
    });
  }
  
  // bind lines
  if (line.trim().startsWith('bind')) {
    return line.replace(/(bind)(\s*=\s*)(.*)/, (_, bind, eq, rest) => {
      const parts = rest.split(',').map((part, i) => {
        part = part.trim();
        if (part.startsWith('$')) {
          return `<span class="syn-variable">${escapeHtml(part)}</span>`;
        } else if (part.startsWith('exec')) {
          return `<span class="syn-function">${escapeHtml(part)}</span>`;
        } else if (/^\d+$/.test(part)) {
          return `<span class="syn-number">${part}</span>`;
        }
        return `<span class="syn-string">${escapeHtml(part)}</span>`;
      });
      return `<span class="syn-keyword">${bind}</span><span class="syn-operator">${eq}</span>${parts.join('<span class="syn-punctuation">, </span>')}`;
    });
  }
  
  // animation lines
  if (line.trim().startsWith('animation') || line.trim().startsWith('bezier')) {
    return line.replace(/^(\s*)(\w+)(\s*=\s*)(.*)/, (_, space, key, eq, value) => {
      const parts = value.split(',').map(part => {
        part = part.trim();
        if (/^[\d.]+$/.test(part)) {
          return `<span class="syn-number">${part}</span>`;
        }
        return `<span class="syn-string">${escapeHtml(part)}</span>`;
      });
      return `${space}<span class="syn-keyword">${key}</span><span class="syn-operator">${eq}</span>${parts.join('<span class="syn-punctuation">, </span>')}`;
    });
  }
  
  // Closing brace
  if (line.trim() === '}') {
    return `<span class="syn-punctuation">${escapeHtml(line)}</span>`;
  }
  
  return escapeHtml(line);
}

function highlightValue(value) {
  value = value.trim();
  
  // Numbers
  if (/^[\d.]+$/.test(value)) {
    return `<span class="syn-number">${value}</span>`;
  }
  
  // Boolean-like
  if (value === 'true' || value === 'false' || value === 'yes' || value === 'no') {
    return `<span class="syn-constant">${value}</span>`;
  }
  
  // Hex colors
  if (value.startsWith('rgba(') || value.startsWith('#')) {
    return `<span class="syn-number">${escapeHtml(value)}</span>`;
  }
  
  // Variables
  if (value.startsWith('$')) {
    return `<span class="syn-variable">${escapeHtml(value)}</span>`;
  }
  
  return `<span class="syn-string">${escapeHtml(value)}</span>`;
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Terminal content - realistic commands
function populateTerminal() {
  const output = document.getElementById('terminal-output');
  
  const prompt = `<span class="prompt-user">camper</span><span class="prompt-symbol">@</span><span class="prompt-host">base16</span> <span class="prompt-path">~/camp</span>
<span class="prompt-symbol">❯</span>`;

  const terminalContent = `${prompt} <span class="term-white">eza --tree -la --icons=never</span>
<span class="term-bright-black">drwxr-xr-x</span>    <span class="term-yellow">-</span> <span class="term-green">jbe</span> <span class="term-green">users</span> <span class="term-blue"> 5 Feb</span>  <span class="term-blue term-bold">.</span>
<span class="term-bright-black">.rw-r--r--</span> <span class="term-green">4.2k</span> <span class="term-green">jbe</span> <span class="term-green">users</span> <span class="term-blue"> 5 Feb</span>  ├── <span class="term-white">app.js</span>
<span class="term-bright-black">drwxr-xr-x</span>    <span class="term-yellow">-</span> <span class="term-green">jbe</span> <span class="term-green">users</span> <span class="term-blue"> 3 Feb</span>  ├── <span class="term-blue term-bold">.github</span>
<span class="term-bright-black">drwxr-xr-x</span>    <span class="term-yellow">-</span> <span class="term-green">jbe</span> <span class="term-green">users</span> <span class="term-blue"> 3 Feb</span>  │   └── <span class="term-blue term-bold">workflows</span>
<span class="term-bright-black">.rw-r--r--</span>  <span class="term-green">842</span> <span class="term-green">jbe</span> <span class="term-green">users</span> <span class="term-blue"> 3 Feb</span>  │       └── <span class="term-white">sync-schemes.yml</span>
<span class="term-bright-black">.rw-r--r--</span>   <span class="term-green">12</span> <span class="term-green">jbe</span> <span class="term-green">users</span> <span class="term-blue"> 5 Feb</span>  ├── <span class="term-white">.gitignore</span>
<span class="term-bright-black">.rw-r--r--</span> <span class="term-green">5.1k</span> <span class="term-green">jbe</span> <span class="term-green">users</span> <span class="term-blue"> 5 Feb</span>  ├── <span class="term-white">index.html</span>
<span class="term-bright-black">.rw-r--r--</span>  <span class="term-green">186</span> <span class="term-green">jbe</span> <span class="term-green">users</span> <span class="term-blue"> 4 Feb</span>  ├── <span class="term-white">package.json</span>
<span class="term-bright-black">.rw-r--r--</span>  <span class="term-green">412</span> <span class="term-green">jbe</span> <span class="term-green">users</span> <span class="term-blue"> 4 Feb</span>  ├── <span class="term-white">README.md</span>
<span class="term-bright-black">.rw-r--r--</span>  <span class="term-green">91k</span> <span class="term-green">jbe</span> <span class="term-green">users</span> <span class="term-blue"> 5 Feb</span>  ├── <span class="term-white">schemes.json</span>
<span class="term-bright-black">.rw-r--r--</span> <span class="term-green">8.3k</span> <span class="term-green">jbe</span> <span class="term-green">users</span> <span class="term-blue"> 5 Feb</span>  ├── <span class="term-white">styles.css</span>
<span class="term-bright-black">.rw-r--r--</span> <span class="term-green">2.8k</span> <span class="term-green">jbe</span> <span class="term-green">users</span> <span class="term-blue"> 4 Feb</span>  └── <span class="term-white">sync-schemes.ts</span>

${prompt} <span class="term-white">curl -s pihole.lan/admin/api.php?summary</span>
<span class="term-bright-black">{</span>
  <span class="term-blue">"domains_blocked"</span>: <span class="term-magenta">127849</span>,
  <span class="term-blue">"dns_queries_today"</span>: <span class="term-magenta">14273</span>,
  <span class="term-blue">"ads_blocked_today"</span>: <span class="term-magenta">2841</span>,
  <span class="term-blue">"ads_percentage"</span>: <span class="term-magenta">19.9</span>,
  <span class="term-blue">"status"</span>: <span class="term-green">"enabled"</span>
<span class="term-bright-black">}</span>

${prompt} <span class="term-white">bluetoothctl devices</span>
<span class="term-yellow">Device 4C:87:5D:AA:F2:01</span> Anker Soundcore Q30
<span class="term-yellow">Device 88:C9:E8:12:34:AB</span> LE-Bose QC45
<span class="term-yellow">Device 00:1A:7D:DA:71:13</span> 中村さんの iPhone
<span class="term-yellow">Device 00:1A:7D:DA:71:14</span> 田中さんの iPhone
<span class="term-yellow">Device 00:1A:7D:DA:71:15</span> 佐藤さんの iPhone
<span class="term-yellow">Device F4:4E:FD:9B:2C:77</span> TOZO-T6

${prompt} <span class="term-white">bluetoothctl connect F4:4E:FD:9B:2C:77</span>
Attempting to connect to <span class="term-yellow">F4:4E:FD:9B:2C:77</span>
<span class="term-red">Failed to connect: org.bluez.Error.Failed br-connection-profile-unavailable</span>

${prompt} <span class="term-white">sudo systemctl restart bluetooth</span>

${prompt} <span class="term-white">dmesg | grep -i bluetooth | tail -3</span>
<span class="term-bright-black">[18842.127]</span> Bluetooth: hci0: RTL: fw rtl_bt/rtl8761bu_fw.bin
<span class="term-bright-black">[18842.891]</span> Bluetooth: hci0: RTL: cfg rtl_bt/rtl8761bu_config
<span class="term-bright-black">[18843.204]</span> Bluetooth: MGMT ver <span class="term-magenta">1.22</span>

${prompt} <span class="term-white">rfkill list bluetooth</span>
<span class="term-cyan">0</span>: hci0: Bluetooth
	Soft blocked: <span class="term-green">no</span>
	Hard blocked: <span class="term-green">no</span>

${prompt} <span class="term-dim">█</span>`;

  output.innerHTML = terminalContent;
}

// File manager content
function populateFileManager() {
  const sidebar = document.getElementById('fm-sidebar');
  const main = document.getElementById('fm-main');
  
  const sidebarItems = [
    { section: 'Places', items: [
      { name: 'Home', icon: 'home', active: true },
      { name: 'Documents', icon: 'file-text' },
      { name: 'Downloads', icon: 'download' },
      { name: 'Pictures', icon: 'image' },
    ]},
    { section: 'Devices', items: [
      { name: '512GB SSD', icon: 'hard-drive' },
    ]},
    { section: 'Network', items: [
      { name: 'Browse Network', icon: 'globe' },
      { name: 'nas.local', icon: 'server' },
      { name: 'media-share', icon: 'folder-symlink' },
    ]},
  ];
  
  sidebar.innerHTML = sidebarItems.map(section => `
    <div class="fm-section">
      <div class="fm-section-title">${section.section}</div>
      ${section.items.map(item => `
        <div class="fm-item${item.active ? ' active' : ''}">
          <i data-lucide="${item.icon}" class="fm-item-icon"></i>
          <span>${item.name}</span>
        </div>
      `).join('')}
    </div>
  `).join('');
  
  const files = [
    { name: '.config', icon: 'folder', type: 'folder' },
    { name: '.local', icon: 'folder', type: 'folder' },
    { name: 'Documents', icon: 'folder', type: 'folder' },
    { name: 'Downloads', icon: 'folder', type: 'folder' },
    { name: 'Pictures', icon: 'folder', type: 'folder' },
    { name: 'Projects', icon: 'folder', type: 'folder' },
    { name: '.bashrc', icon: 'file-code', type: 'file-config' },
    { name: '.zshrc', icon: 'file-code', type: 'file-config' },
    { name: '.gitconfig', icon: 'file-code', type: 'file-config' },
    { name: 'notes.md', icon: 'file-text', type: 'file-text' },
  ];
  
  main.innerHTML = `
    <div class="fm-grid">
      ${files.map((file, i) => `
        <div class="fm-file${i === 0 ? ' selected' : ''}">
          <i data-lucide="${file.icon}" class="fm-file-icon ${file.type}"></i>
          <span class="fm-file-name">${file.name}</span>
        </div>
      `).join('')}
    </div>
  `;
  
  // Re-initialize Lucide for new icons
  if (window.lucide) {
    lucide.createIcons();
  }
}

// Generative art (night/day based on theme variant)
function populateArt() {
  const svg = document.getElementById('art-canvas');
  const width = 400;
  const height = 140;
  
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  
  const rand = (max = 1) => Math.random() * max;
  const scheme = schemes[currentScheme];
  const isLight = scheme?.variant === 'light';
  
  let content = '';
  
  // Noise filter definition
  content += `
    <defs>
      <filter id="art-noise" x="0%" y="0%" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="4" result="noise" />
        <feColorMatrix type="saturate" values="0" result="mono" />
        <feComponentTransfer result="final">
          <feFuncA type="linear" slope="0.3" />
        </feComponentTransfer>
      </filter>
    </defs>
  `;
  
  // Background (darker for daytime to give sky depth)
  const bgColor = isLight ? 'var(--base02)' : 'var(--base00)';
  content += `<rect width="100%" height="100%" fill="${bgColor}" />`;
  
  if (isLight) {
    // === DAYTIME SCENE ===
    
    // Gradient for clouds
    content += `
      <defs>
        <linearGradient id="cloud-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="var(--base01)" />
          <stop offset="100%" stop-color="var(--base02)" />
        </linearGradient>
      </defs>
    `;
    
    // Sun
    content += `
      <circle cx="320" cy="35" r="20" fill="var(--base0a)" opacity="0.9" />
      <circle cx="320" cy="35" r="26" fill="var(--base0a)" opacity="0.2" />
    `;
    
    // Clouds (light, fluffy - gradient from base01 to base02)
    const drawCloud = (x, y, scale = 1) => {
      return `
        <g transform="translate(${x}, ${y}) scale(${scale})">
          <ellipse cx="-22" cy="5" rx="12" ry="8" fill="url(#cloud-gradient)" />
          <ellipse cx="-15" cy="0" rx="16" ry="11" fill="url(#cloud-gradient)" />
          <ellipse cx="0" cy="-2" rx="22" ry="14" fill="url(#cloud-gradient)" />
          <ellipse cx="18" cy="0" rx="18" ry="12" fill="url(#cloud-gradient)" />
          <ellipse cx="30" cy="4" rx="10" ry="7" fill="url(#cloud-gradient)" />
          <ellipse cx="8" cy="-8" rx="12" ry="9" fill="url(#cloud-gradient)" />
          <ellipse cx="-8" cy="-5" rx="10" ry="8" fill="url(#cloud-gradient)" />
        </g>
      `;
    };
    
    content += drawCloud(120, 50, 1.1);
    content += drawCloud(200, 40, 0.9);
    content += drawCloud(360, 40, 0.8);
    
    // Stylized birds (simple V shapes)
    const drawBird = (x, y, size = 1) => {
      return `<path d="M${x - 4 * size} ${y + 2 * size} Q${x} ${y - 2 * size} ${x + 4 * size} ${y + 2 * size}" 
                    stroke="var(--base03)" stroke-width="1.5" fill="none" stroke-linecap="round" />`;
    };
    
    content += drawBird(100, 25, 1);
    content += drawBird(115, 30, 0.8);
    content += drawBird(240, 20, 1.2);
    content += drawBird(250, 28, 0.7);
    
  } else {
    // === NIGHTTIME SCENE ===
    
    const dimColors = ['var(--base03)', 'var(--base04)'];
    const brightColors = ['var(--base05)', 'var(--base08)', 'var(--base0a)', 'var(--base0c)', 'var(--base0d)', 'var(--base0e)'];
    
    // Helper: draw a cross/sparkle star
    const drawStar = (x, y, size, color, opacity = 1) => {
      return `
        <line x1="${x - size}" y1="${y}" x2="${x + size}" y2="${y}" stroke="${color}" stroke-width="1" opacity="${opacity}" />
        <line x1="${x}" y1="${y - size}" x2="${x}" y2="${y + size}" stroke="${color}" stroke-width="1" opacity="${opacity}" />
      `;
    };
    
    // Moon (lower in sky)
    content += `
      <circle cx="340" cy="50" r="15" fill="var(--base06)" />
      <circle cx="347" cy="47" r="15" fill="var(--base00)" />
    `;
    
    // Very faint distant stars
    for (let i = 0; i < 600; i++) {
      const x = rand(width);
      const y = rand(height * 0.75);
      const r = rand(0.25) + 0.05;
      const opacity = rand(0.3) + 0.1;
      const color = dimColors[Math.floor(rand(dimColors.length))];
      content += `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}" opacity="${opacity}" />`;
    }
    
    // Small dot stars
    for (let i = 0; i < 150; i++) {
      const x = rand(width);
      const y = rand(height * 0.7);
      const r = rand(0.35) + 0.15;
      const opacity = rand(0.4) + 0.3;
      const color = dimColors[Math.floor(rand(dimColors.length))];
      content += `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}" opacity="${opacity}" />`;
    }
    
    // Medium colored dots
    for (let i = 0; i < 30; i++) {
      const x = rand(width);
      const y = rand(height * 0.65);
      const r = rand(0.5) + 0.3;
      const color = brightColors[Math.floor(rand(brightColors.length))];
      const opacity = rand(0.3) + 0.5;
      content += `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}" opacity="${opacity}" />`;
    }
    
    // Small cross-shaped stars
    for (let i = 0; i < 15; i++) {
      const x = rand(width);
      const y = rand(height * 0.6);
      const size = rand(1.5) + 0.5;
      const color = brightColors[Math.floor(rand(brightColors.length))];
      const opacity = rand(0.3) + 0.5;
      content += drawStar(x, y, size, color, opacity);
    }
    
    // A few brighter sparkle stars
    for (let i = 0; i < 5; i++) {
      const x = rand(width);
      const y = rand(height * 0.5);
      const size = rand(1.5) + 1.5;
      const color = brightColors[Math.floor(rand(brightColors.length))];
      content += drawStar(x, y, size, color, 0.8);
      content += `<circle cx="${x}" cy="${y}" r="0.6" fill="${color}" />`;
    }
  }
  
  // Rolling hills in foreground (shared for both day/night)
  content += `
    <path d="M-10 140 
             Q30 75, 80 85
             Q130 95, 180 70
             Q240 50, 300 65
             Q360 80, 410 60
             L410 140 Z" 
          fill="color-mix(in srgb, var(--base01) 70%, var(--base00))" />
    <path d="M-10 140
             Q50 85, 120 90
             Q180 95, 240 80
             Q310 65, 410 85
             L410 140 Z"
          fill="var(--base01)" />
    <path d="M-10 140
             Q80 100, 160 105
             Q240 110, 320 95
             Q380 85, 410 100
             L410 140 Z"
          fill="color-mix(in srgb, var(--base02) 80%, var(--base01))" />
    <path d="M-10 140
             Q60 115, 140 118
             Q200 120, 280 112
             Q350 105, 410 115
             L410 140 Z"
          fill="var(--base02)" />
  `;
  
  // Noise overlay
  content += `<rect width="100%" height="100%" fill="white" filter="url(#art-noise)" style="mix-blend-mode: overlay;" />`;
  
  svg.innerHTML = content;
}

// Draggable settings window
function setupDraggableSettings() {
  const window = document.getElementById('settings-window');
  const handle = document.getElementById('settings-drag');
  const fullscreenBtn = document.getElementById('settings-fullscreen');
  
  // Fullscreen toggle (webpage fullscreen)
  fullscreenBtn.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  });
  
  // Update icon when fullscreen changes (e.g. user presses Esc)
  document.addEventListener('fullscreenchange', () => {
    fullscreenBtn.classList.toggle('is-fullscreen', !!document.fullscreenElement);
  });
  
  let isDragging = false;
  let offsetX = 0;
  let offsetY = 0;
  
  handle.addEventListener('mousedown', (e) => {
    isDragging = true;
    const rect = window.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    
    // Switch to fixed positioning if not already
    if (!window.style.position || window.style.position !== 'fixed') {
      window.style.position = 'fixed';
      window.style.left = rect.left + 'px';
      window.style.top = rect.top + 'px';
      window.style.transform = 'none';
    }
    
    e.preventDefault();
  });
  
  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    
    const rect = window.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = document.documentElement.clientHeight;
    
    // Calculate new position
    let newLeft = e.clientX - offsetX;
    let newTop = e.clientY - offsetY;
    
    // Constrain to viewport (keep at least 100px visible)
    const minVisible = 100;
    newLeft = Math.max(-rect.width + minVisible, Math.min(viewportWidth - minVisible, newLeft));
    newTop = Math.max(0, Math.min(viewportHeight - minVisible, newTop));
    
    window.style.left = newLeft + 'px';
    window.style.top = newTop + 'px';
  });
  
  document.addEventListener('mouseup', () => {
    isDragging = false;
  });
}

// Radio player
function setupRadioPlayer() {
  const toggle = document.getElementById('music-toggle');
  const player = document.getElementById('radio-player');
  const volumeSlider = document.getElementById('volume-slider');
  const volumeDown = document.getElementById('volume-down');
  const volumeUp = document.getElementById('volume-up');
  
  let isPlaying = false;
  player.volume = 0.7;
  
  // Play/pause toggle
  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    if (isPlaying) {
      player.pause();
      toggle.classList.remove('playing');
    } else {
      player.play();
      toggle.classList.add('playing');
    }
    isPlaying = !isPlaying;
  });
  
  // Volume controls
  volumeSlider.addEventListener('input', (e) => {
    player.volume = e.target.value / 100;
  });
  
  volumeDown.addEventListener('click', (e) => {
    e.stopPropagation();
    player.volume = Math.max(0, player.volume - 0.1);
    volumeSlider.value = player.volume * 100;
  });
  
  volumeUp.addEventListener('click', (e) => {
    e.stopPropagation();
    player.volume = Math.min(1, player.volume + 0.1);
    volumeSlider.value = player.volume * 100;
  });
  
  // Handle errors gracefully
  player.addEventListener('error', () => {
    console.log('Radio stream unavailable');
  });
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', init);
