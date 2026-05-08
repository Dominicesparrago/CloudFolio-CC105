/**
 * CloudFolio Theme Manager
 * Manages light/dark theme via localStorage and html.dark class
 */

function initTheme() {
  const saved = localStorage.getItem('cf-theme');
  if (saved === 'dark') {
    document.documentElement.classList.add('dark');
  } else if (saved === 'light') {
    document.documentElement.classList.remove('dark');
  } else {
    // Default: use system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('cf-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('cf-theme', 'light');
    }
  }
}

function toggleTheme() {
  const isDark = document.documentElement.classList.toggle('dark');
  localStorage.setItem('cf-theme', isDark ? 'dark' : 'light');
  return isDark;
}

function isDarkMode() {
  return document.documentElement.classList.contains('dark');
}

// Auto-init on script load
initTheme();
