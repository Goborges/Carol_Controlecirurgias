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
  /** Feriados da cidade: "31/08" vale todo ano; "04/06/2026" só naquele dia; "carnaval" (segunda e terça) e
   *  "corpus christi" mudam de data todo ano e são calculados pela Páscoa. Devolve 'MM-DD', 'AAAA-MM-DD', 'carnaval', 'corpus'. */
  function parseExtraHolidays(txt) {
    const out = [];
    for (const raw of String(txt || '').split(/[\s,;]+/)) {
      const s = raw.trim(); if (!s) continue;
      let m = s.match(/^(\d{1,2})\/(\d{1,2})$/);
      if (m) { if (validDate(2000, +m[2], +m[1])) out.push(`${pad2(m[2])}-${pad2(m[1])}`); continue; }   // 2000: aceita 29/02
      m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
      if (m) { let y = +m[3]; if (y < 100) y += 2000; if (validDate(y, +m[2], +m[1])) out.push(ymd(y, +m[2], +m[1])); continue; }
      const w = norm(s);
      if (w === 'carnaval') out.push('carnaval'); else if (w === 'corpus') out.push('corpus');
    }
    return [...new Set(out)];
  }
  function isHoliday(date, extra) {
    const md = date.slice(5); extra = extra || [];
    if (FIXED_HOLIDAYS.includes(md) || extra.includes(md) || extra.includes(date)) return true;
    const pascoa = dayNum(easter(+date.slice(0, 4))), d = dayNum(date);
    if (d === pascoa - 2) return true;                                                   // sexta-feira santa
    if (extra.includes('carnaval') && (d === pascoa - 48 || d === pascoa - 47)) return true;   // segunda e terça de Carnaval
    return extra.includes('corpus') && d === pascoa + 60;                                // Corpus Christi
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
      const viraramVideo = new Set();   // procedimentos que o "VLP" solto já transformou na versão por vídeo
      for (const p of procs) {
        if (viraramVideo.has(p)) continue;
        if (p.term.name === 'Videolaparoscopia' && (res.procs.length || procs.length > 1)) {
          // "VLP" solto junto de outro procedimento: vira modificador dele. Vale primeiro o procedimento do mesmo trecho
          // ("VLP colecisto"); sem ele, o do trecho anterior ("Colecisto - VLP"). O procedimento base não entra de novo.
          const doTrecho = procs.find((q) => q !== p && q.term.name !== 'Videolaparoscopia' && !viraramVideo.has(q));
          const base = doTrecho || lastProc;
          if (base) {
            const variant = index.phrases.find((ph) => ph.term.type === T.PROC && ph.alias === base.alias + ' vlp');
            if (variant) {
              const i = res.procs.indexOf(base.term.name);
              if (i >= 0) res.procs[i] = variant.term.name; else if (!res.procs.includes(variant.term.name)) res.procs.push(variant.term.name);
              lastProc = { term: variant.term, alias: variant.alias };
              if (doTrecho) viraramVideo.add(doTrecho);
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
  // o WhatsApp acrescenta este aviso no fim de uma mensagem editada
  const EDIT_RE = /\s*<\s*(?:esta mensagem foi editada|mensagem editada|this message was edited|message edited|este mensaje fue editado|mensaje editado)\s*>\s*/gi;

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
      let editada = false; t = stripMarks(t).replace(EDIT_RE, () => { editada = true; return ' '; });
      msg.text = t.replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim();
      if (editada) msg.editada = true;
      msg.files = files; msg.photos = files.filter((f) => IMG_EXT.test(f)); msg.omitted = omitted;
      msg.system = msg.system || (msg.lrm && !files.length && !omitted && SYSTEM_RE.test(msg.text));
      const base = `${msg.date}T${msg.time}:${pad2(msg.sec)}|${norm(msg.text).slice(0, 48)}|${files.length + omitted}`;
      const n = (seen.get(base) || 0) + 1; seen.set(base, n);
      msg.key = base + '#' + n;
      delete msg.raw; delete msg.lrm;
    }
    return { chatName, messages: msgs };
  }

  /** Lê de volta a chave de uma mensagem: data, hora, começo do texto (sem acento) e quantos arquivos ela tinha.
   *  Serve para mostrar uma mensagem que o app ignora sem guardar a conversa. Chave de foto solta pode ter "~n". */
  function describeKey(key) {
    const m = String(key || '').match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}):(\d{2})\|([a-z0-9 ]*)\|(\d+)#(\d+)(?:~(\d+))?$/);
    if (!m) return null;
    return { date: m[1], time: m[2], seg: m[3], texto: m[4], arquivos: +m[5], foto: m[7] != null ? +m[7] : null };
  }
  /** O "lugar" de uma mensagem na conversa: data, hora com segundos e quantos arquivos. Não muda quando a legenda é editada. */
  function keySlot(key) { const d = describeKey(key); return d && d.foto == null ? `${d.date}T${d.time}:${d.seg}|${d.arquivos}` : null; }
  /** Legenda editada: o texto mudou, então a chave mudou. Acha a ficha da mesma mensagem pelo lugar dela na conversa
   *  (hora exata e número de arquivos). Só devolve quando há uma única ficha nesse lugar. */
  function findEdited(entry, records) {
    const s = keySlot(entry.key); if (!s) return null;
    const c = records.filter((r) => r.key && r.key !== entry.key && [r.key, ...(r.chavesAntigas || [])].some((k) => keySlot(k) === s));
    return c.length === 1 ? c[0] : null;
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
        const ent = { key: m.key, date: m.date, time: m.time, sec: m.sec, caption: txt, photos: [], omitted: 0, amends: [], t: tmin(m), editada: !!m.editada };
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
        const ent = { key: m.key, date: pending[0].date, time: pending[0].time, sec: pending[0].sec, caption: txt, photos: [], omitted: 0, amends: [], t: tmin(m), editada: !!m.editada };
        for (const p of pending) { ent.photos.push(...p.photos); ent.omitted += p.omitted; }
        pending = []; entries.push(ent); last = ent; continue;
      }
      flush();
      const ent = { key: m.key, date: m.date, time: m.time, sec: m.sec, caption: txt, photos: [], omitted: 0, amends: [], t: tmin(m), textOnly: true, editada: !!m.editada };
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

  /** Sem hora (nem dia) na legenda, a hora do envio não vira hora da cirurgia. Só vale perguntar quando ela muda o valor:
   *  enviada de madrugada (a cirurgia pode ter sido no dia anterior) ou entre 19h e 7h em dia útil (o adicional de 30%
   *  depende da hora). No fim de semana e no feriado o dia inteiro conta, e de dia o mais provável é o horário normal. */
  function avisosDoEnvio(date, time, extraHol) {
    if (!date || !time) return [];
    const h = +time.slice(0, 2);
    if (h < 6) return ['Confira a data'];
    if (isUrgent(date, null, extraHol) !== true && (h >= 19 || h < 7)) return ['Confira a hora'];
    return [];
  }
  function recordFromEntry(e, index, opts) {
    opts = opts || {};
    const p = parseCaption(e.caption, index, e.date);
    const rec = {
      id: uid('r'), key: e.key, origem: 'whatsapp', grupo: opts.chatName || '',
      date: p.date || e.date, time: p.time || null,
      msgDate: e.date, msgTime: e.time,
      procs: p.procs.slice(), hosp: p.hosp, cols: p.cols.slice(), conv: p.conv, funcao: null,
      valorPrevisto: p.valor, status: 'aberto', recebido: null, rep: [],
      devido: p.valor != null ? p.valor : null, devidoOrigem: p.valor != null ? 'combinado' : null, pagamentos: [],
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
    if (!p.time && !p.date) rec.revisar.push(...avisosDoEnvio(e.date, e.time, opts.feriados));
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
      // só a data, sem fração do dia: a hora fica em branco, e não meia-noite (que contaria como urgência)
      const temHora = v - Math.floor(v) > 1 / 172800;
      return { date: ymd(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate()), time: temHora ? `${pad2(dt.getUTCHours())}:${pad2(dt.getUTCMinutes())}` : null };
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
    // só o nome exato da coluna: "Conta paciente" e "Carteira do beneficiário" são números, não o nome
    paciente: ['paciente', 'nome do paciente', 'nome paciente', 'beneficiario', 'nome do beneficiario'],
    // a médica que recebe o repasse (a mesma em todas as linhas); só o nome exato, para não pegar "Médico executor"
    medico: ['medico', 'medica', 'medico repasse', 'favorecido'],
  };
  const SO_NOME_EXATO = new Set(['data', 'valor', 'paciente', 'medico']);
  const FUNCAO_RE = /auxiliar|cirurgi|anestes|instrument|principal|assistente/i;
  const CONVENIO_RE = /\b(unimed|saude|plano|amil|fusex|bradesco|sulamerica|cassi|geap|intercambio|seguros?|convenio|particular)\b/;
  /** Lê as linhas do repasse, com o nome do paciente (desde a 1.14). Descarta atendimento e conta. */
  function parseRepasse(rows, fileName) {
    let hi = -1, map = null;
    for (let i = 0; i < Math.min(rows.length, 15); i++) {
      const cells = (rows[i] || []).map((c) => norm(c));
      const m = {};
      for (const [k, names] of Object.entries(HEADERS)) {
        let idx = -1;
        for (const nm of names) { idx = cells.findIndex((c) => c === nm); if (idx >= 0) break; }
        if (idx < 0 && !SO_NOME_EXATO.has(k)) for (const nm of names) { idx = cells.findIndex((c) => c && c.includes(nm) && !c.includes('paciente')); if (idx >= 0) break; }
        if (idx >= 0) m[k] = idx;
      }
      if (m.data != null && m.procedimento != null && m.valor != null) { hi = i; map = m; break; }
    }
    if (hi < 0) throw new Error('Não encontrei as colunas de data, procedimento e valor nesta planilha.');
    // Conferência pelo conteúdo: há planilhas com o cabeçalho fora do lugar. Na de dez/2025 falta um título antes de
    // "Função médico": dali em diante, cada título fica uma coluna à esquerda dos dados ("Medico" em cima da categoria do
    // plano, "Médico executor" em cima da médica, e o colega sem título).
    const dados = rows.slice(hi + 1).filter((r) => r && excelDate(r[map.data]));
    const preenchidos = (i) => dados.map((r) => r[i]).filter((v) => v != null && String(v).trim() !== '');
    // a função é a coluna com "Primeiro Auxiliar", "Cirurgião"...; se o título dela está em cima de números, vale a coluna
    // do conteúdo, e os títulos dali em diante andam junto com ela. Texto de função com outras palavras fica como está.
    const ehFuncao = (i) => { const v = preenchidos(i); return v.length > 0 && v.filter((x) => typeof x !== 'number' && FUNCAO_RE.test(String(x))).length >= v.length * 0.8; };
    const soNumeros = (i) => { const v = preenchidos(i); return v.length > 0 && v.every((x) => typeof x === 'number' || /^[\d.,\s-]+$/.test(String(x))); };
    if (map.funcao == null || soNumeros(map.funcao)) {
      const n = Math.max(0, ...dados.map((r) => r.length)); let achou = null;
      for (let i = 0; i < n && achou == null; i++) if (i !== map.procedimento && ehFuncao(i)) achou = i;
      if (achou != null && map.funcao != null) {
        const desde = map.funcao, desvio = achou - map.funcao;
        for (const k of Object.keys(map)) if (k !== 'funcao' && map[k] >= desde) map[k] += desvio;
      }
      map.funcao = achou;
    }
    // o colega é uma pessoa: "Médico executor" com nome de convênio ("Unimed...") é coluna lida no lugar errado
    if (map.executor != null) { const v = preenchidos(map.executor).map((x) => norm(x)); if (v.length && v.filter((x) => CONVENIO_RE.test(x)).length >= v.length / 2) map.executor = null; }
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
        paciente: map.paciente != null ? nomeDaPlanilha(r[map.paciente]) : null,
      });
      // o executor igual à médica da planilha é ela mesma: não é colega
      const l = lines[lines.length - 1];
      if (l.exec && map.medico != null && r[map.medico] && norm(l.exec) === norm(r[map.medico])) l.exec = null;
    }
    const name = String(fileName || '');
    const num = (name.match(/repasse\D{0,5}(\d{3,})/i) || [])[1] || null;
    const comp = (name.match(/comp[^a-z0-9]{0,3}(\d{1,2}(?:[\/.-]\d{2,4})?)/i) || [])[1] || null;
    const total = round2(lines.reduce((s, l) => s + l.valor, 0));
    const sig = lines.map((l) => `${l.date}${l.time}${l.cod}${l.valor}`).join('|');
    let h = 0; for (let i = 0; i < sig.length; i++) h = (h * 31 + sig.charCodeAt(i)) | 0;
    return { id: num ? 'rep' + num : 'rep' + (h >>> 0).toString(36), numero: num, comp, nome: name, lines, total };
  }

  // ---- planilha antiga (item 39) ----
  // A competência vem no nome do arquivo ("Comp._12-2025", "Comp._03"). Sem o ano, vale o primeiro mês com esse número a
  // partir da cirurgia mais nova da planilha: a competência nunca é antes das cirurgias que ela paga. Devolve 'aaaa-mm'.
  function mesDaCompetencia(comp, ultimaCirurgia) {
    const m = String(comp || '').match(/^(\d{1,2})(?:\D+(\d{2}|\d{4}))?$/);
    if (!m || +m[1] < 1 || +m[1] > 12) return null;
    const mes = +m[1];
    if (m[2]) return `${m[2].length === 2 ? '20' + m[2] : m[2]}-${pad2(mes)}`;
    if (!/^\d{4}-\d{2}/.test(ultimaCirurgia || '')) return null;
    const ano = +ultimaCirurgia.slice(0, 4);
    return `${mes >= +ultimaCirurgia.slice(5, 7) ? ano : ano + 1}-${pad2(mes)}`;
  }
  /** Planilha antiga: o dinheiro dela não caiu hoje. O repasse cai no mês da competência ou no seguinte; com a competência
   *  de dois meses atrás ou mais, a planilha é antiga. Sem a competência no nome, vale a cirurgia mais nova com mais de 100 dias. */
  function planilhaAntiga(rep, hoje) {
    const ult = ((rep && rep.lines) || []).reduce((m, l) => (l.date > m ? l.date : m), '');
    if (!ult) return false;
    const comp = mesDaCompetencia(rep.comp, ult);
    if (comp) return (+hoje.slice(0, 4) - +comp.slice(0, 4)) * 12 + (+hoje.slice(5, 7) - +comp.slice(5, 7)) >= 2;
    return dayNum(hoje) - dayNum(ult) > 100;
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
    // mesmo primeiro nome: pode ser outra pessoa, então pede confirmação. Se o colega já tem outro nome completo com esse
    // primeiro nome, o mais provável é que seja outra pessoa (outroNome).
    for (const t of cols) for (const a of [norm(t.name), ...(t.aliases || [])]) if (a && (n.startsWith(a + ' ') || a.split(' ')[0] === first && a.length > 2)) {
      const completos = [norm(t.name), ...(t.aliases || [])].filter((x) => x.includes(' ') && x.split(' ')[0] === first);
      return { term: t, how: 'primeiro-nome', outroNome: completos.length > 0 };
    }
    for (const t of cols) for (const a of [norm(t.name), ...(t.aliases || [])]) {
      const af = a.split(' ')[0];
      if (af.length >= 4 && first.length >= 4 && levenshtein(af, first) <= 1) return { term: t, how: 'parecido' };
    }
    return null;
  }

  // ---------- nome do paciente (item 38) ----------
  const PARTICULAS = new Set(['da', 'das', 'de', 'do', 'dos', 'e', 'di', 'du', 'del', 'della', 'van', 'von']);
  /** Nome que veio da planilha: espaços arrumados; TUDO EM MAIÚSCULAS vira nome próprio ("Fulana de Tal"). Número ou
   *  vazio: null. */
  function nomeDaPlanilha(v) {
    const t = String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
    if (!t || !/\p{L}/u.test(t)) return null;
    if (t !== t.toLocaleUpperCase('pt-BR')) return t;
    return t.toLocaleLowerCase('pt-BR').split(' ').map((w, i) => (i > 0 && PARTICULAS.has(w) ? w
      : w.replace(/(^|['’-])(\p{L})/gu, (m, p, c) => p + c.toLocaleUpperCase('pt-BR')))).join(' ');
  }
  const partesDoNome = (s) => norm(s || '').split(' ').filter((w) => w && !PARTICULAS.has(w));
  /** É a mesma pessoa? true: o mesmo nome, ou o nome curto dentro do completo, com o mesmo primeiro nome ("Fulana Exemplo"
   *  e "Fulana de Tal Exemplo"; iniciais valem). null: não dá para saber (falta um dos nomes, ou o nome curto está dentro do
   *  completo mas sem o primeiro nome, como "Tal"). false: o nome curto não está dentro do completo ("Fulana Teste" e
   *  "Fulana de Tal"): pede conferência. */
  function mesmoPaciente(a, b) {
    const x = partesDoNome(a), y = partesDoNome(b);
    if (!x.length || !y.length) return null;
    if (x.join(' ') === y.join(' ')) return true;
    const [curto, longo] = x.length <= y.length ? [x, y] : [y, x];
    const tem = (w) => longo.some((v) => v === w || (w.length === 1 && v.startsWith(w)));
    if (!curto.every(tem)) return false;
    return curto[0] === longo[0] ? true : null;
  }

  // ---------- cruzamento repasse x cirurgias ----------
  // Um ato = linhas do mesmo dia, hora, médico executor e paciente (quando a planilha tem o nome: duas pessoas nunca são a
  // mesma cirurgia). separar: chaves de atos que viram um ato por linha.
  function groupActs(lines, separar) {
    const acts = new Map();
    for (const l of lines) {
      const k = `${l.date}|${l.time || ''}|${norm(l.exec || '')}` + (l.paciente ? '|' + norm(l.paciente) : '');
      if (!acts.has(k)) acts.set(k, { key: k, date: l.date, time: l.time, exec: l.exec, lines: [] });
      acts.get(k).lines.push(l);
    }
    const out = [];
    for (const a of acts.values()) {
      if (a.lines.length > 1 && separar && separar.has(a.key)) a.lines.forEach((l, i) => out.push({ ...a, key: a.key + '#' + i, lines: [l], separado: true }));
      else out.push(a);
    }
    return out;
  }
  // Para casar a planilha com as fichas, a hora do envio ainda ajuda como pista (a ordem das mensagens segue a ordem das
  // cirurgias), mesmo sem valer como hora da cirurgia.
  const horaPista = (rec) => rec.time || (rec.msgTime && rec.msgDate === rec.date ? rec.msgTime : null);
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
    const rt = horaPista(rec);
    if (act.time && rt && dd === 0) {
      const dm = Math.abs(minutesOf(act.date, act.time) - minutesOf(rec.date, rt));
      if (dm <= 90) s += 2; else if (dm <= 240) s += 1;
    }
    if (ctx.hosp && rec.hosp && rec.hosp !== ctx.hosp) s -= 3;
    // o nome do paciente decide entre cirurgias parecidas; outra pessoa quase nunca é a mesma cirurgia
    const mp = mesmoPaciente(act.paciente, rec.paciente);
    if (mp === true) s += 5; else if (mp === false) s -= 6;
    return s;
  }
  /** Propõe pares ato-do-repasse ↔ cirurgia. Não grava nada.
   *  1ª rodada: cirurgias a receber (inclui as pagas em parte), como sempre. 2ª rodada: o que sobrou e casa muito bem
   *  (mesmo dia, colega e procedimento) com uma cirurgia já paga vira proposta de complemento, em vez de cirurgia nova.
   *  opts.ligar: Map chave do ato -> id da cirurgia (ligada à mão) ou null (cirurgia nova). opts.separar: chaves de atos
   *  para separar, uma cirurgia por linha. Cada ato volta com certeza ('alta', 'confira', 'complemento', 'manual' ou
   *  'novo'), outras (cirurgias parecidas, quando há mais de uma candidata) e as diferenças de data e de valor combinado. */
  function planRepasse(rep, records, index, opts) {
    opts = opts || {};
    const prep = (a) => {
      const m = mapExecutor(a.exec, index);
      a.col = m ? m.term.name : null; a.colHow = m ? m.how : null;
      a.procNames = a.lines.map((l) => { const t = mapRepasseProc(l.proc, index); return t ? t.name : sentenceCase(l.proc); });
      a.valor = round2(a.lines.reduce((s, l) => s + l.valor, 0));
      a.paciente = (a.lines.find((l) => l.paciente) || {}).paciente || null;
      return a;
    };
    const abertas = records.filter(emAberto);
    const pagas = records.filter((r) => situacao(r) === 'recebido');
    // Sem hora na planilha, duas cirurgias do mesmo dia e colega viram um ato só. Quando o mesmo procedimento aparece
    // mais de uma vez no ato e o app tem pelo menos essa quantidade de cirurgias dele naquele dia, são cirurgias diferentes.
    const separar = new Set(opts.separar || []);
    const auto = new Set();
    for (const a of groupActs(rep.lines).map(prep)) {
      if (a.time || a.lines.length < 2 || separar.has(a.key) || a.paciente) continue;   // com o nome, já se sabe que é a mesma pessoa
      const cont = new Map(); for (const p of a.procNames) cont.set(p, (cont.get(p) || 0) + 1);
      for (const [p, k] of cont) {
        if (k < 2) continue;
        const fam = famOf(index, p);
        const doDia = abertas.filter((r) => r.date === a.date && (!a.col || !(r.cols || []).length || r.cols.includes(a.col)) && (r.procs || []).some((q) => q === p || famOf(index, q) === fam));
        if (doDia.length >= k) { separar.add(a.key); auto.add(a.key); }
      }
    }
    const acts = groupActs(rep.lines, separar).map(prep);
    for (const a of acts) if (a.separado && auto.has(a.key.replace(/#\d+$/, ''))) a.separadoSozinho = true;
    const ligar = opts.ligar || new Map();
    const usedA = new Set(), usedR = new Set();
    acts.forEach((a, ai) => {
      if (!ligar.has(a.key)) return;
      usedA.add(ai); const id = ligar.get(a.key); const r = id ? records.find((x) => x.id === id) : null;
      if (r && !usedR.has(r.id)) { usedR.add(r.id); a.recordId = r.id; a.certeza = 'manual'; a.complemento = !emAberto(r); }
      else { a.recordId = null; a.certeza = 'novo'; a.manual = true; }
    });
    const scores = new Map();   // ato -> [{ r, sc }]
    const parear = (cands, minimo, marcar) => {
      const pairs = [];
      acts.forEach((a, ai) => {
        if (usedA.has(ai)) return;
        for (const r of cands) {
          const sc = scorePair(a, r, { index, hosp: opts.hosp });
          if (sc < minimo) continue;
          pairs.push({ ai, r, sc });
          if (!scores.has(ai)) scores.set(ai, []); scores.get(ai).push({ r, sc });
        }
      });
      pairs.sort((x, y) => y.sc - x.sc || Math.abs(minutesOf(acts[x.ai].date, acts[x.ai].time) - minutesOf(x.r.date, horaPista(x.r))) - Math.abs(minutesOf(acts[y.ai].date, acts[y.ai].time) - minutesOf(y.r.date, horaPista(y.r))));
      for (const p of pairs) {
        if (usedA.has(p.ai) || usedR.has(p.r.id)) continue;
        usedA.add(p.ai); usedR.add(p.r.id);
        const a = acts[p.ai]; a.recordId = p.r.id; a.score = p.sc; marcar(a, p);
      }
    };
    parear(abertas, 5, (a, p) => { a.certeza = p.sc >= 9 ? 'alta' : 'confira'; });
    parear(pagas, 9, (a) => { a.certeza = 'complemento'; a.complemento = true; });
    const mesmo = opts.mesmo || new Map();
    acts.forEach((a, ai) => {
      if (!a.recordId) { a.recordId = null; if (!a.certeza) a.certeza = 'novo'; a.outras = []; return; }
      const r = records.find((x) => x.id === a.recordId);
      // Cirurgia já paga só com pagamento registrado por ela: a linha pode ser esse mesmo pagamento (não soma) ou um
      // complemento (soma). Parte de "mesmo" quando o valor é igual ao que ela registrou ou quando ela não anotou o valor.
      if (a.complemento) {
        const pg = Array.isArray(r.pagamentos) ? r.pagamentos : [];
        a.podeSerMesmo = pg.length > 0 && pg.every((p) => p.origem !== 'repasse');
        a.mesmo = a.podeSerMesmo && (mesmo.has(a.key) ? !!mesmo.get(a.key) : pg.some((p) => p.valor == null) || Math.abs(totalRecebido(r) - a.valor) < 0.01);
      }
      a.outras = a.certeza === 'manual' ? [] : (scores.get(ai) || []).filter((x) => x.r.id !== a.recordId && x.sc >= Math.max(5, (a.score || 0) - 1)).map((x) => x.r.id);
      a.difData = r.date !== a.date ? r.date : null;
      const mp = mesmoPaciente(a.paciente, r.paciente);
      a.mesmoPaciente = mp === true; a.difPaciente = mp === false ? r.paciente : null;
      a.difValor = r.devidoOrigem === 'combinado' && r.devido != null && Math.abs(r.devido - a.valor) > 0.009 ? r.devido : null;
    });
    return acts;
  }

  // ---------- modelo financeiro ----------
  // Cada cirurgia guarda, separados: o valor devido (devido, com a origem: 'combinado' por ela ou 'repasse'; null = a
  // definir) e a lista de pagamentos (valor, data e origem: 'manual' ou 'repasse', com o número da planilha). O total
  // recebido, o saldo e a situação são calculados. status, recebido e valorPrevisto continuam gravados como espelho
  // (compatFinanceiro), para a versão anterior do app ler os dados se for preciso voltar.
  const totalRecebido = (r) => round2((r.pagamentos || []).reduce((s, p) => s + (p.valor || 0), 0));
  /** Paga por inteiro? Pagamento sem valor anotado ("Já recebi" sem valor) conta como quitação. Com valor devido, quita
   *  quando os pagamentos chegam nele; sem valor devido, quita, a não ser que o último pagamento seja só uma parte. */
  function quitada(r) {
    const pg = r.pagamentos || [];
    if (!pg.length) return false;
    if (pg.some((p) => p.valor == null)) return true;
    if (r.devido != null) return r.devido - totalRecebido(r) < 0.005;
    return !pg[pg.length - 1].parcial;
  }
  /** 'aberto' (a receber), 'parcial', 'recebido' ou 'semcobranca'. Ficha no formato antigo: pelo status. */
  function situacao(r) {
    if (r.status === 'semcobranca') return 'semcobranca';
    if (!Array.isArray(r.pagamentos)) return r.status === 'recebido' ? 'recebido' : 'aberto';
    if (!r.pagamentos.length) return 'aberto';
    return quitada(r) ? 'recebido' : 'parcial';
  }
  const emAberto = (r) => { const s = situacao(r); return s === 'aberto' || s === 'parcial'; };
  /** Do formato antigo (status + recebido + valorPrevisto) para o novo. Devolve true quando mudou alguma coisa.
   *  Também acerta a ficha marcada como paga por uma versão antiga do app, depois de voltar de versão. */
  function migrarFinanceiro(r) {
    const rp = r.recebido;
    const doAntigo = () => ({ id: uid('g'), valor: rp && rp.valor != null ? rp.valor : null, data: (rp && rp.data) || null,
      origem: (rp && rp.origem) || 'manual', repId: (rp && rp.repId) || null, fonte: (rp && rp.fonte) || null });
    if (!Array.isArray(r.pagamentos)) {
      r.pagamentos = r.status === 'recebido' ? [doAntigo()] : [];
      if (r.status === 'recebido' && rp && rp.origem === 'repasse' && rp.valor != null) {
        r.devido = rp.valor; r.devidoOrigem = 'repasse';
        if (r.valorPrevisto != null) r.devidoAntes = { valor: r.valorPrevisto, origem: 'combinado' };
      } else if (r.status !== 'recebido' && r.valorPrevisto != null) { r.devido = r.valorPrevisto; r.devidoOrigem = 'combinado'; }
      else { r.devido = null; r.devidoOrigem = null; }
      if (r.origem === 'repasse' && rp && rp.repId && !r.repCriador) r.repCriador = rp.repId;
      return true;
    }
    if (r.status === 'recebido' && !r.pagamentos.length && rp) { r.pagamentos.push(doAntigo()); return true; }
    return false;
  }
  // assinatura do espelho: se a versão anterior do app mexer no dinheiro da ficha, ela deixa de bater
  const assinatura = (r) => JSON.stringify([r.status || null, r.recebido ? [r.recebido.valor != null ? r.recebido.valor : null, r.recebido.data || null, r.recebido.origem || null, r.recebido.repId || null] : null, r.valorPrevisto != null ? r.valorPrevisto : null]);
  /** Ao abrir o app: a ficha que a versão anterior mexeu (depois de voltar de versão) entra no modelo novo, sem perder o que
   *  ela fez lá: marcou como recebida (o pagamento entra), desfez o pagamento ou a planilha (os pagamentos saem), corrigiu
   *  o valor (fica o valor corrigido) ou mudou o valor combinado. Devolve true quando mudou alguma coisa. */
  function reconciliarFinanceiro(r) {
    if (!Array.isArray(r.pagamentos)) return migrarFinanceiro(r);
    if (!r.espelho || r.espelho === assinatura(r)) return false;
    let antes; try { antes = JSON.parse(r.espelho); } catch (e) { return false; }
    const [stA, recA, vpA] = antes; const rp = r.recebido;
    const doAntigo = () => ({ id: uid('g'), valor: rp && rp.valor != null ? rp.valor : null, data: (rp && rp.data) || null,
      origem: (rp && rp.origem) || 'manual', repId: (rp && rp.repId) || null, fonte: (rp && rp.fonte) || null });
    if (r.status === 'recebido' && stA !== 'recebido') r.pagamentos.push(doAntigo());           // marcada como recebida lá
    else if (r.status !== 'recebido' && stA === 'recebido') {                                    // pagamento ou planilha desfeitos lá
      r.pagamentos = []; delete r.substituidos;
      if (r.devidoOrigem === 'repasse') { const ant = r.devidoAntes || {}; r.devido = ant.valor != null ? ant.valor : null; r.devidoOrigem = ant.origem || null; delete r.devidoAntes; }
    } else if (r.status === 'recebido' && JSON.stringify(recA) !== JSON.stringify(JSON.parse(assinatura(r))[1])) {      // valor corrigido lá
      r.pagamentos = [doAntigo()];
      if (r.devidoOrigem === 'repasse' && rp && rp.valor != null) r.devido = rp.valor;
    }
    const vp = r.valorPrevisto != null ? r.valorPrevisto : null;
    if (vp !== vpA && r.devidoOrigem !== 'repasse') { r.devido = vp; r.devidoOrigem = vp != null ? 'combinado' : null; }
    // recebida lá continua recebida aqui: pela planilha, o devido é o que ela pagou; à mão, sem valor devido (como na migração)
    if (r.status === 'recebido' && (!quitada(r) || (stA !== 'recebido' && rp && rp.origem === 'repasse'))) {
      if (rp && rp.origem === 'repasse') {
        if (r.devidoOrigem !== 'repasse') r.devidoAntes = { valor: r.devido != null ? r.devido : null, origem: r.devidoOrigem || null };
        r.devido = totalRecebido(r); r.devidoOrigem = 'repasse';
      } else { r.devido = null; r.devidoOrigem = null; }
    }
    if (r.origem === 'repasse' && rp && rp.repId && !r.repCriador) r.repCriador = rp.repId;
    delete r.espelho;
    return true;
  }
  /** Espelho gravado junto em toda ficha: status, recebido e valorPrevisto como a versão 1.8 entende. */
  function compatFinanceiro(r) {
    if (!r || !Array.isArray(r.pagamentos)) return r;
    const s = situacao(r);
    if (s !== 'semcobranca') r.status = s === 'recebido' ? 'recebido' : 'aberto';
    const pg = r.pagamentos;
    if (r.status === 'recebido' && pg.length) {
      const ult = pg[pg.length - 1]; const rep = [...pg].reverse().find((p) => p.origem === 'repasse');
      r.recebido = { valor: pg.some((p) => p.valor == null) ? null : totalRecebido(r), data: ult.data || null,
        origem: rep ? 'repasse' : ult.origem || 'manual', repId: rep ? rep.repId : null, fonte: ult.fonte || null };
    } else r.recebido = null;
    if (r.devidoOrigem === 'combinado') r.valorPrevisto = r.devido;
    else if (r.status !== 'recebido') r.valorPrevisto = null;
    r.espelho = assinatura(r);
    return r;
  }
  /** Um ato da planilha paga esta cirurgia. Entra o pagamento, e o valor devido passa a ser o que a planilha identificou,
   *  somado ao que já tinha entrado (num complemento, o devido cresce junto e o saldo continua zero). O devido de antes
   *  fica guardado para desfazer a planilha. */
  function pagarPeloRepasse(r, a, linhas, pag, o) {
    if (!Array.isArray(r.pagamentos)) migrarFinanceiro(r);
    // o.substituir: a linha é o mesmo pagamento que ela já tinha registrado. O dela sai da lista (fica guardado para
    // desfazer a planilha) e o da planilha entra no lugar, sem somar.
    if (o && o.substituir) {
      const dela = r.pagamentos.filter((p) => p.origem !== 'repasse');
      r.substituidos = [...(r.substituidos || []), ...dela.map((p) => ({ ...p, por: pag.repId }))];
      r.pagamentos = r.pagamentos.filter((p) => p.origem === 'repasse');
    }
    const base = r.devidoOrigem === 'repasse' && r.devido != null ? r.devido : totalRecebido(r);
    if (r.devidoOrigem !== 'repasse' && !r.devidoAntes) r.devidoAntes = { valor: r.devido != null ? r.devido : null, origem: r.devidoOrigem || null };
    r.devido = round2(base + a.valor); r.devidoOrigem = 'repasse';
    r.pagamentos.push(pag); r.rep = [...(r.rep || []), ...linhas];
    if (!r.paciente && a.paciente) { r.paciente = a.paciente; r.pacienteDaPlanilha = pag.repId; }   // o nome que faltava
    if (r.status === 'semcobranca') r.status = 'aberto';
    return r;
  }
  /** Tira desta cirurgia o que a planilha repId pôs: pagamentos, linhas e, quando não sobra pagamento de planilha, a data,
   *  a hora e o valor devido de antes. Devolve 'apagar' (criada por ela e sem outro pagamento), 'mudou' ou null. */
  function desfazerRepasseNaFicha(r, repId) {
    if (!Array.isArray(r.pagamentos)) migrarFinanceiro(r);
    const saem = r.pagamentos.filter((p) => p.origem === 'repasse' && p.repId === repId);
    if (!saem.length) return null;
    r.pagamentos = r.pagamentos.filter((p) => !saem.includes(p));
    const voltam = (r.substituidos || []).filter((p) => p.por === repId);
    if (voltam.length) {
      r.pagamentos.push(...voltam.map(({ por, ...p }) => p));
      r.substituidos = r.substituidos.filter((p) => p.por !== repId); if (!r.substituidos.length) delete r.substituidos;
    }
    r.rep = (r.rep || []).filter((l) => l.repId !== repId);
    const outroRep = r.pagamentos.find((p) => p.origem === 'repasse');
    if (r.origem === 'repasse' && r.repCriador === repId) {
      if (!r.pagamentos.length) return 'apagar';
      r.repCriador = outroRep ? outroRep.repId : null;
    }
    if (r.devidoOrigem === 'repasse') {
      if (outroRep) r.devido = round2(r.devido - saem.reduce((s, p) => s + (p.valor || 0), 0));
      else { const ant = r.devidoAntes || { valor: null, origem: null }; r.devido = ant.valor; r.devidoOrigem = ant.origem; delete r.devidoAntes; }
    }
    if (r.pacienteDaPlanilha === repId) { delete r.paciente; delete r.pacienteDaPlanilha; }
    if (!outroRep && r.antesDaPlanilha) {
      const ap = r.antesDaPlanilha; r.date = ap.date; r.time = ap.time;
      r.revisar = [...new Set([...(r.revisar || []), ...(ap.avisos || [])])];
      delete r.antesDaPlanilha; delete r.horaDaPlanilha;
    }
    return 'mudou';
  }

  // ---------- prazo de pagamento e previsão ----------
  // Prazo de cada pagador (hospital, convênio, colega), pelo histórico: dias entre a cirurgia e o primeiro pagamento com
  // valor. "Já recebi" sem valor (marcadas como recebidas de uma vez, antes de usar o app) não conta: a data não é a do
  // dinheiro. Um pagador precisa de pelo menos 3 cirurgias pagas. tipico = mediana (para a previsão); limite = o prazo em
  // que 9 de cada 10 pagamentos chegaram (para "atrasada").
  function prazosDePagamento(records) {
    const grupos = new Map();
    const add = (k, nome, d) => { if (!grupos.has(k)) grupos.set(k, { nome, dias: [] }); grupos.get(k).dias.push(d); };
    for (const r of records) {
      if (!r.date || situacao(r) === 'semcobranca') continue;
      const datas = (r.pagamentos || []).filter((p) => p.valor != null && p.data).map((p) => p.data).sort();
      if (!datas.length) continue;
      const d = dayNum(datas[0]) - dayNum(r.date);
      if (d < 0 || d > 730) continue;      // data estranha: pagamento antes da cirurgia ou depois de 2 anos
      if (r.hosp) add('hosp:' + norm(r.hosp), r.hosp, d);
      if (r.conv) add('conv:' + norm(r.conv), r.conv, d);
      for (const c of r.cols || []) if (c) add('col:' + norm(c), c, d);
    }
    const out = new Map();
    for (const [k, g] of grupos) {
      if (g.dias.length < 3) continue;
      const ds = g.dias.slice().sort((x, y) => x - y);
      out.set(k, { nome: g.nome, n: ds.length, tipico: Math.round(median(ds)), limite: ds[Math.ceil(ds.length * 0.9) - 1] });
    }
    return out;
  }
  /** O prazo que vale para uma cirurgia: o do hospital; sem histórico dele, o do convênio; depois, o do colega. */
  function prazoDe(r, prazos) {
    const chaves = [r.hosp && 'hosp:' + norm(r.hosp), r.conv && 'conv:' + norm(r.conv), ...(r.cols || []).map((c) => c && 'col:' + norm(c))];
    for (const k of chaves) if (k && prazos.has(k)) return prazos.get(k);
    return null;
  }
  /** Depois de quantos dias sem pagamento a cirurgia fica atrasada: o limite do pagador (pelo menos 30 dias) ou, sem
   *  histórico, o padrão de Ajustes. */
  const limiteAtraso = (r, prazos, padrao) => { const p = prazoDe(r, prazos); return p ? Math.max(p.limite, 30) : padrao; };
  /** Quanto deve cair nos próximos 30, 60 e 90 dias, pelo prazo típico de cada pagador. itens: [{ r, valor, aprox }] das
   *  cirurgias a receber. A que já passou do prazo típico, sem estar atrasada, entra nos próximos 30 dias. */
  function previsaoRecebimento(itens, prazos, hoje, padrao) {
    const novo = () => ({ valor: 0, n: 0, aprox: false });
    const faixas = [30, 60, 90].map((ate) => ({ ate, ...novo() }));
    const out = { faixas, depois: novo(), atrasadas: novo(), semPrazo: novo() };
    const h = dayNum(hoje);
    for (const it of itens) {
      const r = it.r; const p = prazoDe(r, prazos); const idade = h - dayNum(r.date);
      let alvo;
      if (idade > limiteAtraso(r, prazos, padrao)) alvo = out.atrasadas;
      else if (!p) alvo = out.semPrazo;
      else { const falta = Math.max(0, p.tipico - idade); alvo = faixas.find((f) => falta <= f.ate) || out.depois; }
      alvo.valor = round2(alvo.valor + (it.valor || 0)); alvo.n++; if (it.aprox) alvo.aprox = true;
    }
    return out;
  }

  // ---------- relatórios (itens 35 e 36) ----------
  // Os totais saem todos daqui, para as telas e o relatório anual baterem entre si (os testes conferem).
  /** Cada pagamento com valor e data. valor: o liberado (o que a planilha pagou, ou o que ela registrou). entrou: o que
   *  caiu na conta. Da planilha em que ela anotou quanto caiu, isso é dividido entre os pagamentos dela na proporção do
   *  liberado (os centavos que sobram vão no maior); dos outros, entrou = valor. */
  function pagamentosComValor(records, repasses) {
    const docs = new Map((repasses || []).filter((d) => d.caiu != null).map((d) => [d.id, d]));
    const out = [], porPlanilha = new Map();
    for (const r of records) for (const p of r.pagamentos || []) {
      if (p.valor == null || !p.data) continue;
      const it = { r, p, mes: p.data.slice(0, 7), valor: round2(p.valor), entrou: round2(p.valor) };
      if (p.origem === 'repasse' && docs.has(p.repId)) { if (!porPlanilha.has(p.repId)) porPlanilha.set(p.repId, []); porPlanilha.get(p.repId).push(it); }
      out.push(it);
    }
    for (const [id, its] of porPlanilha) {
      const caiu = round2(docs.get(id).caiu); const lib = round2(its.reduce((t, x) => t + x.valor, 0));
      if (!(lib > 0)) continue;
      for (const x of its) x.entrou = round2(x.valor * caiu / lib);
      // os centavos que sobram do arredondamento vão no maior pagamento (uma linha de R$ 0,00 continua zero)
      const maior = its.reduce((m, x) => (x.valor > m.valor ? x : m), its[0]);
      maior.entrou = round2(maior.entrou + caiu - its.reduce((t, x) => t + x.entrou, 0));
    }
    return out;
  }
  /** Totais dos relatórios. aberto(r) => { valor, aprox } do que falta receber de uma cirurgia a receber (a mesma conta
   *  do Início). Cirurgia sem cobrança conta na quantidade, sem dinheiro. Uma cirurgia com dois colegas entra nos dois. */
  function relatorio(records, repasses, aberto) {
    const novo = () => ({ n: 0, nRec: 0, nAb: 0, recebido: 0, aReceber: 0, aprox: false, semValor: 0 });
    const totais = { ...novo(), entrou: 0 };
    const mesCir = new Map(), mesPag = new Map(), por = { hospital: new Map(), colega: new Map(), convenio: new Map() };
    const pags = pagamentosComValor(records, repasses);
    const recDe = new Map();
    for (const x of pags) {
      recDe.set(x.r, round2((recDe.get(x.r) || 0) + x.valor));
      if (!mesPag.has(x.mes)) mesPag.set(x.mes, { recebido: 0, entrou: 0, n: 0 });
      const o = mesPag.get(x.mes); o.recebido = round2(o.recebido + x.valor); o.entrou = round2(o.entrou + x.entrou); o.n++;
      totais.entrou = round2(totais.entrou + x.entrou);
    }
    const somar = (m, k, r, s, rec, ab) => {
      if (!m.has(k)) m.set(k, novo());
      const o = m.get(k); o.n++;
      if (s === 'semcobranca') return;
      o.recebido = round2(o.recebido + rec);
      if (s === 'recebido') o.nRec++;
      else { o.nAb++; if (ab && ab.valor != null) { o.aReceber = round2(o.aReceber + ab.valor); if (ab.aprox) o.aprox = true; } else o.semValor++; }
    };
    const diferencas = [];
    for (const r of records) {
      const s = situacao(r); const rec = recDe.get(r) || 0;
      const ab = s === 'aberto' || s === 'parcial' ? aberto(r) : null;
      somar(new Map([['t', totais]]), 't', r, s, rec, ab);
      somar(mesCir, (r.date || '').slice(0, 7), r, s, rec, ab);
      somar(por.hospital, r.hosp || 'Sem hospital', r, s, rec, ab);
      somar(por.convenio, r.conv || 'Sem convênio', r, s, rec, ab);
      for (const c of (r.cols && r.cols.length ? r.cols : ['Sem colega'])) somar(por.colega, c, r, s, rec, ab);
      // diferenças de valor: o combinado com ela × o que a planilha pagou; e o que entrou a mais que o valor devido
      const ant = r.devidoAntes;
      if (r.devidoOrigem === 'repasse' && ant && ant.origem === 'combinado' && ant.valor != null && Math.abs(r.devido - ant.valor) >= 0.01) diferencas.push({ r, tipo: 'combinado', combinado: ant.valor, devido: r.devido, recebido: rec });
      else if (r.devido != null && rec - r.devido > 0.004 && !(r.pagamentos || []).some((p) => p.valor == null)) diferencas.push({ r, tipo: 'a-mais', devido: r.devido, recebido: rec });
    }
    const ordem = (m) => new Map([...m.entries()].sort((a, b) => a[0].localeCompare(b[0])));
    return { totais, mesCirurgia: ordem(mesCir), mesPagamento: ordem(mesPag), por, diferencas: diferencas.sort((a, b) => (b.r.date || '').localeCompare(a.r.date || '')) };
  }
  /** O ano para o Imposto de Renda: o que entrou em cada mês do ano, pela data do pagamento, por fonte pagadora, hospital,
   *  colega e convênio. Fonte pagadora: da planilha, o hospital dela; do pagamento registrado à mão, "Quem pagou" (ou o
   *  hospital da cirurgia). valor: o liberado (bruto); entrou: o que caiu na conta, quando ela anotou. */
  function relatorioAnual(records, repasses, ano) {
    const docs = new Map((repasses || []).map((d) => [d.id, d]));
    const doze = () => Array(12).fill(0);
    const out = { ano: String(ano), meses: doze(), entrou: doze(), total: 0, totalEntrou: 0, n: 0, porFonte: new Map(), porHospital: new Map(), porColega: new Map(), porConvenio: new Map(), itens: [] };
    const add = (m, k, i, v) => { if (!m.has(k)) m.set(k, { meses: doze(), total: 0 }); const o = m.get(k); o.meses[i] = round2(o.meses[i] + v); o.total = round2(o.total + v); };
    for (const x of pagamentosComValor(records, repasses)) {
      if (x.p.data.slice(0, 4) !== out.ano || !x.valor) continue;   // linha de R$ 0,00 (glosa) não é dinheiro que entrou
      const i = +x.p.data.slice(5, 7) - 1; const r = x.r; const v = x.valor;
      out.meses[i] = round2(out.meses[i] + v); out.entrou[i] = round2(out.entrou[i] + x.entrou);
      out.total = round2(out.total + v); out.totalEntrou = round2(out.totalEntrou + x.entrou); out.n++;
      const doc = x.p.origem === 'repasse' ? docs.get(x.p.repId) : null;
      const fonte = x.p.origem === 'repasse' ? (doc && doc.hosp) || r.hosp || 'Planilha de repasse' : x.p.fonte || r.hosp || 'Não informado';
      add(out.porFonte, fonte, i, v); add(out.porHospital, r.hosp || 'Sem hospital', i, v); add(out.porConvenio, r.conv || 'Sem convênio', i, v);
      // cada pagamento, para o contador conferir: data, paciente, procedimento, quem pagou e o valor
      out.itens.push({ data: x.p.data, num: r.num || 0, paciente: r.paciente || '', procs: (r.procs || []).join(' + '), fonte, valor: v, entrou: x.entrou });
      for (const c of (r.cols && r.cols.length ? r.cols : ['Sem colega'])) add(out.porColega, c, i, v);
    }
    const ordem = (m) => new Map([...m.entries()].sort((a, b) => b[1].total - a[1].total || a[0].localeCompare(b[0])));
    for (const k of ['porFonte', 'porHospital', 'porColega', 'porConvenio']) out[k] = ordem(out[k]);
    out.itens.sort((a, b) => a.data.localeCompare(b.data) || a.num - b.num);
    return out;
  }
  /** Anos com pagamento, do mais novo para o mais antigo. */
  const anosComPagamento = (records) => [...new Set(records.flatMap((r) => (r.pagamentos || []).filter((p) => p.valor != null && p.data).map((p) => p.data.slice(0, 4))))].sort().reverse();

  // ---------- lembrete mensal (arquivo de calendário) ----------
  /** Evento que se repete todo mês no dia escolhido, com o ritual do app. Hora local (o Calendário usa o fuso do iPhone).
   *  o: { dia: 1..28, hora: 'HH:MM', hoje: 'AAAA-MM-DD', agora: Date } */
  function lembreteIcs(o) {
    const dia = Math.min(28, Math.max(1, Math.round(+o.dia || 5)));
    const [hh, mm] = String(o.hora || '19:00').split(':').map((x) => pad2(+x || 0));
    let [y, m] = o.hoje.split('-').map(Number);
    if (+o.hoje.slice(8, 10) > dia) { m++; if (m > 12) { m = 1; y++; } }
    const inicio = `${y}${pad2(m)}${pad2(dia)}T${hh}${mm}00`;
    const a = o.agora || new Date();
    const carimbo = `${a.getUTCFullYear()}${pad2(a.getUTCMonth() + 1)}${pad2(a.getUTCDate())}T${pad2(a.getUTCHours())}${pad2(a.getUTCMinutes())}${pad2(a.getUTCSeconds())}Z`;
    const txt = (t) => t.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
    // linhas de no máximo 75 bytes; a continuação começa com um espaço (sem partir uma letra acentuada no meio)
    const dobrar = (linha) => {
      const enc = new TextEncoder(); const partes = []; let atual = '', bytes = 0;
      for (const ch of linha) { const b = enc.encode(ch).length; if (bytes + b > (partes.length ? 74 : 75)) { partes.push(atual); atual = ''; bytes = 0; } atual += ch; bytes += b; }
      partes.push(atual); return partes.join('\r\n ');
    };
    const titulo = 'Controle de Cirurgias: conversa, planilha e backup';
    const passos = '1. Exporte a conversa do grupo do WhatsApp, com as fotos, e traga para o app.\n2. Traga a planilha de repasse do mês.\n3. Faça um backup.';
    return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Controle de Cirurgias//PT-BR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
      'BEGIN:VEVENT', 'UID:lembrete-mensal@controle-de-cirurgias', 'DTSTAMP:' + carimbo, 'DTSTART:' + inicio, 'DURATION:PT20M',
      'RRULE:FREQ=MONTHLY;BYMONTHDAY=' + dia, 'SUMMARY:' + txt(titulo), 'DESCRIPTION:' + txt(passos),
      'BEGIN:VALARM', 'ACTION:DISPLAY', 'TRIGGER:PT0M', 'DESCRIPTION:' + txt(titulo), 'END:VALARM',
      'END:VEVENT', 'END:VCALENDAR'].map(dobrar).join('\r\n') + '\r\n';
  }

  // ---------- estimativas ----------
  // Linhas da mesma cirurgia vindas de planilhas diferentes (complemento, recurso de glosa): somam na linha do mesmo dia,
  // colega e procedimento, para a referência ser o valor que a cirurgia rendeu, e não duas linhas soltas.
  function juntarComplementos(linhas) {
    const out = [], onde = new Map();
    for (const l of linhas) {
      const k = `${l.date}|${norm(l.exec || '')}|${l.procName || ''}`;
      const i = onde.get(k);
      if (i != null && l.repId && out[i].repId && out[i].repId !== l.repId) out[i] = { ...out[i], valor: round2(out[i].valor + l.valor) };
      else { if (i == null) onde.set(k, out.length); out.push({ ...l }); }
    }
    return out;
  }
  function buildRefs(records, extraHol) {
    const byProc = new Map(), byFam = new Map(), byProcConv = new Map();
    const push = (m, k, v) => { if (!m.has(k)) m.set(k, []); m.get(k).push(v); };
    for (const r of records) {
      if (!r.rep || !r.rep.length) continue;
      const acts = groupActs(juntarComplementos(r.rep));
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
    parseCaption, parseChat, describeKey, keySlot, findEdited, groupMessages, collectUnknown, avisosDoEnvio, recordFromEntry,
    zipOpen, zipEntryBlob, zipEntryChecked, zipWrite, crc32, readXlsx, excelDate, parseRepasse,
    mapRepasseProc, mapExecutor, groupActs, planRepasse, buildRefs, estimate, urgencyChecks,
    totalRecebido, quitada, situacao, emAberto, migrarFinanceiro, compatFinanceiro, reconciliarFinanceiro, pagarPeloRepasse, desfazerRepasseNaFicha,
    juntarComplementos, prazosDePagamento, prazoDe, limiteAtraso, previsaoRecebimento, lembreteIcs,
    pagamentosComValor, relatorio, relatorioAnual, anosComPagamento, nomeDaPlanilha, mesmoPaciente, mesDaCompetencia, planilhaAntiga,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Core = api;
})(typeof self !== 'undefined' ? self : this);
