/* Menghnani Family Japan Trip — interactions. Everything is saved only on this device. */
(function () {
  "use strict";
  var NS = "mfjt-";
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem(NS + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(NS + k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  };
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var TRIP = window.TRIP || [];
  var ALL = {};
  TRIP.forEach(function (d) { d.stops.concat(d.backup || []).forEach(function (s) { s.day = d; ALL[s.id] = s; }); });
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function ic(n) { return '<svg class="ic" aria-hidden="true" focusable="false"><use href="#i-' + n + '"></use></svg>'; }

  var search = document.getElementById("guide-search");
  if (search) search.addEventListener("input", function() {
    var q=search.value.trim().toLowerCase(), results=document.getElementById("guide-results"), hits=[];
    if (!q) { results.innerHTML=""; return; }
    TRIP.forEach(function(d){ d.stops.concat(d.backup || []).forEach(function(s){
      if ((d.title+" "+s.title+" "+s.t+" "+(s.search || "")).toLowerCase().indexOf(q)>=0) hits.push({d:d,s:s});
    }); });
    results.innerHTML=hits.length ? hits.slice(0,30).map(function(h){return '<li><a href="'+h.d.slug+'.html#s-'+h.s.id+'">'+h.d.n+' Nov · '+esc(h.s.title)+' — '+esc(h.s.t)+(h.s.backup?' · backup':'')+'</a></li>';}).join("") : '<li>No matches. Try a place, meal or station.</li>';
  });

  /* ── theme ── */
  function applyTheme(pref) {
    var d = document.documentElement;
    d.setAttribute("data-theme-pref", pref);
    if (pref === "light" || pref === "dark") d.setAttribute("data-theme", pref); else d.removeAttribute("data-theme");
    $$("[data-theme-set]").forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-theme-set") === pref)); });
  }
  var themePref = "system";
  try { themePref = localStorage.getItem("mfjt-theme") || "system"; } catch (e) {}
  applyTheme(themePref);
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-theme-set]");
    if (!b) return;
    var p = b.getAttribute("data-theme-set");
    try { if (p === "system") localStorage.removeItem("mfjt-theme"); else localStorage.setItem("mfjt-theme", p); } catch (err) {}
    applyTheme(p);
  });

  /* ── state ── */
  var stamps = store.get("stamps", {});
  var keeps = store.get("keeps", {});
  var tasks = store.get("tasks", {});

  /* ── toast with undo ── */
  var toast = $(".toast"), toastTimer = null, undoFn = null;
  function say(msg, undo) {
    if (!toast) return;
    var openDlg = $("dialog[open]");
    var host = openDlg ? (openDlg.querySelector(".sheet-in, .lb-in") || openDlg) : document.body;
    if (toast.parentNode !== host) host.appendChild(toast);
    $(".toast-msg", toast).textContent = msg;
    undoFn = undo || null;
    $(".toast-undo", toast).hidden = !undo;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.hidden = true; undoFn = null; }, 6000);
  }
  if (toast) $(".toast-undo", toast).addEventListener("click", function () {
    if (undoFn) undoFn();
    toast.hidden = true; undoFn = null;
  });

  /* ── stamps & keeps ── */
  function count(o) { return Object.keys(o).length; }
  function badges() {
    $$("[data-count]").forEach(function (b) {
      var n = b.getAttribute("data-count") === "stamps" ? count(stamps) : count(keeps);
      if (b.textContent !== String(n)) { b.textContent = n; if (!reduce) { b.classList.remove("bump"); void b.offsetWidth; b.classList.add("bump"); } }
      if (n === 0) b.setAttribute("data-zero", ""); else b.removeAttribute("data-zero");
    });
  }
  function paint(fresh) {
    $$("[data-stamp]").forEach(function (b) { b.setAttribute("aria-pressed", String(!!stamps[b.getAttribute("data-stamp")])); });
    $$("[data-keep]").forEach(function (b) { b.setAttribute("aria-pressed", String(!!keeps[b.getAttribute("data-keep")])); });
    $$("[data-stop-entry]").forEach(function (el) {
      var id = el.getAttribute("data-stop-entry");
      el.classList.toggle("is-stamped", !!stamps[id]);
      if (fresh === id && stamps[id] && !reduce) { el.classList.remove("just-stamped"); void el.offsetWidth; el.classList.add("just-stamped"); }
    });
    $$("[data-stop]").forEach(function (el) { el.classList.toggle("is-stamped", !!stamps[el.getAttribute("data-stop")]); });
    $$(".arc-pt").forEach(function (g) { g.classList.toggle("stamped", !!stamps[g.getAttribute("data-for")]); });
    badges(); progress(); upnext(); refreshPanel();
  }
  function setStamp(id, on, quiet) {
    var prev = !!stamps[id];
    if (on) stamps[id] = Date.now(); else delete stamps[id];
    store.set("stamps", stamps);
    paint(on ? id : null);
    if (!quiet) {
      var t = ALL[id] ? ALL[id].title : "Stop";
      say(on ? "Stamped: " + t : "Stamp removed: " + t, function () { setStamp(id, prev, true); });
    }
  }
  function setKeep(id, on, quiet) {
    var prev = !!keeps[id];
    if (on) keeps[id] = Date.now(); else delete keeps[id];
    store.set("keeps", keeps);
    paint();
    if (!quiet) {
      var t = ALL[id] ? ALL[id].title : "Place";
      say(on ? "Kept: " + t : "Removed from kept: " + t, function () { setKeep(id, prev, true); });
    }
  }
  document.addEventListener("click", function (e) {
    var s = e.target.closest("[data-stamp]");
    if (s) { var id = s.getAttribute("data-stamp"); setStamp(id, !stamps[id]); return; }
    var k = e.target.closest("[data-keep]");
    if (k) { var kid = k.getAttribute("data-keep"); setKeep(kid, !keeps[kid]); }
  });

  /* ── progress & up next ── */
  function dayStops(slug) { var d = TRIP.filter(function (x) { return x.slug === slug; })[0]; return d ? d.stops : []; }
  /* One list for the group and route currently chosen on this page: Up next, the progress bar and the folding all read it. */
  function routeIsBackup() { var b = $("#tab-backup"); return !!(b && b.getAttribute("aria-selected") === "true"); }
  function partyOn() { return !!(DAY && DAY.parties && DAY.parties[selectedParty]); }
  function routeStops(slug) {
    var d = TRIP.filter(function (x) { return x.slug === slug; })[0];
    if (!d) return [];
    var st = d.stops;
    if (!DAY || DAY.slug !== slug) return st;
    if (partyOn()) st = st.filter(function (s) { return !s.party || s.party === "all" || s.party === selectedParty; });
    if (routeIsBackup() && d.backup && d.backup.length) {
      st = DAY.choiceCommon && DAY.choiceCommon.length ? st.filter(function (s) { return DAY.choiceCommon.indexOf(s.id) >= 0; }).concat(d.backup) : d.backup.slice();
    }
    return st;
  }
  function routeLabel() {
    var parts = [];
    if (partyOn()) parts.push(DAY.parties[selectedParty]);
    if (DAY && DAY.routes) { var rl = routeIsBackup() ? DAY.routes.backup : DAY.routes.main; if (rl) parts.push(rl); }
    return parts.join(" · ");
  }
  function progress() {
    $$("[data-progress]").forEach(function (el) {
      var st = routeStops(el.getAttribute("data-progress")), n = st.filter(function (s) { return stamps[s.id]; }).length;
      var p = st.length ? Math.round(n / st.length * 100) : 0;
      var lab = DAY && DAY.slug === el.getAttribute("data-progress") ? routeLabel() : "";
      el.innerHTML = '<div class="prog"><span>' + n + " of " + st.length + ' stamped' + (lab ? '<small class="prog-route">' + esc(lab) + '</small>' : '') + '</span><span class="prog-bar"><span style="--p:' + p + '%"></span></span></div>';
    });
    $$("[data-progress-mini]").forEach(function (el) {
      var st = dayStops(el.getAttribute("data-progress-mini")), n = st.filter(function (s) { return stamps[s.id]; }).length;
      el.textContent = n ? n + " of " + st.length + " stops stamped" : "";
    });
  }
  var DAY = null;
  try { var dd = $("#day-data"); if (dd) DAY = JSON.parse(dd.textContent); } catch (e) {}
  var selectedParty = store.get("party", "all");
  if (DAY && DAY.parties && selectedParty !== "all" && !DAY.parties[selectedParty]) selectedParty = "all"; // a group from another day
  function partyButtons() { $$("[data-party]").forEach(function(b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-party") === selectedParty)); }); }
  function foldParty() {
    var on = partyOn();
    $$("[data-party-of]").forEach(function (el) {
      var other = on && el.getAttribute("data-party-of") !== selectedParty;
      el.classList.toggle("is-other", other);
      if (!other) el.classList.remove("peek");
      if (el.classList.contains("stop") && !el.querySelector(".peek-btn")) {
        var t = el.querySelector(".stop-title");
        if (t) t.insertAdjacentHTML("afterend", '<button type="button" class="peek-btn" aria-expanded="false">Other group · show details</button>');
      }
    });
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest(".peek-btn"); if (!b) return;
    var st = b.closest(".stop"), open = !st.classList.contains("peek");
    st.classList.toggle("peek", open); b.setAttribute("aria-expanded", String(open));
    b.textContent = open ? "Other group · hide details" : "Other group · show details";
  });
  partyButtons(); foldParty();
  document.addEventListener("click", function(e) { var b=e.target.closest("[data-party]"); if (!b) return; selectedParty=b.getAttribute("data-party"); store.set("party",selectedParty); partyButtons(); foldParty(); upnext(); progress(); context(); });
  function upnext() {
    var box = $("[data-upnext]");
    if (!box || !DAY) return;
    var firstOpen = dayStops(DAY.slug).filter(function (s) { return !stamps[s.id]; })[0];
    if (DAY.parties && Object.keys(DAY.parties).length && !partyOn() && firstOpen && firstOpen.party && firstOpen.party !== "all") {
      var names = Object.keys(DAY.parties).map(function (k) { return esc(DAY.parties[k]); });
      box.innerHTML = '<h2>Which group is this phone with?</h2><p>Choose ' + names.join(" or ") + ' above for your next step. Shared stops stay in both lists.</p>'; return;
    }
    var st = routeStops(DAY.slug), lab = routeLabel();
    var done = st.filter(function (s) { return stamps[s.id]; }).length;
    var next = null;
    for (var i = 0; i < st.length; i++) { if (!stamps[st[i].id]) { next = st[i]; break; } }
    var h = '<h2 class="sr-only">Up next</h2>';
    if (!next) {
      h += '<div class="un-card"><span class="un-ic">' + ic("stamp") + '</span><p class="un-k">Day complete</p><p class="un-t">Every stop is stamped — well travelled!</p>' +
        '<div class="un-acts"><button type="button" class="chip-btn" data-open="stampbook">' + ic("stamp") + 'See the stamp book</button><span class="note-s">Based on your stamps, not your location.</span></div></div>';
    } else {
      h += '<div class="un-card"><span class="un-ic">' + ic(next.kind) + '</span><p class="un-k">' + (done ? "Up next · " + done + " of " + st.length + " stamped" : "First up today") + (lab ? '<span class="un-route">' + esc(lab) + '</span>' : '') + '</p>' +
        '<p class="un-t"><span class="gn-time">' + esc(next.t) + "</span>" + esc(next.title) + "</p>" +
        '<div class="un-acts"><a class="chip-btn" href="#s-' + next.id + '" data-goto="' + next.id + '">' + ic("right") + 'Go to it</a>' +
        '<button type="button" class="chip-btn solid" data-stamp="' + next.id + '" aria-pressed="false">' + ic("stamp") + 'Stamp & move on</button>' +
        '<span class="note-s">Based on your stamps, not your location.</span></div></div>';
    }
    box.innerHTML = h;
  }
  document.addEventListener("click", function (e) {
    var g = e.target.closest("[data-goto]");
    if (!g) return;
    var id = g.getAttribute("data-goto"), el = document.getElementById("s-" + id);
    if (!el) return;
    e.preventDefault();
    revealEntry(el);
  });
  function revealEntry(el) {
    var panel = el.closest("[role=tabpanel]");
    if (panel && panel.hidden) { var t = document.getElementById(panel.getAttribute("aria-labelledby")); if (t) selectTab(t); }
    if (el.classList.contains("is-other")) { el.classList.add("peek"); var pb = el.querySelector(".peek-btn"); if (pb) { pb.setAttribute("aria-expanded", "true"); pb.textContent = "Other group · hide details"; } }
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash");
    var h = el.querySelector(".stop-title"); if (h) { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); }
    history.replaceState(null, "", "#s-" + el.getAttribute("data-stop-entry"));
  }

  /* ── infographic panel ── */
  var panel = $(".g-panel"), openBtn = null, openId = null;
  function imgHTML(id) {
    var fig = document.querySelector('[data-zoom="' + id + '"] img');
    if (!fig) return "";
    return '<button type="button" class="zoom" data-zoom="' + id + '" aria-label="View larger picture"><img src="' + fig.getAttribute("src") + '" alt="' + esc(fig.getAttribute("alt")) + '" loading="lazy"></button>';
  }
  function renderPanel(id) {
    var s = DAY && DAY.stops[id];
    if (!s || !panel) return;
    var tips = s.tips.length ? "<ul class=\"tips\">" + s.tips.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + "</ul>" : "";
    var img = s.img.length ? imgHTML(s.img[0]) : "";
    var kindName = (ALL[id] && ALL[id].kind) || "time";
    panel.className = "g-panel k-" + kindName;
    panel.innerHTML =
      '<button type="button" class="x gp-close" aria-label="Close details and return to the whole day">' + ic("close") + "</button>" +
      '<div class="gp-top"><span class="gn-ic">' + ic(kindName) + '</span><div><p class="gp-kind">' + esc(s.kind) + (s.backup ? " · backup branch" : "") + "</p>" +
      '<h3 class="gp-title" tabindex="-1">' + esc(s.title) + '</h3><p class="gp-time">' + esc(s.t) + (s.status ? ' · <span class="tag">' + esc(s.status) + "</span>" : "") + "</p></div></div>" +
      '<div class="gp-body' + (img ? " has-img" : "") + '"><div>' + (s.story ? "<p>" + esc(s.story) + "</p>" : "") + tips + (s.places_html || "") + "</div>" + img + "</div>" +
      '<div class="gp-acts"><button type="button" class="act stamp" data-stamp="' + id + '" aria-pressed="' + !!stamps[id] + '">' + ic("stamp") + '<span class="act-on">Stamped</span><span class="act-off">Stamp</span></button>' +
      (s.keep ? '<button type="button" class="act keep" data-keep="' + id + '" aria-pressed="' + !!keeps[id] + '">' + ic("keep") + '<span class="act-on">Kept</span><span class="act-off">Keep</span></button>' : "") +
      '<a class="chip-btn" href="#s-' + id + '" data-goto="' + id + '">' + ic("list") + "Read in the full day</a>" +
      '<button type="button" class="chip-btn gp-back">' + ic("left") + "Back to the whole day</button></div>";
  }
  function openPanel(btn) {
    var id = btn.getAttribute("data-stop");
    if (openBtn) openBtn.setAttribute("aria-expanded", "false");
    if (openId === id && !panel.hidden) { closePanel(); return; }
    openBtn = btn; openId = id;
    btn.setAttribute("aria-expanded", "true");
    renderPanel(id);
    panel.hidden = false;
    $$(".arc-pt").forEach(function (g) { g.classList.toggle("on", g.getAttribute("data-for") === id); });
    var t = $(".gp-title", panel); if (t) t.focus({ preventScroll: true });
    panel.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "nearest" });
  }
  function closePanel() {
    if (!panel) return;
    panel.hidden = true; panel.innerHTML = "";
    $$(".arc-pt").forEach(function (g) { g.classList.remove("on"); });
    if (openBtn) { openBtn.setAttribute("aria-expanded", "false"); openBtn.focus({ preventScroll: false }); }
    openBtn = null; openId = null;
  }
  function refreshPanel() { if (panel && !panel.hidden && openId) { renderPanel(openId); } }
  $$(".graphic [data-stop]").forEach(function (b) { b.setAttribute("aria-expanded", "false"); });
  document.addEventListener("click", function (e) {
    var b = e.target.closest(".graphic [data-stop]");
    if (b) { openPanel(b); return; }
    if (e.target.closest(".gp-close, .gp-back")) { closePanel(); }
  });
  if (panel) panel.addEventListener("keydown", function (e) { if (e.key === "Escape") { e.stopPropagation(); closePanel(); } });

  /* ── tabs ── */
  function selectTab(tab) {
    var list = tab.closest("[role=tablist]");
    $$("[role=tab]", list).forEach(function (t) {
      var on = t === tab;
      t.setAttribute("aria-selected", String(on)); t.tabIndex = on ? 0 : -1;
      var p = document.getElementById(t.getAttribute("aria-controls")); if (p) p.hidden = !on;
    });
    if (DAY && tab.id) { var rs = store.get("route", {}); rs[DAY.slug] = tab.id === "tab-backup" ? "backup" : "main"; store.set("route", rs); }
    upnext(); progress(); context();
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-show-tab]"); if (!b) return;
    var t = document.getElementById(b.getAttribute("data-show-tab")); if (!t) return;
    selectTab(t);
    var list = t.closest(".tabs") || t;
    list.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    t.focus({ preventScroll: true });
  });
  $$("[role=tablist]").forEach(function (list) {
    list.addEventListener("click", function (e) { var t = e.target.closest("[role=tab]"); if (t) selectTab(t); });
    list.addEventListener("keydown", function (e) {
      var tabs = $$("[role=tab]", list), i = tabs.indexOf(document.activeElement);
      if (i < 0) return;
      var j = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : null;
      if (j === null) return;
      e.preventDefault(); j = (j + tabs.length) % tabs.length; tabs[j].focus(); selectTab(tabs[j]);
    });
  });

  /* ── task ticks ── */
  function paintTasks() {
    $$("[data-task]").forEach(function (cb) {
      var id = cb.getAttribute("data-task");
      cb.checked = id in tasks ? !!tasks[id] : cb.getAttribute("data-orig") === "1";
    });
  }
  document.addEventListener("change", function (e) {
    var cb = e.target.closest("[data-task]");
    if (!cb) return;
    var id = cb.getAttribute("data-task"), orig = cb.getAttribute("data-orig") === "1";
    if (cb.checked === orig) delete tasks[id]; else tasks[id] = cb.checked;
    store.set("tasks", tasks);
  });
  document.addEventListener("click", function (e) {
    if (!e.target.closest("[data-reset-tasks]")) return;
    var before = JSON.parse(JSON.stringify(tasks));
    $$("[data-task]").forEach(function (cb) { delete tasks[cb.getAttribute("data-task")]; });
    store.set("tasks", tasks); paintTasks();
    say("Ticks reset to the plan", function () { tasks = before; store.set("tasks", tasks); paintTasks(); });
  });

  /* ── dialogs: stamp book & kept ── */
  function renderStampbook() {
    var body = $("#stampbook .sb-body"); if (!body) return;
    var total = 0, got = 0, h = "";
    TRIP.forEach(function (d) {
      var items = d.stops.concat(d.backup || []);
      var dg = items.filter(function (s) { return stamps[s.id]; }).length; got += dg; total += d.stops.length;
      h += '<section class="sb-day"><h3><a href="' + d.slug + '.html">' + d.dow + " " + d.n + " Nov · " + esc(d.title) + "</a><small>" + dg + "/" + d.stops.length + "</small></h3><ul class=\"sb-stamps\">" +
        items.map(function (s) {
          var on = !!stamps[s.id];
          return '<li><a href="' + d.slug + ".html#s-" + s.id + '" class="' + (on ? "on" : "") + '" aria-label="' + esc(s.t + " — " + s.title + (on ? " (stamped)" : " (not yet)") + (s.backup ? " · backup" : "")) + '">' + ic(s.kind) + "</a></li>";
        }).join("") + "</ul></section>";
    });
    body.innerHTML = '<p class="sb-sum">' + got + " stamps collected of " + total + " main-plan stops</p>" + h;
  }
  function renderKept() {
    var body = $("#kept .kp-body"); if (!body) return;
    var h = "", any = false;
    TRIP.forEach(function (d) {
      var items = d.stops.concat(d.backup || []).filter(function (s) { return keeps[s.id]; });
      if (!items.length) return; any = true;
      h += '<section class="kp-day"><h3>' + d.dow + " " + d.n + " Nov · " + esc(d.title) + '</h3><ul class="kp-list">' + items.map(function (s) {
        return '<li><a href="' + d.slug + ".html#s-" + s.id + '"><span>' + esc(s.title) + "</span><small>" + esc(s.t) + (s.backup ? " · backup" : "") + "</small></a>" +
          '<button type="button" class="x" data-keep="' + s.id + '" aria-pressed="true" aria-label="Remove ' + esc(s.title) + ' from kept">' + ic("close") + "</button></li>";
      }).join("") + "</ul></section>";
    });
    body.innerHTML = any ? h : '<p class="kp-empty">Nothing kept yet. Look for the Keep button on places, meals and shops.</p>';
  }
  var lastOpener = null;
  function openDialog(id, opener) {
    var dlg = document.getElementById(id); if (!dlg || !dlg.showModal) return;
    lastOpener = opener || document.activeElement;
    if (id === "stampbook") renderStampbook();
    if (id === "kept") renderKept();
    dlg.showModal();
  }
  document.addEventListener("click", function (e) {
    var o = e.target.closest("[data-open]");
    if (o) { openDialog(o.getAttribute("data-open"), o); return; }
    var c = e.target.closest("[data-close]");
    if (c) { var d = c.closest("dialog"); if (d) d.close(); return; }
    if (e.target.tagName === "DIALOG") e.target.close();
    var cl = e.target.closest("[data-clear]");
    if (cl) {
      var before = JSON.parse(JSON.stringify(stamps));
      stamps = {}; store.set("stamps", stamps); paint(); renderStampbook();
      say("All stamps cleared", function () { stamps = before; store.set("stamps", stamps); paint(); renderStampbook(); });
    }
  });
  $$("dialog").forEach(function (d) {
    d.addEventListener("close", function () {
      if (toast && d.contains(toast)) document.body.appendChild(toast);
      if (lastOpener && lastOpener.focus) lastOpener.focus();
    });
  });
  // keep dialogs in sync while open
  var _paint = paint;
  paint = function (f) { _paint(f); if ($("#kept") && $("#kept").open) renderKept(); if ($("#stampbook") && $("#stampbook").open) renderStampbook(); };
  document.addEventListener("click", function (e) {
    var a = e.target.closest(".sheet a[href]");
    if (a) { var d = a.closest("dialog"); if (d) { lastOpener = null; d.close(); } }
  });

  /* ── lightbox ── */
  var lb = $("#lightbox"), lbList = [], lbI = 0;
  function lbShow(i) {
    lbI = (i + lbList.length) % lbList.length;
    var btn = lbList[lbI], img = $("img", btn), fig = btn.closest("figure");
    var big = img.getAttribute("src").replace("-800.webp", "-1600.webp");
    var li = $("img", lb); li.src = big; li.alt = img.alt;
    var cap = fig ? fig.querySelector("figcaption") : null;
    $("figcaption", lb).innerHTML = cap ? cap.innerHTML : "";
    $(".lb-count", lb).textContent = (lbI + 1) + " / " + lbList.length;
    var multi = lbList.length > 1;
    $(".lb-prev", lb).hidden = !multi; $(".lb-next", lb).hidden = !multi;
  }
  document.addEventListener("click", function (e) {
    var z = e.target.closest("[data-zoom]");
    if (!z || !lb || !lb.showModal) return;
    var id = z.getAttribute("data-zoom");
    lbList = $$("main .pic [data-zoom]");
    var i = lbList.indexOf(z);
    if (i < 0) { i = lbList.map(function (b) { return b.getAttribute("data-zoom"); }).indexOf(id); }
    if (i < 0) { lbList = [z]; i = 0; }
    lastOpener = z;
    lbShow(i); lb.showModal(); $(".lb-close", lb).focus();
  });
  if (lb) {
    $(".lb-prev", lb).addEventListener("click", function () { lbShow(lbI - 1); });
    $(".lb-next", lb).addEventListener("click", function () { lbShow(lbI + 1); });
    lb.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") { e.preventDefault(); lbShow(lbI - 1); }
      if (e.key === "ArrowRight") { e.preventDefault(); lbShow(lbI + 1); }
    });
    lb.addEventListener("click", function (e) { if (e.target.classList.contains("lb-in")) lb.close(); });
  }

  /* ── date rail: centre current day, mark today (Japan date, from the device clock) ── */
  var rail = $(".daterail ol");
  if (rail) {
    var cur = $('[aria-current="page"]', rail);
    if (cur) { var r = rail.getBoundingClientRect(), c = cur.getBoundingClientRect(); rail.scrollLeft += (c.left - r.left) - (r.width - c.width) / 2; }
  }
  try {
    var jst = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
    var todayLink = $('.daterail a[data-date="' + jst + '"]');
    if (todayLink) {
      todayLink.classList.add("is-today");
      var tl = $("[data-today-link]"); if (tl) { tl.href = todayLink.getAttribute("href"); tl.hidden = false; }
    }
  } catch (e) {}

  /* ── sticky offsets ── */
  var topbar = $(".top");
  function setHH() { if (topbar) document.documentElement.style.setProperty("--hh", topbar.offsetHeight + "px"); }
  setHH(); window.addEventListener("resize", setHH);
  // the header can change height after web fonts arrive; without this the rail floated ~50px below it on desktop
  if (topbar && window.ResizeObserver) new ResizeObserver(setHH).observe(topbar);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(setHH);

  /* ── remembered route (e.g. evening B or the Kobe backup) survives a reload or a trip to Maps ── */
  var deep = location.hash && location.hash.indexOf("#s-") === 0 ? document.getElementById(location.hash.slice(1)) : null;
  if (DAY && !deep && store.get("route", {})[DAY.slug] === "backup" && $("#tab-backup")) selectTab($("#tab-backup"));

  /* ── deep links into backup tab, on load and for in-page links (stamp book, kept places, search) ── */
  if (deep) setTimeout(function () { revealEntry(deep); }, 60);
  window.addEventListener("hashchange", function () {
    if (location.hash.indexOf("#s-") !== 0) return;
    var t = document.getElementById(location.hash.slice(1)); if (t) revealEntry(t);
  });

  /* ── where am I: a slim line under the date rail once the day heading has scrolled away ── */
  var ctx = null, ctxHeads = [], dayTitle = $(".day-title");
  if (DAY && rail && dayTitle) {
    var dr = $(".daterail");
    dr.insertAdjacentHTML("beforeend", '<div class="dr-context" hidden><p class="drc-text"></p><button type="button" class="drc-up">' + ic("today") + 'Up next</button></div>');
    ctx = $(".dr-context", dr);
    ctxHeads = $$(".dayhead .day-title, .day-main .sec-h, .plan .ch-h, .decide .dc-h");
    $(".drc-up", ctx).addEventListener("click", function () {
      var u = $("[data-upnext]"); if (!u) return;
      var tgt = $(".party-pick") && !partyOn() ? $(".party-pick") : u;
      tgt.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
      var f = $("a, button", tgt); if (f) f.focus({ preventScroll: true });
    });
    var ticking = false;
    window.addEventListener("scroll", function () { if (!ticking) { ticking = true; requestAnimationFrame(function () { ticking = false; context(); }); } }, { passive: true });
    window.addEventListener("resize", context);
  }
  function context() {
    if (!ctx) return;
    var line = $(".daterail").getBoundingClientRect().bottom + 48;
    var show = dayTitle.getBoundingClientRect().bottom < 0;
    if (!show) { ctx.hidden = true; return; }
    var cur = null;
    ctxHeads.forEach(function (h) { if (h.offsetParent !== null && h.getBoundingClientRect().top < line) cur = h; });
    var day = DAY && $('.daterail [aria-current="page"]');
    var parts = [day ? $(".dr-dow", day).textContent + " " + $(".dr-n", day).textContent + " Nov" : ""];
    var head = cur && !cur.classList.contains("day-title") ? cur.textContent.trim() : "";
    var words = function (label) { return label.split(/[^A-Za-z]+/).filter(function (w) { return w.length >= 4; }); };
    var named = function (label) { return words(label).some(function (w) { return head.indexOf(w) >= 0; }); };
    var allNamed = function (label) { return words(label).every(function (w) { return head.indexOf(w) >= 0; }); };
    if (partyOn() && !named(DAY.parties[selectedParty])) parts.push(DAY.parties[selectedParty]);
    if (head) parts.push(head);
    var inPanel = cur && cur.closest("[role=tabpanel]");
    if (DAY.routes && (store.get("route", {})[DAY.slug] || routeIsBackup())) {
      var rl = routeIsBackup() ? DAY.routes.backup : DAY.routes.main;
      if (rl && !(inPanel && allNamed(rl))) { if (inPanel) parts.splice(parts.length - 1, 0, rl); else parts.push(rl); }
    }
    $(".drc-text", ctx).textContent = parts.filter(Boolean).join(" · ");
    var up = $("[data-upnext]");
    $(".drc-up", ctx).hidden = !(up && up.getBoundingClientRect().bottom < 0);
    ctx.hidden = false;
    if ($(".drc-text", ctx).clientWidth < 140) ctx.hidden = true; // very large text on a narrow phone: the rail alone is clearer
  }

  paintTasks();
  paint();
  context();
})();
