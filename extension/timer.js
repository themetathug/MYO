// UK Jobs Insider — Application Time Tracker v3
// Tracks time ONLY when actively applying (not browsing/importing).
console.log('[UKJT] timer.js loaded on: ' + location.hostname);
(function() {
  'use strict';
  if (window.__ukjtTimer) return;

  var host = location.hostname.toLowerCase();
  var path = location.pathname.toLowerCase();
  var full = location.href.toLowerCase();

  // Never track on internal/system pages
  if (host === 'localhost' || host === '127.0.0.1') return;
  if (host.indexOf('chrome-extension') !== -1) return;
  var skip = {'google.com':1,'youtube.com':1,'facebook.com':1,'twitter.com':1,
    'instagram.com':1,'reddit.com':1,'wikipedia.org':1,'stackoverflow.com':1,'github.com':1,
    'x.com':1,'tiktok.com':1,'pinterest.com':1,'twitch.tv':1,'netflix.com':1,'spotify.com':1,
    'amazon.com':1,'ebay.com':1,'paypal.com':1};
  if (skip[host] || skip[host.replace('www.','')]) return;

  // ── Determine page type ──
  // TYPE A: "APPLY PAGE" → start timer immediately (user is filling an application)
  // TYPE B: "JOB BOARD / LISTING" → DON'T start timer, but watch for apply clicks

  var isApplyPage = false;
  var isJobSite = false;
  var reason = '';

  // --- APPLY PAGE detection (timer starts immediately) ---
  // ATS platforms where the whole site IS the application
  var ats = ['myworkdayjobs.com','greenhouse.io','lever.co','ashbyhq.com',
    'jobvite.com','workable.com','smartrecruiters.com','icims.com','taleo.net',
    'brassring.com','bamboohr.com','recruitee.com','teamtailor.com','jazzhr.com',
    'applytojob.com','pinpointhq.com','personio.com','comeet.co','hirevue.com',
    'successfactors.com','eightfold.ai','phenom.com','avature.net'];
  for (var i = 0; i < ats.length; i++) {
    if (host.indexOf(ats[i]) !== -1) { isApplyPage = true; reason = 'ATS: ' + ats[i]; break; }
  }

  // URL path explicitly says /apply
  if (!isApplyPage && /\/(apply|application|apply-now|job-application|submit-application)(\/|$|\?|#)/i.test(path)) {
    isApplyPage = true; reason = 'Path: /apply';
  }

  // URL has both job and apply signals
  if (!isApplyPage && full.indexOf('/job/') !== -1 && full.indexOf('/apply') !== -1) {
    isApplyPage = true; reason = 'URL: job+apply';
  }

  // --- JOB SITE detection (timer starts on apply CLICK only) ---
  if (!isApplyPage) {
    // Job boards
    var boards = ['linkedin.com','indeed.com','indeed.co.uk','reed.co.uk','totaljobs.com',
      'glassdoor.com','glassdoor.co.uk','monster.com','monster.co.uk','cv-library.co.uk',
      'ziprecruiter.com','dice.com','cwjobs.co.uk','adzuna.co.uk','amazon.jobs',
      'simplyhired.com','careerbuilder.com','flexjobs.com','wellfound.com','builtin.com'];
    for (var j = 0; j < boards.length; j++) {
      if (host.indexOf(boards[j]) !== -1) { isJobSite = true; reason = 'Board: ' + boards[j]; break; }
    }
    // Career subdomains
    if (!isJobSite && /\b(careers?|jobs?|apply|hiring|talent|recruit)\b/.test(host.split('.').slice(0, -2).join('.'))) {
      isJobSite = true; reason = 'Subdomain: ' + host;
    }
    // Career paths
    if (!isJobSite && /^\/(careers?|jobs?|positions?|openings?|vacancies?|hiring|join-us|work-with-us)(\/|$)/i.test(path)) {
      isJobSite = true; reason = 'Path: career page';
    }
    // Job detail pages
    if (!isJobSite && (full.indexOf('/job/') !== -1 || full.indexOf('/role/') !== -1 || full.indexOf('/position/') !== -1)) {
      isJobSite = true; reason = 'URL: job detail';
    }
  }

  if (!isApplyPage && !isJobSite) {
    console.log('[UKJT] Not a job page: ' + host + path.substring(0, 40));
    return;
  }

  window.__ukjtTimer = true;

  // ── STATE ──
  var startTime = null;
  var seconds = 0;
  var paused = false;
  var running = false;
  var timerInterval = null;

  // ── UI: floating indicator (hidden until tracking starts) ──
  var el = document.createElement('div');
  el.id = 'ukjt-timer';
  el.setAttribute('style',
    'position:fixed;bottom:20px;right:20px;z-index:2147483647;' +
    'padding:10px 16px;border-radius:12px;' +
    'background:linear-gradient(135deg,#667eea,#764ba2);' +
    'color:#fff;font:600 14px/1 system-ui,-apple-system,sans-serif;' +
    'box-shadow:0 4px 20px rgba(102,126,234,.5);' +
    'display:none;align-items:center;gap:8px;cursor:default;user-select:none;'
  );
  var dot = document.createElement('span');
  dot.setAttribute('style','width:8px;height:8px;background:#10b981;border-radius:50%;');
  var label = document.createElement('span');
  label.textContent = 'Tracking: 0:00';
  el.appendChild(dot);
  el.appendChild(label);

  function mount() {
    if (document.body && !document.getElementById('ukjt-timer')) {
      document.body.appendChild(el);
    }
  }
  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount);
  setTimeout(mount, 1000);
  setTimeout(mount, 3000);

  // ── START TRACKING ──
  function startTracking(triggerReason) {
    if (running) return;
    running = true;
    startTime = Date.now();
    seconds = 0;
    paused = false;
    el.style.display = 'flex';
    console.log('[UKJT] ⏱️ Timer STARTED (' + triggerReason + ')');

    timerInterval = setInterval(function() {
      if (!paused) {
        seconds++;
        var m = Math.floor(seconds / 60);
        var s = seconds % 60;
        label.textContent = 'Tracking: ' + m + ':' + (s < 10 ? '0' : '') + s;
        dot.style.opacity = (seconds % 2 === 0) ? '1' : '0.4';
      }
    }, 1000);
  }

  // ── PAUSE on hidden / idle ──
  document.addEventListener('visibilitychange', function() {
    if (running) paused = document.hidden;
  });
  var idleTimeout = null;
  function resetIdle() {
    if (running) paused = false;
    clearTimeout(idleTimeout);
    idleTimeout = setTimeout(function() { if (running) paused = true; }, 120000);
  }
  ['mousedown','keydown','scroll','click','touchstart'].forEach(function(e) {
    document.addEventListener(e, resetIdle, { passive: true });
  });

  // ── SAVE ──
  function save() {
    if (!running || seconds < 3) return;
    var data = {
      url: location.href,
      startTime: startTime,
      endTime: Date.now(),
      totalTimeSeconds: Math.round((Date.now() - startTime) / 1000),
      activeTime: seconds,
      trigger: 'tab_closed',
      sessionId: 'timer_' + startTime + '_' + Math.random().toString(36).substr(2, 6),
      jobData: {
        company: (function() {
          var c = document.querySelector('[data-company],[itemprop="hiringOrganization"] [itemprop="name"],.company-name,.employer-name');
          if (c) return c.textContent.trim();
          return host.replace(/^(www\.|jobs\.|careers\.|apply\.)/i,'').split('.')[0].replace(/^./,function(x){return x.toUpperCase();});
        })(),
        position: (function() {
          var p = document.querySelector('h1,.job-title,[data-testid="job-title"]');
          return p ? p.textContent.trim().substring(0, 150) : null;
        })(),
        location: null, salary: null,
        jobBoardSource: reason.split(':')[0].trim(),
      },
    };
    console.log('[UKJT] 💾 Saving: ' + seconds + 's on ' + host);
    try {
      chrome.storage.local.get(['pendingApplications'], function(res) {
        var q = (res && res.pendingApplications) || [];
        q.push(data);
        if (q.length > 50) q.splice(0, q.length - 50);
        chrome.storage.local.set({ pendingApplications: q });
      });
      chrome.storage.local.get(['token', 'apiUrl'], function(res) {
        if (!res || !res.token) return;
        var apiUrl = res.apiUrl || 'http://localhost:3001';
        fetch(apiUrl + '/api/applications/track-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + res.token },
          body: JSON.stringify(data),
        }).then(function(r) {
          console.log('[UKJT] Save ' + (r.ok ? 'OK' : 'FAIL:' + r.status));
        }).catch(function() {});
      });
    } catch (e) {}
  }

  window.addEventListener('beforeunload', save);
  setInterval(function() { if (seconds > 10) save(); }, 60000);

  // ══════════════════════════════════════════════════════════════
  // TYPE A: Apply page → start timer immediately
  // ══════════════════════════════════════════════════════════════
  if (isApplyPage) {
    console.log('[UKJT] Apply page detected (' + reason + ') — auto-starting timer');
    if (document.body) startTracking(reason);
    else document.addEventListener('DOMContentLoaded', function() { startTracking(reason); });
    return;
  }

  // ══════════════════════════════════════════════════════════════
  // TYPE B: Job site → start timer only when user clicks Apply
  // ══════════════════════════════════════════════════════════════
  console.log('[UKJT] Job site detected (' + reason + ') — waiting for apply click');

  function watchForApplyClicks() {
    document.addEventListener('click', function(e) {
      if (running) return;
      var target = e.target;
      if (!target) return;

      // Walk up to find the actual button/link
      var btn = target.closest ? target.closest('button, a, [role="button"], input[type="submit"]') : target;
      if (!btn) btn = target;

      var text = (btn.textContent || btn.value || '').toLowerCase().trim();
      var ariaLabel = (btn.getAttribute && btn.getAttribute('aria-label') || '').toLowerCase();
      var href = (btn.href || '').toLowerCase();

      // Check if this is an apply action
      var isApplyClick =
        text === 'apply' ||
        text === 'apply now' ||
        text === 'easy apply' ||
        text === 'apply on company site' ||
        text === 'submit application' ||
        text === 'submit' ||
        text.indexOf('apply for') !== -1 ||
        text.indexOf('apply to') !== -1 ||
        text.indexOf('easy apply') !== -1 ||
        text.indexOf('apply now') !== -1 ||
        text.indexOf('quick apply') !== -1 ||
        ariaLabel.indexOf('apply') !== -1 ||
        ariaLabel.indexOf('easy apply') !== -1 ||
        (href && href.indexOf('/apply') !== -1);

      if (isApplyClick) {
        console.log('[UKJT] 🖱️ Apply button clicked: "' + text.substring(0, 40) + '"');
        startTracking('Apply click: ' + text.substring(0, 30));
      }
    }, true);

    // Also watch for LinkedIn Easy Apply modal opening
    if (host.indexOf('linkedin.com') !== -1) {
      var observer = new MutationObserver(function(mutations) {
        if (running) return;
        for (var i = 0; i < mutations.length; i++) {
          for (var j = 0; j < mutations[i].addedNodes.length; j++) {
            var node = mutations[i].addedNodes[j];
            if (node.nodeType !== 1) continue;
            var modal = node.querySelector ? node.querySelector('.jobs-easy-apply-modal, [data-test-modal-id="easy-apply-modal"]') : null;
            if (!modal) modal = (node.classList && node.classList.contains('jobs-easy-apply-modal')) ? node : null;
            if (modal) {
              console.log('[UKJT] 📝 LinkedIn Easy Apply modal opened');
              startTracking('LinkedIn Easy Apply modal');
              return;
            }
            // Also detect "Application sent" confirmation
            var txt = (node.textContent || '').toLowerCase();
            if (running && (txt.indexOf('application sent') !== -1 || txt.indexOf('application submitted') !== -1)) {
              console.log('[UKJT] ✅ Application submitted!');
              save();
            }
          }
        }
      });
      if (document.body) {
        observer.observe(document.body, { childList: true, subtree: true });
      } else {
        document.addEventListener('DOMContentLoaded', function() {
          observer.observe(document.body, { childList: true, subtree: true });
        });
      }
    }

    // Watch for URL changes to /apply (SPA navigation)
    var lastUrl = location.href;
    setInterval(function() {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        if (/\/(apply|application)(\/|$|\?|#)/i.test(location.pathname.toLowerCase())) {
          console.log('[UKJT] 🔄 Navigated to apply page');
          startTracking('SPA navigation to /apply');
        }
      }
    }, 1000);
  }

  if (document.body) watchForApplyClicks();
  else document.addEventListener('DOMContentLoaded', watchForApplyClicks);
})();
