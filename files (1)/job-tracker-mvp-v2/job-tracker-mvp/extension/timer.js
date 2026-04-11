// UK Jobs Insider — Standalone Application Time Tracker v2
// Intentionally small, zero dependencies, runs on document_start.
console.log('[UKJT] timer.js loaded on: ' + location.hostname);
(function() {
  'use strict';
  if (window.__ukjtTimer) { console.log('[UKJT] Already running, skip'); return; }

  var host = location.hostname.toLowerCase();
  var path = location.pathname.toLowerCase();
  var full = location.href.toLowerCase();

  // Never track on internal/system pages
  if (host === 'localhost' || host === '127.0.0.1') return;
  if (host.indexOf('chrome-extension') !== -1 || host.indexOf('moz-extension') !== -1) return;

  // Skip known non-career sites (exact match only)
  var skipExact = {'google.com':1,'youtube.com':1,'facebook.com':1,'twitter.com':1,
    'instagram.com':1,'reddit.com':1,'wikipedia.org':1,'stackoverflow.com':1,'github.com':1,
    'x.com':1,'tiktok.com':1,'pinterest.com':1,'twitch.tv':1,'netflix.com':1,'spotify.com':1,
    'amazon.com':1,'ebay.com':1,'paypal.com':1};
  // Only skip the MAIN domain, not subdomains like jobs.netflix.com
  if (skipExact[host] || skipExact[host.replace('www.','')]) return;

  // ── MATCHING ──
  var matched = false, reason = '';

  // 1. ATS platforms — hostname contains these
  var ats = ['myworkdayjobs.com','workday.com','greenhouse.io','lever.co','ashbyhq.com',
    'jobvite.com','workable.com','smartrecruiters.com','icims.com','taleo.net',
    'brassring.com','bamboohr.com','recruitee.com','teamtailor.com','jazzhr.com',
    'applytojob.com','pinpointhq.com','personio.com','dover.com','comeet.co',
    'hirevue.com','successfactors.com','eightfold.ai','phenom.com','avature.net'];
  for (var i = 0; i < ats.length; i++) {
    if (host.indexOf(ats[i]) !== -1) { matched = true; reason = 'ATS: ' + ats[i]; break; }
  }

  // 2. Job boards — hostname contains these
  if (!matched) {
    var boards = ['linkedin.com/jobs','linkedin.com/my-items','indeed.com','indeed.co.uk',
      'reed.co.uk','totaljobs.com','glassdoor.com','glassdoor.co.uk',
      'monster.com','monster.co.uk','cv-library.co.uk','ziprecruiter.com','dice.com',
      'cwjobs.co.uk','adzuna.co.uk','amazon.jobs','simplyhired.com','careerbuilder.com',
      'flexjobs.com','remoteok.com','angel.co','wellfound.com','weworkremotely.com',
      'builtin.com','themuse.com','hired.com'];
    for (var j = 0; j < boards.length; j++) {
      var b = boards[j];
      if (b.indexOf('/') !== -1) {
        if ((host + path).indexOf(b) !== -1) { matched = true; reason = 'Board: ' + b; break; }
      } else {
        if (host.indexOf(b) !== -1) { matched = true; reason = 'Board: ' + b; break; }
      }
    }
  }

  // 3. Career subdomains — jobs.company.com, careers.company.com, apply.company.com
  if (!matched) {
    if (/^(careers?|jobs?|apply|hiring|talent|recruit|work)\./.test(host)) {
      matched = true; reason = 'Subdomain: ' + host.split('.')[0];
    }
  }

  // 4. URL path signals — /apply, /careers/*, /jobs/* on ANY website
  if (!matched) {
    if (/\/(apply|application|apply-now|job-application|submit-application)(\/|$|\?|#)/i.test(path)) {
      matched = true; reason = 'Path: /apply';
    }
  }
  if (!matched) {
    if (/^\/(careers?|jobs?|positions?|openings?|vacancies?|hiring|join-us|work-with-us|join-our-team|opportunities)\/.+/i.test(path)) {
      matched = true; reason = 'Path: career subpath';
    }
  }

  // 5. Page URL contains job-related keywords in combination
  if (!matched) {
    if (full.indexOf('/job/') !== -1 && (full.indexOf('/apply') !== -1 || full.indexOf('application') !== -1)) {
      matched = true; reason = 'URL: job+apply combo';
    }
  }

  if (!matched) {
    console.log('[UKJT] No match for: ' + host + path.substring(0, 40));
    return;
  }

  window.__ukjtTimer = true;
  console.log('[UKJT] Timer started (' + reason + ') on ' + host);

  // ── STATE ──
  var startTime = Date.now();
  var seconds = 0;
  var paused = false;

  // ── UI: floating indicator ──
  var el = document.createElement('div');
  el.id = 'ukjt-timer';
  el.setAttribute('style',
    'position:fixed;bottom:20px;right:20px;z-index:2147483647;' +
    'padding:10px 16px;border-radius:12px;' +
    'background:linear-gradient(135deg,#667eea,#764ba2);' +
    'color:#fff;font:600 14px/1 system-ui,-apple-system,sans-serif;' +
    'box-shadow:0 4px 20px rgba(102,126,234,.5);' +
    'display:flex;align-items:center;gap:8px;cursor:default;user-select:none;'
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
  // Retry mount in case body wasn't ready
  setTimeout(mount, 1000);
  setTimeout(mount, 3000);

  // ── TICK ──
  setInterval(function() {
    if (!paused) {
      seconds++;
      var m = Math.floor(seconds / 60);
      var s = seconds % 60;
      label.textContent = 'Tracking: ' + m + ':' + (s < 10 ? '0' : '') + s;
      // Pulse the dot
      dot.style.opacity = (seconds % 2 === 0) ? '1' : '0.4';
    }
  }, 1000);

  // ── PAUSE on hidden / idle ──
  document.addEventListener('visibilitychange', function() { paused = document.hidden; });
  var idleTimeout = null;
  function resetIdle() {
    paused = false;
    clearTimeout(idleTimeout);
    idleTimeout = setTimeout(function() { paused = true; }, 120000);
  }
  var events = ['mousedown','keydown','scroll','click','touchstart'];
  for (var k = 0; k < events.length; k++) {
    document.addEventListener(events[k], resetIdle, { passive: true });
  }
  resetIdle();

  // ── SAVE ──
  function save() {
    if (seconds < 3) return;
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
          var el = document.querySelector('[data-company],[itemprop="hiringOrganization"] [itemprop="name"],.company-name,.employer-name');
          if (el) return el.textContent.trim();
          return host.replace(/^(www\.|jobs\.|careers\.|apply\.)/i,'').split('.')[0].replace(/^./,function(c){return c.toUpperCase();});
        })(),
        position: (function() {
          var el = document.querySelector('h1,.job-title,[data-testid="job-title"]');
          return el ? el.textContent.trim().substring(0, 150) : null;
        })(),
        location: null,
        salary: null,
        jobBoardSource: reason.split(':')[0].trim(),
      },
    };
    console.log('[UKJT] Saving: ' + seconds + 's on ' + host);
    try {
      // Queue for background sync
      chrome.storage.local.get(['pendingApplications'], function(res) {
        var q = (res && res.pendingApplications) || [];
        q.push(data);
        if (q.length > 50) q.splice(0, q.length - 50);
        chrome.storage.local.set({ pendingApplications: q });
      });
      // Direct save attempt
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
    } catch (e) { console.warn('[UKJT] Save error:', e); }
  }

  window.addEventListener('beforeunload', save);
  // Periodic save every 60s as backup
  setInterval(function() { if (seconds > 10) save(); }, 60000);
})();
