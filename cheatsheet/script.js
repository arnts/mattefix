/* =====================================================
   1T CHEAT SHEET — Script
   - KaTeX auto-rendering ($...$, $$...$$)
   - Mørk/lys-modus med localStorage
   - Print-knapp
   - Søk som filtrerer kort/seksjoner
   - Quiz: vis fasit per spørsmål, eller alle på én gang
   - Fold ut/inn alle seksjoner
   ===================================================== */

(function() {
  const STORAGE_THEME = 'cheatsheet-theme';
  const STORAGE_OPEN = 'cheatsheet-open';

  // ============ TEMA (mørk/lys) ============
  function loadTheme() {
    const saved = localStorage.getItem(STORAGE_THEME);
    if (saved) {
      document.documentElement.setAttribute('data-theme', saved);
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  }
  loadTheme();

  document.addEventListener('DOMContentLoaded', () => {
    const themeBtn = document.getElementById('themeToggle');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        const cur = document.documentElement.getAttribute('data-theme') || 'light';
        const next = cur === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem(STORAGE_THEME, next);
      });
    }

    // ============ KaTeX rendering ============
    if (typeof renderMathInElement === 'function') {
      renderMathInElement(document.body, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$', right: '$', display: false }
        ],
        throwOnError: false,
        strict: false
      });
    } else {
      // Hvis auto-render ikke er klar (defer-rekkefølge), prøv igjen etter et øyeblikk
      window.addEventListener('load', () => {
        if (typeof renderMathInElement === 'function') {
          renderMathInElement(document.body, {
            delimiters: [
              { left: '$$', right: '$$', display: true },
              { left: '$', right: '$', display: false }
            ],
            throwOnError: false,
            strict: false
          });
        }
      });
    }

    // ============ Print ============
    const printBtn = document.getElementById('printBtn');
    if (printBtn) {
      printBtn.addEventListener('click', () => {
        // Sørg for at alle seksjoner er åpne ved utskrift
        document.querySelectorAll('details.section').forEach(d => d.setAttribute('open', ''));
        window.print();
      });
    }

    // ============ Fold ut/inn alle ============
    const expandBtn = document.getElementById('expandAll');
    if (expandBtn) {
      expandBtn.addEventListener('click', () => {
        const sections = document.querySelectorAll('details.section');
        const allOpen = Array.from(sections).every(s => s.hasAttribute('open'));
        sections.forEach(s => {
          if (allOpen) s.removeAttribute('open');
          else s.setAttribute('open', '');
        });
      });
    }

    // ============ Søk ============
    const searchInput = document.getElementById('searchInput');
    const clearBtn = document.getElementById('clearSearch');
    const searchBar = document.querySelector('.search-bar');

    function filterCards(query) {
      const q = query.trim().toLowerCase();
      const cards = document.querySelectorAll('.card, .quiz-item');
      const sections = document.querySelectorAll('details.section');

      if (!q) {
        cards.forEach(c => c.classList.remove('hidden-search'));
        sections.forEach(s => s.classList.remove('hidden-search'));
        return;
      }

      // Vis kort hvis tekst matcher
      cards.forEach(card => {
        const text = card.textContent.toLowerCase();
        if (text.includes(q)) card.classList.remove('hidden-search');
        else card.classList.add('hidden-search');
      });

      // Skjul seksjoner uten matcher, åpne de som har
      sections.forEach(section => {
        const visible = section.querySelectorAll('.card:not(.hidden-search), .quiz-item:not(.hidden-search)');
        if (visible.length === 0) {
          section.classList.add('hidden-search');
        } else {
          section.classList.remove('hidden-search');
          section.setAttribute('open', '');
        }
      });
    }

    if (searchInput) {
      searchInput.addEventListener('input', e => {
        const v = e.target.value;
        if (v) searchBar.classList.add('has-text');
        else searchBar.classList.remove('has-text');
        filterCards(v);
      });
    }
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        searchInput.value = '';
        searchBar.classList.remove('has-text');
        filterCards('');
        searchInput.focus();
      });
    }

    // ============ Quiz: vis/skjul fasit ============
    document.querySelectorAll('.btn-show').forEach(btn => {
      btn.addEventListener('click', () => {
        const item = btn.closest('.quiz-item');
        if (!item) return;
        const ans = item.querySelector('.quiz-a');
        if (!ans) return;
        const isHidden = ans.classList.contains('hidden');
        ans.classList.toggle('hidden');
        btn.textContent = isHidden ? 'Skjul fasit' : 'Vis fasit';
      });
    });

    const showAll = document.getElementById('showAllAnswers');
    const hideAll = document.getElementById('hideAllAnswers');
    if (showAll) {
      showAll.addEventListener('click', () => {
        document.querySelectorAll('.quiz-a').forEach(a => a.classList.remove('hidden'));
        document.querySelectorAll('.btn-show').forEach(b => b.textContent = 'Skjul fasit');
      });
    }
    if (hideAll) {
      hideAll.addEventListener('click', () => {
        document.querySelectorAll('.quiz-a').forEach(a => a.classList.add('hidden'));
        document.querySelectorAll('.btn-show').forEach(b => b.textContent = 'Vis fasit');
      });
    }

    // ============ Tastatursnarveier ============
    document.addEventListener('keydown', e => {
      // "/" fokuserer søk
      if (e.key === '/' && document.activeElement !== searchInput) {
        e.preventDefault();
        if (searchInput) searchInput.focus();
      }
      // Esc tømmer søk hvis fokus er der
      if (e.key === 'Escape' && document.activeElement === searchInput) {
        searchInput.value = '';
        searchBar.classList.remove('has-text');
        filterCards('');
        searchInput.blur();
      }
    });
  });
})();
