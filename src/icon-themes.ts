import { IconTheme, IconSet, IconThemeName } from './types.js';

// Built-in Icon Themes
const EMOJI_THEME: IconSet = {
  // File and folder icons
  folder: '📁',
  file: '📄',
  code: '📝',
  
  // Tree structure
  branch: '├──',
  lastBranch: '└──',
  vertical: '│',
  
  // Feature icons
  symbols: '🔷',
  imports: '🔗',
  exports: '📤',
  dependencies: '📥',
  dependents: '🔄',
  preview: '👁️',
  search: '🔍',
  performance: '⚡',
  
  // Git status
  gitModified: '🟡',
  gitAdded: '🟢',
  gitDeleted: '🔴',
  gitUntracked: '⚪',
  gitRenamed: '🔵',
  
  // Performance indicators
  perfFast: '🟢',
  perfMedium: '🟡',
  perfSlow: '🟠',
  perfCritical: '🔴',
  
  // Search match types
  searchFile: '📄',
  searchSymbol: '🔷',
  searchContent: '📝',
  searchImport: '🔗',
  
  // Dependency types
  depImport: '📦',
  depRequire: '🔧',
  depDynamic: '⚡',
  depType: '🏷️',
  
  // Status indicators
  error: '❌',
  truncated: '...',
  loading: '⏳'
};

const MINIMAL_THEME: IconSet = {
  // File and folder icons
  folder: '+',
  file: '-',
  code: '*',
  
  // Tree structure
  branch: '├─',
  lastBranch: '└─',
  vertical: '│',
  
  // Feature icons
  symbols: 'S',
  imports: 'I',
  exports: 'E',
  dependencies: 'D',
  dependents: 'R',
  preview: 'P',
  search: '?',
  performance: 'T',
  
  // Git status
  gitModified: 'M',
  gitAdded: 'A',
  gitDeleted: 'D',
  gitUntracked: '?',
  gitRenamed: 'R',
  
  // Performance indicators
  perfFast: 'F',
  perfMedium: 'M',
  perfSlow: 'S',
  perfCritical: '!',
  
  // Search match types
  searchFile: 'f',
  searchSymbol: 's',
  searchContent: 'c',
  searchImport: 'i',
  
  // Dependency types
  depImport: 'i',
  depRequire: 'r',
  depDynamic: 'd',
  depType: 't',
  
  // Status indicators
  error: '!',
  truncated: '...',
  loading: '~'
};

const NERD_FONTS_THEME: IconSet = {
  // File and folder icons (requires Nerd Fonts)
  folder: '',
  file: '',
  code: '',
  
  // Tree structure
  branch: '├─',
  lastBranch: '└─',
  vertical: '│',
  
  // Feature icons
  symbols: '',
  imports: '',
  exports: '',
  dependencies: '',
  dependents: '',
  preview: '',
  search: '',
  performance: '',
  
  // Git status
  gitModified: '',
  gitAdded: '',
  gitDeleted: '',
  gitUntracked: '',
  gitRenamed: '',
  
  // Performance indicators
  perfFast: '',
  perfMedium: '',
  perfSlow: '',
  perfCritical: '',
  
  // Search match types
  searchFile: '',
  searchSymbol: '',
  searchContent: '',
  searchImport: '',
  
  // Dependency types
  depImport: '',
  depRequire: '',
  depDynamic: '',
  depType: '',
  
  // Status indicators
  error: '',
  truncated: '...',
  loading: ''
};

const ASCII_THEME: IconSet = {
  // File and folder icons
  folder: '[DIR]',
  file: '[FILE]',
  code: '[CODE]',
  
  // Tree structure
  branch: '|--',
  lastBranch: '`--',
  vertical: '|',
  
  // Feature icons
  symbols: '[SYM]',
  imports: '[IMP]',
  exports: '[EXP]',
  dependencies: '[DEP]',
  dependents: '[REF]',
  preview: '[PREV]',
  search: '[SRCH]',
  performance: '[PERF]',
  
  // Git status
  gitModified: '[MOD]',
  gitAdded: '[ADD]',
  gitDeleted: '[DEL]',
  gitUntracked: '[NEW]',
  gitRenamed: '[REN]',
  
  // Performance indicators
  perfFast: '[FAST]',
  perfMedium: '[MED]',
  perfSlow: '[SLOW]',
  perfCritical: '[CRIT]',
  
  // Search match types
  searchFile: '[FILE]',
  searchSymbol: '[SYM]',
  searchContent: '[TXT]',
  searchImport: '[IMP]',
  
  // Dependency types
  depImport: '[IMP]',
  depRequire: '[REQ]',
  depDynamic: '[DYN]',
  depType: '[TYP]',
  
  // Status indicators
  error: '[ERR]',
  truncated: '[...]',
  loading: '[...]'
};

