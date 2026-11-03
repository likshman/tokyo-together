/* Japan Tax Refund Guide · November 2026 — page behaviour.
   The estimator and purchase-record demo store nothing and send nothing.
   Checklist ticks use the site's existing device-only [data-task] storage in site.js. */
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var yen = function (n) { return "JPY " + Math.round(n).toLocaleString("en-US"); };

  /* ── Diagram: refund estimator ── */
  // Accepts "110000", "110,000", "¥110,000", "JPY 110000". Returns {value} or {error} or {empty}.
  var parseYen = function (raw) {
    var t = String(raw || "").replace(/[\s,，]/g, "").replace(/^(jpy|¥|￥|円)/i, "").replace(/(円|yen)$/i, "");
    if (!t) return { empty: true };
    if (/^-/.test(t)) return { error: "Enter a positive amount." };
    if (/^\d+\.\d*$/.test(t)) return { error: "Yen has no decimals. Enter whole yen, for example 110000." };
    if (!/^\d+$/.test(t)) return { error: "Use numbers only, for example 110000 or 110,000." };
    var v = Number(t);
    if (v > 1e10) return { error: "That is larger than this estimator handles." };
    return { value: v };
  };
  var est = $("[data-estimator]");
  if (est) {
    var price = $("#est-price", est), fee = $("#est-fee", est), sum = $(".tg-sum", est);
    var out = function (k, v) { $$('[data-out="' + k + '"]', est).forEach(function (e) { e.textContent = v; }); };
    var width = function (k, pct) { var e = $('[data-w="' + k + '"]', est); if (e) e.style.width = Math.max(0, Math.min(100, pct)).toFixed(2) + "%"; };
    var setErr = function (input, msg) {
      var box = document.getElementById(input.id + "-msg");
      if (box) box.textContent = msg || "";
      if (msg) input.setAttribute("aria-invalid", "true"); else input.removeAttribute("aria-invalid");
    };
    var timer = null;
    var calc = function () {
      var P = parseYen(price.value), F = parseYen(fee.value);
      var r = Number(($('input[name="rate"]:checked', est) || {}).value || 10);
      setErr(price, P.error || (P.empty ? "Enter the price you paid, tax included." : ""));
      setErr(fee, F.error || "");
      var minEl = $('[data-out="min"]', est);
      if (P.error || P.empty || F.error) {
        ["price", "pre", "tax", "tax2", "fee", "net"].forEach(function (k) { out(k, "—"); });
        out("formula", ""); if (minEl) { minEl.textContent = "—"; minEl.classList.remove("is-under"); }
        sum.classList.add("is-empty");
        width("pre", 100); width("tax", 0); width("fee", 0); width("net", 0);
        clearTimeout(timer); timer = setTimeout(function () { out("say", ""); }, 600);
        return;
      }
      sum.classList.remove("is-empty");
      var p = P.value, f = F.empty ? 0 : F.value;
      var tax = Math.floor(p * r / (100 + r));          // tax inside a tax-inclusive price, rounded down
      var pre = p - tax, applied = Math.min(f, tax), net = tax - applied;
      out("price", yen(p)); out("pre", yen(pre)); out("tax", yen(tax)); out("tax2", yen(tax));
      out("formula", p.toLocaleString("en-US") + " × " + r + " ÷ " + (100 + r));
      out("fee", "− " + yen(f));
      out("net", f > tax ? "JPY 0" : "≈ " + yen(net));
      if (minEl) {
        var ok = pre >= 5000;
        minEl.textContent = ok ? "This amount alone reaches it (same purchaser, store and day)"
          : "Below JPY 5,000 before tax on its own. It only counts if the same person’s same-day purchases at that store, or at an authorised combining counter, reach JPY 5,000.";
        minEl.classList.toggle("is-under", !ok);
      }
      if (f > tax) setErr(fee, "This fee is larger than the tax in the price, so nothing would come back.");
      width("pre", p ? pre / p * 100 : 100); width("tax", p ? tax / p * 100 : 0);
      width("fee", tax ? applied / tax * 100 : 0); width("net", tax ? net / tax * 100 : 0);
      clearTimeout(timer);
      timer = setTimeout(function () {
        out("say", "Tax in the price " + yen(tax) + ". Estimated net refund " + (f > tax ? "JPY 0" : "about " + yen(net)) + ".");
      }, 600);
    };
    est.addEventListener("input", calc);
    est.addEventListener("change", calc);
    calc();
  }

  /* ── Diagram: one purchase record is judged as a set ── */
  var recs = $("[data-records]");
  if (recs) {
    var msg = $("[data-rec-msg]", recs), base = msg ? msg.innerHTML : "";
    var ok = '<svg class="ic" aria-hidden="true" focusable="false"><use href="#i-tg-ok"></use></svg>';
    var no = '<svg class="ic" aria-hidden="true" focusable="false"><use href="#i-tg-no"></use></svg>';
    var paint = function () {
      var lost = [];
      $$("[data-rec]", recs).forEach(function (rec) {
        var gone = $$(".tg-tog", rec).some(function (b) { return b.getAttribute("aria-pressed") === "true" && b.getAttribute("data-act") !== "worn"; });
        rec.classList.toggle("is-lost", gone);
        var st = $("[data-status]", rec);
        st.className = "tg-rec-st " + (gone ? "st-lost" : "st-ok");
        st.innerHTML = gone ? no + "<span>Whole record loses the refund, every item on it</span>" : ok + "<span>Complete: can still be confirmed</span>";
        if (gone) lost.push(rec.getAttribute("data-rec").toUpperCase());
      });
      if (!msg) return;
      if (!lost.length) { msg.innerHTML = base; return; }
      var a = lost.indexOf("A") > -1, b = lost.indexOf("B") > -1;
      msg.innerHTML = a && b ? "<b>Both records lose the refund.</b> Each has an item that was eaten or left in Japan. Tell Customs staff before confirming."
        : a ? "<b>Record A loses the refund, including the watch</b>, because the snacks on the same receipt were eaten. Record B is separate and can still be confirmed."
        : "<b>Record B loses the refund</b>, because the sweater stayed in Japan. Record A is unaffected and can still be confirmed.";
    };
    recs.addEventListener("click", function (e) {
      var b = e.target.closest(".tg-tog"); if (!b) return;
      var on = b.getAttribute("aria-pressed") !== "true";
      b.setAttribute("aria-pressed", String(on));
      var li = b.closest("li");
      li.classList.toggle("is-gone", on && b.getAttribute("data-act") !== "worn");
      li.classList.toggle("is-used", on && b.getAttribute("data-act") === "worn");
      paint();
    });
  }

  /* ── question cards: full screen ── */
  var dlg = $("#tg-show"), opener = null;
  var showCard = function (n, from) {
    var card = document.getElementById("card-" + n);
    if (!card || !dlg || !dlg.showModal) return false;
    $(".tg-show-k", dlg).textContent = $(".tg-q-ctx", card).textContent.replace(/^\d+/, "").trim();
    $(".tg-show-en", dlg).textContent = $(".tg-q-en", card).textContent;
    $(".tg-show-ja", dlg).textContent = $(".tg-q-ja", card).textContent;
    opener = from || null;
    dlg.showModal();
    $(".tg-show-x", dlg).focus();
    return true;
  };
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-show-card]");
    if (!b) return;
    if (showCard(b.getAttribute("data-show-card"), b)) e.preventDefault();  // links fall back to the card itself
  });
  if (dlg) dlg.addEventListener("close", function () { if (opener && document.contains(opener)) opener.focus(); opener = null; });

  /* open a <details> when a link targets something inside it */
  var openTarget = function () {
    var id = decodeURIComponent(location.hash.slice(1)); if (!id) return;
    var t = document.getElementById(id); if (!t) return;
    var d = t.closest("details"); if (d && !d.open) { d.open = true; t.scrollIntoView(); }
  };
  window.addEventListener("hashchange", openTarget); openTarget();

  /* ── shortcut dock: say where the reader is ── */
  var dock = $(".tg-dock");
  if (dock && "IntersectionObserver" in window) {
    var where = $("[data-dock-where]", dock);
    var names = { start: "Start", contents: "Start", journey: "The whole journey", before: "Before you buy", checkout: "At the till", money: "The money",
      intact: "Using purchases", packing: "Packing", airport: "At the airport", departures: "Departure days", narita: "Narita", kansai: "Kansai",
      problems: "Problems", repayment: "Track the refund", staff: "Staff cards", final: "Final check", sources: "Sources" };
    var secs = $$(".tg-hero, .tg-sec, .tg-airport");
    var current = null;
    var mark = function (id) {
      if (id === current) return; current = id;
      if (where) where.textContent = names[id] || "Start";
      $$(".tg-dock-a", dock).forEach(function (a) {
        if (a.getAttribute("data-dock") === id && id !== "contents") a.setAttribute("aria-current", "location"); else a.removeAttribute("aria-current");
      });
    };
    var io = new IntersectionObserver(function () {
      var mid = window.innerHeight * 0.35, best = null;
      secs.forEach(function (s) { var r = s.getBoundingClientRect(); if (r.top <= mid && r.bottom > mid) best = s; });
      if (best) mark(best.id || "start");
    }, { threshold: [0, 0.25, 0.5, 0.75, 1] });
    secs.forEach(function (s) { io.observe(s); });
    window.addEventListener("scroll", function () {
      var mid = window.innerHeight * 0.35;
      for (var i = secs.length - 1; i >= 0; i--) { var r = secs[i].getBoundingClientRect(); if (r.top <= mid && r.bottom > mid) { mark(secs[i].id || "start"); break; } }
    }, { passive: true });
  }

  /* ── say plainly if this browser won't keep ticks ── */
  var note = $("[data-storage-note]");
  if (note) {
    var okStore = false;
    try { localStorage.setItem("mfjt-tg-test", "1"); localStorage.removeItem("mfjt-tg-test"); okStore = true; } catch (e) { okStore = false; }
    if (!okStore) note.textContent = "This browser isn’t saving ticks right now (for example in a private window), so they’ll clear when you leave the page. Nothing is sent anywhere.";
  }
})();
