/**
 * Lillys Mattepilot progress-tracking
 *
 * Lagrer i localStorage hvilke quiz-spørsmål eleven har svart riktig/feil på,
 * og bruker dette til å:
 *  - prioritere spørsmål eleven strever med (smart utvelgelse i quiz)
 *  - vise mestringsgrad per kapittel
 *
 * Stable spørsmåls-ID = chapter + ":" + hash(spørsmålstekst). Det gjør at IDer
 * holder seg stabile selv om vi legger til nye spørsmål eller bytter rekkefølge.
 */
(function() {
  const STORAGE_KEY = 'mattepilot-progress-v1';

  // Kapitler som er registrert. Brukes av mestrings-siden for å iterere.
  // Hver side legger seg selv til ved å kalle MattepilotProgress.registerChapter().
  const registeredChapters = {};

  function load() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch (e) {
      return {};
    }
  }

  function save(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      // Quota full eller localStorage utilgjengelig
      console.warn('Mattepilot: kunne ikke lagre progresjon', e);
    }
  }

  function hashStr(text) {
    let h = 0;
    for (let i = 0; i < text.length; i++) {
      h = ((h << 5) - h + text.charCodeAt(i)) | 0;
    }
    // Konverter til positivt og base36 for kortere strenger
    return (h >>> 0).toString(36);
  }

  function questionId(chapter, text) {
    return chapter + ':' + hashStr(text);
  }

  /**
   * Lagre svar på et spørsmål.
   * Streak = antall riktige på rad. Tilbakestilles til 0 ved feil.
   * Et spørsmål regnes som "mestret" når streak ≥ 3.
   */
  function recordAnswer(chapter, questionText, correct) {
    const data = load();
    const id = questionId(chapter, questionText);
    const cur = data[id] || { streak: 0, seen: 0, correct: 0, wrong: 0 };
    cur.seen = (cur.seen || 0) + 1;
    if (correct) {
      cur.correct = (cur.correct || 0) + 1;
      cur.streak = (cur.streak || 0) + 1;
    } else {
      cur.wrong = (cur.wrong || 0) + 1;
      cur.streak = 0;
    }
    cur.lastSeen = new Date().toISOString();
    data[id] = cur;
    save(data);
  }

  function getQuestionStats(chapter, questionText) {
    const data = load();
    return data[questionId(chapter, questionText)] || null;
  }

  /**
   * Beregn prioritet for hvert spørsmål.
   * Spørsmål eleven sliter med får høyere prioritet.
   * Prioritet:
   *  - Aldri sett: 1.0
   *  - Streak 0 (sist svar feil): 1.0
   *  - Streak 1: 0.6
   *  - Streak 2: 0.35
   *  - Streak 3+ (mestret): 0.15
   */
  function priorityFor(stats) {
    if (!stats) return 1.0;
    const streak = stats.streak || 0;
    if (streak === 0) return 1.0;
    if (streak === 1) return 0.6;
    if (streak === 2) return 0.35;
    return 0.15;
  }

  /**
   * Velg N spørsmål med vektet tilfeldig utvelgelse uten gjentakelse.
   * Spørsmål eleven sliter med har høyere sannsynlighet for å bli plukket.
   *
   * @param {string} chapter - kapittel-nøkkel
   * @param {Array} allQuestions - alle tilgjengelige spørsmål (objekter med .q)
   * @param {number} n - hvor mange å velge
   * @param {Object} opts - { onlyStruggling: bool } — hvis true, bare ikke-mestrede spørsmål
   */
  function selectQuestions(chapter, allQuestions, n, opts) {
    opts = opts || {};
    const data = load();
    const items = allQuestions.map((q, i) => ({
      question: q,
      index: i,
      stats: data[questionId(chapter, q.q)] || null
    }));

    let pool;
    if (opts.onlyStruggling) {
      // Kun spørsmål som ikke er mestret (streak < 3)
      pool = items.filter(it => !it.stats || (it.stats.streak || 0) < 3);
      // Hvis tom, fall tilbake til alle
      if (pool.length === 0) pool = items.slice();
    } else {
      pool = items.slice();
    }

    // Vektet random uten replacement
    const picked = [];
    const remaining = pool.map(it => ({ ...it, w: priorityFor(it.stats) }));
    while (picked.length < n && remaining.length > 0) {
      const totalW = remaining.reduce((s, x) => s + x.w, 0);
      let r = Math.random() * totalW;
      let idx = 0;
      for (let i = 0; i < remaining.length; i++) {
        r -= remaining[i].w;
        if (r <= 0) { idx = i; break; }
      }
      picked.push(remaining[idx].question);
      remaining.splice(idx, 1);
    }
    return picked;
  }

  /**
   * Sammendrag for et kapittel: hvor mange spørsmål er mestret, sett, totalt.
   */
  function getChapterMastery(chapter, allQuestions) {
    const data = load();
    let mastered = 0, seen = 0;
    for (const q of allQuestions) {
      const stats = data[questionId(chapter, q.q)];
      if (stats) {
        seen++;
        if ((stats.streak || 0) >= 3) mastered++;
      }
    }
    return {
      total: allQuestions.length,
      seen,
      mastered,
      pct: allQuestions.length > 0 ? mastered / allQuestions.length : 0
    };
  }

  /**
   * Registrer et kapittel. Mestrings-siden bruker dette til å vite hvilke
   * kapitler som finnes og hvilke spørsmål de inneholder.
   */
  function registerChapter(key, info) {
    registeredChapters[key] = info;
    // Lagre også i localStorage så mestrings-siden kan finne dem på tvers av sider
    const data = load();
    data._chapters = data._chapters || {};
    data._chapters[key] = {
      title: info.title,
      url: info.url,
      questions: info.questions.map(q => ({ q: q.q })) // kun tekstene trengs for mestring
    };
    save(data);
  }

  function getRegisteredChapters() {
    const data = load();
    return data._chapters || {};
  }

  /**
   * Tilbakestill all progresjon.
   */
  function resetProgress() {
    const data = load();
    const chapters = data._chapters || {};
    save({ _chapters: chapters }); // behold kapittel-registreringen
  }

  /**
   * Tilbakestill bare ett kapittel.
   */
  function resetChapter(chapter) {
    const data = load();
    const prefix = chapter + ':';
    Object.keys(data).forEach(key => {
      if (key.startsWith(prefix)) delete data[key];
    });
    save(data);
  }

  // Eksponer offentlig API
  window.MattepilotProgress = {
    recordAnswer,
    getQuestionStats,
    selectQuestions,
    getChapterMastery,
    registerChapter,
    getRegisteredChapters,
    resetProgress,
    resetChapter,
    questionId
  };
})();
