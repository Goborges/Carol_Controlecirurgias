/* Registro de Cirurgias — núcleo (sem interface).
   Leitura do WhatsApp exportado, leitura do repasse (.xlsx), dicionário de termos,
   cruzamento repasse x cirurgias, estimativas, zip (ler/gravar). Roda no navegador e no Node. */
(function (root) {
  'use strict';

  // ---------- utilidades ----------
  const MARKS = /[‎‏‪-‮⁦-⁩﻿]/g;
  const stripMarks = (s) => String(s == null ? '' : s).replace(MARKS, '');
  function norm(s) {
    return stripMarks(s).normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }
  const pad2 = (n) => String(n).padStart(2, '0');
  const ymd = (y, m, d) => `${y}-${pad2(m)}-${pad2(d)}`;
  function parseYMD(s) { const [y, m, d] = String(s).split('-').map(Number); return { y, m, d }; }
  function dayNum(s) { const { y, m, d } = parseYMD(s); return Math.floor(Date.UTC(y, m - 1, d) / 86400000); }
  function fromDayNum(n) { const dt = new Date(n * 86400000); return ymd(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate()); }
  function minutesOf(date, time) {
    const t = time ? (+time.slice(0, 2)) * 60 + (+time.slice(3, 5)) : 12 * 60;
    return dayNum(date) * 1440 + t;
  }
  const weekday = (s) => new Date(dayNum(s) * 86400000).getUTCDay(); // 0 = domingo
  function validDate(y, m, d) {
    if (!(m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 1990 && y <= 2100)) return false;
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCMonth() === m - 1;
  }
  function todayStr(now) {
    const d = now || new Date();
    return ymd(d.getFullYear(), d.getMonth() + 1, d.getDate());
  }
  function median(arr) {
    if (!arr.length) return null;
    const a = [...arr].sort((x, y) => x - y); const k = Math.floor(a.length / 2);
    return a.length % 2 ? a[k] : (a[k - 1] + a[k]) / 2;
  }
  const round2 = (v) => Math.round(v * 100) / 100;
  function levenshtein(a, b) {
    if (a === b) return 0; if (!a.length) return b.length; if (!b.length) return a.length;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
    return prev[b.length];
  }
  function capFirst(s) { s = String(s || '').trim(); return s ? s[0].toUpperCase() + s.slice(1) : s; }
  function sentenceCase(s) { return capFirst(String(s || '').toLowerCase().replace(/\s+/g, ' ').trim()); }
  function uid(prefix) { return (prefix || 'x') + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

  // ---------- feriados e urgência (CBHPM: 19h–7h, sábados, domingos e feriados) ----------
  function easter(y) {
    const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4,
      f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30,
      i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451),
      month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
    return ymd(y, month, day);
  }
  const FIXED_HOLIDAYS = ['01-01', '04-21', '05-01', '09-07', '10-12', '11-02', '11-15', '11-20', '12-25'];
  function parseExtraHolidays(txt) {
    return String(txt || '').split(/[\s,;]+/).map((s) => {
      const m = s.match(/^(\d{1,2})\/(\d{1,2})$/); return m ? `${pad2(m[2])}-${pad2(m[1])}` : null;
    }).filter(Boolean);
  }
  function isHoliday(date, extra) {
    const md = date.slice(5);
    if (FIXED_HOLIDAYS.includes(md) || (extra || []).includes(md)) return true;
    const y = +date.slice(0, 4);
    return date === fromDayNum(dayNum(easter(y)) - 2); // sexta-feira santa
  }
  /** true = horário de urgência; false = horário normal; null = sem hora e dia útil */
  function isUrgent(date, time, extra) {
    if (!date) return null;
    const wd = weekday(date);
    if (wd === 0 || wd === 6 || isHoliday(date, extra)) return true;
    if (!time) return null;
    const h = +time.slice(0, 2);
    return h >= 19 || h < 7;
  }

  // ---------- dicionário ----------
  const T = { PROC: 'proc', HOSP: 'hosp', COL: 'col', CONV: 'conv', IGN: 'ign' };
  const TYPE_LABEL = { proc: 'Procedimento', hosp: 'Hospital', col: 'Colega', conv: 'Convênio', ign: 'Ignorar' };
  // Procedimentos e abreviações gerais + hospitais. Colegas são aprendidos na primeira importação.
  const DEFAULT_TERMS = [
    ['proc', 'Colecistectomia videolaparoscópica', 'colecistectomia', ['cvl', 'cvlp', 'colecistectomia vlp', 'colecistectomia video', 'colecistectomia videolaparoscopica', 'colecistectomia por videolaparoscopia', 'colecisto vlp'], [['colecistectomia', 'video']]],
    ['proc', 'Colecistectomia', 'colecistectomia', ['colecistectomia', 'colecisto', 'colecistectomia aberta'], [['colecistectomia']]],
    ['proc', 'Apendicectomia videolaparoscópica', 'apendicectomia', ['apvl', 'apvlp', 'apendicectomia vlp', 'apendicite vlp', 'apendice vlp', 'apendicectomia video', 'apendicectomia videolaparoscopica', 'apendicectomia por videolaparoscopia'], [['apendicectomia', 'video']]],
    ['proc', 'Apendicectomia', 'apendicectomia', ['apendicectomia', 'apendicite', 'apendice', 'apendicectomia aberta'], [['apendicectomia']]],
    ['proc', 'Herniorrafia videolaparoscópica', 'herniorrafia', ['hernia vlp', 'herniorrafia vlp', 'hernioplastia vlp', 'herniorrafia videolaparoscopica', 'hernioplastia videolaparoscopica'], [['herni', 'video']]],
    ['proc', 'Herniorrafia', 'herniorrafia', ['hernia', 'herniorrafia', 'hernioplastia'], [['herniorrafia'], ['hernioplastia']]],
    ['proc', 'Correção de hérnia interna', 'herniorrafia', ['hernia interna'], [['hernia', 'interna']]],
    ['proc', 'Correção de hérnia encarcerada', 'herniorrafia', ['hernia encarcerada', 'hernia estrangulada'], [['encarcerada'], ['estrangulada']]],
    ['proc', 'Correção de hérnia encarcerada (VLP)', 'herniorrafia', ['hernia encarcerada vlp', 'hernia estrangulada vlp'], []],
    ['proc', 'Laparotomia exploradora', 'laparotomia', ['le', 'laparotomia exploradora', 'laparotomia', 'lap exploradora'], [['laparotomia']]],
    ['proc', 'Fechamento de parede abdominal', 'parede', ['fechamento de parede', 'fechamento parede', 'fechamento de parede abdominal'], [['fechamento', 'parede']]],
    ['proc', 'Drenagem de abscesso', 'drenagem', ['drenagem de abscesso', 'drenagem abscesso'], [['drenagem', 'abscesso']]],
    ['proc', 'Videolaparoscopia', 'videolaparoscopia', ['videolaparoscopia', 'vlp', 'videolaparoscopia diagnostica', 'laparoscopia diagnostica'], [['laparoscopia', 'diagnostica']]],
    ['proc', 'Videolaparoscopia (abdome agudo obstrutivo)', 'videolaparoscopia', ['abd agudo obstrutivo', 'abdome agudo obstrutivo', 'abd agudo obstrutivo vlp', 'abdome agudo obstrutivo vlp'], []],
    ['proc', 'Distorção de volvo (VLP)', 'volvo', ['volvo', 'vlp volvo', 'vlp volvo direito', 'distorcao de volvo', 'detorcao de volvo'], [['volvo']]],
    ['proc', 'Colectomia parcial videolaparoscópica', 'colectomia', ['colectomia parcial videolaparoscopica', 'colectomia parcial vlp', 'colectomia vlp'], [['colectomia', 'video']]],
    ['proc', 'Colectomia parcial', 'colectomia', ['colectomia parcial', 'colectomia'], [['colectomia']]],
    ['proc', 'Desbridamento de úlcera', 'desbridamento', ['desbridamento ulcera', 'desbridamento de ulcera'], [['desbridamento', 'ulcera']]],
    ['proc', 'Desbridamento de lesão', 'desbridamento', ['desbridamento de lesao', 'desbridamento lesao', 'desbridamento'], [['desbridamento']]],
    ['proc', 'Histerectomia', 'histerectomia', ['histerectomia', 'histerectomia total'], [['histerectomia']]],
    ['proc', 'Colostomia', 'colostomia', ['colostomia'], [['colostomia']]],
    ['proc', 'Cisto sacrococcígeo (tratamento cirúrgico)', 'cisto sacrococcigeo', ['cisto sacrococcigeo', 'cisto pilonidal'], [['sacrococcigeo'], ['pilonidal']]],
    ['hosp', 'UMC', null, ['umc'], null],
    ['hosp', 'Santa Clara', null, ['santa clara', 'sta clara', 'mater dei', 'materdei', 'mater dei santa clara'], null],
    ['hosp', 'Santa Genoveva', null, ['santa genoveva', 'sta genoveva', 'genoveva'], null],
  ];
  function defaultTerms() {
    return DEFAULT_TERMS.map(([type, name, fam, aliases, kw], i) => ({
      id: 't' + type + i, type, name, fam: fam || undefined, aliases: aliases.map(norm), kw: kw || undefined,
    }));
  }
  function buildIndex(terms) {
    const phrases = [];
    for (const t of terms) {
      const set = new Set([norm(t.name), ...(t.aliases || []).map(norm)]);
      for (const a of set) if (a) phrases.push({ toks: a.split(' '), alias: a, term: t });
    }
    phrases.sort((a, b) => b.toks.length - a.toks.length || b.alias.length - a.alias.length);
    const byName = new Map(terms.map((t) => [t.type + '|' + t.name, t]));
    return { terms, phrases, byName };
  }
  const famOf = (index, procName) => { const t = index.byName.get('proc|' + procName); return t && t.fam ? t.fam : norm(procName).split(' ')[0]; };

  // ---------- leitura de legenda em formato livre ----------
  const PROCISH = /(ectomia|otomia|ostomia|plastia|rafia|pexia|scopia|hernia|drenag|desbrid|biopsia|exerese|ressec|laparo|sutura|correc|reconstru|amputa|enxerto|retalho|abscesso|cisto|lesao|fechamento|retirada|implante|colocacao|troca|lavagem|limpeza|tumor|nodulo|fistula|anastomose|derivacao|cateter|dreno|varizes|safen|hemorroid|fissura|vlp|video)/;
  const WEEKDAY_RE = /\b(segunda|ter[cç]a|quarta|quinta|sexta|s[aá]bado|domingo)(\s*-?\s*feira)?\b|\bfeira\b|\bhoje\b|\bontem\b/gi;
  const SPLIT_RE = /\s+[-–—]+\s*|\s*[-–—]+\s+|\s*[+;,\n\/|]\s*/;
  const AMEND_RE = /^\s*(convertid[oa]s?|convers[aã]o|obs\b|observa[cç][aã]o|corre[cç][aã]o:)/i;

  function tokenize(seg) {
    const out = [];
    for (const m of String(seg).matchAll(/[\p{L}\p{N}]+/gu)) {
      const n = norm(m[0]); if (!n) continue;
      for (const part of n.split(' ')) out.push({ o: m[0], n: part });
    }
    return out;
  }
  function scan(tokens, index, types, used) {
    const found = [];
    for (let i = 0; i < tokens.length; i++) {
      if (used[i]) continue;
      for (const ph of index.phrases) {
        if (!types.includes(ph.term.type)) continue;
        const L = ph.toks.length; if (i + L > tokens.length) continue;
        let ok = true;
        for (let k = 0; k < L; k++) if (used[i + k] || tokens[i + k].n !== ph.toks[k]) { ok = false; break; }
        if (ok) { for (let k = 0; k < L; k++) used[i + k] = true; found.push({ term: ph.term, alias: ph.alias, at: i, len: L }); i += L - 1; break; }
      }
    }
    return found;
  }

  /**
   * Lê uma legenda livre. Retorna campos reconhecidos + termos desconhecidos.
   * msgDate: 'YYYY-MM-DD' da mensagem (para inferir o ano de "06/07").
   */
  function parseCaption(raw, index, msgDate) {
    const res = { date: null, time: null, valor: null, procs: [], hosp: null, cols: [], conv: null, unknown: [], amend: false, empty: true };
    let text = stripMarks(raw || '').trim();
    if (!text) return res;
    res.amend = AMEND_RE.test(text);
    // data no texto: 28/11/25, 06/07
    text = text.replace(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/g, (m, d, mo, y) => {
      if (res.date) return ' ';
      d = +d; mo = +mo;
      let year = y ? (+y < 100 ? 2000 + +y : +y) : (msgDate ? +msgDate.slice(0, 4) : new Date().getFullYear());
      if (!validDate(year, mo, d)) return m;
      let ds = ymd(year, mo, d);
      if (!y && msgDate && dayNum(ds) > dayNum(msgDate) + 1) { year -= 1; ds = ymd(year, mo, d); }
      res.date = ds; return ' ';
    });
    // hora no texto: 14:30, 14h30, 14h
    text = text.replace(/\b([01]?\d|2[0-3])\s*(?::|h)\s*([0-5]\d)\b|\b([01]?\d|2[0-3])\s*h\b/gi, (m, h1, mi, h2) => {
      if (res.time) return ' ';
      res.time = h1 != null ? `${pad2(h1)}:${mi}` : `${pad2(h2)}:00`; return ' ';
    });
    // valor: R$ 1.234,56 | valor 1500
    text = text.replace(/(?:r\$|valor:?|vlr:?)\s*(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?/gi, (m, int, dec) => {
      if (res.valor == null) res.valor = +(int.replace(/\./g, '') + '.' + (dec || '0')); return ' ';
    });
    text = text.replace(WEEKDAY_RE, ' ');
    const segments = text.split(SPLIT_RE).map((s) => s && s.trim()).filter(Boolean);
    let lastProc = null;
    const pendingNames = [];
    for (const seg of segments) {
      const toks = tokenize(seg); if (!toks.length) continue;
      const used = toks.map(() => false);
      for (const f of scan(toks, index, [T.HOSP, T.COL, T.CONV, T.IGN], used)) {
        if (f.term.type === T.HOSP && !res.hosp) res.hosp = f.term.name;
        else if (f.term.type === T.COL && !res.cols.includes(f.term.name)) res.cols.push(f.term.name);
        else if (f.term.type === T.CONV && !res.conv) res.conv = f.term.name;
      }
      const left = toks.map((t, i) => (used[i] ? null : t));
      const leftToks = left.filter(Boolean);
      if (!leftToks.length) continue;
      const leftNorm = leftToks.map((t) => t.n).join(' ');
      if (/^(vlp|video|videolaparoscopica|videolaparoscopia|por video)$/.test(leftNorm) && lastProc) {
        const variant = index.phrases.find((p) => p.term.type === T.PROC && p.alias === lastProc.alias + ' vlp');
        if (variant) {
          const i = res.procs.indexOf(lastProc.term.name);
          if (i >= 0) res.procs[i] = variant.term.name;
          lastProc = { term: variant.term, alias: variant.alias };
        }
        continue;
      }
      const pUsed = toks.map((t, i) => used[i]);
      const procs = scan(toks, index, [T.PROC], pUsed);
      for (const p of procs) {
        if (p.term.name === 'Videolaparoscopia' && (res.procs.length || procs.length > 1)) {
          // "VLP" solto junto de outro procedimento: vira modificador
          const base = lastProc || procs.find((q) => q !== p && q.term.name !== 'Videolaparoscopia');
          if (base) {
            const variant = index.phrases.find((ph) => ph.term.type === T.PROC && ph.alias === base.alias + ' vlp');
            if (variant) {
              const i = res.procs.indexOf(base.term.name);
              if (i >= 0) res.procs[i] = variant.term.name; else res.procs.push(variant.term.name);
              lastProc = { term: variant.term, alias: variant.alias };
            }
            continue;
          }
        }
        if (!res.procs.includes(p.term.name)) res.procs.push(p.term.name);
        lastProc = p;
      }
      // sobras
      const rest = toks.filter((t, i) => !pUsed[i]);
      if (!rest.length) continue;
      const restNorm = rest.map((t) => t.n).join(' ');
      const restOrig = rest.map((t) => t.o).join(' ');
      if (!procs.length && PROCISH.test(restNorm)) {
        res.unknown.push({ text: capFirst(restOrig), norm: restNorm, guess: T.PROC });
        if (!res.procs.includes(capFirst(restOrig))) res.procs.push(capFirst(restOrig));
        continue;
      }
      // possível nome (colega ou hospital) — decide depois, com a frequência
      const capitalized = rest.every((t) => /^\p{Lu}/u.test(t.o));
      if (capitalized && rest.length <= 3) {
        if (rest.length > 1 || rest[0].o.length >= 3) pendingNames.push({ text: restOrig, norm: restNorm, upper: rest.every((t) => t.o === t.o.toUpperCase()) });
      }
    }
    for (const nm of pendingNames) {
      let guess = T.IGN;
      if (nm.upper && nm.norm.length <= 5 && !res.hosp) guess = T.HOSP;
      else if (!res.cols.length) guess = T.COL;
      res.unknown.push({ text: nm.text, norm: nm.norm, guess });
    }
    res.empty = !(res.procs.length || res.hosp || res.cols.length || res.date || res.valor != null);
    return res;
  }

  // ---------- conversa exportada do WhatsApp ----------
  const IOS_HDR = /^\[(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*([AaPp])\.?\s?[Mm]\.?)?\]\s?(.*)$/;
  const AND_HDR = /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*([AaPp])\.?\s?[Mm]\.?)?\s+[-–]\s+(.*)$/;
  const ATT_RES = [
    /<\s*(?:anexado|attached|adjunto|allegato|joint|angeh[aä]ngt)\s*:\s*([^>]+?)\s*>/gi,
    /([^\s<>:"|?*]+\.(?:jpe?g|png|heic|webp|gif|mp4|mov|pdf|opus|m4a|docx?|xlsx?))\s*\((?:arquivo anexado|file attached|archivo adjunto)\)/gi,
  ];
  const OMIT_RE = /(<?\s*(?:imagem ocultada|image omitted|foto ocultada|m[ií]dia oculta|media omitted|v[ií]deo omitido|video omitted|figurinha omitida|sticker omitted|documento omitido|document omitted|gif omitido|[aá]udio ocultado|audio omitted)\s*>?)/gi;
  const SYSTEM_RE = /(criptografia de ponta a ponta|end-to-end encrypted|criou (este|o) grupo|created (this )?group|adicionou|added you|saiu|left|mudou (o nome|a imagem|a descri)|changed (the|this) group|mensagem foi apagada|message was deleted|mensagem apagada|mensagens tempor[aá]rias|disappearing messages|c[oó]digo de seguran[cç]a)/i;
  const IMG_EXT = /\.(jpe?g|png|heic|webp)$/i;

  function parseChat(text) {
    const lines = String(text).replace(/\r\n?/g, '\n').split('\n');
    const msgs = [];
    for (const rawLine of lines) {
      const line = stripMarks(rawLine);
      const m = line.match(IOS_HDR) || line.match(AND_HDR);
      if (!m) { if (msgs.length) msgs[msgs.length - 1].raw += '\n' + line; continue; }
      const lrm = /:\s?[‎‏]/.test(rawLine);
      let [, a, b, y, hh, mi, ss, ap, rest] = m;
      let d = +a, mo = +b; if (mo > 12 && d <= 12) [d, mo] = [mo, d];
      let year = +y; if (year < 100) year += 2000;
      let h = +hh; if (ap) { const pm = /p/i.test(ap); if (pm && h < 12) h += 12; if (!pm && h === 12) h = 0; }
      const sm = rest.match(/^([^:]{1,80}?):(?:\s|$)([\s\S]*)$/);
      msgs.push({ date: ymd(year, mo, d), time: `${pad2(h)}:${mi}`, sec: ss ? +ss : 0, sender: sm ? sm[1].trim() : '', raw: sm ? sm[2] : rest, system: !sm, lrm });
    }
    let chatName = '';
    if (msgs.length && SYSTEM_RE.test(msgs[0].raw)) chatName = msgs[0].sender;
    const seen = new Map();
    for (const msg of msgs) {
      let t = msg.raw; const files = [];
      for (const re of ATT_RES) t = t.replace(re, (all, f) => { files.push(stripMarks(f).trim()); return ' '; });
      let omitted = 0; t = t.replace(OMIT_RE, () => { omitted++; return ' '; });
      msg.text = stripMarks(t).replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim();
      msg.files = files; msg.photos = files.filter((f) => IMG_EXT.test(f)); msg.omitted = omitted;
      msg.system = msg.system || (msg.lrm && !files.length && !omitted && SYSTEM_RE.test(msg.text));
      const base = `${msg.date}T${msg.time}:${pad2(msg.sec)}|${norm(msg.text).slice(0, 48)}|${files.length + omitted}`;
      const n = (seen.get(base) || 0) + 1; seen.set(base, n);
      msg.key = base + '#' + n;
      delete msg.raw; delete msg.lrm;
    }
    return { chatName, messages: msgs };
  }

  /** Agrupa mensagens em cirurgias (legenda + fotos) e fotos sem legenda. */
  function groupMessages(messages) {
    const entries = []; const loose = []; let pending = []; let last = null;
    const tmin = (m) => minutesOf(m.date, m.time) + m.sec / 60;
    const flush = () => { for (const p of pending) loose.push(p); pending = []; };
    const hasMedia = (m) => m.photos.length || m.omitted;
    for (const m of messages) {
      if (m.system) continue;
      const media = hasMedia(m); const txt = m.text;
      if (!media && !txt) continue;
      if (media && txt) {
        const ent = { key: m.key, date: m.date, time: m.time, sec: m.sec, caption: txt, photos: [], omitted: 0, amends: [], t: tmin(m) };
        const recent = pending.filter((p) => tmin(m) - tmin(p) <= 5);
        pending = pending.filter((p) => !recent.includes(p)); flush();
        for (const p of recent) { ent.photos.push(...p.photos); ent.omitted += p.omitted; }
        ent.photos.push(...m.photos); ent.omitted += m.omitted;
        entries.push(ent); last = ent; continue;
      }
      if (media) {
        if (last && tmin(m) - last.t <= 2 && !pending.length) { last.photos.push(...m.photos); last.omitted += m.omitted; last.t = tmin(m); continue; }
        if (last && last.textOnly && !last.photos.length && tmin(m) - last.t <= 5) { last.photos.push(...m.photos); last.omitted += m.omitted; last.t = tmin(m); continue; }
        if (pending.length && tmin(m) - tmin(pending[pending.length - 1]) > 5) flush();
        pending.push(m); continue;
      }
      // só texto
      if (AMEND_RE.test(txt) && last && last.date === m.date && tmin(m) - last.t <= 6 * 60) { last.amends.push({ key: m.key, text: txt }); continue; }
      if (pending.length && tmin(m) - tmin(pending[pending.length - 1]) <= 15) {
        const ent = { key: m.key, date: pending[0].date, time: pending[0].time, sec: pending[0].sec, caption: txt, photos: [], omitted: 0, amends: [], t: tmin(m) };
        for (const p of pending) { ent.photos.push(...p.photos); ent.omitted += p.omitted; }
        pending = []; entries.push(ent); last = ent; continue;
      }
      flush();
      const ent = { key: m.key, date: m.date, time: m.time, sec: m.sec, caption: txt, photos: [], omitted: 0, amends: [], t: tmin(m), textOnly: true };
      entries.push(ent); last = ent;
    }
    flush();
    return { entries, loose: loose.map((m) => ({ key: m.key, date: m.date, time: m.time, photos: m.photos, omitted: m.omitted })) };
  }

  /** Conta termos desconhecidos em todas as legendas e decide o palpite por frequência. */
  function collectUnknown(entries, index) {
    const map = new Map();
    for (const e of entries) {
      const p = parseCaption(e.caption, index, e.date);
      for (const u of p.unknown) {
        const cur = map.get(u.norm) || { text: u.text, norm: u.norm, count: 0, guesses: {} };
        cur.count++; cur.guesses[u.guess] = (cur.guesses[u.guess] || 0) + 1; map.set(u.norm, cur);
      }
    }
    const out = [];
    for (const u of map.values()) {
      let guess = Object.entries(u.guesses).sort((a, b) => b[1] - a[1])[0][0];
      if (guess === T.COL && u.count < 2 && u.norm.includes(' ')) guess = T.IGN; // nome composto que aparece uma vez: anotação
      if (guess !== T.IGN) out.push({ text: u.text, norm: u.norm, count: u.count, guess });
    }
    return out.sort((a, b) => b.count - a.count);
  }

  function recordFromEntry(e, index, opts) {
    opts = opts || {};
    const p = parseCaption(e.caption, index, e.date);
    const rec = {
      id: uid('r'), key: e.key, origem: 'whatsapp', grupo: opts.chatName || '',
      date: p.date || e.date, time: p.date ? (p.time || null) : (p.time || e.time),
      msgDate: e.date, msgTime: e.time,
      procs: p.procs.slice(), hosp: p.hosp, cols: p.cols.slice(), conv: p.conv, funcao: null,
      valorPrevisto: p.valor, status: 'aberto', recebido: null, rep: [],
      caption: e.caption, notas: '', photoIds: [], photoNames: e.photos.slice(), omitted: e.omitted || 0,
      revisar: [], createdAt: Date.now(), updatedAt: Date.now(),
    };
    for (const a of e.amends || []) {
      const q = parseCaption(a.text, index, e.date);
      rec.caption += '\n' + a.text;
      if (q.procs.length) rec.procs = q.procs.slice();
      rec.notas = (rec.notas ? rec.notas + '\n' : '') + a.text;
      rec.revisar.push('Conversão ou observação — confira o procedimento');
    }
    if (!rec.procs.length) rec.revisar.push('Sem procedimento');
    if (p.unknown.some((u) => u.guess === T.PROC)) rec.revisar.push('Procedimento novo');
    return rec;
  }

  // ---------- zip ----------
  async function zipOpen(blob) {
    const size = blob.size; const tailLen = Math.min(size, 65557);
    const tail = new Uint8Array(await blob.slice(size - tailLen).arrayBuffer());
    let e = -1;
    for (let i = tail.length - 22; i >= 0; i--) if (tail[i] === 0x50 && tail[i + 1] === 0x4b && tail[i + 2] === 5 && tail[i + 3] === 6) { e = i; break; }
    if (e < 0) throw new Error('Este arquivo não é um .zip válido.');
    const dv = new DataView(tail.buffer, tail.byteOffset, tail.byteLength);
    let count = dv.getUint16(e + 10, true), cdSize = dv.getUint32(e + 12, true), cdOff = dv.getUint32(e + 16, true);
    if (count === 0xffff || cdSize === 0xffffffff || cdOff === 0xffffffff) {
      const lp = e - 20;
      if (lp >= 0 && dv.getUint32(lp, true) === 0x07064b50) {
        const off = Number(dv.getBigUint64(lp + 8, true));
        const z = new DataView(await blob.slice(off, off + 56).arrayBuffer());
        if (z.getUint32(0, true) === 0x06064b50) { count = Number(z.getBigUint64(32, true)); cdSize = Number(z.getBigUint64(40, true)); cdOff = Number(z.getBigUint64(48, true)); }
      }
    }
    const cd = new Uint8Array(await blob.slice(cdOff, cdOff + cdSize).arrayBuffer());
    const c = new DataView(cd.buffer, cd.byteOffset, cd.byteLength);
    const entries = []; let p = 0; const td = new TextDecoder('utf-8');
    while (p + 46 <= cd.length && c.getUint32(p, true) === 0x02014b50) {
      const method = c.getUint16(p + 10, true);
      let csize = c.getUint32(p + 20, true), usize = c.getUint32(p + 24, true), off = c.getUint32(p + 42, true);
      const nlen = c.getUint16(p + 28, true), xlen = c.getUint16(p + 30, true), clen = c.getUint16(p + 32, true);
      const name = td.decode(cd.subarray(p + 46, p + 46 + nlen));
      let x = p + 46 + nlen; const xend = x + xlen;
      while (x + 4 <= xend) {
        const id = c.getUint16(x, true), sz = c.getUint16(x + 2, true);
        if (id === 1) {
          let q = x + 4;
          if (usize === 0xffffffff) { usize = Number(c.getBigUint64(q, true)); q += 8; }
          if (csize === 0xffffffff) { csize = Number(c.getBigUint64(q, true)); q += 8; }
          if (off === 0xffffffff) { off = Number(c.getBigUint64(q, true)); q += 8; }
        }
        x += 4 + sz;
      }
      if (!name.endsWith('/')) entries.push({ name, base: name.split('/').pop(), method, csize, usize, off, crc: c.getUint32(p + 16, true) });
      p = xend + clen;
    }
    return { blob, entries };
  }
  async function zipEntryBlob(zip, entry, type) {
    const lh = new DataView(await zip.blob.slice(entry.off, entry.off + 30).arrayBuffer());
    if (lh.getUint32(0, true) !== 0x04034b50) throw new Error('Arquivo .zip corrompido.');
    const start = entry.off + 30 + lh.getUint16(26, true) + lh.getUint16(28, true);
    const data = zip.blob.slice(start, start + entry.csize);
    if (entry.method === 0) return type ? new Blob([data], { type }) : data;
    if (entry.method === 8) {
      if (typeof DecompressionStream === 'undefined') throw new Error('Este aparelho não consegue abrir .zip (atualize o iOS).');
      const out = await new Response(data.stream().pipeThrough(new DecompressionStream('deflate-raw'))).blob();
      return type ? new Blob([out], { type }) : out;
    }
    throw new Error('Formato de compressão não suportado no .zip.');
  }
  /** Como zipEntryBlob, mas confere o CRC do arquivo: se o zip estiver danificado, dá erro em vez de devolver dados errados. */
  async function zipEntryChecked(zip, entry, type) {
    const blob = await zipEntryBlob(zip, entry, type);
    const u8 = new Uint8Array(await blob.arrayBuffer());
    if (u8.length !== entry.usize || crc32(u8) !== entry.crc) throw new Error(`O arquivo ${entry.base} está danificado no backup.`);
    return blob;
  }
  const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(u8) { let c = 0xffffffff; for (let i = 0; i < u8.length; i++) c = CRC_TABLE[(c ^ u8[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
  /** files: [{name, data: Uint8Array|string|Blob}] → Blob .zip (sem compressão) */
  async function zipWrite(files, now) {
    const te = new TextEncoder(); const parts = []; const central = []; let offset = 0;
    const d = now || new Date();
    const dosTime = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    const dosDate = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    for (const f of files) {
      const name = te.encode(f.name);
      let data = f.data;
      if (typeof data === 'string') data = te.encode(data);
      else if (typeof Blob !== 'undefined' && data instanceof Blob) data = new Uint8Array(await data.arrayBuffer());
      const crc = crc32(data);
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
      lh.setUint16(10, dosTime, true); lh.setUint16(12, dosDate, true); lh.setUint32(14, crc, true);
      lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
      parts.push(new Uint8Array(lh.buffer), name, data);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
      ch.setUint16(12, dosTime, true); ch.setUint16(14, dosDate, true); ch.setUint32(16, crc, true);
      ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, name.length, true);
      ch.setUint32(42, offset, true);
      central.push(new Uint8Array(ch.buffer), name);
      offset += 30 + name.length + data.length;
    }
    const cdSize = central.reduce((s, u) => s + u.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
    end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
    return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: 'application/zip' });
  }

  // ---------- planilha .xlsx (repasse) ----------
  function xmlDecode(s) {
    return String(s).replace(/&#x([0-9a-f]+);/gi, (m, h) => String.fromCodePoint(parseInt(h, 16)))
      .replace(/&#(\d+);/g, (m, d) => String.fromCodePoint(+d))
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
  }
  const attr = (tag, name) => { const m = tag.match(new RegExp('\\b' + name + '="([^"]*)"')); return m ? m[1] : null; };
  function colIndex(ref) { const L = ref.match(/^[A-Z]+/)[0]; let n = 0; for (const ch of L) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; }
  async function readXlsx(blob) {
    const z = await zipOpen(blob);
    const txt = async (name) => { const e = z.entries.find((x) => x.name === name || x.name === '/' + name); return e ? (await zipEntryBlob(z, e)).text() : null; };
    const wb = await txt('xl/workbook.xml');
    const rels = await txt('xl/_rels/workbook.xml.rels');
    let sheetPath = 'xl/worksheets/sheet1.xml';
    const st = wb && wb.match(/<sheet\b[^>]*>/);
    if (st && rels) {
      const rid = attr(st[0], 'r:id');
      for (const rm of rels.match(/<Relationship\b[^>]*>/g) || []) {
        if (attr(rm, 'Id') === rid) { const tg = attr(rm, 'Target'); sheetPath = tg.startsWith('/') ? tg.slice(1) : 'xl/' + tg.replace(/^\.\//, ''); }
      }
    }
    const ss = [];
    const ssx = await txt('xl/sharedStrings.xml');
    if (ssx) for (const m of ssx.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)) {
      ss.push(xmlDecode([...m[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join('')));
    }
    const sx = await txt(sheetPath);
    if (!sx) throw new Error('Planilha vazia ou em formato não reconhecido.');
    const rows = [];
    for (const rm of sx.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
      const row = [];
      for (const cm of rm[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const a = cm[1]; const inner = cm[2] || ''; const ref = attr('<c ' + a, 'r'); const t = attr('<c ' + a, 't');
        if (!ref) continue;
        let v = null; const vm = inner.match(/<v>([\s\S]*?)<\/v>/);
        if (t === 's') v = vm ? ss[+vm[1]] : null;
        else if (t === 'inlineStr') v = xmlDecode([...inner.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((x) => x[1]).join(''));
        else if (t === 'str' || t === 'd') v = vm ? xmlDecode(vm[1]) : null;
        else if (t === 'b') v = vm ? vm[1] === '1' : null;
        else v = vm ? +vm[1] : null;
        row[colIndex(ref)] = v;
      }
      rows.push(row);
    }
    return rows;
  }
  function excelDate(v) {
    if (typeof v === 'number' && isFinite(v) && v > 20000 && v < 80000) {
      const ms = Math.round(v * 86400000); const dt = new Date(Date.UTC(1899, 11, 30) + ms);
      return { date: ymd(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate()), time: `${pad2(dt.getUTCHours())}:${pad2(dt.getUTCMinutes())}` };
    }
    const s = String(v || '').trim();
    let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:[ T](\d{1,2}):(\d{2}))?/);
    if (m) { let y = +m[3]; if (y < 100) y += 2000; if (validDate(y, +m[2], +m[1])) return { date: ymd(y, +m[2], +m[1]), time: m[4] ? `${pad2(m[4])}:${m[5]}` : null }; }
    m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
    if (m && validDate(+m[1], +m[2], +m[3])) return { date: ymd(+m[1], +m[2], +m[3]), time: m[4] ? `${m[4]}:${m[5]}` : null };
    return null;
  }
  function toNumber(v) {
    if (typeof v === 'number') return v;
    const s = String(v || '').replace(/[R$\s]/g, '');
    if (!s) return null;
    const n = /,\d{1,2}$/.test(s) ? +s.replace(/\./g, '').replace(',', '.') : +s.replace(/,/g, '');
    return isFinite(n) ? n : null;
  }
  const HEADERS = {
    data: ['data procedimento', 'data do procedimento', 'dt procedimento', 'data realizacao', 'data atendimento', 'data'],
    convenio: ['convenio', 'operadora', 'plano'],
    codigo: ['codigo', 'cod', 'codigo tuss', 'tuss'],
    procedimento: ['procedimento', 'descricao procedimento', 'descricao'],
    valor: ['liberado', 'valor liberado', 'valor pago', 'vl liberado', 'valor repasse', 'valor'],
    funcao: ['funcao medico', 'funcao', 'grau participacao', 'participacao'],
    executor: ['medico executor', 'executor', 'cirurgiao principal', 'cirurgiao', 'medico responsavel'],
  };
  /** Lê as linhas do repasse. Descarta colunas de paciente, atendimento e conta. */
  function parseRepasse(rows, fileName) {
    let hi = -1, map = null;
    for (let i = 0; i < Math.min(rows.length, 15); i++) {
      const cells = (rows[i] || []).map((c) => norm(c));
      const m = {};
      for (const [k, names] of Object.entries(HEADERS)) {
        let idx = -1;
        for (const nm of names) { idx = cells.findIndex((c) => c === nm); if (idx >= 0) break; }
        if (idx < 0 && k !== 'data' && k !== 'valor') for (const nm of names) { idx = cells.findIndex((c) => c && c.includes(nm) && !c.includes('paciente')); if (idx >= 0) break; }
        if (idx >= 0) m[k] = idx;
      }
      if (m.data != null && m.procedimento != null && m.valor != null) { hi = i; map = m; break; }
    }
    if (hi < 0) throw new Error('Não encontrei as colunas de data, procedimento e valor nesta planilha.');
    const lines = [];
    for (let i = hi + 1; i < rows.length; i++) {
      const r = rows[i] || [];
      const dt = excelDate(r[map.data]); const valor = toNumber(r[map.valor]);
      if (!dt || valor == null) continue;
      lines.push({
        date: dt.date, time: dt.time, valor: round2(valor),
        conv: map.convenio != null && r[map.convenio] ? String(r[map.convenio]).trim() : null,
        cod: map.codigo != null && r[map.codigo] != null ? String(r[map.codigo]).trim() : null,
        proc: String(r[map.procedimento] || '').replace(/\s+/g, ' ').trim(),
        funcao: map.funcao != null && r[map.funcao] ? String(r[map.funcao]).trim() : null,
        exec: map.executor != null && r[map.executor] ? String(r[map.executor]).replace(/\s+/g, ' ').trim() : null,
      });
    }
    const name = String(fileName || '');
    const num = (name.match(/repasse\D{0,5}(\d{3,})/i) || [])[1] || null;
    const comp = (name.match(/comp[^a-z0-9]{0,3}(\d{1,2}(?:[\/.-]\d{2,4})?)/i) || [])[1] || null;
    const total = round2(lines.reduce((s, l) => s + l.valor, 0));
    const sig = lines.map((l) => `${l.date}${l.time}${l.cod}${l.valor}`).join('|');
    let h = 0; for (let i = 0; i < sig.length; i++) h = (h * 31 + sig.charCodeAt(i)) | 0;
    return { id: num ? 'rep' + num : 'rep' + (h >>> 0).toString(36), numero: num, comp, nome: name, lines, total };
  }

  // ---------- termos: procedimento do repasse e médico executor ----------
  function mapRepasseProc(name, index) {
    const n = norm(name);
    let best = null, bestScore = 0;
    for (const t of index.terms) {
      if (t.type !== T.PROC) continue;
      const aliases = [norm(t.name), ...(t.aliases || [])];
      if (aliases.includes(n)) return t;
      for (const kw of t.kw || []) {
        if (kw.length && kw.every((w) => n.includes(w))) {
          const sc = kw.length * 10 + kw.join('').length;
          if (sc > bestScore) { best = t; bestScore = sc; }
        }
      }
    }
    return best;
  }
  function mapExecutor(full, index) {
    if (!full) return null;
    const n = norm(full); const first = n.split(' ')[0];
    const cols = index.terms.filter((t) => t.type === T.COL);
    for (const t of cols) if ([norm(t.name), ...(t.aliases || [])].includes(n)) return { term: t, how: 'exato' };
    for (const t of cols) for (const a of [norm(t.name), ...(t.aliases || [])]) if (a && (n.startsWith(a + ' ') || a.split(' ')[0] === first && a.length > 2)) return { term: t, how: 'nome' };
    for (const t of cols) for (const a of [norm(t.name), ...(t.aliases || [])]) {
      const af = a.split(' ')[0];
      if (af.length >= 4 && first.length >= 4 && levenshtein(af, first) <= 1) return { term: t, how: 'parecido' };
    }
    return null;
  }

  // ---------- cruzamento repasse x cirurgias ----------
  function groupActs(lines) {
    const acts = new Map();
    for (const l of lines) {
      const k = `${l.date}|${l.time || ''}|${norm(l.exec || '')}`;
      if (!acts.has(k)) acts.set(k, { date: l.date, time: l.time, exec: l.exec, lines: [] });
      acts.get(k).lines.push(l);
    }
    return [...acts.values()];
  }
  function scorePair(act, rec, ctx) {
    const dd = Math.abs(dayNum(act.date) - dayNum(rec.date));
    if (dd > 1) return -99;
    let s = dd === 0 ? 4 : 1; const why = [];
    if (act.col && rec.cols && rec.cols.length) { if (rec.cols.includes(act.col)) { s += 4; why.push('colega'); } else s -= 4; }
    if (rec.procs && rec.procs.length && act.procNames.length) {
      const exact = act.procNames.some((p) => rec.procs.includes(p));
      const fams = new Set(act.procNames.map((p) => famOf(ctx.index, p)));
      const fam = rec.procs.some((p) => fams.has(famOf(ctx.index, p)));
      if (exact) { s += 3; why.push('procedimento'); } else if (fam) { s += 2; why.push('procedimento'); } else s -= 2;
    }
    if (act.time && rec.time && dd === 0) {
      const dm = Math.abs(minutesOf(act.date, act.time) - minutesOf(rec.date, rec.time));
      if (dm <= 90) s += 2; else if (dm <= 240) s += 1;
    }
    if (ctx.hosp && rec.hosp && rec.hosp !== ctx.hosp) s -= 3;
    return s;
  }
  /** Propõe pares ato-do-repasse ↔ cirurgia em aberto. Não grava nada. */
  function planRepasse(rep, records, index, opts) {
    opts = opts || {};
    const acts = groupActs(rep.lines);
    for (const a of acts) {
      const m = mapExecutor(a.exec, index);
      a.col = m ? m.term.name : null; a.colHow = m ? m.how : null;
      a.procNames = a.lines.map((l) => { const t = mapRepasseProc(l.proc, index); return t ? t.name : sentenceCase(l.proc); });
      a.valor = round2(a.lines.reduce((s, l) => s + l.valor, 0));
    }
    const open = records.filter((r) => r.status === 'aberto');
    const pairs = [];
    acts.forEach((a, ai) => open.forEach((r) => { const sc = scorePair(a, r, { index, hosp: opts.hosp }); if (sc >= 5) pairs.push({ ai, r, sc }); }));
    pairs.sort((x, y) => y.sc - x.sc || Math.abs(minutesOf(acts[x.ai].date, acts[x.ai].time) - minutesOf(x.r.date, x.r.time)) - Math.abs(minutesOf(acts[y.ai].date, acts[y.ai].time) - minutesOf(y.r.date, y.r.time)));
    const usedA = new Set(), usedR = new Set();
    for (const p of pairs) {
      if (usedA.has(p.ai) || usedR.has(p.r.id)) continue;
      usedA.add(p.ai); usedR.add(p.r.id);
      acts[p.ai].recordId = p.r.id; acts[p.ai].score = p.sc; acts[p.ai].certeza = p.sc >= 9 ? 'alta' : 'confira';
    }
    for (const a of acts) if (!a.recordId) { a.recordId = null; a.certeza = 'novo'; }
    return acts;
  }

  // ---------- estimativas ----------
  function buildRefs(records, extraHol) {
    const byProc = new Map(), byFam = new Map(), byProcConv = new Map();
    const push = (m, k, v) => { if (!m.has(k)) m.set(k, []); m.get(k).push(v); };
    for (const r of records) {
      if (!r.rep || !r.rep.length) continue;
      const acts = groupActs(r.rep);
      for (const a of acts) {
        if (a.lines.length !== 1) continue; // atos com vários procedimentos têm redução; ficam fora da referência
        const l = a.lines[0]; if (!l.procName || !(l.valor > 0)) continue;
        const urg = isUrgent(l.date, l.time, extraHol);
        const base = l.valor / (urg ? 1.3 : 1);
        push(byProc, l.procName, base); push(byFam, l.fam || norm(l.procName).split(' ')[0], base);
        if (l.conv) push(byProcConv, l.procName + '|' + l.conv, { base, urg, valor: l.valor, recId: r.id });
      }
    }
    return { byProc, byFam, byProcConv };
  }
  function estimate(rec, refs, index, extraHol) {
    if (!rec.procs || !rec.procs.length) return null;
    const bases = []; let missing = 0;
    for (const p of rec.procs) {
      const exact = refs.byProc.get(p); const fam = refs.byFam.get(famOf(index, p));
      const v = exact ? median(exact) : fam ? median(fam) : null;
      if (v == null) missing++; else bases.push(v);
    }
    if (!bases.length) return { valor: null, parcial: true, faltam: missing };
    bases.sort((a, b) => b - a);
    let total = bases[0] + bases.slice(1).reduce((s, v) => s + v * 0.5, 0);
    if (isUrgent(rec.date, rec.time, extraHol)) total *= 1.3;
    return { valor: round2(total), parcial: missing > 0, faltam: missing };
  }
  /** Cirurgia em horário de urgência paga pelo valor de horário normal (mesmo procedimento e convênio). */
  function urgencyChecks(records, refs, extraHol) {
    const out = [];
    for (const [k, arr] of refs.byProcConv) {
      const normal = arr.filter((x) => !x.urg).map((x) => x.base);
      const base = normal.length ? median(normal) : null;
      if (base == null) continue;
      for (const x of arr) if (x.urg && Math.abs(x.valor - base) / base < 0.02) out.push({ recId: x.recId, chave: k, pago: x.valor, esperado: round2(base * 1.3) });
    }
    return out;
  }

  const api = {
    norm, stripMarks, pad2, ymd, dayNum, fromDayNum, minutesOf, weekday, todayStr, median, round2, uid, capFirst, sentenceCase, levenshtein,
    easter, isHoliday, isUrgent, parseExtraHolidays, T, TYPE_LABEL, defaultTerms, buildIndex, famOf,
    parseCaption, parseChat, groupMessages, collectUnknown, recordFromEntry,
    zipOpen, zipEntryBlob, zipEntryChecked, zipWrite, crc32, readXlsx, excelDate, parseRepasse,
    mapRepasseProc, mapExecutor, groupActs, planRepasse, buildRefs, estimate, urgencyChecks,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Core = api;
})(typeof self !== 'undefined' ? self : this);