const CORPORATE_THEME: IconSet = {
  // File and folder icons
  folder: '▶',
  file: '○',
  code: '●',
  
  // Tree structure
  branch: '├─',
  lastBranch: '└─',
  vertical: '│',
  
  // Feature icons
  symbols: '◆',
  imports: '→',
  exports: '←',
  dependencies: '↓',
  dependents: '↑',
  preview: '◉',
  search: '◇',
  performance: '◈',
  
  // Git status
  gitModified: '◐',
  gitAdded: '◑',
  gitDeleted: '◒',
  gitUntracked: '◯',
  gitRenamed: '◔',
  
  // Performance indicators
  perfFast: '▲',
  perfMedium: '►',
  perfSlow: '▼',
  perfCritical: '◆',
  
  // Search match types
  searchFile: '○',
  searchSymbol: '◆',
  searchContent: '●',
  searchImport: '→',
  
  // Dependency types
  depImport: '→',
  depRequire: '⇒',
  depDynamic: '⟶',
  depType: '⟹',
  
  // Status indicators
  error: '✕',
  truncated: '…',
  loading: '⋯'
};

// Theme registry
const ICON_THEMES: Record<IconThemeName, IconTheme> = {
  emoji: {
    name: 'emoji',
    displayName: 'Emoji Theme',
    description: 'Colorful emojis for a fun, visual experience',
    icons: EMOJI_THEME
  },
  
  minimal: {
    name: 'minimal',
    displayName: 'Minimal Theme',
    description: 'Simple ASCII characters for clean, lightweight display',
    icons: MINIMAL_THEME
  },
  
  'nerd-fonts': {
    name: 'nerd-fonts',
    displayName: 'Nerd Fonts Theme',
    description: 'Professional developer icons (requires Nerd Fonts installed)',
    icons: NERD_FONTS_THEME
  },
  
  ascii: {
    name: 'ascii',
    displayName: 'ASCII Theme',
    description: 'Pure ASCII text for maximum compatibility',
    icons: ASCII_THEME
  },
  
  corporate: {
    name: 'corporate',
    displayName: 'Corporate Theme',
    description: 'Professional symbols suitable for business environments',
    icons: CORPORATE_THEME
  }
};

/**
 * Get a theme by name with optional custom icon overrides
 */
export function getIconTheme(
  themeName: IconThemeName = 'emoji', 
  customIcons?: Partial<IconSet>
): IconSet {
  const baseTheme = ICON_THEMES[themeName];
  if (!baseTheme) {
    throw new Error(`Unknown icon theme: ${themeName}`);
  }
  
  // Merge custom icons with base theme
  return customIcons ? { ...baseTheme.icons, ...customIcons } : baseTheme.icons;
}

/**
 * Get all available themes
 */
export function getAvailableThemes(): IconTheme[] {
  return Object.values(ICON_THEMES);
}

/**
 * Get theme information without icons
 */
export function getThemeInfo(themeName: IconThemeName): Omit<IconTheme, 'icons'> {
  const theme = ICON_THEMES[themeName];
  if (!theme) {
    throw new Error(`Unknown icon theme: ${themeName}`);
  }
  
  return {
    name: theme.name,
    displayName: theme.displayName,
    description: theme.description
  };
}

/**
 * Validate custom icons object
 */
export function validateCustomIcons(customIcons: unknown): boolean {
  if (typeof customIcons !== 'object' || customIcons === null) {
    return false;
  }
  
  // All values must be strings
  return Object.values(customIcons).every(value => typeof value === 'string');
}