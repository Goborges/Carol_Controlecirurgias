/* Controle de Cirurgias — interface. Depende de Core (core.js). */
(function () {
  'use strict';
  const C = window.Core;
  const PREVIEW = window.APP_MODE === 'preview';
  const VERSION = '1.12';
  const TERMS_VERSION = 1;
  // Modo de teste: o mesmo endereço com ?teste usa outro banco, separado do app de verdade.
  const TESTE = !PREVIEW && /(?:^|[?&])teste(?:[=&]|$)/.test(location.search);
  const DB_NAME = TESTE ? 'registro-cirurgias-teste' : 'registro-cirurgias';
  const DB_VERSION = 2;   // sobe quando o banco ganha uma lista nova (a 2 trouxe miniaturas, lixeira e importações)
  // ================= erros recentes (aparecem no diagnóstico; sem dados das cirurgias) =================
  const ERROS = [];
  function anotaErro(msg, onde) {
    ERROS.push({ em: new Date().toISOString(), msg: String(msg || 'erro').slice(0, 240), onde: String(onde || '').slice(0, 80) });
    while (ERROS.length > 20) ERROS.shift();
    try { if (Store.ready() && S.storage === 'idb') Store.put('meta', { k: 'erros', lista: ERROS.slice() }).catch(() => {}); } catch (e) { /* banco ainda não aberto */ }
  }
  window.addEventListener('error', (e) => anotaErro(e.message, ((e.filename || '').split('/').pop() || '') + (e.lineno ? ':' + e.lineno : '')));
  window.addEventListener('unhandledrejection', (e) => anotaErro((e.reason && e.reason.message) || e.reason, 'promessa'));
  const $ = (s, el) => (el || document).querySelector(s);

  // ================= DOM =================
  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    let value;
    if (props) for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'value') value = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'checked' || k === 'disabled' || k === 'selected' || k === 'multiple' || k === 'open') el[k] = !!v;
      else el.setAttribute(k, v === true ? '' : String(v));
    }
    for (const kid of kids.flat(Infinity)) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    if (value !== undefined) el.value = value;
    return el;
  }
  const ICONS = {
    home: '<path d="M3.5 10.5 12 3.8l8.5 6.7"/><path d="M5.8 9v10.7h4.4v-5.4h3.6v5.4h4.4V9"/>',
    list: '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M8 9.5h8M8 14.5h5"/>',
    chart: '<path d="M6 19v-6M12 19V6M18 19v-9"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.4M12 18.8v2.4M21.2 12h-2.4M5.2 12H2.8M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7M18.5 18.5l-1.7-1.7M7.2 7.2 5.5 5.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    cash: '<rect x="3" y="6.5" width="18" height="11" rx="2.5"/><circle cx="12" cy="12" r="2.4"/>',
    chat: '<path d="M4.5 18.5 5.6 15A7.5 7.5 0 1 1 9 18.6z"/>',
    sheet: '<rect x="4.5" y="3.5" width="15" height="17" rx="2.5"/><path d="M8.5 9h7M8.5 13h7M8.5 17h4"/>',
    lock: '<rect x="5" y="11" width="14" height="9.5" rx="2.5"/><path d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3"/>',
    camera: '<path d="M4 8.5h3l1.8-2.5h6.4L17 8.5h3V19H4z"/><circle cx="12" cy="13.3" r="3.3"/>',
    moon: '<path d="M19.5 14.6A7.6 7.6 0 1 1 9.4 4.5a6 6 0 0 0 10.1 10.1z"/>',
    check: '<path d="M5 12.5 9.5 17 19 7.5"/>',
    x: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
    back: '<path d="M15 5.5 8.5 12l6.5 6.5"/>',
    chev: '<path d="M9.5 5.5 16 12l-6.5 6.5"/>',
    trash: '<path d="M4.5 7h15M10 11v6M14 11v6M6.5 7l1 13h9l1-13M9.5 7V4.5h5V7"/>',
    merge: '<path d="M7 4v5a6 6 0 0 0 6 6h5"/><path d="M15 12l3 3-3 3"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
    alert: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.8v5M12 16.2h.01"/>',
    photo: '<rect x="3.5" y="5" width="17" height="14" rx="3"/><circle cx="9" cy="10" r="1.6"/><path d="M20.5 15.5 16 11l-8.5 8"/>',
    share: '<path d="M12 15V3.5M7.5 8 12 3.5 16.5 8"/><path d="M5 12.5V19a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-6.5"/>',
    zoom: '<circle cx="11" cy="11" r="6"/><path d="M15.5 15.5 20 20M11 8.5v5M8.5 11h5"/>',
    phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
    tag: '<path d="M3.5 12.5V4.5h8l9 9-8 8z"/><circle cx="8" cy="9" r="1.4"/>',
    undo: '<path d="M9 7 4.5 11.5 9 16"/><path d="M5 11.5h9.5a5 5 0 0 1 0 10H11"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    filter: '<path d="M4 6.5h16M7 12h10M10 17.5h4"/>',
    building: '<path d="M5 20V5.5A1.5 1.5 0 0 1 6.5 4h7A1.5 1.5 0 0 1 15 5.5V20M15 9.5h3.5A1.5 1.5 0 0 1 20 11v9M3.5 20h17M8.5 8h3M8.5 11.5h3M8.5 15h3"/>',
    user: '<circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/>',
    cal: '<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M4 9.5h16M8.5 3v4M15.5 3v4"/>',
    info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 7.8h.01"/>',
    bell: '<path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 1.5H5l1.5-1.5Z"/><path d="M10 20.5a2.2 2.2 0 0 0 4 0"/>',
    folder: '<path d="M3.5 7.5A2 2 0 0 1 5.5 5.5h4l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>',
  };
  function icon(name, cls) {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('class', 'ic' + (cls ? ' ' + cls : '')); s.setAttribute('aria-hidden', 'true');
    s.innerHTML = ICONS[name] || ''; return s;
  }

  // ================= formatação =================
  const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const MES_LONGO = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const DIA_LONGO = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  const nf2 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const nf1 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
  const nf0 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
  const brl = (v) => (v == null ? '—' : 'R$ ' + nf2.format(v));
  const brl0 = (v) => (v == null ? '—' : 'R$ ' + nf0.format(Math.round(v)));
  const ddmmyyyy = (d) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : '—');
  const today = () => C.todayStr();
  const daysSince = (d) => C.dayNum(today()) - C.dayNum(d);
  const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
  const cap = (s) => C.capFirst(s);
  // junta partes de uma frase: "a", "a e b", "a, b e c" (as vazias saem)
  const frase = (partes) => { const p = partes.filter(Boolean); return p.length > 1 ? p.slice(0, -1).join(', ') + ' e ' + p[p.length - 1] : p[0] || ''; };
  const sameYear = (d) => d.slice(0, 4) === today().slice(0, 4);
  function dataLonga(d, opts) {
    if (!d) return '';
    opts = opts || {};
    const s = `${opts.semDia ? '' : DIA_LONGO[C.weekday(d)] + ', '}${+d.slice(8, 10)} de ${MES_LONGO[+d.slice(5, 7) - 1]}`;
    return s + (sameYear(d) && !opts.ano ? '' : ' de ' + d.slice(0, 4));
  }
  const horaTxt = (t) => (t ? t.replace(':', 'h') : '');
  const monthName = (k) => cap(MES_LONGO[+k.slice(5, 7) - 1]) + (k.slice(0, 4) === today().slice(0, 4) ? '' : ' de ' + k.slice(0, 4));
  function parseMoney(s) {
    s = String(s == null ? '' : s).replace(/[R$\s]/g, '');
    if (!s) return null;
    const n = /,\d{1,2}$/.test(s) || (s.includes(',') && !s.includes('.')) ? +s.replace(/\./g, '').replace(',', '.') : +s.replace(/,/g, '');
    return isFinite(n) ? C.round2(n) : null;
  }
  const moneyInput = (v) => (v == null ? '' : nf2.format(v));
  const uniq = (arr) => [...new Set(arr.filter(Boolean))];
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const initials = (n) => String(n).replace(/\(.*?\)/g, '').split(/\s+/).filter((w) => w && !/^(dr|dra|de|da|do|dos|das)\.?$/i.test(w)).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';
  function greeting() { const hh = new Date().getHours(); return hh < 12 ? 'Bom dia' : hh < 18 ? 'Boa tarde' : 'Boa noite'; }

  // ================= armazenamento =================
  // thumbs: miniaturas das fotos, separadas das originais. trash: a lixeira (30 dias). imports: cada conversa trazida do WhatsApp.
  const STORES = ['records', 'photos', 'loose', 'terms', 'repasses', 'meta', 'ignored', 'thumbs', 'trash', 'imports'];
  const KEYS = { meta: 'k', ignored: 'key' };
  const Store = (() => {
    let db = null, mem = null;
    const useMem = () => { mem = {}; STORES.forEach((s) => (mem[s] = new Map())); };
    // Abre o banco na versão que este app conhece. Se ele já estiver numa versão mais nova (aberto por um app mais novo),
    // abre como está: voltar uma versão do app nunca deixa os dados de fora.
    const abrir = (versao) => new Promise((res, rej) => {
      const rq = versao ? indexedDB.open(DB_NAME, versao) : indexedDB.open(DB_NAME);
      rq.onupgradeneeded = () => { const d = rq.result; for (const s of STORES) if (!d.objectStoreNames.contains(s)) d.createObjectStore(s, { keyPath: KEYS[s] || 'id' }); };
      rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error);
      // outra janela com uma versão antiga ainda segura o banco: espera ela fechar (o pedido continua de pé)
      rq.onblocked = () => { const m = $('#main'); if (m) m.replaceChildren(h('div', { class: 'empty' }, h('span', { class: 'halo' }, icon('alert')), h('h2', null, 'Feche as outras janelas do app'), h('p', null, 'O app está terminando uma atualização. Feche as outras abas dele que estiverem abertas no Safari.'))); };
    });
    async function open() {
      if (PREVIEW || !('indexedDB' in window)) { useMem(); return 'memory'; }
      try {
        try { db = await abrir(DB_VERSION); } catch (e) { if (e && e.name === 'VersionError') db = await abrir(0); else throw e; }
        if (STORES.some((s) => !db.objectStoreNames.contains(s))) throw new Error('o banco não tem as listas esperadas');
        // uma versão mais nova do app, aberta em outra janela, precisa mexer no banco: esta janela solta e pede para atualizar
        db.onversionchange = () => { db.close(); showUpdate(); };
        return 'idb';
      } catch (e) { anotaErro(e && (e.message || e.name), 'abrir o banco'); db = null; useMem(); return 'memory'; }
    }
    const keyOf = (s, v) => v[KEYS[s] || 'id'];
    // toda ficha gravada leva junto o espelho do modelo financeiro (status, recebido, valorPrevisto), que a versão
    // anterior do app lê. Assim, voltar de versão mostra os pagamentos certos.
    const antes = (s, v) => { if (s === 'records' && v) C.compatFinanceiro(v); return v; };
    function run(s, mode, fn) {
      return new Promise((res, rej) => {
        const t = db.transaction(s, mode); const st = t.objectStore(s); const rq = fn(st);
        t.oncomplete = () => res(rq ? rq.result : undefined); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error || new Error('abort'));
      });
    }
    return {
      open,
      ready: () => !!(db || mem),
      all: (s) => (mem ? Promise.resolve([...mem[s].values()]) : run(s, 'readonly', (st) => st.getAll())),
      get: (s, k) => (mem ? Promise.resolve(mem[s].get(k)) : run(s, 'readonly', (st) => st.get(k))),
      put: (s, v) => (antes(s, v), mem ? (mem[s].set(keyOf(s, v), v), Promise.resolve()) : run(s, 'readwrite', (st) => st.put(v))),
      putMany: (s, arr) => (arr.forEach((v) => antes(s, v)), mem ? (arr.forEach((v) => mem[s].set(keyOf(s, v), v)), Promise.resolve()) : (arr.length ? run(s, 'readwrite', (st) => { arr.forEach((v) => st.put(v)); return null; }) : Promise.resolve())),
      del: (s, k) => (mem ? (mem[s].delete(k), Promise.resolve()) : run(s, 'readwrite', (st) => st.delete(k))),
      clear: (s) => (mem ? (mem[s].clear(), Promise.resolve()) : run(s, 'readwrite', (st) => st.clear())),
      keys: (s) => (mem ? Promise.resolve([...mem[s].keys()]) : run(s, 'readonly', (st) => st.getAllKeys())),
      // grava e apaga em várias listas numa operação só: ou tudo acontece, ou nada acontece
      // ops: [{ s: 'records', put: valor } | { s: 'photos', del: chave }]
      apply: (ops) => {
        ops = (ops || []).filter(Boolean); if (!ops.length) return Promise.resolve();
        for (const o of ops) if (!('del' in o)) antes(o.s, o.put);
        if (mem) { for (const o of ops) { if ('del' in o) mem[o.s].delete(o.del); else mem[o.s].set(keyOf(o.s, o.put), o.put); } return Promise.resolve(); }
        return new Promise((res, rej) => {
          const t = db.transaction([...new Set(ops.map((o) => o.s))], 'readwrite');
          for (const o of ops) { const st = t.objectStore(o.s); if ('del' in o) st.delete(o.del); else st.put(o.put); }
          t.oncomplete = () => res(); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error || new Error('a gravação foi interrompida'));
        });
      },
      // troca o conteúdo de várias listas de uma vez só: ou tudo muda, ou nada muda
      replaceAll: (map) => {
        const names = Object.keys(map);
        for (const s of names) for (const v of map[s]) antes(s, v);
        if (mem) { for (const s of names) { mem[s].clear(); for (const v of map[s]) mem[s].set(keyOf(s, v), v); } return Promise.resolve(); }
        return new Promise((res, rej) => {
          const t = db.transaction(names, 'readwrite');
          for (const s of names) { const st = t.objectStore(s); st.clear(); for (const v of map[s]) st.put(v); }
          t.oncomplete = () => res(); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error || new Error('a troca foi interrompida'));
        });
      },
    };
  })();

  // ================= estado =================
  const DEFAULT_SETTINGS = { k: 'settings', alertDias: 90, feriados: '31/08', pinHash: null, pinSalt: null, lastBackup: null, seq: 0, hospRepasse: null, termsVersion: 0, installHidden: false, tema: 'ameixa', nome: '', grupo: '', dataVersion: 0 };
  const S = {
    records: [], terms: [], repasses: [], loose: [], ignored: new Set(), ignoredInfo: new Map(), trash: [], imports: [], settings: { ...DEFAULT_SETTINGS },
    index: null, refs: null, hol: [], checks: [], tab: 'inicio', demo: false, storage: 'idb',
    f: { q: '', status: 'todas', periodo: 'tudo', col: '', hosp: '', conv: '' }, selecting: false, sel: new Set(), relTab: 'meses',
  };
  async function load() {
    S.storage = await Store.open();
    const [records, terms, repasses, loose, meta, ignored, trash, imports] = await Promise.all(['records', 'terms', 'repasses', 'loose', 'meta', 'ignored', 'trash', 'imports'].map((s) => Store.all(s)));
    S.records = records; S.repasses = repasses; S.loose = loose; S.trash = trash; S.imports = imports;
    S.ignored = new Set(ignored.map((x) => x.key)); S.ignoredInfo = new Map(ignored.map((x) => [x.key, x]));
    S.settings = { ...DEFAULT_SETTINGS, ...(meta.find((m) => m.k === 'settings') || {}) };
    S.terms = terms;
    const er = meta.find((m) => m.k === 'erros'); if (er && Array.isArray(er.lista)) ERROS.splice(0, ERROS.length, ...er.lista.slice(-20));
    await migrate();
    // ficha gravada por uma versão antiga do app (depois de voltar de versão): entra no modelo financeiro novo
    if (!S.dadosNovos && (S.settings.dataVersion || 0) >= 4) { const velhas = S.records.filter((r) => C.reconciliarFinanceiro(r)); if (velhas.length) await Store.putMany('records', velhas); }
    // a numeração das fichas nunca anda para trás, mesmo se o app fechou no meio de uma importação
    const maior = Math.max(0, ...S.records.map((r) => r.num || 0), ...S.trash.map((x) => (x.rec && x.rec.num) || 0));
    if (maior > (S.settings.seq || 0)) S.settings.seq = maior;
    // com dados de uma versão mais nova do app, não apaga nada: ela pode usar fotos de um jeito que esta não conhece
    if (!S.dadosNovos) {
      try { await esvaziarLixeiraAntiga(); await limparOrfas(); } catch (e) { anotaErro(e && e.message, 'limpeza'); }
    }
    if (!PREVIEW) segurarTrava();
    applyTheme(); derive();
  }
  // ================= versão dos dados =================
  // Cada mudança no formato salvo entra aqui como uma migração numerada, feita uma vez só e na ordem.
  // A versão viaja junto no backup: restaurar um backup antigo roda as migrações que faltam.
  // 'copia' = listas guardadas antes de mexer (em Ajustes > Copiar diagnóstico aparece que a cópia existe).
  // Uma migração longa recebe progresso(i, n): com muitas fotos, aparece "Atualizando o app".
  const MIGRATIONS = [
    { v: 1, nome: 'nomes e abreviações padrão', async run() {
      if ((S.settings.termsVersion || 0) >= TERMS_VERSION) return;
      const have = new Set(S.terms.map((t) => t.type + '|' + t.name));
      const add = C.defaultTerms().filter((t) => !have.has(t.type + '|' + t.name));
      S.terms.push(...add); await Store.putMany('terms', add);
      S.settings.termsVersion = TERMS_VERSION;
    } },
    // Até a 1.6, a miniatura ficava no mesmo registro da foto: mostrar uma miniatura lia a foto inteira.
    // Agora ela fica na lista 'thumbs'. A migração copia cada miniatura, uma foto por vez; a antiga fica onde estava,
    // como cópia, até uma próxima versão confirmar que está tudo certo. Se parar no meio, continua na próxima abertura.
    { v: 2, nome: 'miniaturas numa lista separada', async run(progresso) {
      const ids = await Store.keys('photos'); const tem = new Set(await Store.keys('thumbs'));
      let i = 0;
      for (const id of ids) {
        if (!tem.has(id)) { const p = await Store.get('photos', id); if (p && p.tbuf) await Store.put('thumbs', { id, buf: p.tbuf }); }
        progresso(++i, ids.length);
      }
    } },
    // Até a 1.7, sem hora na legenda, a ficha ficava com a hora do envio da foto como hora da cirurgia (item 16): uma
    // cirurgia às 15h postada às 20h virava urgência. Agora essa hora fica em branco, e o app pede para conferir quando ela
    // muda o valor. Se a ficha já foi paga por uma planilha com hora, vale a hora da planilha. Fichas em que ela mexeu na
    // hora não mudam. As fichas são copiadas antes (meta 'copia-migracao-3').
    { v: 3, nome: 'hora do envio não é hora da cirurgia', copia: ['records'], async run() {
      const idx = C.buildIndex(S.terms); const hol = C.parseExtraHolidays(S.settings.feriados);
      const mudar = [];
      for (const r of S.records) {
        if (r.origem !== 'whatsapp' || !r.msgTime || r.time !== r.msgTime || r.date !== r.msgDate || r.editadaEm) continue;
        if (C.parseCaption(r.caption || '', idx, r.msgDate).time) continue;   // a hora estava escrita na legenda
        const l = (r.rep || []).find((x) => x.time && x.date === r.date);
        if (l) { r.time = l.time; r.horaDaPlanilha = true; }
        else { r.time = null; r.revisar = uniq([...(r.revisar || []), ...C.avisosDoEnvio(r.msgDate, r.msgTime, hol)]); }
        mudar.push(r);
      }
      await Store.putMany('records', mudar);
    } },
    // Item 22: cada ficha passa a ter valor devido (devido e devidoOrigem), a lista de pagamentos e, calculados, o saldo e
    // a situação (a receber, parcial, recebida, sem cobrança). O pagamento que havia vira o primeiro da lista; o valor
    // combinado vira valor devido "combinado"; a ficha paga por planilha fica com o devido da planilha. Nada é apagado:
    // status, recebido e valorPrevisto continuam, como espelho para a versão anterior. As fichas são copiadas antes.
    { v: 4, nome: 'valor devido, pagamentos e saldo', copia: ['records'], async run() {
      const mudar = S.records.filter((r) => C.migrarFinanceiro(r));
      await Store.putMany('records', mudar);
    } },
  ];
  const DATA_VERSION = MIGRATIONS[MIGRATIONS.length - 1].v;
  async function migrate() {
    let v = S.settings.dataVersion || 0;
    if (v > DATA_VERSION) { S.dadosNovos = true; return; } // dados de uma versão mais nova do app: não mexe em nada
    let aviso = null;
    const progresso = (i, n) => {
      if (!aviso && n > 30) aviso = busy('Atualizando o app…');
      if (aviso) aviso.set(i / n, `Preparando as fotos: ${i} de ${n}`);
    };
    try {
      for (const m of MIGRATIONS) {
        if (m.v <= v) continue;
        if (m.copia) {
          const copia = {}; for (const st of m.copia) copia[st] = await Store.all(st);
          await Store.put('meta', { k: 'copia-migracao-' + m.v, em: new Date().toISOString(), dados: copia });
        }
        await m.run(progresso);
        v = m.v; S.settings.dataVersion = v; await saveSettings();
      }
    } finally { if (aviso) aviso.done(); }
  }
  function derive() {
    S.index = C.buildIndex(S.terms);
    S.hol = C.parseExtraHolidays(S.settings.feriados);
    S.refs = C.buildRefs(S.records, S.hol);
    S.checks = C.urgencyChecks(S.records, S.refs, S.hol);
    S.prazos = C.prazosDePagamento(S.records);
  }
  function applyTheme() { document.documentElement.setAttribute('data-tema', S.settings.tema || 'ameixa'); }
  const saveSettings = () => Store.put('meta', S.settings);
  // editadaEm marca uma mudança feita por ela (desfazer uma importação avisa quando vai levar junto essas mudanças);
  // sistema: true para o que o próprio app desfaz, como uma planilha
  async function saveRecord(r, opts) {
    r.updatedAt = Date.now();
    if (!(opts && opts.sistema)) r.editadaEm = r.updatedAt;
    const i = S.records.findIndex((x) => x.id === r.id);
    if (i >= 0) S.records[i] = r; else S.records.push(r);
    await Store.put('records', r);
  }
  function persistStorage() { try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {}); } catch (e) { /* sem suporte */ } }
  const isStandalone = () => window.navigator.standalone === true || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);

  // ================= fotos =================
  const urlCache = new Map();
  function extType(name) {
    const e = (String(name).split('.').pop() || '').toLowerCase();
    return { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', heic: 'image/heic', webp: 'image/webp', gif: 'image/gif' }[e] || 'image/jpeg';
  }
  function loadImage(blob) {
    return new Promise((res, rej) => { const u = URL.createObjectURL(blob); const im = new Image(); im.onload = () => { res(im); setTimeout(() => URL.revokeObjectURL(u), 1000); }; im.onerror = () => { URL.revokeObjectURL(u); rej(new Error('img')); }; im.src = u; });
  }
  async function makeThumb(blob, max) {
    let src = null;
    if ('createImageBitmap' in window) { try { src = await createImageBitmap(blob); } catch (e) { src = null; } }
    if (!src) src = await loadImage(blob);
    const w = src.width, hh = src.height, sc = Math.min(1, (max || 480) / Math.max(w, hh));
    const cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(w * sc)); cv.height = Math.max(1, Math.round(hh * sc));
    cv.getContext('2d').drawImage(src, 0, 0, cv.width, cv.height);
    if (src.close) src.close();
    return new Promise((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error('thumb'))), 'image/jpeg', 0.74));
  }
  // A foto original fica em 'photos' e a miniatura em 'thumbs', gravadas juntas numa operação só.
  async function storePhoto(blob, name) {
    const id = C.uid('p');
    const type = blob.type || extType(name);
    const buf = await blob.arrayBuffer();
    let tbuf = null;
    try { tbuf = await (await makeThumb(new Blob([buf], { type }), 480)).arrayBuffer(); } catch (e) { tbuf = null; }
    await Store.apply([{ s: 'photos', put: { id, name: name || '', type, buf } }, tbuf ? { s: 'thumbs', put: { id, buf: tbuf } } : null]);
    return id;
  }
  // miniatura: lê só a lista 'thumbs'. Se faltar, usa a do lugar antigo (fotos de antes da 1.7) ou a foto inteira,
  // e já deixa uma miniatura pronta para a próxima vez.
  async function photoURL(id, thumb) {
    const k = id + (thumb ? ':t' : '');
    if (urlCache.has(k)) return urlCache.get(k);
    let blob = null;
    if (thumb) { const t = await Store.get('thumbs', id); if (t && t.buf) blob = new Blob([t.buf], { type: 'image/jpeg' }); }
    if (!blob) {
      const p = await Store.get('photos', id);
      if (!p) return null;
      if (thumb && p.tbuf) { blob = new Blob([p.tbuf], { type: 'image/jpeg' }); Store.put('thumbs', { id, buf: p.tbuf }).catch(() => {}); }
      else {
        blob = new Blob([p.buf], { type: p.type });
        if (thumb) makeThumb(blob, 480).then((b) => b.arrayBuffer()).then((buf) => Store.put('thumbs', { id, buf })).catch(() => {});
      }
    }
    const u = URL.createObjectURL(blob);
    urlCache.set(k, u); return u;
  }
  function photoImg(id, thumb) {
    const im = h('img', { alt: '', loading: 'lazy', decoding: 'async' });
    photoURL(id, thumb).then((u) => { if (u) im.src = u; });
    return im;
  }
  function soltarURL(id) { for (const k of [id, id + ':t']) if (urlCache.has(k)) { URL.revokeObjectURL(urlCache.get(k)); urlCache.delete(k); } }
  async function deletePhotos(ids) {
    ids = [...new Set(ids || [])]; if (!ids.length) return;
    await Store.apply(ids.flatMap((id) => [{ s: 'photos', del: id }, { s: 'thumbs', del: id }]));
    ids.forEach(soltarURL);
  }
  // fotos em uso: nas fichas, nas fotos para organizar e na lixeira
  function fotosEmUso(records, loose, trash) {
    const usadas = new Set();
    for (const r of records || []) for (const id of r.photoIds || []) usadas.add(id);
    for (const l of loose || []) if (l.photoId) usadas.add(l.photoId);
    for (const x of trash || []) {
      if (x.rec) for (const id of x.rec.photoIds || []) usadas.add(id);
      for (const l of x.loose || []) if (l.photoId) usadas.add(l.photoId);
      if (x.photoId) usadas.add(x.photoId);
    }
    return usadas;
  }
  // apaga de vez só as fotos da lista que não estão em uso em nenhum outro lugar
  async function apagarFotosSemUso(ids) {
    const usadas = fotosEmUso(S.records, S.loose, S.trash);
    await deletePhotos((ids || []).filter((id) => !usadas.has(id)));
  }
  // Cada janela aberta do app segura uma "trava" compartilhada; ao abrir, o app vê se há outra janela aberta (no
  // computador, duas abas). Se houver, não limpa fotos órfãs: a outra pode estar no meio de uma importação.
  const TRAVA = 'app-aberto:' + DB_NAME;
  let comTrava = false;
  async function outraJanelaAberta() {
    try {
      if (!navigator.locks || !navigator.locks.query) return false;
      const q = await navigator.locks.query();
      return (q.held || []).filter((l) => l.name === TRAVA).length - (comTrava ? 1 : 0) > 0;
    } catch (e) { return false; }
  }
  function segurarTrava() {
    if (comTrava) return;
    try { if (navigator.locks && navigator.locks.request) navigator.locks.request(TRAVA, { mode: 'shared' }, () => { comTrava = true; return new Promise(() => {}); }).catch(() => {}); } catch (e) { /* sem suporte */ }
  }
  // Fotos órfãs: gravadas, mas sem ficha, sem foto para organizar e fora da lixeira. Acontece quando o app fecha no meio
  // de uma importação ou de uma ficha nova. Só roda ao abrir o app, quando nada está sendo editado, e relê tudo do banco.
  async function limparOrfas() {
    if (await outraJanelaAberta()) return 0;
    const [records, loose, trash] = await Promise.all([Store.all('records'), Store.all('loose'), Store.all('trash')]);
    const usadas = fotosEmUso(records, loose, trash);
    const fotos = await Store.keys('photos'), minis = await Store.keys('thumbs');
    const sobra = fotos.filter((id) => !usadas.has(id));
    const minisSobra = minis.filter((id) => !usadas.has(id));
    if (!sobra.length && !minisSobra.length) return 0;
    await Store.apply([...sobra.map((id) => ({ s: 'photos', del: id })), ...minisSobra.map((id) => ({ s: 'thumbs', del: id }))]);
    sobra.forEach(soltarURL);
    return sobra.length;
  }

  // ================= regras =================
  // situação pelo modelo financeiro (core.js): 'aberto' (a receber), 'parcial', 'recebido' ou 'semcobranca'
  const sit = (r) => C.situacao(r);
  const isOpen = (r) => C.emAberto(r);              // a receber, inclusive as pagas só em parte
  const isPaid = (r) => sit(r) === 'recebido';
  const urgOf = (r) => C.isUrgent(r.date, r.time, S.hol);
  // atrasada: passou do prazo de costume de quem paga (hospital, convênio ou colega); sem histórico, o padrão de Ajustes
  const isLate = (r) => isOpen(r) && daysSince(r.date) > C.limiteAtraso(r, S.prazos || new Map(), S.settings.alertDias);
  // o que falta no cadastro: avisos da importação + procedimento, hospital ou colega em branco.
  // "Está tudo certo" (conferido) cala os campos em branco; quem marcou "sem cobrança" não é cobrada disso.
  function pendencias(r) {
    if (r.status === 'semcobranca') return [];
    const out = [...(r.revisar || [])];
    if (!r.conferido) {
      if (!(r.procs || []).length && !out.includes('Sem procedimento')) out.push('Sem procedimento');
      if (!r.hosp) out.push('Sem hospital');
      if (!(r.cols || []).length) out.push('Sem colega');
    }
    return out;
  }
  const needsReview = (r) => pendencias(r).length > 0;
  const backupDue = () => !PREVIEW && S.records.length > 0 && (!S.settings.lastBackup || daysSince(S.settings.lastBackup) > 30);
  // O dinheiro de uma cirurgia, separado como no modelo financeiro: valor devido, pagamentos, total recebido, saldo e,
  // quando ainda não há valor devido, a estimativa (sempre aproximada). aReceber é o saldo, ou a estimativa menos o
  // que já entrou.
  function fin(r) {
    const s = sit(r); const pg = r.pagamentos || [];
    const recebido = C.totalRecebido(r);
    const devido = r.devido != null ? r.devido : null;
    const saldo = devido != null ? C.round2(devido - recebido) : null;
    let aReceber = null, aprox = false, est = null;
    if (s === 'aberto' || s === 'parcial') {
      if (saldo != null) aReceber = Math.max(0, saldo);
      else { est = C.estimate(r, S.refs, S.index, S.hol); if (est && est.valor != null) { aReceber = Math.max(0, C.round2(est.valor - recebido)); aprox = true; } }
    }
    return { s, pg, recebido, semValorAnotado: pg.some((p) => p.valor == null), devido, origem: r.devidoOrigem || null, saldo, aReceber, aprox, est };
  }
  function valueOf(r) {
    const f = fin(r);
    if (f.s === 'recebido') return { v: f.semValorAnotado ? null : f.recebido, kind: 'recebido' };
    if (f.s === 'semcobranca') return { v: 0, kind: 'semcobranca' };
    if (f.aReceber != null) return { v: f.aReceber, kind: f.aprox ? 'estimado' : 'previsto', parcial: !!(f.est && f.est.parcial) };
    return { v: null, kind: 'semvalor' };
  }
  function statusOf(r) {
    const s = sit(r);
    if (s === 'recebido') return ['Recebida', 'ok'];
    if (s === 'semcobranca') return ['Sem cobrança', 'plain'];
    if (needsReview(r)) return ['Completar', 'warn'];
    if (s === 'parcial') return ['Parcial', 'accent'];
    if (isLate(r)) return ['Atrasada', 'danger'];
    return ['A receber', 'accent'];
  }
  // Dinheiro que entrou, pelo mês em que caiu. Da planilha em que ela anotou quanto caiu de fato na conta, vale esse
  // valor (já sem retenções e taxas), para bater com o extrato do banco.
  function recebidoPorMes() {
    const m = new Map(); const soma = (k, v) => m.set(k, C.round2((m.get(k) || 0) + v));
    const caiu = new Map(S.repasses.filter((x) => x.caiu != null && x.pay).map((x) => [x.id, x]));
    for (const r of S.records) for (const p of r.pagamentos || []) {
      if (!p.data || p.valor == null || (p.origem === 'repasse' && caiu.has(p.repId))) continue;
      soma(p.data.slice(0, 7), p.valor);
    }
    for (const x of caiu.values()) soma(x.pay.slice(0, 7), x.caiu);
    return m;
  }
  const procText = (r) => (r.procs && r.procs.length ? r.procs.join(' + ') : 'Procedimento não informado');
  function ondeCom(r) {
    const cols = (r.cols || []).filter(Boolean);
    const com = cols.length ? 'com ' + (cols.length > 1 ? cols.slice(0, -1).join(', ') + ' e ' + cols[cols.length - 1] : cols[0]) : '';
    return [r.hosp, com].filter(Boolean).join(', ');
  }
  const FLAG_TXT = { 'Sem procedimento': 'Falta dizer qual foi o procedimento.', 'Sem hospital': 'Falta dizer o hospital.', 'Sem colega': 'Falta dizer com quem foi.', 'Procedimento novo': 'O procedimento foi escrito de um jeito novo. Confira o nome.' };
  function flagText(f, r) {
    const envio = r && r.msgTime ? horaTxt(r.msgTime) : '';
    if (f === 'Confira a hora') return `A legenda não diz a hora, e a foto foi enviada às ${envio}, no horário de urgência. Se a cirurgia foi depois das 19h ou antes das 7h, coloque a hora: o valor é 30% maior.`;
    if (f === 'Confira a data') return `A foto foi enviada de madrugada, às ${envio}. Se a cirurgia foi no dia anterior, corrija a data e, se souber, a hora.`;
    if (f === 'Legenda editada') return `A legenda foi editada no WhatsApp depois que você mexeu nesta ficha. Antes era: “${(r && r.legendaAnterior) || ''}”. Confira se a ficha continua certa.`;
    return FLAG_TXT[f] || (/convers|observa/i.test(f) ? 'A legenda tem uma observação depois da cirurgia. Confira o procedimento.' : f);
  }
  const namesOf = (type) => S.terms.filter((t) => t.type === type).map((t) => t.name).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  function topUsed(kind, n) {
    const cnt = new Map();
    for (const r of S.records) for (const v of kind === 'procs' ? r.procs || [] : kind === 'cols' ? r.cols || [] : [r[kind]]) if (v) cnt.set(v, (cnt.get(v) || 0) + 1);
    return [...cnt.entries()].sort((a, b) => b[1] - a[1]).map((x) => x[0]).slice(0, n);
  }
  function metrics() {
    const open = S.records.filter(isOpen);
    // "Para receber" = saldos confirmados (há valor devido) + estimativas (sem valor devido), mostrados em separado
    let conf = 0, est = 0, semValor = 0;
    for (const r of open) { const f = fin(r); if (f.aReceber == null) semValor++; else if (f.aprox) est += f.aReceber; else conf += f.aReceber; }
    return {
      open: open.length, aReceber: C.round2(conf + est), confirmados: C.round2(conf), estimados: C.round2(est), semValor,
      recMes: recebidoPorMes().get(today().slice(0, 7)) || 0,
      late: open.filter(isLate).length, review: S.records.filter(needsReview).length, loose: S.loose.length, checks: S.checks.length,
    };
  }

  // ================= componentes =================
  // aviso rápido embaixo da tela; com acao ({ label, fn }) ganha um botão, como "Desfazer"
  function toast(msg, ms, acao) {
    const t = $('#toast');
    t.replaceChildren(...[h('span', null, msg), acao ? h('button', { class: 'act', type: 'button', onclick: () => { t.hidden = true; clearTimeout(toast._t); acao.fn(); } }, acao.label) : null].filter(Boolean));
    t.classList.toggle('com-acao', !!acao); t.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(() => (t.hidden = true), ms || (acao ? 7000 : 3000));
  }
  function confirmDialog(o) {
    return new Promise((res) => {
      const done = (v) => { wrap.remove(); res(v); };
      const wrap = h('div', { class: 'dialog-wrap' }, h('div', { class: 'dialog', role: 'alertdialog', 'aria-modal': 'true' },
        h('h3', null, o.title), o.text ? h('p', null, o.text) : null,
        h('div', { class: 'dialog-actions' },
          o.cancel === false ? null : h('button', { class: 'btn', type: 'button', onclick: () => done(false) }, o.cancel || 'Cancelar'),
          h('button', { class: 'btn ' + (o.danger ? 'danger' : 'primary'), type: 'button', onclick: () => done(true) }, o.ok || 'Confirmar'))));
      document.body.append(wrap);
    });
  }
  function formDialog(o) {
    return new Promise((res) => {
      const inputs = {};
      const done = (ok) => { const out = {}; for (const [k, el] of Object.entries(inputs)) out[k] = el.value; wrap.remove(); res(ok ? out : null); };
      const wrap = h('div', { class: 'dialog-wrap' }, h('form', { class: 'dialog', onsubmit: (e) => { e.preventDefault(); done(true); } },
        h('h3', null, o.title), o.text ? h('p', null, o.text) : null,
        o.fields.map((f) => { const id = 'fd-' + f.id; inputs[f.id] = h('input', { id, type: f.type || 'text', value: f.value == null ? '' : f.value, inputmode: f.inputmode, placeholder: f.placeholder, autocomplete: 'off' }); return h('div', { class: 'field' }, h('label', { for: id }, f.label), inputs[f.id]); }),
        h('div', { class: 'dialog-actions' }, h('button', { type: 'button', class: 'btn', onclick: () => done(false) }, 'Cancelar'), h('button', { type: 'submit', class: 'btn primary' }, o.ok || 'Salvar'))));
      document.body.append(wrap);
    });
  }
  function busy(label) {
    const lab = h('p', null, label); const bar = h('span');
    const wrap = h('div', { class: 'dialog-wrap' }, h('div', { class: 'dialog', role: 'status', 'aria-live': 'polite' }, h('h3', null, 'Só um instante'), lab, h('div', { class: 'progress' }, bar)));
    document.body.append(wrap);
    return { set(p, txt) { bar.style.width = Math.round(p * 100) + '%'; if (txt) lab.textContent = txt; }, done() { wrap.remove(); } };
  }
  const navBtn = (label, on, iconName, strong) => h('button', { class: 'navbtn' + (strong ? ' strong' : ''), type: 'button', onclick: on }, iconName ? icon(iconName) : null, label);
  const sheets = [];
  function openSheet(cfg) {
    const head = h('div', { class: 'sheet-head' }); const body = h('div', { class: 'sheet-body' }); const foot = h('div', { class: 'sheet-foot' });
    const el = h('section', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': cfg.title || 'Detalhes' }, head, body, foot);
    let closed = false;
    const api = {
      el, body,
      async close(force) {
        if (closed) return;
        if (!force && cfg.beforeClose && !(await cfg.beforeClose())) return;
        closed = true; el.classList.remove('open'); el.classList.add('closing');
        setTimeout(() => el.remove(), 300);
        const i = sheets.indexOf(api); if (i >= 0) sheets.splice(i, 1);
        document.documentElement.classList.toggle('sheet-open', sheets.length > 0);
        if (cfg.onClose) cfg.onClose();
      },
      update() { const st = body.scrollTop; drawHead(); draw(); body.scrollTop = st; },
    };
    function drawHead() {
      const hd = cfg.head ? cfg.head(api) : {};
      const left = hd.left !== undefined ? hd.left : navBtn(cfg.back ? 'Voltar' : 'Fechar', () => api.close(), cfg.back ? 'back' : null);
      head.replaceChildren(h('div', { class: 'l' }, left), h('h2', null, hd.title !== undefined ? hd.title : cfg.title || ''), h('div', { class: 'r' }, hd.right || null));
    }
    function draw() {
      const out = cfg.render(api) || {};
      body.replaceChildren(h('div', { class: 'inner' }, out.body || []));
      foot.replaceChildren(...(out.foot ? [h('div', { class: 'inner' }, out.foot)] : []));
      foot.hidden = !out.foot;
    }
    drawHead(); draw();
    arrastarParaFechar(el, head, () => api.close());   // arrastar a barra do topo para baixo fecha, como tocar em Fechar
    $('#sheets').append(el); sheets.push(api); document.documentElement.classList.add('sheet-open');
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('open')));
    return api;
  }
  // Arrastar para baixo fecha (item 34). alca: onde o dedo começa (a barra do topo da tela, ou o menu inteiro). Só puxar
  // para baixo conta; soltar depois de 110 px, ou rápido, fecha. Se o fechar for recusado (algo sem salvar), volta ao lugar.
  function arrastarParaFechar(alvo, alca, fechar) {
    let y0 = null, x0 = 0, t0 = 0, dy = 0, ativo = false;
    alca.addEventListener('touchstart', (e) => { if (e.touches.length !== 1) { y0 = null; return; } y0 = e.touches[0].clientY; x0 = e.touches[0].clientX; t0 = Date.now(); dy = 0; ativo = false; }, { passive: true });
    alca.addEventListener('touchmove', (e) => {
      if (y0 == null) return;
      const d = e.touches[0].clientY - y0;
      if (!ativo) { if (d < 8 || Math.abs(e.touches[0].clientX - x0) > d) return; ativo = true; alvo.style.transition = 'none'; }
      dy = Math.max(0, d); alvo.style.transform = `translateY(${dy}px)`;
      if (e.cancelable) e.preventDefault();
    }, { passive: false });
    const fim = () => {
      if (y0 == null) return; y0 = null;
      if (!ativo) return; ativo = false;
      // o toque que arrastou não vale como toque num botão do que foi arrastado (um aviso que abrir logo depois funciona)
      const engole = (e) => { if (alca.contains(e.target)) { e.stopPropagation(); e.preventDefault(); } };
      window.addEventListener('click', engole, true); setTimeout(() => window.removeEventListener('click', engole, true), 400);
      alvo.style.transition = '';
      const vel = dy / Math.max(1, Date.now() - t0);
      if (dy > 110 || (dy > 40 && vel > 0.6)) Promise.resolve(fechar()).then(() => { if (alvo.isConnected && !alvo.classList.contains('closing')) alvo.style.transform = ''; });
      else alvo.style.transform = '';
    };
    alca.addEventListener('touchend', fim); alca.addEventListener('touchcancel', fim);
  }
  function actionSheet(title, options) {
    const close = () => { wrap.classList.remove('open'); setTimeout(() => wrap.remove(), 280); };
    const painel = h('div', { class: 'as', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
        h('div', { class: 'grab' }), h('h3', null, title),
        options.map(([key, ic, tone, t, sub, fn]) => h('button', { class: 'opt', type: 'button', 'data-act': key, onclick: () => { close(); setTimeout(fn, 120); } },
          h('span', { class: 'bubble ' + (tone || '') }, icon(ic)), h('span', { class: 't' }, t, sub ? h('small', null, sub) : null))),
        h('button', { class: 'btn block cancel', type: 'button', onclick: close }, 'Cancelar'));
    const wrap = h('div', { class: 'as-wrap', onclick: (e) => { if (e.target === wrap) close(); } }, painel);
    arrastarParaFechar(painel, painel, close);
    document.body.append(wrap);
    requestAnimationFrame(() => requestAnimationFrame(() => wrap.classList.add('open')));
  }
  function field(label, control, hint) {
    const id = control.id || (control.id = 'f' + Math.random().toString(36).slice(2, 8));
    return h('div', { class: 'field' }, h('label', { for: id }, label), control, hint ? h('div', { class: 'hint' }, hint) : null);
  }
  function seg(options, current, onPick, label, cls) {
    return h('div', { class: 'seg' + (cls ? ' ' + cls : ''), role: 'group', 'aria-label': label || null }, options.map(([val, lab]) => h('button', { type: 'button', 'aria-pressed': String(val === current), onclick: () => onPick(val) }, lab)));
  }
  const matchName = (v, names) => names.find((n) => C.norm(n) === C.norm(v)) || C.capFirst(v);
  function tip(title, text, actionLabel, action, iconName, tone) {
    return h('div', { class: 'tip' + (tone ? ' ' + tone : ''), role: 'note' }, icon(iconName || 'info'), h('div', null, h('b', null, title), text, actionLabel ? h('div', null, h('button', { type: 'button', onclick: action }, actionLabel)) : null));
  }
  function dateBadge(r, tone) {
    return h('span', { class: 'dbadge ' + (tone || ''), 'aria-hidden': 'true' }, h('span', { class: 'd' }, +r.date.slice(8, 10)), h('span', { class: 'm' }, MES[+r.date.slice(5, 7) - 1] + (sameYear(r.date) ? '' : ' ' + r.date.slice(2, 4))));
  }
  function recordItem(r, onTap, pressed) {
    const v = valueOf(r); const [st, tone] = statusOf(r);
    const where = ondeCom(r);
    const u = urgOf(r);
    const meta = [where ? h('span', { class: 'w' }, where) : null,
      r.time ? h('span', { class: 'x' }, u ? icon('moon', 'moon') : null, horaTxt(r.time)) : (u ? h('span', { class: 'x' }, icon('moon', 'moon')) : null)].filter(Boolean);
    return h('button', { class: 'ritem', type: 'button', 'aria-pressed': pressed == null ? null : String(!!pressed), onclick: () => onTap(r), 'aria-label': `${dataLonga(r.date)}: ${procText(r)}. ${st}` },
      dateBadge(r),
      h('span', { class: 'rmain' }, h('span', { class: 'p' }, procText(r)), meta.length ? h('span', { class: 'm' }, meta) : null),
      h('span', { class: 'rside' },
        v.v == null ? null : h('span', { class: 'val' + (v.kind === 'estimado' ? ' aprox' : '') }, (v.kind === 'estimado' ? '≈ ' : '') + brl0(v.v)),
        h('span', { class: 'st ' + tone }, st)));
  }
  function rowBtn(iconName, tone, title, sub, onTap, extra) {
    return h(onTap ? 'button' : 'div', { class: 'rowbtn', type: onTap ? 'button' : null, onclick: onTap || null },
      iconName ? h('span', { class: 'bubble ' + (tone || '') }, icon(iconName)) : null,
      h('span', { class: 't' }, title, sub ? h('small', null, sub) : null), extra || null, onTap ? icon('chev', 'chev') : null);
  }
  const secTitle = (t, right) => h('div', { class: 'sec-h' }, h('h2', null, t), right || null);

  // ================= navegação =================
  const APP_NAME = 'Controle de Cirurgias';
  const TITLES = { lista: 'Cirurgias', recebimentos: 'Recebimentos', relatorios: 'Relatórios', ajustes: 'Ajustes' };
  function go(tab, filtro) {
    S.tab = tab;
    if (filtro) S.f = { q: '', status: 'todas', periodo: 'tudo', col: '', hosp: '', conv: '', ...filtro };
    S.selecting = false; S.sel.clear();
    render(); window.scrollTo(0, 0);
  }
  function render() {
    for (const b of document.querySelectorAll('.tab')) b.setAttribute('aria-current', b.dataset.tab === S.tab ? 'page' : 'false');
    const t = $('#title');
    // na prévia, uma linha discreta avisa que as cirurgias são inventadas (para não confundir com as dela)
    if (S.tab === 'inicio') t.replaceChildren(APP_NAME, h('span', { class: 'sub' }, PREVIEW && S.demo ? `${greeting()}. Estas cirurgias são de exemplo.` : greeting() + (S.settings.nome ? ', ' + S.settings.nome : '')));
    else if (S.tab === 'ajustes') t.replaceChildren(h('button', { class: 'navbtn voltar', type: 'button', onclick: () => go('inicio') }, icon('back'), 'Início'), TITLES.ajustes);
    else t.replaceChildren(...[TITLES[S.tab], S.tab === 'lista' && S.records.length ? h('span', { class: 'sub' }, plural(S.records.length, 'cirurgia registrada', 'cirurgias registradas')) : null].filter(Boolean));
    const acts = $('#top-actions'); acts.replaceChildren();
    // Ajustes fica num ícone no topo do Início, com a bolinha quando o backup está atrasado
    if (S.tab === 'inicio') acts.append(h('button', { class: 'navbtn gear', id: 'btn-ajustes', type: 'button', 'aria-label': backupDue() ? 'Ajustes. Backup pendente' : 'Ajustes', onclick: () => go('ajustes') },
      icon('gear'), backupDue() ? h('span', { class: 'badge', 'aria-hidden': 'true' }) : null));
    if (S.tab === 'lista' && S.records.length) acts.append(h('button', { class: 'navbtn', type: 'button', onclick: () => { S.selecting = !S.selecting; S.sel.clear(); render(); } }, S.selecting ? 'Pronto' : 'Selecionar'));
    if (S.settings.pinHash) acts.append(h('button', { class: 'navbtn', type: 'button', 'aria-label': 'Bloquear agora', onclick: () => lockScreen() }, icon('lock')));
    const view = { inicio: viewInicio, lista: viewLista, recebimentos: viewRecebimentos, relatorios: viewRelatorios, ajustes: viewAjustes }[S.tab];
    // a tabela ganha uma coluna mais larga no computador e no iPhone deitado
    document.documentElement.classList.toggle('wide', S.tab === 'relatorios' && S.relTab === 'tabela');
    const faixa = TESTE ? tip('Modo de teste', ' Estes dados ficam num banco separado do app de verdade.', 'Sair do modo de teste', () => { location.href = location.pathname; }, 'alert', 'warn') : null;
    $('#main').replaceChildren(...[faixa, ...[].concat(view())].filter(Boolean));
    // o filtro escolhido sempre fica à vista na fileira de opções
    for (const on of document.querySelectorAll('#main .chips [aria-pressed="true"]')) {
      const row = on.parentElement; const l = on.offsetLeft - row.offsetLeft, r = l + on.offsetWidth;
      if (r > row.scrollLeft + row.clientWidth || l < row.scrollLeft) row.scrollLeft = Math.max(0, r - row.clientWidth + 16);
    }
  }
  function sheetAdd() {
    actionSheet('Adicionar', [
      ['whatsapp', 'chat', 'ok', 'Conversa do WhatsApp', 'Traz as cirurgias e as fotos do grupo', () => sheetWhatsHelp()],
      ['repasse', 'sheet', '', 'Planilha de repasse', 'Marca como pagas as cirurgias que estão nela', () => pickFile()],
      ['pagamento', 'cash', 'warn', 'Pagamento recebido', 'Quando o dinheiro cair sem planilha', () => sheetRecebi()],
      ['cirurgia', 'plus', 'night', 'Cirurgia', 'Cadastrar aqui, com foto da galeria', () => sheetRecord(null)],
    ]);
  }

  // ================= Início =================
  function viewInicio() {
    const out = [];
    if (!PREVIEW && S.storage === 'memory') out.push(tip('Os dados não estão sendo salvos', ' Abra o app pelo ícone na tela de início.', null, null, 'alert', 'warn'));
    else if (!PREVIEW && !TESTE && !isStandalone() && !S.settings.installHidden) out.push(tip('Instale na tela de início', ' No Safari, toque em Compartilhar e depois em Adicionar à Tela de Início.', 'Ver como', () => sheetInstall(), 'phone'));
    if (S.imports.some((x) => x.estado === 'andamento')) out.push(tip('A importação da conversa não terminou', ' O que já entrou está guardado. Escolha o arquivo da conversa de novo, e o app traz só o que faltou.', 'Continuar', () => sheetWhatsHelp(), 'alert', 'warn'));
    if (!S.records.length && !S.loose.length) { out.push(welcome()); return out; }
    const m = metrics();
    const strip = h('span', { class: 'strip' }, h('span', null, 'Recebido em ' + MES_LONGO[+today().slice(5, 7) - 1]), h('b', null, brl0(m.recMes)));
    let big, sub, label;
    if (!m.open) {
      // nada esperando pagamento: um recado no lugar de "R$ 0,00"
      big = h('span', { class: 'big txt' }, S.records.length ? 'Tudo em dia' : 'Nada ainda');
      sub = S.records.length ? 'Nenhuma cirurgia esperando pagamento.' : 'Organize as fotos para criar as cirurgias.';
      label = `Para receber: nada. ${sub}`;
    } else if (m.semValor === m.open) {
      // nenhuma cirurgia tem valor ainda (logo depois de trazer o WhatsApp): mostra quantas são, não "R$ 0,00"
      big = h('span', { class: 'big' }, String(m.open), h('span', { class: 'unit' }, m.open === 1 ? 'cirurgia' : 'cirurgias'));
      sub = 'Ainda sem valor. Quando você importar uma planilha de repasse, o app calcula uma estimativa.';
      label = `Para receber: ${plural(m.open, 'cirurgia', 'cirurgias')}, ainda sem valor. Ver as cirurgias a receber.`;
    } else {
      const [int, dec] = nf2.format(m.aReceber).split(',');
      big = h('span', { class: 'big' }, h('span', { class: 'cur' }, 'R$'), int, h('span', { class: 'cents' }, ',' + dec));
      // duas linhas curtas em vez de uma frase que quebra no meio; confirmado e estimado aparecem separados
      const partes = m.confirmados && m.estimados ? `${brl0(m.confirmados)} confirmados + ≈ ${brl0(m.estimados)} estimados`
        : m.confirmados ? `Valor confirmado de ${plural(m.open - m.semValor, 'cirurgia', 'cirurgias')}` : `Soma aproximada de ${plural(m.open, 'cirurgia', 'cirurgias')}`;
      sub = [h('span', null, partes), m.semValor ? h('span', null, `${m.semValor} ainda sem valor`) : null];
      label = `Para receber: ${m.estimados ? 'cerca de ' : ''}${brl(m.aReceber)}${m.confirmados && m.estimados ? `, sendo ${brl(m.confirmados)} confirmados e cerca de ${brl(m.estimados)} estimados` : ''}, de ${plural(m.open, 'cirurgia', 'cirurgias')}${m.semValor ? `, ${m.semValor} ainda sem valor` : ''}. Ver as cirurgias a receber.`;
    }
    out.push(h('button', { class: 'hero', type: 'button', onclick: () => go('recebimentos'), 'aria-label': label.replace('Ver as cirurgias a receber.', 'Ver os recebimentos.') },
      h('span', { class: 'label' }, 'Para receber'), big, h('span', { class: 'sub' }, sub), h('span', { class: 'stitch', 'aria-hidden': 'true' }), strip));
    // "Precisa de atenção": no máximo 3 linhas, cada uma levando à tela certa (os detalhes ficam em Recebimentos)
    const todo = (ic, tone, title, sub, fn) => { const b = rowBtn(ic, tone, title, sub, fn); b.classList.add(tone); return b; };
    const rows = [];
    if (m.review) rows.push(todo('alert', 'warn', plural(m.review, 'cirurgia para completar', 'cirurgias para completar'), 'falta procedimento, hospital ou colega', () => go('lista', { status: 'revisar' })));
    if (m.loose) rows.push(todo('photo', 'accent', plural(m.loose, 'foto sem legenda', 'fotos sem legenda'), 'diga de qual cirurgia é cada uma', () => sheetLoose()));
    if (m.late) { const v = S.records.filter(isLate).reduce((a, r) => a + (valueOf(r).v || 0), 0);
      rows.push(todo('clock', 'danger', plural(m.late, 'cirurgia atrasada', 'cirurgias atrasadas'), `passaram do prazo de costume${v ? `, cerca de ${brl0(v)}` : ''}`, () => { go('recebimentos'); const el = $('#sec-atrasadas'); if (el) el.scrollIntoView({ block: 'start' }); })); }
    if (m.checks) rows.push(todo('moon', 'night', plural(m.checks, 'pagamento sem o adicional noturno', 'pagamentos sem o adicional noturno'), 'confira com o faturamento', () => { S.relTab = 'totais'; go('relatorios'); const el = $('#sec-conferir') || $('#sec-convenios'); if (el) el.scrollIntoView({ block: 'start' }); }));
    if (rows.length) out.push(h('section', { class: 'sec', id: 'sec-atencao' }, secTitle('Precisa de atenção'), h('div', { class: 'todo' }, rows.slice(0, 3))));
    const recent = [...S.records].sort(byDateDesc).slice(0, 5);
    if (recent.length) out.push(h('section', { class: 'sec' }, secTitle('Últimas cirurgias', h('button', { type: 'button', onclick: () => go('lista', {}) }, 'Ver todas')),
      h('div', { class: 'group' }, recent.map((r) => recordItem(r, (x) => sheetRecord(x))))));
    return out;
  }
  function welcome() {
    return h('section', { class: 'welcome' },
      h('span', { class: 'halo' }, icon('chat')),
      h('h2', null, 'Vamos trazer suas cirurgias do WhatsApp'),
      h('p', null, 'O app lê as fotos e as legendas do seu grupo, organiza tudo e mostra quanto você tem para receber. Nada sai do seu iPhone.'),
      h('button', { class: 'btn primary block', type: 'button', onclick: () => sheetWhatsHelp() }, 'Começar'),
      h('button', { class: 'btn ghost block', type: 'button', onclick: () => sheetRecord(null) }, 'Prefiro cadastrar uma cirurgia'));
  }
  const byDateDesc = (a, b) => (b.date + (b.time || '')).localeCompare(a.date + (a.time || '')) || (b.num || 0) - (a.num || 0);

  // ================= Cirurgias =================
  function periodRange(p) {
    const t = today(); const y = +t.slice(0, 4), mo = +t.slice(5, 7);
    const first = (yy, mm) => C.ymd(yy, mm, 1);
    if (p === 'mes') return [first(y, mo), t];
    if (p === 'mespassado') { const pm = mo === 1 ? 12 : mo - 1, py = mo === 1 ? y - 1 : y; return [first(py, pm), C.fromDayNum(C.dayNum(first(y, mo)) - 1)]; }
    if (p === '3m') return [C.fromDayNum(C.dayNum(t) - 92), t];
    if (p === 'ano') return [first(y, 1), C.ymd(y, 12, 31)];
    if (p === 'anopassado') return [first(y - 1, 1), C.ymd(y - 1, 12, 31)];
    return null;
  }
  const PERIODOS = [['tudo', 'Desde o início'], ['mes', 'Este mês'], ['mespassado', 'Mês passado'], ['3m', 'Últimos 3 meses'], ['ano', 'Este ano'], ['anopassado', 'Ano passado']];
  function filtered(f) {
    f = f || S.f; const q = C.norm(f.q); const rng = periodRange(f.periodo);
    return S.records.filter((r) => {
      if (f.status === 'aberto' && !isOpen(r)) return false;
      if (f.status === 'recebido' && !isPaid(r)) return false;
      if (f.status === 'atrasadas' && !isLate(r)) return false;
      if (f.status === 'revisar' && !needsReview(r)) return false;
      if (rng && (r.date < rng[0] || r.date > rng[1])) return false;
      if (f.col && !(r.cols || []).includes(f.col)) return false;
      if (f.hosp && r.hosp !== f.hosp) return false;
      if (f.conv && r.conv !== f.conv) return false;
      if (q) {
        const hay = C.norm([procText(r), r.hosp, (r.cols || []).join(' '), r.conv, r.notas, r.caption, ddmmyyyy(r.date), dataLonga(r.date, { ano: true }), r.num ? 'n' + r.num : ''].join(' '));
        if (!q.split(' ').every((w) => hay.includes(w))) return false;
      }
      return true;
    }).sort(byDateDesc);
  }
  const usedValues = (k) => uniq(S.records.flatMap((r) => (k === 'cols' ? r.cols || [] : [r[k]]))).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  function viewLista() {
    if (!S.records.length) return [welcome()];
    const out = [];
    const search = h('input', { id: 'busca', type: 'search', placeholder: 'Buscar cirurgia, colega ou hospital', value: S.f.q, autocomplete: 'off', 'aria-label': 'Buscar' });
    search.addEventListener('input', () => { S.f.q = search.value; drawList(); });
    out.push(h('div', { class: 'search' }, icon('search'), search));
    const counts = { todas: S.records.length, aberto: S.records.filter(isOpen).length, atrasadas: S.records.filter(isLate).length, recebido: S.records.filter(isPaid).length, revisar: S.records.filter(needsReview).length };
    const extra = ['periodo', 'col', 'hosp', 'conv'].filter((k) => (k === 'periodo' ? S.f.periodo !== 'tudo' : S.f[k]));
    out.push(h('div', { class: 'toolbar' },
      h('div', { class: 'chips', role: 'group', 'aria-label': 'Situação' }, [['todas', 'Todas'], ['aberto', 'A receber'], ['atrasadas', 'Atrasadas'], ['recebido', 'Recebidas'], ['revisar', 'Completar']]
        .filter(([k]) => k === 'todas' || counts[k] > 0 || S.f.status === k)
        .map(([k, l]) => h('button', { class: 'chip', type: 'button', 'aria-pressed': String(S.f.status === k), onclick: () => { S.f.status = k; render(); } }, l, h('span', { class: 'n' }, counts[k])))),
      h('button', { class: 'iconchip', type: 'button', 'aria-label': 'Filtrar por período, colega, hospital ou convênio', onclick: sheetFiltros }, icon('filter'), extra.length ? h('span', { class: 'dot' }) : null)));
    if (extra.length) out.push(h('div', { class: 'qchips' }, extra.map((k) => h('button', { class: 'qchip', type: 'button', 'aria-pressed': 'true', 'aria-label': 'Tirar o filtro', onclick: () => { if (k === 'periodo') S.f.periodo = 'tudo'; else S.f[k] = ''; render(); } },
      k === 'periodo' ? PERIODOS.find((p) => p[0] === S.f.periodo)[1] : S.f[k], h('span', { class: 'x', 'aria-hidden': 'true' }, '✕')))));
    const selbar = h('div', { class: 'selbar', hidden: !S.selecting });
    const listBox = h('div', { class: 'sec' });
    out.push(selbar, listBox);
    function drawSel() {
      selbar.hidden = !S.selecting;
      selbar.replaceChildren(h('span', null, S.sel.size ? plural(S.sel.size, 'escolhida', 'escolhidas') : 'Toque nas cirurgias'),
        h('button', { class: 'btn', type: 'button', disabled: !S.sel.size, onclick: () => bulk('recebido') }, 'Já recebi'),
        h('button', { class: 'btn', type: 'button', disabled: !S.sel.size, onclick: () => bulk('excluir'), 'aria-label': 'Excluir as escolhidas' }, icon('trash', 'sm')));
    }
    function drawList() {
      const rs = filtered(); const groups = new Map();
      for (const r of rs) { const k = r.date.slice(0, 7); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r); }
      const tap = (r) => { if (S.selecting) { S.sel.has(r.id) ? S.sel.delete(r.id) : S.sel.add(r.id); drawSel(); drawList(); } else sheetRecord(r); };
      const kids = [];
      if (!rs.length) kids.push(h('div', { class: 'empty' }, h('span', { class: 'halo' }, icon('search')), h('p', null, 'Nenhuma cirurgia com esses filtros.')));
      for (const [k, arr] of groups) {
        kids.push(h('div', { class: 'month-h' }, h('h3', null, monthName(k)), h('span', null, plural(arr.length, 'cirurgia', 'cirurgias'))));
        kids.push(h('div', { class: 'group' }, arr.map((r) => recordItem(r, tap, S.selecting ? S.sel.has(r.id) : null))));
      }
      listBox.replaceChildren(...kids);
    }
    drawSel(); drawList();
    return out;
  }
  function sheetFiltros() {
    const f = { ...S.f };
    openSheet({ title: 'Filtrar', render(api) {
      const sel = (id, label, cur, opts, k) => field(label, h('select', { id, onchange: (e) => { f[k] = e.target.value; api.update(); } }, opts.map(([v, l]) => h('option', { value: v, selected: v === cur }, l))));
      const n = filtered(f).length;
      return { body: [h('div', { class: 'form' },
        sel('fl-per', 'Quando', f.periodo, PERIODOS, 'periodo'),
        sel('fl-col', 'Colega', f.col, [['', 'Todos'], ...usedValues('cols').map((v) => [v, v])], 'col'),
        sel('fl-hosp', 'Hospital', f.hosp, [['', 'Todos'], ...usedValues('hosp').map((v) => [v, v])], 'hosp'),
        sel('fl-conv', 'Convênio', f.conv, [['', 'Todos'], ...usedValues('conv').map((v) => [v, v])], 'conv'))],
        foot: [h('button', { class: 'btn', type: 'button', onclick: () => { Object.assign(f, { periodo: 'tudo', col: '', hosp: '', conv: '' }); api.update(); } }, 'Limpar'),
          h('button', { class: 'btn primary', type: 'button', onclick: () => { S.f = f; api.close(true); render(); } }, `Ver ${plural(n, 'cirurgia', 'cirurgias')}`)] };
    } });
  }
  async function bulk(kind) {
    const ids = [...S.sel]; const n = ids.length; if (!n) return;
    if (kind === 'excluir') {
      if (!(await confirmDialog({ title: `Excluir ${plural(n, 'cirurgia', 'cirurgias')}?`, text: `Elas ficam ${LIXEIRA_DIAS} dias na lixeira, em Ajustes, com as fotos. No WhatsApp, nada muda.`, ok: 'Excluir', danger: true }))) return;
      const itens = await excluirCirurgias(ids.map((id) => S.records.find((x) => x.id === id)).filter(Boolean));
      S.selecting = false; S.sel.clear(); derive(); render();
      toast(n === 1 ? 'Cirurgia excluída.' : `${n} cirurgias excluídas.`, 0, desfazer(itens, n === 1 ? 'A cirurgia voltou.' : 'As cirurgias voltaram.'));
      return;
    } else if (kind === 'recebido') {
      if (!(await confirmDialog({ title: `Marcar ${plural(n, 'cirurgia', 'cirurgias')} como recebidas?`, text: 'Bom para as que já foram pagas antes de você usar o app. O valor fica em branco e você pode completar depois.', ok: 'Marcar' }))) return;
      for (const id of ids) { const r = S.records.find((x) => x.id === id); if (r && isOpen(r)) { r.pagamentos = [...(r.pagamentos || []), { id: C.uid('g'), valor: null, data: today(), origem: 'manual' }]; await saveRecord(r); } }
    }
    S.selecting = false; S.sel.clear(); derive(); render(); toast('Pronto.');
  }

  // ================= Relatórios =================
  // três abas: o gráfico por mês, a tabela de controle e os totais (por colega, hospital e convênio)
  const REL_TABS = [['meses', 'Meses'], ['tabela', 'Tabela'], ['totais', 'Totais']];
  function viewRelatorios() {
    if (!S.records.length) return [welcome()];
    if (!REL_TABS.some(([k]) => k === S.relTab)) S.relTab = 'meses';
    const out = [seg(REL_TABS, S.relTab, (v) => { S.relTab = v; render(); window.scrollTo(0, 0); }, 'Tipo de relatório')];
    out.push(...({ meses: repMeses, tabela: repTabela, totais: repTotais }[S.relTab])());
    return out;
  }
  function repTotais() {
    return [
      h('section', { class: 'sec' }, secTitle('Por colega'), repGrupo('colegas')),
      h('section', { class: 'sec' }, secTitle('Por hospital'), repGrupo('hospitais')),
      h('section', { class: 'sec', id: 'sec-convenios' }, secTitle('Por convênio'), h('p', { class: 'note' }, 'Pelo que veio nas planilhas de repasse.'), ...repConvenios())];
  }
  // nome curto da operação, para caber na tabela: sem o que está entre parênteses e com "VL" no lugar de videolaparoscópica
  const shortProc = (p) => p.replace(/\s*\([^)]*\)/g, '').replace(/\s+v[íi]deo\s*laparosc[óo]pic[ao]s?\b/gi, ' VL').replace(/\s+laparosc[óo]pic[ao]s?\b/gi, ' lap.').trim();
  const procShort = (r) => (r.procs && r.procs.length ? r.procs.map(shortProc).join(' + ') : 'Sem procedimento');
  function sumsBy(keyFn) {
    const by = new Map();
    for (const r of S.records) for (const k of [].concat(keyFn(r))) {
      if (!k) continue; if (!by.has(k)) by.set(k, { n: 0, rec: 0, est: 0, nRec: 0, nAb: 0 });
      const o = by.get(k); o.n++; const f = fin(r);
      if (f.s === 'semcobranca') continue;
      o.rec += f.recebido;                           // o que já entrou, inclusive a parte de uma cirurgia paga em parte
      if (f.s === 'recebido') o.nRec++; else { o.nAb++; if (f.aReceber != null) o.est += f.aReceber; }
    }
    return by;
  }
  // tabela simples: data, operação, colega, hospital, valor e se recebeu; da mais nova para a mais antiga
  const ddmm = (d) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
  function repTabela() {
    const f = S.tabF || 'todas';
    const all = [...S.records].sort(byDateDesc);
    const isRec = isPaid;
    const counts = { todas: all.length, nao: all.filter(isOpen).length, sim: all.filter(isRec).length };
    const rows = all.filter((r) => f === 'todas' || (f === 'sim' ? isRec(r) : isOpen(r)));
    const chips = h('div', { class: 'chips', role: 'group', 'aria-label': 'Mostrar' }, [['todas', 'Todas'], ['nao', 'Não recebidas'], ['sim', 'Recebidas']]
      .map(([k, l]) => h('button', { class: 'chip', type: 'button', 'aria-pressed': String(f === k), onclick: () => { S.tabF = k; render(); } }, l, h('span', { class: 'n' }, counts[k]))));
    const kids = [h('div', { class: 'trow head', 'aria-hidden': 'true' }, h('span', { class: 'c-data' }, 'Data'), h('span', { class: 'c-op' }, 'Operação'),
      h('span', { class: 'c-sub' }, h('span', null, 'Colega'), h('span', null, 'hospital')), h('span', { class: 'c-val' }, 'Valor'), h('span', { class: 'c-rec' }, 'Recebeu'))];
    const yNow = today().slice(0, 4); let lastY = null;
    for (const r of rows) {
      const y = r.date.slice(0, 4);
      if (y !== lastY && !(lastY === null && y === yNow)) kids.push(h('div', { class: 'trow year', 'aria-hidden': 'true' }, y));
      lastY = y;
      const v = valueOf(r);
      const valTxt = v.kind === 'semcobranca' || v.v == null ? '—' : v.kind === 'estimado' ? '≈ ' + brl0(v.v) : brl(v.v);
      const cols = (r.cols || []).join(', ');
      const recEl = isRec(r) ? h('span', { class: 'pill sim' }, 'Sim') : r.status === 'semcobranca' ? h('span', { class: 'pill sc' }, '—') : sit(r) === 'parcial' ? h('span', { class: 'pill parte' }, 'Parte') : h('span', { class: 'pill nao' }, 'Não');
      kids.push(h('button', { class: 'trow', type: 'button', onclick: () => sheetRecord(r),
        'aria-label': `${dataLonga(r.date, { ano: true })}: ${procText(r)}${cols ? ', com ' + cols : ''}${r.hosp ? ', ' + r.hosp : ''}. Valor ${valTxt === '—' ? 'sem valor' : valTxt}. ${isRec(r) ? 'Recebida' : r.status === 'semcobranca' ? 'Sem cobrança' : sit(r) === 'parcial' ? 'Recebida em parte' : 'Não recebida'}.` },
        h('span', { class: 'c-data' }, ddmm(r.date)), h('span', { class: 'c-op' }, procShort(r)),
        h('span', { class: 'c-sub' }, h('span', { class: cols ? null : 'empty' }, cols || '—'), h('span', { class: r.hosp ? null : 'empty' }, r.hosp || '—')),
        h('span', { class: 'c-val' + (v.kind === 'estimado' ? ' aprox' : '') }, valTxt), h('span', { class: 'c-rec' }, recEl)));
    }
    if (!rows.length) kids.push(h('div', { class: 'empty' }, h('p', null, 'Nenhuma cirurgia aqui.')));
    return [chips, h('div', { class: 'tbl' }, kids), h('button', { class: 'link', type: 'button', onclick: () => exportCSV() }, 'Baixar como planilha')];
  }
  function moneyLines(o) {
    if (o.rec && o.est) return [brl0(o.rec), `recebido, e ≈ ${brl0(o.est)} a receber`];
    if (o.rec) return [brl0(o.rec), 'recebido'];
    if (o.est) return ['≈ ' + brl0(o.est), 'a receber'];
    return ['—', ''];
  }
  const short = (v) => (v >= 1000 ? nf1.format(v / 1000) + ' mil' : nf0.format(v));
  // os últimos 8 meses até o mês atual, sem pular os meses vazios (a partir do primeiro mês com cirurgia)
  function chartMonths(keys) {
    const t = today(); let y = +t.slice(0, 4), m = +t.slice(5, 7);
    const out = [];
    for (let i = 0; i < 8; i++) { out.unshift(`${y}-${String(m).padStart(2, '0')}`); if (--m === 0) { m = 12; y--; } }
    const first = keys[0];
    const from = out.findIndex((k) => k >= first);
    return first && from > 0 ? out.slice(from) : out;
  }
  function repMeses() {
    const by = sumsBy((r) => r.date.slice(0, 7));
    const keys = [...by.keys()].sort();
    const empty = { n: 0, rec: 0, est: 0, nRec: 0, nAb: 0 };
    const last = chartMonths(keys);
    const get = (k) => by.get(k) || empty;
    const qtd = S.chartMode === 'qtd';
    const parts = (o) => (qtd ? [o.nRec, o.nAb] : [o.rec, o.est]);
    const max = Math.max(1, ...last.map((k) => { const [a, b] = parts(get(k)); return a + b; }));
    const chart = h('div', { class: 'chartcard' },
      h('div', { class: 'chart-h' }, h('h2', null, 'Por mês'), seg([['valor', 'Valor'], ['qtd', 'Quantidade']], qtd ? 'qtd' : 'valor', (v) => { S.chartMode = v; render(); }, 'Mostrar o gráfico por', 'sm')),
      h('div', { class: 'legend' }, h('span', null, h('i', { class: 'rec' }), qtd ? 'Recebidas' : 'Recebido'), h('span', null, h('i', { class: 'est' }), 'A receber')),
      h('div', { class: 'vbars', role: 'img', 'aria-label': (qtd ? 'Quantidade de cirurgias por mês: ' : 'Valores por mês da cirurgia: ') + last.map((k) => { const [a, b] = parts(get(k)); return `${MES_LONGO[+k.slice(5, 7) - 1]}, ${qtd ? a + b : brl0(a + b)}`; }).join('; ') },
        last.map((k) => { const o = get(k); const [a, b] = parts(o); const tot = a + b;
        return h('div', { class: 'vbar' }, h('span', { class: 'tot' }, tot ? (qtd ? String(tot) : short(tot)) : ''),
          h('div', { class: 'stack', style: `height:${tot ? Math.max(4, (tot / max) * 100) : 0}%` }, b ? h('span', { class: 'est', style: `flex:${b}` }) : null, a ? h('span', { class: 'rec', style: `flex:${a}` }) : null),
          h('span', { class: 'lab' }, MES[+k.slice(5, 7) - 1])); })),
      h('p', { class: 'note' }, qtd ? 'Cirurgias feitas em cada mês.' : 'Pelo mês em que a cirurgia foi feita. A receber é o valor aproximado.'));
    // o que antes ficava no Início: atrasos e adicional noturno
    const late = S.records.filter(isLate);
    const lateVal = late.reduce((s, r) => s + (valueOf(r).v || 0), 0);
    const watch = [];
    if (late.length) watch.push(rowBtn('clock', 'danger', plural(late.length, 'cirurgia esperando pagamento', 'cirurgias esperando pagamento'), `passaram do prazo de costume${lateVal ? `, cerca de ${brl0(lateVal)}` : ''}`, () => go('lista', { status: 'atrasadas' })));
    if (S.checks.length) watch.push(rowBtn('moon', 'night', plural(S.checks.length, 'pagamento sem o adicional noturno', 'pagamentos sem o adicional noturno'), 'feitas à noite, no fim de semana ou em feriado', () => { S.relTab = 'totais'; render(); const el = $('#sec-conferir') || $('#sec-convenios'); if (el) el.scrollIntoView({ block: 'start' }); }));
    const rows = [...keys].reverse().map((k) => { const o = by.get(k); const [a, b] = moneyLines(o);
      return rowBtn(null, null, monthName(k), plural(o.n, 'cirurgia', 'cirurgias'), null, h('span', { class: 'v' }, a, b ? h('small', null, b) : null)); });
    const pays = recebidoPorMes();
    const out = [chart];
    if (watch.length) out.push(h('section', { class: 'sec' }, secTitle('Para acompanhar'), h('div', { class: 'group' }, watch)));
    out.push(h('section', { class: 'sec' }, secTitle('Mês a mês'), h('p', { class: 'note' }, 'Pelo mês em que a cirurgia foi feita.'), h('div', { class: 'group flat' }, rows)));
    if (pays.size) out.push(h('section', { class: 'sec' }, secTitle('Dinheiro que entrou'), h('p', { class: 'note' }, 'Pelo mês em que o pagamento caiu.'),
      h('div', { class: 'group flat' }, [...pays.keys()].sort().reverse().map((k) => rowBtn(null, null, monthName(k), null, null, h('span', { class: 'v' }, brl(pays.get(k))))))));
    return out;
  }
  function repGrupo(kind) {
    const by = sumsBy((r) => (kind === 'colegas' ? (r.cols && r.cols.length ? r.cols : 'Sem colega') : r.hosp || 'Sem hospital'));
    const keys = [...by.keys()].sort((a, b) => by.get(b).n - by.get(a).n);
    return [h('div', { class: 'group' }, keys.map((k) => { const o = by.get(k); const [a, b] = moneyLines(o);
      return h('div', { class: 'rowbtn' }, kind === 'colegas' ? h('span', { class: 'avatar' }, initials(k)) : h('span', { class: 'bubble' }, icon('building')),
        h('span', { class: 't' }, k, h('small', null, plural(o.n, 'cirurgia', 'cirurgias'))), h('span', { class: 'v' }, a, b ? h('small', null, b) : null)); }))];
  }
  function repConvenios() {
    const by = new Map();
    for (const r of S.records) for (const l of r.rep || []) { const k = l.conv || 'Sem convênio'; if (!by.has(k)) by.set(k, { n: 0, v: 0 }); const o = by.get(k); o.n++; o.v += l.valor; }
    const keys = [...by.keys()].sort((a, b) => by.get(b).v - by.get(a).v);
    const out = [];
    out.push(keys.length ? h('div', { class: 'group' }, keys.map((k) => { const o = by.get(k);
      return h('div', { class: 'rowbtn' }, h('span', { class: 'bubble' }, icon('sheet')), h('span', { class: 't' }, k, h('small', null, `${plural(o.n, 'procedimento', 'procedimentos')}, média de ${brl0(o.v / o.n)}`)), h('span', { class: 'v' }, brl0(o.v))); }))
      : h('div', { class: 'empty' }, h('span', { class: 'halo' }, icon('sheet')), h('p', null, 'Aparece depois que você abrir uma planilha de repasse.')));
    if (S.checks.length) out.push(h('section', { class: 'sec', id: 'sec-conferir' }, h('div', { class: 'sec-h' }, h('h2', { class: 'sm' }, 'Pagamentos para conferir')),
      h('p', { class: 'note' }, 'Feitas das 19h às 7h, no fim de semana ou em feriado, mas pagas pelo valor do horário normal.'),
      h('div', { class: 'group' }, S.checks.map((c) => { const r = S.records.find((x) => x.id === c.recId); return r ? recordItem(r, (x) => sheetRecord(x)) : null; }))));
    const refs = [...S.refs.byProc.entries()].sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'));
    out.push(h('details', { class: 'more' }, h('summary', null, 'Como o app calcula o valor aproximado'),
      h('div', { class: 'sec' }, h('p', { class: 'note' }, 'Pela média do que você já recebeu em cada procedimento, juntando os convênios. Das 19h às 7h, no fim de semana e em feriado, conta 30% a mais, como na tabela CBHPM. Quando há dois procedimentos na mesma cirurgia, o segundo conta pela metade.'),
        refs.length ? h('div', { class: 'group flat' }, refs.map(([p, arr]) => rowBtn(null, null, p, `${brl0(C.median(arr))} no horário normal, ${brl0(C.median(arr) * 1.3)} à noite e no fim de semana`))) : null)));
    return out;
  }

  // ================= Ajustes =================
  const TEMAS = [['rose', 'Rosé', '#b0466e'], ['vinho', 'Vinho', '#8b2e46'], ['ameixa', 'Ameixa', '#7b3f8f'], ['lavanda', 'Lavanda', '#6a58b6'], ['azul', 'Azul', '#2d66b5'],
    ['marinho', 'Marinho', '#243f72'], ['petroleo', 'Petróleo', '#12706f'], ['salvia', 'Sálvia', '#4a7960'], ['caramelo', 'Caramelo', '#96663a'], ['grafite', 'Grafite', '#434a56']];
  function viewAjustes() {
    const sec = (title, kids) => h('section', { class: 'sec' }, h('div', { class: 'sec-h' }, h('h2', { class: 'sm' }, title)), h('div', { class: 'group' }, kids));
    const out = [];
    if (backupDue()) out.push(tip(S.settings.lastBackup ? 'Hora de fazer um backup' : 'Faça seu primeiro backup', ' Os dados ficam só neste iPhone. Guarde uma cópia no iCloud Drive.', 'Fazer backup agora', () => exportBackup(), 'share', 'warn'));
    if (PREVIEW || (!TESTE && !isStandalone())) out.push(h('div', { class: 'group' }, rowBtn('phone', '', 'Instalar no iPhone', PREVIEW ? 'Para usar no dia a dia, com as suas cirurgias' : 'Para abrir pelo ícone, sem internet', () => sheetInstall())));
    out.push(sec('Cor do app', [h('div', { class: 'swatches', role: 'group', 'aria-label': 'Cor do app' }, TEMAS.map(([k, l, c]) => h('button', { class: 'swatch', type: 'button', 'aria-pressed': String((S.settings.tema || 'ameixa') === k), onclick: async () => { S.settings.tema = k; applyTheme(); await saveSettings(); render(); } }, h('i', { style: `background:${c}` }), l)))]));
    out.push(sec('Seus dados', [
      rowBtn('share', 'ok', 'Fazer backup', S.settings.lastBackup ? 'O último foi em ' + ddmmyyyy(S.settings.lastBackup) : 'Você ainda não fez nenhum', () => exportBackup()),
      rowBtn('undo', 'plain', 'Restaurar um backup', 'Troca os dados deste iPhone pelos do backup. Se ele tiver partes, escolha todas juntas.', () => pickBackup()),
      rowBtn('sheet', 'plain', 'Exportar planilha', 'Para abrir no Excel ou no Numbers', () => exportCSV())]));
    out.push(sec('Organização', [
      rowBtn('photo', '', 'Fotos para organizar', plural(S.loose.length, 'foto', 'fotos'), () => sheetLoose()),
      rowBtn('tag', '', 'Nomes e abreviações', 'Colegas, hospitais, procedimentos e convênios', () => sheetTerms()),
      rowBtn('folder', '', 'Planilhas de repasse', plural(S.repasses.length, 'importada', 'importadas'), () => sheetRepasses()),
      rowBtn('chat', '', 'Conversas do WhatsApp', plural(S.imports.length, 'importada', 'importadas'), () => sheetImports()),
      rowBtn('trash', '', 'Lixeira', S.trash.length ? `${plural(S.trash.length, 'item', 'itens')} dos últimos ${LIXEIRA_DIAS} dias` : 'Vazia', () => sheetLixeira())]));
    out.push(sec('Preferências', [
      rowBtn('user', 'plain', 'Seu nome', S.settings.nome || 'Para o app te cumprimentar', async () => { const v = await formDialog({ title: 'Seu nome', fields: [{ id: 'n', label: 'Como você quer ser chamada', value: S.settings.nome }] }); if (v) { S.settings.nome = v.n.trim(); await saveSettings(); render(); } }),
      rowBtn('clock', 'danger', 'Aviso de atraso', `Pelo prazo de costume de quem paga. Sem histórico, depois de ${S.settings.alertDias} dias`, async () => {
        const v = await formDialog({ title: 'Aviso de atraso', text: 'Com histórico, o app usa o prazo de costume de cada hospital, convênio ou colega. Sem histórico, depois de quantos dias sem pagamento a cirurgia aparece como atrasada?', fields: [{ id: 'd', label: 'Dias', type: 'number', inputmode: 'numeric', value: S.settings.alertDias }] });
        if (v && +v.d > 0) { S.settings.alertDias = Math.round(+v.d); await saveSettings(); render(); }
      }),
      rowBtn('cal', 'night', 'Feriados da cidade', feriadosTxt() || 'Nenhum', () => sheetFeriados()),
      rowBtn('bell', 'ok', 'Lembrete no Calendário', S.settings.lembrete ? `Todo dia ${S.settings.lembrete.dia}, às ${horaTxt(S.settings.lembrete.hora)}` : 'Conversa, planilha e backup, todo mês', () => sheetLembrete()),
      rowBtn('lock', 'warn', 'Senha para abrir', S.settings.pinHash ? 'Ligada' : 'Desligada', () => sheetPin())]));
    out.push(h('div', { class: 'group' },
      h('div', { class: 'rowbtn' }, h('span', { class: 'bubble plain' }, icon('info')), h('span', { class: 't' }, 'Versão ' + VERSION, h('small', { id: 'storage-info' }, PREVIEW ? 'Prévia com cirurgias de exemplo. Nada fica salvo aqui.' : S.storage === 'memory' ? 'Nada está sendo salvo' : 'Os dados ficam só neste aparelho'))),
      rowBtn('info', 'plain', 'Copiar diagnóstico', 'Para mandar quando algo der errado. Não leva dados das cirurgias.', () => sheetDiagnostico()),
      h('button', { class: 'rowbtn danger', type: 'button', onclick: () => wipeAll() }, h('span', { class: 'bubble danger' }, icon('trash')), h('span', { class: 't' }, TESTE ? 'Apagar os dados de teste' : 'Apagar todos os dados'))));
    if (navigator.storage && navigator.storage.estimate && S.storage !== 'memory') navigator.storage.estimate().then((e) => { const el = $('#storage-info'); if (el && e.usage) el.textContent = `Os dados ficam só neste aparelho (${(e.usage / 1048576).toFixed(1).replace('.', ',')} MB)`; }).catch(() => {});
    return out;
  }
  // ================= Recebimentos (item 27) =================
  // A receber e recebido no mês, quando deve cair, as atrasadas, as pagas em parte e o histórico de planilhas e
  // pagamentos. Ações de registrar ficam no botão +.
  function viewRecebimentos() {
    if (!S.records.length) return [h('div', { class: 'empty' }, h('span', { class: 'halo' }, icon('cash')), h('p', null, 'Nenhuma cirurgia ainda. Traga a conversa do WhatsApp pelo botão +.'))];
    const m = metrics(); const out = [];
    const aReceber = !m.open ? 'Nada esperando pagamento' : m.semValor === m.open ? plural(m.open, 'cirurgia', 'cirurgias') + ', ainda sem valor'
      : m.confirmados && m.estimados ? `${brl0(m.confirmados)} confirmados + ≈ ${brl0(m.estimados)} estimados` : plural(m.open, 'cirurgia', 'cirurgias') + (m.semValor ? `, ${m.semValor} ainda sem valor` : '');
    const total = m.open && m.semValor !== m.open ? (m.estimados ? '≈ ' : '') + brl0(m.aReceber) : '—';
    out.push(h('div', { class: 'group' },
      rowBtn('cash', 'accent', 'A receber', aReceber, m.open ? () => go('lista', { status: 'aberto' }) : null, h('span', { class: 'v' }, total)),
      rowBtn('check', 'ok', 'Recebido em ' + MES_LONGO[+today().slice(5, 7) - 1], 'o que caiu na conta neste mês', null, h('span', { class: 'v' }, brl0(m.recMes)))));
    const prev = previsao(); if (prev) out.push(prev);
    const lista = (id, titulo, nota, rs, filtro) => h('section', { class: 'sec', id }, secTitle(titulo, rs.length > 5 && filtro ? h('button', { type: 'button', onclick: () => go('lista', { status: filtro }) }, 'Ver todas') : null),
      nota ? h('p', { class: 'note' }, nota) : null, h('div', { class: 'group' }, rs.slice(0, 5).map((r) => recordItem(r, (x) => sheetRecord(x)))));
    const atrasadas = S.records.filter(isLate).sort((a, b) => a.date.localeCompare(b.date));
    if (atrasadas.length) out.push(lista('sec-atrasadas', 'Atrasadas', 'Passaram do prazo de costume de quem paga. Sem histórico de quem paga, depois de ' + S.settings.alertDias + ' dias.', atrasadas, 'atrasadas'));
    const parciais = S.records.filter((r) => sit(r) === 'parcial').sort((a, b) => a.date.localeCompare(b.date));
    if (parciais.length) out.push(lista('sec-parciais', 'Pagas em parte', 'Já entrou uma parte; o resto continua a receber.', parciais, null));
    out.push(historico());
    return out;
  }
  // Histórico: cada planilha de repasse numa linha e cada pagamento registrado por ela, do mais novo para o mais antigo
  function historico() {
    const itens = [];
    for (const d of S.repasses) itens.push({ data: d.pay || '', el: () => rowBtn('sheet', '', d.numero ? 'Planilha nº ' + d.numero : d.nome || 'Planilha de repasse',
      `${ddmmyyyy(d.pay)}: ${brl(d.total)} liberados${d.caiu != null ? `, caiu ${brl(d.caiu)}` : ''}`, () => sheetRepasses(), h('span', { class: 'v' }, brl0(d.caiu != null ? d.caiu : d.total))) });
    for (const r of S.records) for (const p of r.pagamentos || []) {
      if (p.origem === 'repasse') continue;
      itens.push({ data: p.data || '', el: () => rowBtn('cash', 'ok', procText(r), `${p.data ? ddmmyyyy(p.data) : 'sem data'}: registrado por você${p.fonte ? ', de ' + p.fonte : ''}${p.parcial ? ', uma parte' : ''}`,
        () => sheetRecord(r), h('span', { class: 'v' }, p.valor == null ? 'sem valor' : brl0(p.valor))) });
    }
    itens.sort((a, b) => b.data.localeCompare(a.data));
    const n = S.histN || 10;
    return h('section', { class: 'sec', id: 'sec-historico' }, secTitle('Histórico', S.repasses.length ? h('button', { type: 'button', onclick: () => sheetRepasses() }, 'Planilhas') : null),
      h('p', { class: 'note' }, 'Planilhas de repasse e pagamentos que você registrou.'),
      itens.length ? h('div', { class: 'group' }, itens.slice(0, n).map((x) => x.el())) : h('p', { class: 'note' }, 'Nenhum pagamento ainda.'),
      itens.length > n ? h('button', { class: 'btn ghost block', type: 'button', onclick: () => { S.histN = n + 20; render(); } }, 'Ver mais') : null);
  }
  // ---- prazo e previsão (item 28) ----
  function quandoCai(r, pz) {
    const alvo = C.fromDayNum(C.dayNum(r.date) + pz.tipico);
    return alvo >= today() ? `Deve cair por volta de ${ddmm(alvo)}: ${pz.nome} costuma pagar em cerca de ${pz.tipico} dias.`
      : `Já pode cair a qualquer momento: ${pz.nome} costuma pagar em cerca de ${pz.tipico} dias.`;
  }
  // Quanto deve cair nos próximos 30, 60 e 90 dias, pelo prazo de costume de cada pagador (as atrasadas ficam em
  // "Para acompanhar"). Sem histórico de quem paga, a cirurgia fica sem previsão, em vez de inventar uma data.
  function previsao() {
    const itens = S.records.filter(isOpen).map((r) => { const f = fin(r); return { r, valor: f.aReceber, aprox: f.aprox }; });
    if (!itens.length) return null;
    const p = C.previsaoRecebimento(itens, S.prazos || new Map(), today(), S.settings.alertDias);
    const val = (o) => (o.valor ? (o.aprox ? '≈ ' : '') + brl0(o.valor) : '—');
    const nomes = ['Nos próximos 30 dias', 'De 31 a 60 dias', 'De 61 a 90 dias'];
    const linhas = p.faixas.map((o, i) => rowBtn(null, null, nomes[i], o.n ? plural(o.n, 'cirurgia', 'cirurgias') : 'Nenhuma cirurgia', null, h('span', { class: 'v' }, val(o))));
    if (p.depois.n) linhas.push(rowBtn(null, null, 'Depois de 90 dias', plural(p.depois.n, 'cirurgia', 'cirurgias'), null, h('span', { class: 'v' }, val(p.depois))));
    const nota = ['Pelo prazo de costume de cada hospital, convênio ou colega.',
      p.semPrazo.n ? `${plural(p.semPrazo.n, 'cirurgia fica', 'cirurgias ficam')} sem previsão: quem paga ainda não tem histórico.` : null].filter(Boolean).join(' ');
    return h('section', { class: 'sec', id: 'sec-previsao' }, secTitle('Quando deve cair'), h('p', { class: 'note' }, nota), h('div', { class: 'group flat' }, linhas));
  }
  // ---- lembrete mensal no Calendário (item 33) ----
  function sheetLembrete() {
    const lb = S.settings.lembrete || {};
    let dia = lb.dia || 5, hora = lb.hora || '19:00';
    return openSheet({ title: 'Lembrete no Calendário', back: true, render(api) {
      const diaSel = h('select', { id: 'lb-dia', 'aria-label': 'Dia do mês', onchange: (e) => { dia = +e.target.value; } },
        Array.from({ length: 28 }, (_, i) => h('option', { value: String(i + 1), selected: i + 1 === dia }, 'Dia ' + (i + 1))));
      const horaIn = h('input', { id: 'lb-hora', type: 'time', value: hora, oninput: (e) => { hora = e.target.value || '19:00'; } });
      return { body: [
        h('p', { class: 'note' }, 'Uma vez por mês, o Calendário do iPhone lembra você de:'),
        h('ol', { class: 'steps' }, h('li', null, h('span', null, 'Exportar a conversa do grupo do WhatsApp, com as fotos, e trazer para o app.')),
          h('li', null, h('span', null, 'Trazer a planilha de repasse do mês.')), h('li', null, h('span', null, 'Fazer um backup.'))),
        h('form', { class: 'form', onsubmit: (e) => e.preventDefault() }, h('div', { class: 'grid2' }, field('Dia do mês', diaSel), field('Hora', horaIn))),
        h('p', { class: 'note' }, 'Toque em Criar o lembrete e salve o arquivo. Depois, abra o arquivo em Arquivos e toque em Adicionar ao Calendário.')],
        foot: h('button', { class: 'btn primary', type: 'button', onclick: async () => {
          if (PREVIEW) { await confirmDialog({ title: 'Disponível no app instalado', text: 'Nesta prévia o navegador não deixa salvar arquivos.', ok: 'Entendi', cancel: false }); return; }
          const ics = C.lembreteIcs({ dia, hora, hoje: today() });
          if (await compartilhar(new Blob([ics], { type: 'text/calendar' }), 'lembrete-controle-de-cirurgias.ics', 'text/calendar')) {
            S.settings.lembrete = { dia, hora }; await saveSettings(); render(); api.close(true);
            toast('Agora abra o arquivo em Arquivos e toque em Adicionar ao Calendário.', 5000);
          }
        } }, 'Criar o lembrete') };
    } });
  }
  // ---- feriados da cidade ----
  // Guardados num texto só (como nas versões antigas): datas "31/08" (todo ano) ou "04/06/2026" (só naquele ano) e as
  // palavras "carnaval" e "corpus christi", que o núcleo calcula pela Páscoa.
  const ehCarnaval = (t) => C.norm(t) === 'carnaval', ehCorpus = (t) => C.norm(t).startsWith('corpus');
  const partesFeriados = () => String(S.settings.feriados || '').split(/[,;]+/).map((t) => t.trim()).filter(Boolean);
  function feriadosTxt() {
    const ps = partesFeriados();
    return [...ps.filter((t) => !ehCarnaval(t) && !ehCorpus(t)), ps.some(ehCarnaval) ? 'Carnaval' : null, ps.some(ehCorpus) ? 'Corpus Christi' : null].filter(Boolean).join(', ');
  }
  function sheetFeriados() {
    const ps = partesFeriados();
    let carnaval = ps.some(ehCarnaval), corpus = ps.some(ehCorpus);
    let datas = ps.filter((t) => !ehCarnaval(t) && !ehCorpus(t)).join(', ');
    return openSheet({ title: 'Feriados da cidade', back: true, render(api) {
      const inp = h('input', { id: 'fer-datas', type: 'text', value: datas, placeholder: '31/08', autocomplete: 'off', oninput: (e) => { datas = e.target.value; } });
      const opcao = (titulo, sub, val, set) => h('div', { class: 'qrow' }, h('div', { class: 'q' }, titulo, h('small', null, sub)),
        seg([['sim', 'Conta'], ['nao', 'Não conta']], val ? 'sim' : 'nao', (v) => { set(v === 'sim'); api.update(); }, titulo));
      return { body: [
        h('p', { class: 'lead' }, 'Os feriados nacionais e a Sexta-feira Santa já contam. Escolha os outros dias que contam como feriado para o adicional de 30%.'),
        h('div', { class: 'group' },
          opcao('Carnaval', 'Segunda e terça. A data muda todo ano.', carnaval, (v) => { carnaval = v; }),
          opcao('Corpus Christi', 'Uma quinta-feira. A data muda todo ano.', corpus, (v) => { corpus = v; })),
        h('form', { class: 'form', onsubmit: (e) => e.preventDefault() }, field('Outros dias', inp, 'Separe por vírgula. 31/08 vale todo ano; 04/06/2026 vale só naquele ano.'))],
        foot: h('button', { class: 'btn primary', type: 'button', onclick: async () => {
          const itens = datas.split(/[\s,;]+/).map((t) => t.trim()).filter(Boolean);
          const ruins = itens.filter((t) => !C.parseExtraHolidays(t).length);
          if (ruins.length) { toast(`Não entendi “${ruins[0]}”. Use dia/mês, como 31/08, ou dia/mês/ano.`, 4500); return; }
          S.settings.feriados = [...itens, carnaval ? 'carnaval' : null, corpus ? 'corpus christi' : null].filter(Boolean).join(', ');
          await saveSettings(); derive(); render(); api.close(true); toast('Feriados salvos.');
        } }, 'Salvar') };
    } });
  }
  async function wipeAll() {
    if (!(await confirmDialog({ title: TESTE ? 'Apagar os dados de teste?' : 'Apagar todos os dados?', text: TESTE ? 'Saem só os dados do modo de teste. O app de verdade não muda.' : 'Saem do app as cirurgias, as fotos, os nomes e as planilhas. Se quiser guardar uma cópia, faça um backup antes.', ok: 'Continuar', danger: true }))) return;
    if (!(await confirmDialog({ title: 'Tem certeza?', text: 'Não dá para desfazer.', ok: 'Apagar tudo', danger: true }))) return;
    for (const s of STORES) await Store.clear(s);
    urlCache.forEach((u) => URL.revokeObjectURL(u)); urlCache.clear();
    S.demo = false; await load(); go('inicio'); toast('Dados apagados.');
  }

  // ================= ficha da cirurgia =================
  function newRecord(over) {
    return { id: C.uid('r'), num: 0, key: null, origem: 'manual', grupo: '', date: today(), time: null, procs: [], hosp: null, cols: [], conv: null, funcao: null, valorPrevisto: null, status: 'aberto', recebido: null, rep: [], devido: null, devidoOrigem: null, pagamentos: [], caption: '', notas: '', photoIds: [], photoNames: [], revisar: [], createdAt: Date.now(), updatedAt: Date.now(), ...(over || {}) };
  }
  function sheetRecord(rec, opts) {
    opts = opts || {};
    const isNew = !rec || !S.records.some((x) => x.id === rec.id);
    let mode = isNew ? 'edit' : 'view';
    let d = clone(rec || newRecord());
    let draft = isNew ? d : null;
    let added = [], dirty = !!opts.dirty, pendingAdds = [];
    const startEdit = () => { draft = clone(d); added = []; dirty = false; mode = 'edit'; api.update(); };
    const persist = async () => { await saveRecord(d); derive(); render(); api.update(); };
    const discard = async () => { if (added.length) await deletePhotos(added); added = []; };
    const api = openSheet({
      title: isNew ? 'Nova cirurgia' : 'Cirurgia',
      head: () => (mode === 'edit'
        ? { left: navBtn('Cancelar', cancelEdit), title: isNew ? 'Nova cirurgia' : 'Editar', right: null }
        : { left: navBtn('Fechar', () => api.close(), 'back'), title: '', right: navBtn('Editar', startEdit, null, true) }),
      beforeClose: async () => {
        if (mode !== 'edit' || !dirty) { await discard(); return true; }
        const ok = await confirmDialog({ title: 'Sair sem salvar?', text: 'O que você mudou não será guardado.', ok: 'Sair sem salvar', danger: true, cancel: 'Continuar' });
        if (ok) await discard();
        return ok;
      },
      render: () => (mode === 'edit' ? renderEdit() : renderView()),
    });
    async function cancelEdit() {
      if (isNew) return api.close();
      if (dirty && !(await confirmDialog({ title: 'Descartar as mudanças?', ok: 'Descartar', danger: true, cancel: 'Continuar editando' }))) return;
      await discard(); mode = 'view'; draft = null; api.update();
    }
    function photosRow(x, editing) {
      const addTile = h('button', { class: 'ph add' + (x.photoIds.length ? '' : ' only'), type: 'button', onclick: () => pickPhotos(async (files) => {
        const b = busy('Guardando as fotos…');
        try { let i = 0; for (const f of files) { const id = await storePhoto(f, f.name); x.photoIds.push(id); if (editing) { added.push(id); dirty = true; } b.set(++i / files.length); } } finally { b.done(); }
        if (!editing) await persist(); else api.update();
      }) }, icon('camera'), 'Adicionar foto');
      return h('div', { class: 'carousel', 'aria-label': 'Fotos' }, x.photoIds.map((id, i) => h('button', { class: 'ph', type: 'button', 'aria-label': `Ver foto ${i + 1}`, onclick: () => openViewer(x.photoIds, i, editing ? null : async (rid) => {
        const { x: item, r } = await tirarFoto(S.records.find((y) => y.id === d.id) || d, rid); d = clone(r);
        derive(); render(); api.update();
        toast('Foto tirada da cirurgia.', 0, { label: 'Desfazer', fn: async () => { await recuperar([item]); const nr = S.records.find((y) => y.id === d.id); if (nr) d = clone(nr); derive(); render(); api.update(); toast('A foto voltou.'); } });
      }) }, photoImg(id, true))), addTile);
    }
    function renderView() {
      const kids = [photosRow(d, false)];
      kids.push(h('div', null, h('h1', { class: 'r-title' }, procText(d)),
        h('div', { class: 'r-sub' }, h('span', null, cap(dataLonga(d.date, { ano: true })) + (d.time ? ', às ' + horaTxt(d.time) : '')), urgOf(d) ? h('span', { class: 'tag-night' }, icon('moon'), 'Horário de urgência') : null),
        // de onde veio a hora: da planilha de repasse, ou nenhuma (a hora do envio não vale como hora da cirurgia)
        d.horaDaPlanilha ? h('div', { class: 'r-note' }, 'Data e hora pela planilha de repasse.')
          : !d.time && d.msgTime && d.msgDate === d.date ? h('div', { class: 'r-note' }, `Hora não informada. A foto foi enviada às ${horaTxt(d.msgTime)}.`) : null));
      const pend = pendencias(d);
      if (pend.length) kids.push(h('div', { class: 'checkcard' }, h('b', null, icon('alert', 'sm'), 'Para completar'), pend.map((f) => h('p', null, flagText(f, d))),
        h('div', { class: 'btnrow' }, h('button', { class: 'btn sm soft', type: 'button', onclick: startEdit }, 'Completar'),
          h('button', { class: 'btn sm', type: 'button', onclick: async () => { d.revisar = []; d.conferido = true; await persist(); toast('Pronto. Ela sai de Para completar.'); } }, 'Está tudo certo'))));
      kids.push(payCard(d, persist));
      const info = [['Hospital', d.hosp], [d.cols && d.cols.length > 1 ? 'Colegas' : 'Colega', (d.cols || []).join(', ')], ['Sua função', d.funcao], ['Convênio', d.conv], ['Observações', d.notas]].filter((x) => x[1]);
      if (info.length) kids.push(h('div', { class: 'group info' }, info.map(([k, v]) => h('div', { class: 'ir' }, h('span', null, k), h('span', null, v)))));
      if (d.rep && d.rep.length) kids.push(h('section', { class: 'sec' }, h('div', { class: 'sec-h' }, h('h2', { style: 'font-size:1.1875rem' }, 'Na planilha de repasse')),
        h('div', { class: 'group flat' }, d.rep.map((l) => rowBtn(null, null, l.procName, [l.conv, l.funcao].filter(Boolean).join(', '), null, h('span', { class: 'v' }, brl(l.valor)))))));
      if (d.caption) kids.push(h('section', { class: 'sec' }, h('div', { class: 'sec-h' }, h('h2', { style: 'font-size:1.1875rem' }, 'Legenda no WhatsApp')), h('div', { class: 'caption-box' }, d.caption),
        d.legendaAnterior ? h('p', { class: 'note' }, `Editada no WhatsApp. Antes era: “${d.legendaAnterior}”.`) : null));
      kids.push(h('div', { class: 'group' },
        h('button', { class: 'rowbtn', type: 'button', onclick: () => mergeInto(d, api) }, h('span', { class: 'bubble plain' }, icon('merge')), h('span', { class: 't' }, 'Juntar com outra ficha', h('small', null, 'Quando a mesma cirurgia aparece duas vezes')), icon('chev', 'chev')),
        h('button', { class: 'rowbtn danger', type: 'button', onclick: async () => {
          if (!(await confirmDialog({ title: 'Excluir esta cirurgia?', text: `Ela fica ${LIXEIRA_DIAS} dias na lixeira, em Ajustes, com as fotos. No WhatsApp, nada muda.`, ok: 'Excluir', danger: true }))) return;
          const itens = await excluirCirurgias([S.records.find((x) => x.id === d.id) || d]); derive(); render(); api.close(true);
          toast('Cirurgia excluída.', 0, desfazer(itens, 'A cirurgia voltou.'));
        } }, h('span', { class: 'bubble danger' }, icon('trash')), h('span', { class: 't' }, 'Excluir cirurgia'))));
      if (d.num) kids.push(h('p', { class: 'note', style: 'text-align:center' }, `Registro nº ${d.num}`));
      return { body: kids };
    }
    function renderEdit() {
      const x = draft; const mark = () => { dirty = true; };
      const kids = [photosRow(x, true)];
      const urgLine = () => (x.date && C.isUrgent(x.date, x.time, S.hol) ? h('span', { class: 'tag-night' }, icon('moon'), 'Horário de urgência: conta 30% a mais') : h('span', { class: 'note' }, x.time ? 'Horário normal' : 'Se souber, coloque a hora: à noite e no fim de semana o valor é maior.'));
      const urgEl = h('div', null, urgLine());
      const dateIn = h('input', { type: 'date', value: x.date, required: true, oninput: (e) => { x.date = e.target.value; mark(); urgEl.replaceChildren(urgLine()); } });
      const timeIn = h('input', { type: 'time', value: x.time || '', oninput: (e) => { x.time = e.target.value || null; mark(); urgEl.replaceChildren(urgLine()); } });
      const toggle = (list, v) => { const i = list.findIndex((y) => C.norm(y) === C.norm(v)); if (i >= 0) list.splice(i, 1); else list.push(v); mark(); api.update(); };
      const chipsMulti = (list, options) => h('div', { class: 'qchips' }, uniq([...list, ...options]).map((v) => h('button', { class: 'qchip', type: 'button', 'aria-pressed': String(list.some((y) => C.norm(y) === C.norm(v))), onclick: () => toggle(list, v) }, v)));
      const chipsOne = (cur, options, set) => h('div', { class: 'qchips' }, uniq([cur, ...options]).map((v) => h('button', { class: 'qchip', type: 'button', 'aria-pressed': String(!!cur && C.norm(cur) === C.norm(v)), onclick: () => { set(cur && C.norm(cur) === C.norm(v) ? null : v); mark(); api.update(); } }, v)));
      pendingAdds = [];
      const addRow = (ph, names, onAdd, id) => {
        const inp = h('input', { id, type: 'text', placeholder: ph, list: id + '-l', autocomplete: 'off', enterkeyhint: 'done' });
        const doAdd = () => { const v = inp.value.trim(); if (v) { onAdd(matchName(v, names)); mark(); api.update(); } };
        // se ela digitar um nome e tocar direto em Salvar, sem "Incluir", o nome entra do mesmo jeito
        pendingAdds.push(() => { const v = inp.value.trim(); if (v) { onAdd(matchName(v, names)); inp.value = ''; } });
        inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); doAdd(); } });
        return h('div', { class: 'addrow' }, inp, h('button', { class: 'btn soft', type: 'button', onclick: doAdd }, 'Incluir'), h('datalist', { id: id + '-l' }, names.map((n) => h('option', { value: n }))));
      };
      const procOpts = uniq([...topUsed('procs', 8), 'Colecistectomia videolaparoscópica', 'Apendicectomia videolaparoscópica', 'Herniorrafia']).slice(0, 8);
      // valor combinado = valor devido que ela mesma anotou (o da planilha de repasse entra sozinho)
      const valIn = h('input', { type: 'text', inputmode: 'decimal', value: moneyInput(x.devido), placeholder: 'Se já souber', oninput: (e) => { x.devido = parseMoney(e.target.value); x.devidoOrigem = x.devido != null ? 'combinado' : null; mark(); } });
      const notas = h('textarea', { rows: 3, placeholder: 'Sem nome nem dados do paciente', oninput: (e) => { x.notas = e.target.value; mark(); } }); notas.value = x.notas || '';
      kids.push(h('form', { class: 'form', onsubmit: (e) => e.preventDefault() },
        h('div', { class: 'grid2' }, field('Data', dateIn), field('Hora', timeIn)), urgEl,
        h('div', { class: 'field' }, h('span', { class: 'lbl' }, 'O que foi feito'), chipsMulti(x.procs, procOpts), addRow('Outro procedimento', namesOf('proc'), (v) => { if (!x.procs.some((y) => C.norm(y) === C.norm(v))) x.procs.push(v); }, 'ed-proc')),
        h('div', { class: 'field' }, h('span', { class: 'lbl' }, 'Hospital'), chipsOne(x.hosp, uniq([...topUsed('hosp', 6), ...namesOf('hosp')]).slice(0, 6), (v) => { x.hosp = v; }), addRow('Outro hospital', namesOf('hosp'), (v) => { x.hosp = v; }, 'ed-hosp')),
        h('div', { class: 'field' }, h('span', { class: 'lbl' }, 'Com quem'), chipsMulti(x.cols, topUsed('cols', 8)), addRow('Outro colega', namesOf('col'), (v) => { if (!x.cols.some((y) => C.norm(y) === C.norm(v))) x.cols.push(v); }, 'ed-col')),
        h('div', { class: 'field' }, h('span', { class: 'lbl' }, 'Sua função'), chipsOne(x.funcao, ['Cirurgiã principal', 'Primeiro auxiliar', 'Segundo auxiliar'], (v) => { x.funcao = v; })),
        h('div', { class: 'field' }, h('span', { class: 'lbl' }, 'Convênio'), chipsOne(x.conv, uniq([...topUsed('conv', 6), 'Particular']).slice(0, 6), (v) => { x.conv = v; }), addRow('Outro convênio', namesOf('conv'), (v) => { x.conv = v; }, 'ed-conv')),
        isOpen(x) ? field('Valor combinado (R$)', valIn, 'Se deixar em branco, o app usa o valor aproximado.') : null,
        field('Observações', notas)));
      return { body: kids, foot: h('button', { class: 'btn primary', type: 'button', onclick: saveEdit }, isNew ? 'Salvar cirurgia' : 'Salvar') };
    }
    async function saveEdit() {
      const x = draft;
      for (const f of pendingAdds) f();
      if (!x.date) { toast('Coloque a data da cirurgia.'); return; }
      // ela conferiu a ficha ao salvar: os avisos da importação saem ("Procedimento novo", hora do envio, legenda editada).
      // O que continua em branco (procedimento, hospital, colega) segue em Para completar até ser preenchido.
      x.revisar = [];
      if (x.horaDaPlanilha && (x.time !== d.time || x.date !== d.date)) delete x.horaDaPlanilha;
      const learned = await learnTerms(x);
      if (isNew) { S.settings.seq += 1; x.num = S.settings.seq; await saveSettings(); }
      await saveRecord(x); d = x; draft = null; added = []; dirty = false;
      derive(); render();
      // avisa quando um nome novo (colega, hospital, procedimento, convênio) foi guardado em Nomes e abreviações
      const extra = learned.length === 1 ? ` ${learned[0].name} foi guardado em Nomes e abreviações.` : learned.length > 1 ? ` ${learned.length} nomes novos guardados em Nomes e abreviações.` : '';
      if (isNew) { if (opts.onSaved) await opts.onSaved(x); api.close(true); toast('Cirurgia salva.' + extra, extra ? 4500 : 0); }
      else { mode = 'view'; api.update(); toast('Alterações salvas.' + extra, extra ? 4500 : 0); }
    }
    return api;
  }
  async function learnTerms(r) {
    const add = [];
    const has = (type, name) => S.terms.some((t) => t.type === type && C.norm(t.name) === C.norm(name)) || add.some((t) => t.type === type && C.norm(t.name) === C.norm(name));
    for (const p of r.procs || []) if (!has('proc', p)) add.push({ id: C.uid('t'), type: 'proc', name: p, fam: C.norm(p).split(' ')[0], aliases: [C.norm(p)] });
    for (const c of r.cols || []) if (!has('col', c)) add.push({ id: C.uid('t'), type: 'col', name: c, aliases: [C.norm(c)] });
    if (r.hosp && !has('hosp', r.hosp)) add.push({ id: C.uid('t'), type: 'hosp', name: r.hosp, aliases: [C.norm(r.hosp)] });
    if (r.conv && !has('conv', r.conv)) add.push({ id: C.uid('t'), type: 'conv', name: r.conv, aliases: [C.norm(r.conv)] });
    if (add.length) { S.terms.push(...add); await Store.putMany('terms', add); }
    return add;
  }
  function statusTag(r) { const [st, tone] = statusOf(r); return h('span', { class: 'st ' + tone }, st); }
  // ================= financeiro da cirurgia =================
  // O bloco mostra, separados: quanto falta (ou quanto entrou), o valor devido, cada pagamento e o saldo.
  // A estimativa aparece sempre com ≈ e só enquanto não há valor devido.
  const nomeRepasse = (id) => { const x = S.repasses.find((y) => y.id === id); return x && x.numero ? 'planilha nº ' + x.numero : 'planilha de repasse'; };
  function payCard(d, persist) {
    const f = fin(d);
    if (f.s === 'semcobranca') return h('div', { class: 'paycard muted' }, h('div', { class: 'what' }, 'Marcada como sem cobrança'), h('button', { class: 'btn sm', type: 'button', onclick: async () => { d.status = 'aberto'; await persist(); } }, 'Voltar para a receber'));
    const linha = (k, v, sub, acao) => h('div', { class: 'fin-row' }, h('span', { class: 'k' }, k, sub ? h('small', null, sub) : null),
      h('span', { class: 'v' }, v, acao ? h('button', { class: 'link', type: 'button', onclick: acao }, 'Corrigir') : null));
    const linhas = [];
    if (f.pg.length || f.devido != null) {
      // recebida sem valor devido (paga à mão): só os pagamentos; a receber sem valor devido: "A definir", sem inventar saldo
      if (f.devido != null || f.s !== 'recebido') linhas.push(linha('Valor devido', f.devido != null ? brl(f.devido) : 'A definir', f.devido == null ? null : f.origem === 'repasse' ? 'pela planilha de repasse' : 'combinado'));
      for (const p of f.pg) linhas.push(linha(p.data ? 'Pago em ' + ddmmyyyy(p.data) : 'Pago', p.valor == null ? 'Valor não informado' : brl(p.valor),
        p.origem === 'repasse' ? 'pela ' + nomeRepasse(p.repId) : p.parcial ? 'uma parte, registrada por você' : 'registrado por você',
        p.origem === 'repasse' ? null : () => editarPagamento(d, p, persist)));
      if (f.saldo != null && f.pg.length && !f.semValorAnotado) linhas.push(linha(f.saldo > 0.004 ? 'Falta receber' : f.saldo < -0.004 ? 'Recebido a mais' : 'Saldo', brl(Math.abs(f.saldo))));
    }
    const fin_ = linhas.length ? h('div', { class: 'fin' }, linhas) : null;
    if (f.s === 'recebido') {
      const ult = f.pg[f.pg.length - 1] || {};
      // Desfazer tira o último pagamento registrado por ela (o da planilha sai desfazendo a planilha, em Ajustes)
      const desfazer = ult.id && ult.origem !== 'repasse' ? h('div', { class: 'btnrow' }, h('button', { class: 'btn sm ghost', type: 'button', onclick: async () => {
        d.pagamentos = (d.pagamentos || []).filter((x) => x.id !== ult.id); await persist(); toast(isOpen(d) ? 'Voltou para a receber.' : 'Pagamento desfeito.'); } }, 'Desfazer')) : null;
      return h('div', { class: 'paycard done' },
        h('div', { class: 'top' }, h('div', null, h('div', { class: 'what' }, ult.data ? 'Recebida em ' + dataLonga(ult.data, { semDia: true, ano: !sameYear(ult.data) }) : 'Recebida'),
          h('div', { class: 'amount' + (f.semValorAnotado ? ' txt' : '') }, f.semValorAnotado ? 'Valor não informado' : brl(f.recebido)))),
        fin_, desfazer);
    }
    const v = valueOf(d); const dias = daysSince(d.date); const pz = C.prazoDe(d, S.prazos || new Map());
    const titulo = f.s === 'parcial' ? 'Falta receber' : f.devido != null && f.origem === 'combinado' ? 'Valor combinado' : 'A receber';
    const dica = v.kind === 'estimado' ? (f.s === 'parcial' ? `Aproximado: a estimativa menos os ${brl(f.recebido)} que já entraram.` : `Valor aproximado, pela média do que você já recebeu${v.parcial ? '. Um dos procedimentos ainda não tem referência' : ''}.`)
      : v.kind === 'semvalor' ? (f.s === 'parcial' ? `Já entraram ${brl(f.recebido)}. Quando souber o valor todo, coloque em Editar, como valor combinado.` : 'Ainda não há planilha com esse procedimento para estimar o valor.') : null;
    return h('div', { class: 'paycard' },
      h('div', { class: 'top' }, h('div', null, h('div', { class: 'what' }, titulo), h('div', { class: 'amount' + (v.kind === 'estimado' ? ' aprox' : '') + (v.v == null ? ' txt' : '') }, v.v == null ? 'Sem valor ainda' : (v.kind === 'estimado' ? '≈ ' : '') + brl(v.v))), statusOf(d)[1] === 'accent' ? null : statusTag(d)),
      dica ? h('div', { class: 'hint' }, dica) : null,
      isLate(d) ? h('div', { class: 'alert-line' }, `Esperando há ${dias} dias.${pz ? ` ${pz.nome} costuma pagar em até ${pz.limite} dias.` : ''}`)
        : pz ? h('div', { class: 'hint' }, quandoCai(d, pz)) : null,
      fin_,
      h('div', { class: 'btnrow' },
        h('button', { class: 'btn primary', type: 'button', onclick: () => registrarPagamento(d, persist) }, f.s === 'parcial' ? 'Registrar pagamento' : 'Já recebi'),
        f.s === 'aberto' ? h('button', { class: 'btn', type: 'button', onclick: async () => { d.status = 'semcobranca'; await persist(); } }, 'Não vou cobrar') : null));
  }
  // Pagamento novo pela ficha. Sem valor devido, ela diz se foi o valor todo; se foi só uma parte e ela souber quanto
  // falta, o valor devido passa a ser o que entrou mais o que falta (valor combinado).
  async function registrarPagamento(d, persist) {
    const f = fin(d);
    const out = await payDialog(d, { valor: f.aReceber, data: today() });
    if (!out) return;
    d.pagamentos = [...(d.pagamentos || []), { id: C.uid('g'), valor: out.valor, data: out.data, origem: 'manual', parcial: out.parcial || undefined }];
    if (out.parcial && out.falta != null && out.falta > 0) { d.devido = C.round2(C.totalRecebido(d) + out.falta); d.devidoOrigem = 'combinado'; }
    await persist();
    const depois = fin(d);
    toast(isPaid(d) ? 'Marcada como recebida.' : depois.saldo != null ? `Pagamento registrado. Faltam ${brl(depois.saldo)}.` : 'Pagamento registrado. O resto continua a receber.');
  }
  async function editarPagamento(d, p, persist) {
    const out = await payDialog(d, { valor: p.valor, data: p.data, parcial: !!p.parcial, editando: p });
    if (!out) return;
    if (out.apagar) d.pagamentos = (d.pagamentos || []).filter((x) => x.id !== p.id);
    else d.pagamentos = (d.pagamentos || []).map((x) => (x.id === p.id ? { ...x, valor: out.valor, data: out.data, parcial: out.parcial || undefined } : x));
    if (!out.apagar && out.parcial && out.falta != null && out.falta > 0) { d.devido = C.round2(C.totalRecebido(d) + out.falta); d.devidoOrigem = 'combinado'; }
    await persist();
    toast(out.apagar ? 'Pagamento apagado.' : 'Pagamento corrigido.');
  }
  // "Quanto você recebeu?": valor e dia. Sem valor devido: "Foi o valor todo?" e, se foi uma parte, quanto falta.
  // Com valor devido: mostra quanto ainda falta depois deste pagamento.
  function payDialog(d, o) {
    o = o || {};
    return new Promise((res) => {
      const f = fin(d); const semDevido = f.devido == null;
      const jaEntrou = C.round2(f.recebido - (o.editando && o.editando.valor ? o.editando.valor : 0));
      let parte = !!o.parcial;
      const vIn = h('input', { id: 'pd-valor', type: 'text', inputmode: 'decimal', value: moneyInput(o.valor), placeholder: '0,00', autocomplete: 'off' });
      const dIn = h('input', { id: 'pd-data', type: 'date', value: o.data || today() });
      const faltaIn = h('input', { id: 'pd-falta', type: 'text', inputmode: 'decimal', placeholder: 'Se souber', autocomplete: 'off' });
      const box = h('div');
      const desenhar = () => {
        if (semDevido) {
          box.replaceChildren(h('div', { class: 'field' }, h('span', { class: 'lbl' }, 'Foi o valor todo?'),
            seg([['tudo', 'Sim, tudo'], ['parte', 'Não, só uma parte']], parte ? 'parte' : 'tudo', (v) => { parte = v === 'parte'; desenhar(); }, 'Foi o valor todo?')),
            parte ? h('div', { class: 'field' }, h('label', { for: 'pd-falta' }, 'Quanto ainda falta (R$)'), faltaIn, h('div', { class: 'hint' }, 'Se não souber, deixe em branco.')) : null);
        } else {
          const falta = C.round2(f.devido - jaEntrou - (parseMoney(vIn.value) || 0));
          box.replaceChildren(h('p', { class: 'note', id: 'pd-info' }, falta > 0.004 ? `Depois deste pagamento, ainda faltam ${brl(falta)} dos ${brl(f.devido)} devidos.` : 'Com este pagamento, a cirurgia fica quitada.'));
        }
      };
      vIn.addEventListener('input', desenhar); desenhar();
      const done = (out) => { wrap.remove(); res(out); };
      const ok = () => {
        const valor = parseMoney(vIn.value);
        if (parte && !(valor > 0)) { toast('Coloque quanto entrou.'); return; }
        done({ valor, data: dIn.value || today(), parcial: semDevido && parte, falta: semDevido && parte ? parseMoney(faltaIn.value) : null });
      };
      const wrap = h('div', { class: 'dialog-wrap' }, h('form', { class: 'dialog', onsubmit: (e) => { e.preventDefault(); ok(); } },
        h('h3', null, o.editando ? 'Corrigir pagamento' : 'Quanto você recebeu?'), h('p', null, procText(d)),
        h('div', { class: 'field' }, h('label', { for: 'pd-valor' }, 'Valor (R$)'), vIn),
        h('div', { class: 'field' }, h('label', { for: 'pd-data' }, 'Dia em que caiu'), dIn),
        box,
        o.editando ? h('button', { class: 'link danger', type: 'button', style: 'align-self:flex-start', onclick: () => done({ apagar: true }) }, 'Apagar este pagamento') : null,
        h('div', { class: 'dialog-actions' }, h('button', { type: 'button', class: 'btn', onclick: () => done(null) }, 'Cancelar'), h('button', { type: 'submit', class: 'btn primary' }, 'Confirmar'))));
      document.body.append(wrap);
    });
  }
  // ================= lixeira =================
  // Excluir manda para a lixeira por 30 dias: a ficha (ou a foto) sai das listas, mas as fotos continuam guardadas.
  // A mensagem do WhatsApp passa a ser ignorada nas importações; recuperar tira esse bloqueio. Depois de 30 dias,
  // o item sai de vez (as fotos saem na limpeza ao abrir o app), e a mensagem continua ignorada, com como trazer de volta.
  const LIXEIRA_DIAS = 30, DIA_MS = 86400000;
  // motivo: excluida (cirurgia excluída), apagada (foto solta apagada), organizada (foto solta que virou ou entrou numa
  // cirurgia), juntada (ficha juntada a outra). fotos: as fotos da mensagem, para saber se elas ainda estão no app.
  const ignorar = (key, motivo, fotos) => (key ? { s: 'ignored', put: { key, motivo, em: Date.now(), fotos: fotos || [] } } : null);
  function espelharIgnoradas(ops) {
    for (const o of ops) if (o && o.s === 'ignored') {
      if ('del' in o) { S.ignored.delete(o.del); S.ignoredInfo.delete(o.del); } else { S.ignored.add(o.put.key); S.ignoredInfo.set(o.put.key, o.put); }
    }
  }
  async function excluirCirurgias(recs) {
    const em = Date.now(); const ops = []; const itens = [];
    for (const r of recs) {
      const x = { id: C.uid('x'), tipo: 'cirurgia', em, rec: r };
      itens.push(x); ops.push({ s: 'trash', put: x }, { s: 'records', del: r.id }, ignorar(r.key, 'excluida', r.photoIds));
    }
    await Store.apply(ops); espelharIgnoradas(ops);
    const ids = new Set(recs.map((r) => r.id));
    S.records = S.records.filter((r) => !ids.has(r.id)); S.trash.push(...itens);
    return itens;
  }
  async function tirarFoto(rec, photoId) {
    const r = { ...rec, photoIds: (rec.photoIds || []).filter((id) => id !== photoId), updatedAt: Date.now(), editadaEm: Date.now() };
    const x = { id: C.uid('x'), tipo: 'foto', em: Date.now(), recId: rec.id, photoId, pos: (rec.photoIds || []).indexOf(photoId), data: rec.date };
    await Store.apply([{ s: 'trash', put: x }, { s: 'records', put: r }]);
    const i = S.records.findIndex((y) => y.id === r.id); if (i >= 0) S.records[i] = r;
    S.trash.push(x);
    return { x, r };
  }
  async function apagarSoltas(ls) {
    const x = { id: C.uid('x'), tipo: 'fotos', em: Date.now(), loose: ls };
    const ops = [{ s: 'trash', put: x }, ...ls.flatMap((l) => [{ s: 'loose', del: l.id }, ignorar(l.key, 'apagada', [l.photoId])])];
    await Store.apply(ops); espelharIgnoradas(ops);
    const ids = new Set(ls.map((l) => l.id)); S.loose = S.loose.filter((l) => !ids.has(l.id)); S.trash.push(x);
    return x;
  }
  // devolve o que estava na lixeira; retorna quantos itens voltaram
  async function recuperar(itens) {
    const naLixeira = new Set(S.trash.map((x) => x.id));
    const ordem = { cirurgia: 0, fotos: 1, foto: 2 };
    itens = itens.filter((x) => naLixeira.has(x.id)).sort((a, b) => ordem[a.tipo] - ordem[b.tipo]);
    const ops = [], voltaRec = [], voltaLoose = [], muda = new Map(); let n = 0;
    for (const x of itens) {
      ops.push({ s: 'trash', del: x.id });
      if (x.tipo === 'cirurgia') {
        // se a mesma mensagem já voltou por uma importação, não cria outra ficha igual
        if (x.rec.key && S.records.some((r) => r.key === x.rec.key)) continue;
        voltaRec.push(x.rec); ops.push({ s: 'records', put: x.rec }, x.rec.key ? { s: 'ignored', del: x.rec.key } : null); n++;
      } else if (x.tipo === 'fotos') {
        for (const l of x.loose) { voltaLoose.push(l); ops.push({ s: 'loose', put: l }, l.key ? { s: 'ignored', del: l.key } : null); }
        n++;
      } else if (x.tipo === 'foto') {
        const volta = voltaRec.find((r) => r.id === x.recId);
        const r = volta || muda.get(x.recId) || S.records.find((y) => y.id === x.recId);
        if (r) {
          const ids = r.photoIds || [];
          const novo = ids.includes(x.photoId) ? ids : [...ids.slice(0, Math.max(0, x.pos)), x.photoId, ...ids.slice(Math.max(0, x.pos))];
          if (volta) volta.photoIds = novo; else muda.set(r.id, { ...r, photoIds: novo, updatedAt: Date.now() });
        } else {   // a cirurgia dela não existe mais: a foto volta para Fotos para organizar
          const l = { id: C.uid('l'), key: null, date: x.data || today(), time: '', photoId: x.photoId };
          voltaLoose.push(l); ops.push({ s: 'loose', put: l });
        }
        n++;
      }
    }
    for (const r of muda.values()) ops.push({ s: 'records', put: r });
    await Store.apply(ops); espelharIgnoradas(ops);
    const saiu = new Set(itens.map((x) => x.id));
    S.trash = S.trash.filter((x) => !saiu.has(x.id));
    S.records.push(...voltaRec);
    for (const r of muda.values()) { const i = S.records.findIndex((y) => y.id === r.id); if (i >= 0) S.records[i] = r; }
    S.loose.push(...voltaLoose);
    return n;
  }
  // o botão "Desfazer" dos avisos
  const desfazer = (itens, msg) => ({ label: 'Desfazer', fn: async () => { const n = await recuperar(itens); derive(); render(); toast(n ? msg : 'Já tinha voltado.'); } });
  // itens com mais de 30 dias saem de vez (as fotos que ficarem sem uso saem logo depois, em limparOrfas)
  async function esvaziarLixeiraAntiga() {
    const limite = Date.now() - LIXEIRA_DIAS * DIA_MS;
    const velhos = S.trash.filter((x) => (x.em || 0) < limite);
    if (!velhos.length) return;
    await Store.apply(velhos.map((x) => ({ s: 'trash', del: x.id })));
    const ids = new Set(velhos.map((x) => x.id)); S.trash = S.trash.filter((x) => !ids.has(x.id));
  }
  // sem lixeira: ao desfazer uma importação ou uma planilha (trazer de novo recria as fichas)
  async function apagarFichasDeVez(recs) {
    if (!recs.length) return;
    const ids = new Set(recs.map((r) => r.id));
    await Store.apply(recs.map((r) => ({ s: 'records', del: r.id })));
    S.records = S.records.filter((r) => !ids.has(r.id));
    await apagarFotosSemUso(recs.flatMap((r) => r.photoIds || []));
  }
  function mergeInto(d, parentApi) {
    sheetPick('Juntar com qual ficha?', S.records.filter((r) => r.id !== d.id), async (target) => {
      const ok = await confirmDialog({ title: 'Juntar as duas fichas?', text: `As fotos e a legenda desta ficha vão para a cirurgia de ${dataLonga(target.date)} (${procText(target)}). Esta ficha deixa de existir.`, ok: 'Juntar' });
      if (!ok) return false;
      const t = S.records.find((x) => x.id === target.id);
      t.photoIds.push(...d.photoIds);
      if (!t.procs.length) t.procs = d.procs.slice();
      if (!t.hosp) t.hosp = d.hosp; if (!t.cols.length) t.cols = d.cols.slice(); if (!t.time) t.time = d.time; if (!t.conv) t.conv = d.conv;
      if (d.caption) t.caption = t.caption ? t.caption + '\n' + d.caption : d.caption;
      if (d.notas) t.notas = t.notas ? t.notas + '\n' + d.notas : d.notas;
      // os pagamentos e as linhas da planilha das duas fichas ficam juntos; o valor devido de uma completa o da outra
      if ((d.pagamentos || []).length) t.pagamentos = [...(t.pagamentos || []), ...d.pagamentos];
      if ((d.rep || []).length) t.rep = [...(t.rep || []), ...d.rep];
      if (t.devido == null && d.devido != null) { t.devido = d.devido; t.devidoOrigem = d.devidoOrigem; }
      else if (t.devidoOrigem === 'repasse' && d.devidoOrigem === 'repasse' && d.devido != null) t.devido = C.round2(t.devido + d.devido);
      t.updatedAt = t.editadaEm = Date.now();
      // numa operação só: a ficha de destino guarda tudo, esta sai, e a mensagem dela passa a ser ignorada
      const ops = [{ s: 'records', put: t }, { s: 'records', del: d.id }, ignorar(d.key, 'juntada', d.photoIds)];
      await Store.apply(ops); espelharIgnoradas(ops);
      S.records = S.records.filter((x) => x.id !== d.id);
      derive(); render(); parentApi.close(true); toast('Fichas juntadas.');
      return true;
    });
  }
  function sheetPick(title, records, onPick) {
    let q = '';
    return openSheet({ title, back: true, render(api) {
      const inp = h('input', { type: 'search', placeholder: 'Buscar por data, procedimento ou colega', value: q, 'aria-label': 'Buscar', autocomplete: 'off' });
      const box = h('div', { class: 'group' });
      const draw = () => {
        const nq = C.norm(q);
        const rs = records.filter((r) => !nq || nq.split(' ').every((w) => C.norm([procText(r), r.hosp, (r.cols || []).join(' '), ddmmyyyy(r.date), dataLonga(r.date, { ano: true })].join(' ')).includes(w))).sort(byDateDesc).slice(0, 80);
        box.replaceChildren(...(rs.length ? rs.map((r) => recordItem(r, async (x) => { const done = await onPick(x); if (done !== false) api.close(true); })) : [h('div', { class: 'empty' }, h('p', null, 'Nada encontrado.'))]));
      };
      inp.addEventListener('input', () => { q = inp.value; draw(); }); draw();
      return { body: [h('div', { class: 'search' }, icon('search'), inp), box] };
    } });
  }

  // ================= fotos em tela cheia =================
  function openViewer(ids, start, onRemove) {
    let i = start || 0;
    const img = h('img', { alt: '' });
    const box = h('div', { class: 'viewer-img', onclick: () => box.classList.toggle('zoom') }, img);
    const count = h('span', null);
    const load = async () => { box.classList.remove('zoom'); img.removeAttribute('src'); count.textContent = `${i + 1} de ${ids.length}`; const u = await photoURL(ids[i], false); if (u) img.src = u; };
    const close = () => { wrap.remove(); document.removeEventListener('keydown', key); };
    const key = (e) => { if (e.key === 'Escape') close(); if (e.key === 'ArrowRight' && i < ids.length - 1) { i++; load(); } if (e.key === 'ArrowLeft' && i > 0) { i--; load(); } };
    const wrap = h('div', { class: 'viewer', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Foto' },
      h('div', { class: 'viewer-top' }, h('button', { class: 'vbtn', type: 'button', 'aria-label': 'Fechar', onclick: close }, icon('x')), count,
        onRemove ? h('button', { class: 'vbtn', type: 'button', 'aria-label': 'Tirar esta foto da cirurgia', onclick: async () => {
          if (!(await confirmDialog({ title: 'Tirar esta foto da cirurgia?', text: `Ela fica ${LIXEIRA_DIAS} dias na lixeira, em Ajustes. No WhatsApp continua.`, ok: 'Tirar', danger: true }))) return;
          const id = ids[i]; close(); onRemove(id);
        } }, icon('trash')) : h('span', { style: 'width:46px' })),
      box,
      h('div', { class: 'viewer-nav' }, h('button', { class: 'vbtn', type: 'button', 'aria-label': 'Foto anterior', onclick: () => { if (i > 0) { i--; load(); } } }, icon('back')),
        h('span', { style: 'opacity:.7' }, 'Toque para ampliar'),
        h('button', { class: 'vbtn', type: 'button', 'aria-label': 'Próxima foto', onclick: () => { if (i < ids.length - 1) { i++; load(); } } }, icon('chev'))));
    document.body.append(wrap); document.addEventListener('keydown', key); load();
  }

  // ================= pagamento recebido =================
  function sheetRecebi() {
    const st = { valor: null, data: today(), fonte: '', sel: [], alloc: new Map(), parte: false, falta: null };
    const fontes = uniq([...usedValues('cols'), ...usedValues('conv'), ...usedValues('hosp')]);
    const api = openSheet({ title: 'Pagamento recebido', render() {
      const valIn = h('input', { id: 'pg-valor', type: 'text', inputmode: 'decimal', placeholder: '0,00', value: moneyInput(st.valor), oninput: (e) => { st.valor = parseMoney(e.target.value); realloc(); drawCands(); drawFoot(); drawQuita(); } });
      const dateIn = h('input', { type: 'date', value: st.data, oninput: (e) => { st.data = e.target.value; } });
      const fonteSel = h('select', { onchange: (e) => { st.fonte = e.target.value; drawCands(); } }, h('option', { value: '' }, 'Qualquer um'), fontes.map((f) => h('option', { value: f, selected: f === st.fonte }, f)));
      const cands = h('section', { class: 'sec' });
      const quita = h('div', { id: 'pg-quita', style: 'padding:0 0 12px 46px' });   // aparece logo abaixo da cirurgia escolhida
      const footBtn = h('button', { class: 'btn primary', type: 'button', onclick: confirm }, 'Registrar');
      // uma cirurgia só: sem valor devido, pergunta se o pagamento quita; com valor devido, mostra quanto ainda falta
      function drawQuita() {
        const r = st.sel.length === 1 ? S.records.find((x) => x.id === st.sel[0]) : null;
        if (!r) { quita.replaceChildren(); return; }
        const f = fin(r);
        if (f.devido == null) {
          const faltaIn = h('input', { id: 'pg-falta', type: 'text', inputmode: 'decimal', placeholder: 'Se souber', value: moneyInput(st.falta), oninput: (e) => { st.falta = parseMoney(e.target.value); } });
          quita.replaceChildren(h('div', { class: 'form' }, h('div', { class: 'field' }, h('span', { class: 'lbl' }, 'Foi o valor todo dessa cirurgia?'),
            seg([['tudo', 'Sim, tudo'], ['parte', 'Não, só uma parte']], st.parte ? 'parte' : 'tudo', (v) => { st.parte = v === 'parte'; drawQuita(); }, 'Foi o valor todo?')),
            st.parte ? field('Quanto ainda falta (R$)', faltaIn, 'Se não souber, deixe em branco.') : null));
        } else {
          const falta = C.round2(f.devido - f.recebido - (st.valor || 0));
          quita.replaceChildren(h('p', { class: 'note' }, falta > 0.004 ? `Depois deste pagamento, ainda faltam ${brl(falta)} dos ${brl(f.devido)} devidos.` : 'Com este pagamento, a cirurgia fica quitada.'));
        }
      }
      function realloc() {
        const sel = st.sel.map((id) => S.records.find((r) => r.id === id)).filter(Boolean);
        st.alloc.clear(); if (!sel.length || st.valor == null) return;
        const w = sel.map((r) => valueOf(r).v || 0); const tw = w.reduce((s, x) => s + x, 0);
        let rest = st.valor;
        sel.forEach((r, i) => { const v = i === sel.length - 1 ? C.round2(rest) : C.round2(tw ? (st.valor * w[i]) / tw : st.valor / sel.length); st.alloc.set(r.id, v); rest -= v; });
      }
      function drawCands() {
        const f = C.norm(st.fonte);
        const match = (r) => !f || (r.cols || []).some((c) => C.norm(c) === f) || C.norm(r.conv || '') === f || C.norm(r.hosp || '') === f;
        const list = S.records.filter(isOpen).filter(match).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 60);
        const items = list.map((r) => {
          const on = st.sel.includes(r.id);
          const row = recordItem(r, () => { st.sel = on ? st.sel.filter((x) => x !== r.id) : [...st.sel, r.id]; realloc(); drawCands(); drawFoot(); drawQuita(); }, on);
          if (on && st.sel.length === 1) return h('div', null, row, quita);
          return on && st.sel.length > 1 ? h('div', null, row, h('div', { class: 'row', style: 'padding:0 16px 12px 73px' }, h('span', { class: 'small muted' }, 'Desta:'),
            h('input', { type: 'text', inputmode: 'decimal', 'aria-label': 'Valor desta cirurgia', value: moneyInput(st.alloc.get(r.id)), style: 'max-width:150px;min-height:42px', oninput: (e) => { st.alloc.set(r.id, parseMoney(e.target.value)); drawFoot(); } }))) : row;
        });
        cands.replaceChildren(h('div', { class: 'sec-h' }, h('h2', { style: 'font-size:1.1875rem' }, 'De qual cirurgia?'), h('span', { class: 'small muted' }, st.sel.length ? plural(st.sel.length, 'escolhida', 'escolhidas') : '')),
          h('p', { class: 'note' }, 'Toque em uma ou mais. As mais antigas aparecem primeiro.'),
          items.length ? h('div', { class: 'group' }, items) : h('div', { class: 'empty' }, h('p', null, f ? 'Nenhuma cirurgia a receber com esse nome.' : 'Nenhuma cirurgia a receber.')));
      }
      function drawFoot() {
        const soma = [...st.alloc.values()].reduce((s, v) => s + (v || 0), 0);
        footBtn.disabled = !(st.valor > 0 && st.sel.length);
        footBtn.textContent = st.sel.length > 1 && Math.abs(soma - (st.valor || 0)) > 0.009 ? `A soma dá ${brl(soma)}` : `Registrar${st.valor ? ' ' + brl(st.valor) : ''}`;
      }
      async function confirm() {
        const soma = [...st.alloc.values()].reduce((s, v) => s + (v || 0), 0);
        if (st.sel.length > 1 && Math.abs(soma - st.valor) > 0.009) { toast(`A soma (${brl(soma)}) está diferente do valor recebido (${brl(st.valor)}).`); return; }
        const umaSo = st.sel.length === 1;
        for (const id of st.sel) {
          const r = S.records.find((x) => x.id === id); if (!r) continue;
          const parte = umaSo && st.parte && r.devido == null;
          r.pagamentos = [...(r.pagamentos || []), { id: C.uid('g'), valor: umaSo ? st.valor : st.alloc.get(id), data: st.data || today(), origem: 'manual', fonte: st.fonte || null, parcial: parte || undefined }];
          if (parte && st.falta > 0) { r.devido = C.round2(C.totalRecebido(r) + st.falta); r.devidoOrigem = 'combinado'; }
          await saveRecord(r);
        }
        derive(); render(); api.close(true); toast('Pagamento registrado.');
      }
      drawCands(); drawFoot(); drawQuita();
      return { body: [h('div', { class: 'form' }, h('div', { class: 'grid2' }, field('Quanto caiu (R$)', valIn), field('Quando', dateIn)), field('Quem pagou', fonteSel, 'Mostra só as cirurgias dessa pessoa, convênio ou hospital.')), cands], foot: footBtn };
    } });
    return api;
  }

  // ================= fotos para organizar =================
  function sheetLoose() {
    const sel = new Set();
    const api = openSheet({ title: 'Fotos para organizar', render(api) {
      if (!S.loose.length) return { body: [h('div', { class: 'empty' }, h('span', { class: 'halo' }, icon('check')), h('h2', null, 'Tudo organizado'), h('p', null, 'Nenhuma foto sem legenda.'))] };
      const groups = new Map();
      for (const l of [...S.loose].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))) { const k = l.date + ' ' + l.time; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(l); }
      const body = [h('p', { class: 'lead' }, 'Fotos que foram para o grupo sem nenhum texto. Escolha as de uma mesma cirurgia e diga o que fazer com elas. Se preferir, deixe aqui: elas não entram nas contas.')];
      for (const [k, arr] of groups) {
        body.push(h('div', { class: 'month-h' }, h('h3', { style: 'font-size:1.0625rem' }, `Enviadas em ${dataLonga(k.slice(0, 10), { semDia: true, ano: !sameYear(k.slice(0, 10)) })}, às ${horaTxt(k.slice(11))}`), h('span', null, plural(arr.length, 'foto', 'fotos'))));
        body.push(h('div', { class: 'pgrid' }, arr.map((l) => h('div', { class: 'ptile' + (sel.has(l.id) ? ' sel' : ''), role: 'checkbox', 'aria-checked': String(sel.has(l.id)), tabindex: '0', onclick: (e) => { if (e.target.closest('.zoom')) return; sel.has(l.id) ? sel.delete(l.id) : sel.add(l.id); api.update(); } },
          photoImg(l.photoId, true), h('span', { class: 'chk' }, sel.has(l.id) ? icon('check') : null),
          h('button', { class: 'zoom', type: 'button', 'aria-label': 'Ver foto grande', onclick: () => openViewer(arr.map((x) => x.photoId), arr.indexOf(l)) }, icon('zoom'))))));
      }
      const chosen = () => S.loose.filter((l) => sel.has(l.id));
      const foot = [
        h('button', { class: 'btn primary', type: 'button', style: 'flex:1.7', disabled: !sel.size, onclick: () => {
          const ls = chosen(); const first = ls[0];
          sheetRecord(newRecord({ date: first.date, time: null, photoIds: ls.map((l) => l.photoId), revisar: [] }), { dirty: true, onSaved: async () => { await removeLoose(ls); sel.clear(); api.update(); } });
        } }, 'Criar cirurgia'),
        h('button', { class: 'btn', type: 'button', disabled: !sel.size, onclick: () => {
          const ls = chosen();
          sheetPick('Juntar a qual cirurgia?', S.records, async (t) => { const r = S.records.find((x) => x.id === t.id); r.photoIds.push(...ls.map((l) => l.photoId)); await saveRecord(r); await removeLoose(ls); sel.clear(); derive(); render(); api.update(); toast('Fotos juntadas à cirurgia.'); });
        } }, 'Juntar'),
        h('button', { class: 'btn', type: 'button', style: 'flex:0 0 56px', disabled: !sel.size, 'aria-label': 'Apagar as fotos escolhidas', onclick: async () => {
          const ls = chosen();
          if (!(await confirmDialog({ title: `Apagar ${plural(ls.length, 'foto', 'fotos')}?`, text: `${ls.length === 1 ? 'Ela fica' : 'Elas ficam'} ${LIXEIRA_DIAS} dias na lixeira, em Ajustes. No WhatsApp continuam.`, ok: 'Apagar', danger: true }))) return;
          const item = await apagarSoltas(ls); sel.clear(); render(); api.update();
          toast(ls.length === 1 ? 'Foto apagada.' : `${ls.length} fotos apagadas.`, 0, { label: 'Desfazer', fn: async () => { await recuperar([item]); render(); api.update(); toast(ls.length === 1 ? 'A foto voltou.' : 'As fotos voltaram.'); } });
        } }, icon('trash', 'sm'))];
      return { body, foot };
    } });
    return api;
  }
  // fotos que viraram uma cirurgia ou entraram numa: saem de Fotos para organizar e não voltam na próxima importação
  async function removeLoose(ls) {
    const ops = ls.flatMap((l) => [{ s: 'loose', del: l.id }, ignorar(l.key, 'organizada', [l.photoId])]);
    await Store.apply(ops); espelharIgnoradas(ops);
    const ids = new Set(ls.map((l) => l.id)); S.loose = S.loose.filter((l) => !ids.has(l.id));
    render();
  }

  // ================= lixeira (tela) =================
  const diasRestantes = (x) => Math.max(1, LIXEIRA_DIAS - Math.floor((Date.now() - (x.em || 0)) / DIA_MS));
  // mensagens que o app ignora e que valem mostrar: as excluídas ou apagadas que já não estão na lixeira, e as fotos
  // organizadas ou fichas juntadas cujas fotos já não estão em lugar nenhum do app
  function ignoradasParaMostrar() {
    const naLixeira = new Set();
    for (const x of S.trash) { if (x.rec && x.rec.key) naLixeira.add(x.rec.key); for (const l of x.loose || []) if (l.key) naLixeira.add(l.key); }
    const usadas = fotosEmUso(S.records, S.loose, S.trash);
    return [...S.ignoredInfo.values()].filter((g) => {
      if (naLixeira.has(g.key)) return false;
      if (g.motivo === 'organizada' || g.motivo === 'juntada') return (g.fotos || []).length > 0 && !g.fotos.some((id) => usadas.has(id));
      return true;
    }).map((g) => ({ ...g, d: C.describeKey(g.key) })).filter((g) => g.d).sort((a, b) => (b.d.date + b.d.time).localeCompare(a.d.date + a.d.time));
  }
  const miniFoto = (id) => h('span', { class: 'lx-ph', 'aria-hidden': 'true' }, id ? photoImg(id, true) : icon('photo'));
  function sheetLixeira() {
    return openSheet({ title: 'Lixeira', back: true, render(api) {
      const itens = [...S.trash].sort((a, b) => (b.em || 0) - (a.em || 0));
      const ign = ignoradasParaMostrar();
      const voltar = (x) => h('button', { class: 'btn sm', type: 'button', onclick: async () => {
        const n = await recuperar([x]); derive(); render(); api.update();
        toast(!n ? 'Ela já tinha voltado pela conversa do WhatsApp.' : x.tipo === 'cirurgia' ? 'A cirurgia voltou.' : x.tipo === 'fotos' ? 'As fotos voltaram para Fotos para organizar.' : 'A foto voltou.');
      } }, 'Recuperar');
      const quando = (x, txt) => `${txt} em ${ddmmyyyy(C.todayStr(new Date(x.em)))}. Sai da lixeira em ${plural(diasRestantes(x), 'dia', 'dias')}.`;
      const linha = (x) => {
        if (x.tipo === 'cirurgia') return h('div', { class: 'ritem lx' }, dateBadge(x.rec), h('span', { class: 'rmain' }, h('span', { class: 'p' }, procText(x.rec)), h('span', { class: 'm' }, quando(x, 'Excluída'))), h('span', { class: 'rside' }, voltar(x)));
        if (x.tipo === 'fotos') return h('div', { class: 'ritem lx' }, miniFoto(x.loose[0] && x.loose[0].photoId), h('span', { class: 'rmain' }, h('span', { class: 'p' }, plural(x.loose.length, 'foto sem legenda', 'fotos sem legenda')), h('span', { class: 'm' }, quando(x, x.loose.length === 1 ? 'Apagada' : 'Apagadas'))), h('span', { class: 'rside' }, voltar(x)));
        const r = S.records.find((y) => y.id === x.recId);
        return h('div', { class: 'ritem lx' }, miniFoto(x.photoId), h('span', { class: 'rmain' }, h('span', { class: 'p' }, 'Foto de uma cirurgia'), h('span', { class: 'm' }, (r ? `${procText(r)}, de ${ddmmyyyy(r.date)}. ` : '') + quando(x, 'Tirada da cirurgia'))), h('span', { class: 'rside' }, voltar(x)));
      };
      const body = [h('p', { class: 'lead' }, `O que você exclui fica aqui por ${LIXEIRA_DIAS} dias, com as fotos. Depois sai de vez.`)];
      body.push(itens.length ? h('div', { class: 'group' }, itens.map(linha)) : h('div', { class: 'empty' }, h('span', { class: 'halo' }, icon('trash')), h('p', null, 'A lixeira está vazia.')));
      if (ign.length) body.push(h('section', { class: 'sec' }, h('div', { class: 'sec-h' }, h('h2', { class: 'sm' }, 'Mensagens que o app ignora')),
        h('p', { class: 'note' }, 'O app não traz de novo da conversa o que você excluiu ou apagou. Toque em Trazer de volta, e a mensagem volta na próxima vez que você trouxer a conversa do WhatsApp.'),
        h('div', { class: 'group' }, ign.map((g) => h('div', { class: 'ritem lx' }, dateBadge({ date: g.d.date }),
          h('span', { class: 'rmain' }, h('span', { class: 'p' }, g.d.texto ? cap(g.d.texto) : 'Foto sem legenda'), h('span', { class: 'm' }, `Enviada às ${horaTxt(g.d.time)}${g.d.texto && g.d.arquivos ? `, com ${plural(g.d.arquivos, 'foto', 'fotos')}` : ''}`)),
          h('span', { class: 'rside' }, h('button', { class: 'btn sm', type: 'button', onclick: async () => {
            await Store.del('ignored', g.key); S.ignored.delete(g.key); S.ignoredInfo.delete(g.key); api.update();
            toast('Pronto. Ela volta na próxima vez que você trouxer a conversa.', 4500);
          } }, 'Trazer de volta')))))));
      return { body };
    } });
  }

  // ================= nomes e abreviações =================
  const TYPE_TXT = { col: 'Colega', hosp: 'Hospital', proc: 'Procedimento', conv: 'Convênio', ign: 'Ignorar' };
  function sheetTerms() {
    let q = '';
    return openSheet({ title: 'Nomes e abreviações', back: true, render(api) {
      const inp = h('input', { type: 'search', placeholder: 'Buscar', value: q, autocomplete: 'off', 'aria-label': 'Buscar nome' });
      const box = h('div', { class: 'sec' });
      const draw = () => {
        const nq = C.norm(q); const kids = [];
        for (const type of ['col', 'hosp', 'proc', 'conv', 'ign']) {
          const ts = S.terms.filter((t) => t.type === type && (!nq || C.norm(t.name + ' ' + (t.aliases || []).join(' ')).includes(nq))).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
          if (!ts.length) continue;
          kids.push(h('div', { class: 'month-h' }, h('h3', null, { col: 'Colegas', hosp: 'Hospitais', proc: 'Procedimentos', conv: 'Convênios', ign: 'Palavras ignoradas' }[type])));
          kids.push(h('div', { class: 'group flat' }, ts.map((t) => { const al = (t.aliases || []).filter((a) => a !== C.norm(t.name)).slice(0, 5);
            return h('button', { class: 'rowbtn', type: 'button', onclick: () => sheetTermEdit(t, () => api.update()) }, h('span', { class: 't' }, t.name, al.length ? h('small', null, 'também: ' + al.join(', ')) : null), icon('chev', 'chev')); })));
        }
        box.replaceChildren(...kids);
      };
      inp.addEventListener('input', () => { q = inp.value; draw(); }); draw();
      return { body: [h('p', { class: 'lead' }, 'É assim que o app entende as suas legendas e as planilhas. "Também" são outros jeitos de escrever o mesmo nome, como CVL.'), h('div', { class: 'search' }, icon('search'), inp), box],
        foot: h('button', { class: 'btn soft', type: 'button', onclick: () => sheetTermEdit(null, () => api.update()) }, icon('plus'), 'Novo nome') };
    } });
  }
  function sheetTermEdit(term, onDone) {
    const t = term ? clone(term) : { id: C.uid('t'), type: 'proc', name: '', aliases: [] };
    const oldName = term ? term.name : null;
    let aliasTxt = (t.aliases || []).filter((a) => a !== C.norm(t.name)).join(', ');
    return openSheet({ title: term ? term.name : 'Novo nome', back: true, render(api) {
      const nameIn = h('input', { type: 'text', value: t.name, autocomplete: 'off', oninput: (e) => { t.name = e.target.value; } });
      const al = h('textarea', { rows: 3, oninput: (e) => { aliasTxt = e.target.value; } }); al.value = aliasTxt;
      const body = [h('form', { class: 'form', onsubmit: (e) => e.preventDefault() }, field('Nome', nameIn),
        h('div', { class: 'field' }, h('span', { class: 'lbl' }, 'É um'), h('div', { class: 'qchips' }, Object.entries(TYPE_TXT).map(([k, l]) => h('button', { class: 'qchip', type: 'button', 'aria-pressed': String(k === t.type), onclick: () => { t.type = k; api.update(); } }, l)))),
        field('Outros jeitos de escrever', al, 'Separe por vírgula. Exemplo: cvl, colecisto vlp'))];
      if (term) body.push(h('button', { class: 'link danger', type: 'button', onclick: async () => {
        if (!(await confirmDialog({ title: 'Excluir este nome?', text: 'As cirurgias que já usam esse nome não mudam.', ok: 'Excluir', danger: true }))) return;
        S.terms = S.terms.filter((x) => x.id !== t.id); await Store.del('terms', t.id); derive(); render(); if (onDone) onDone(); api.close(true);
      } }, 'Excluir este nome'));
      return { body, foot: h('button', { class: 'btn primary', type: 'button', onclick: async () => {
        t.name = (t.name || '').trim(); if (!t.name) { toast('Escreva o nome.'); return; }
        t.aliases = uniq([C.norm(t.name), ...aliasTxt.split(',').map((a) => C.norm(a))]);
        if (t.type === 'proc' && !t.fam) t.fam = C.norm(t.name).split(' ')[0];
        const i = S.terms.findIndex((x) => x.id === t.id); if (i >= 0) S.terms[i] = t; else S.terms.push(t);
        await Store.put('terms', t);
        if (oldName && oldName !== t.name) await renameEverywhere(term.type, oldName, t.name);
        derive(); render(); if (onDone) onDone(); api.close(true); toast('Salvo.');
      } }, 'Salvar') };
    } });
  }
  async function renameEverywhere(type, from, to) {
    const changed = [];
    for (const r of S.records) {
      let ch = false;
      if (type === 'proc' && r.procs.includes(from)) { r.procs = r.procs.map((p) => (p === from ? to : p)); ch = true; }
      if (type === 'col' && (r.cols || []).includes(from)) { r.cols = r.cols.map((p) => (p === from ? to : p)); ch = true; }
      if (type === 'hosp' && r.hosp === from) { r.hosp = to; ch = true; }
      if (type === 'conv' && r.conv === from) { r.conv = to; ch = true; }
      if (type === 'proc') for (const l of r.rep || []) if (l.procName === from) { l.procName = to; ch = true; }
      if (ch) changed.push(r);
    }
    await Store.putMany('records', changed);
  }

  // ================= planilhas importadas =================
  function sheetRepasses() {
    return openSheet({ title: 'Planilhas de repasse', back: true, render(api) {
      if (!S.repasses.length) return { body: [h('div', { class: 'empty' }, h('span', { class: 'halo' }, icon('sheet')), h('p', null, 'Nenhuma planilha importada ainda.'))], foot: h('button', { class: 'btn primary', type: 'button', onclick: pickFile }, 'Abrir uma planilha') };
      const reps = [...S.repasses].sort((a, b) => (b.importedAt || 0) - (a.importedAt || 0));
      // quanto caiu de fato na conta (item 26): opcional, pode ser anotado depois, olhando o extrato
      const caiu = async (d) => {
        const v = await formDialog({ title: 'Quanto caiu na conta?', text: `A planilha liberou ${brl(d.total)}. Coloque o valor que entrou no banco, para o "Recebido no mês" bater com o extrato. Em branco, vale o liberado.`, fields: [{ id: 'v', label: 'Valor (R$)', inputmode: 'decimal', value: moneyInput(d.caiu), placeholder: moneyInput(d.total) }] });
        if (!v) return;
        d.caiu = parseMoney(v.v); await Store.put('repasses', d); render(); api.update(); toast('Valor guardado.');
      };
      const sub = (d) => { const dif = d.caiu != null ? C.round2(d.total - d.caiu) : 0;
        return `${brl(d.total)} liberados, ${plural(d.n, 'linha', 'linhas')}, pago em ${ddmmyyyy(d.pay)}` + (d.caiu == null ? '' : `. Caiu ${brl(d.caiu)}${Math.abs(dif) >= 0.005 ? ` (${dif > 0 ? brl(dif) + ' a menos' : brl(-dif) + ' a mais'})` : ''}`); };
      return { body: [h('div', { class: 'group' }, reps.map((d) => h('div', { class: 'rowbtn' }, h('span', { class: 'bubble' }, icon('sheet')),
        h('span', { class: 't' }, d.numero ? 'Repasse nº ' + d.numero : d.nome || 'Repasse', h('small', null, sub(d)),
          h('span', { class: 'row', style: 'gap:8px;margin-top:10px' }, h('button', { class: 'btn sm', type: 'button', onclick: () => caiu(d) }, 'Quanto caiu'),
            h('button', { class: 'btn sm', type: 'button', onclick: async () => { if (await undoRepasse(d, true)) api.update(); } }, 'Desfazer'))))))] };
    } });
  }
  async function undoRepasse(doc, ask) {
    if (ask && !(await confirmDialog({ title: 'Desfazer esta planilha?', text: 'Os pagamentos dela saem das cirurgias. As que ela pagou voltam para a receber, e as que ela criou são apagadas.', ok: 'Desfazer', danger: true }))) return false;
    const criadas = [];
    for (const r of [...S.records]) {
      const res = C.desfazerRepasseNaFicha(r, doc.id);   // tira pagamento, linhas, valor devido e a data/hora dela
      if (res === 'apagar') criadas.push(r);
      else if (res === 'mudou') await saveRecord(r, { sistema: true });
    }
    await apagarFichasDeVez(criadas);
    S.repasses = S.repasses.filter((x) => x.id !== doc.id); await Store.del('repasses', doc.id);
    derive(); render(); if (ask) toast('Planilha desfeita.');
    return true;
  }

  // ================= importação =================
  function pickFile() {
    const inp = $('#file-in'); inp.value = ''; inp.multiple = false;
    inp.onchange = async () => {
      const f = inp.files && inp.files[0]; if (!f) return;
      try { await routeFile(f); } catch (e) { console.error(e); anotaErro(e && e.message, 'abrir arquivo'); await confirmDialog({ title: 'Não deu para abrir', text: (e && e.message) || String(e), ok: 'Entendi', cancel: false }); }
    };
    inp.click();
  }
  function pickPhotos(cb) {
    const inp = $('#photo-in'); inp.value = '';
    inp.onchange = () => { const fs = [...(inp.files || [])]; if (fs.length) cb(fs); };
    inp.click();
  }
  async function routeFile(file) {
    let zip = null;
    try { zip = await C.zipOpen(file); } catch (e) { zip = null; }
    if (zip) {
      if (zip.entries.some((e) => e.name === 'xl/workbook.xml')) return flowRepasse(file);
      if (zip.entries.some((e) => e.name === 'dados.json' || e.name === 'backup.json')) return flowRestore([file]);
      if (zip.entries.some((e) => /\.txt$/i.test(e.base))) return flowWhatsApp(file, zip);
      throw new Error('Esse arquivo não é a conversa do WhatsApp, uma planilha de repasse nem um backup do app.');
    }
    const head = await file.slice(0, 4000).text();
    if (/^\s*\{/.test(head)) return flowRestore([file]);
    if (/\[\d{1,2}\/\d{1,2}\/\d{2,4},? \d{1,2}:\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4},? \d{1,2}:\d{2} - /.test(head)) return flowWhatsApp(file, null);
    throw new Error('Esse arquivo não é a conversa do WhatsApp, uma planilha de repasse nem um backup do app.');
  }
  function clearDemo() {
    if (!S.demo) return;
    S.records = S.records.filter((r) => !r.demo); S.repasses = S.repasses.filter((r) => !r.demo); S.terms = S.terms.filter((t) => !t.demo);
    S.demo = false; derive(); render();
  }
  function sheetWhatsHelp() {
    const grupo = S.settings.grupo || 'das cirurgias';
    openSheet({ title: 'Trazer do WhatsApp', render() {
      return { body: [
        h('p', { class: 'lead' }, 'O WhatsApp entrega a conversa num arquivo. Você não precisa abrir nem mexer nele.'),
        h('ol', { class: 'steps' },
          h('li', null, h('span', null, 'No WhatsApp, abra o grupo ', h('b', null, grupo), ' e toque no nome do grupo, lá em cima.')),
          h('li', null, h('span', null, 'Desça até o fim e toque em ', h('b', null, 'Exportar conversa'), '. Escolha ', h('b', null, 'Anexar mídia'), '.')),
          h('li', null, h('span', null, 'Toque em ', h('b', null, 'Salvar em Arquivos'), ' e depois em ', h('b', null, 'Salvar'), '.')),
          h('li', null, h('span', null, 'Volte aqui e toque em ', h('b', null, 'Escolher o arquivo'), '.'))),
        tip('Pode exportar a conversa inteira sempre', ' O app só traz o que for novo. Uma ou duas vezes por mês já basta.', null, null, 'info')],
        foot: h('button', { class: 'btn primary', type: 'button', 'data-act': 'escolher', onclick: () => pickFile() }, 'Escolher o arquivo') };
    } });
  }

  // ---- WhatsApp ----
  async function flowWhatsApp(file, zip) {
    const b = busy('Lendo a conversa…');
    let chat, g;
    try {
      let text;
      if (zip) { const te = zip.entries.find((e) => e.base === '_chat.txt') || zip.entries.find((e) => /\.txt$/i.test(e.base)); text = await (await C.zipEntryBlob(zip, te)).text(); }
      else text = await file.text();
      chat = C.parseChat(text); g = C.groupMessages(chat.messages);
    } finally { b.done(); }
    if (!chat.messages.length) throw new Error('Não encontrei mensagens nesse arquivo.');
    clearDemo();
    for (const s of sheets.slice()) s.close(true);
    const senders = new Map(); for (const m of chat.messages) if (!m.system && m.sender) senders.set(m.sender, (senders.get(m.sender) || 0) + 1);
    const me = [...senders.entries()].sort((a, b) => b[1] - a[1])[0];
    if (!S.settings.nome && me && !PREVIEW) S.settings.nome = C.capFirst(me[0].split(/\s+/)[0]);
    if (chat.chatName && (!me || chat.chatName !== me[0])) S.settings.grupo = chat.chatName.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '').trim();
    // cada ficha pela chave da mensagem (e pelas chaves antigas, de antes de a legenda ser editada)
    const byKey = () => new Map(S.records.flatMap((r) => [r.key, ...(r.chavesAntigas || [])].filter(Boolean).map((k) => [k, r])));
    // o que é novo nesta conversa. Fotos sem legenda vão uma a uma: cada foto tem a sua chave (com "~n" quando a mesma
    // mensagem traz mais de uma), e a que já está no app, na lixeira ou foi ignorada não entra de novo.
    const plan = () => {
      const ex = byKey(); const lk = new Set(S.loose.map((l) => l.key));
      for (const x of S.trash) for (const l of x.loose || []) if (l.key) lk.add(l.key);
      // legenda editada no WhatsApp: a chave mudou, mas é a mesma mensagem (mesma hora exata e número de fotos)
      const ignLugar = new Set([...S.ignored].map((k) => C.keySlot(k)).filter(Boolean));
      const entries = [], editadas = [];
      for (const e of g.entries) {
        if (ex.has(e.key) || S.ignored.has(e.key)) continue;
        if (e.editada) {
          const r = C.findEdited(e, S.records);
          if (r) { editadas.push({ e, r }); continue; }
          if (ignLugar.has(C.keySlot(e.key))) continue;   // ela tinha excluído essa cirurgia antes da edição
        }
        entries.push(e);
      }
      const fill = zip ? g.entries.filter((e) => ex.has(e.key) && !ex.get(e.key).photoIds.length && e.photos.length) : [];
      const loose = [];
      if (zip) for (const l of g.loose) {
        if (S.ignored.has(l.key)) continue;
        l.photos.forEach((name, i) => { const key = l.photos.length > 1 ? `${l.key}~${i}` : l.key; if (!lk.has(key) && !S.ignored.has(key)) loose.push({ key, date: l.date, time: l.time, name }); });
      }
      return { entries, editadas, fill, loose, ex };
    };
    let p = plan();
    const unknown = C.collectUnknown([...p.entries, ...p.editadas.map((x) => x.e)], S.index);
    const choice = new Map(unknown.map((u) => [u.norm, u.guess]));
    const st = { step: unknown.length ? 'termos' : 'resumo', done: null };
    let recs = [];
    const api = openSheet({ title: 'Conversa do WhatsApp',
      // enquanto guarda as fotos, a tela fica aberta: se fechar no meio, a importação continua da próxima vez
      beforeClose: async () => { if (st.step !== 'importando') return true; toast('Espere terminar de guardar as fotos.'); return false; },
      render(api) {
      if (st.step === 'termos') {
        return { body: [
          h('h1', { class: 'bigtitle' }, 'Quem é quem?'),
          h('p', { class: 'lead' }, 'Estes nomes aparecem nas suas legendas. Confirme o que cada um é. O app guarda a resposta e não pergunta de novo.'),
          h('div', { class: 'group' }, unknown.map((u) => h('div', { class: 'qrow' }, h('div', { class: 'q' }, u.text, h('small', null, `aparece ${plural(u.count, 'vez', 'vezes')}`)),
            seg([['col', 'Colega'], ['hosp', 'Hospital'], ['proc', 'Procedimento'], ['ign', 'Ignorar']], choice.get(u.norm), (v) => { choice.set(u.norm, v); api.update(); }, u.text))))],
          foot: h('button', { class: 'btn primary', type: 'button', onclick: async () => {
            const add = unknown.map((u) => ({ id: C.uid('t'), type: choice.get(u.norm), name: u.text, aliases: [u.norm], fam: choice.get(u.norm) === 'proc' ? u.norm.split(' ')[0] : undefined }));
            S.terms.push(...add); await Store.putMany('terms', add); derive(); p = plan(); st.step = 'resumo'; api.update();
          } }, 'Continuar') };
      }
      if (st.step === 'resumo') {
        recs = p.entries.map((e) => C.recordFromEntry(e, S.index, { chatName: chat.chatName, feriados: S.hol }));
        const nPh = recs.reduce((s, r) => s + r.photoNames.length, 0) + p.fill.reduce((s, e) => s + e.photos.length, 0);
        const nLoose = p.loose.length;
        const rev = recs.filter((r) => pendencias(r).length).length;
        const dates = recs.map((r) => r.date).sort();
        const nEd = p.editadas.length;
        if (!recs.length && !nLoose && !p.fill.length && !nEd) {
          // uma importação que tinha parado no meio e não tem mais nada a trazer está, na prática, terminada
          const parada = S.imports.find((x) => x.estado === 'andamento');
          if (parada) { parada.estado = 'pronta'; parada.fim = Date.now(); Store.put('imports', parada).then(() => render()).catch(() => {}); }
          return { body: [h('div', { class: 'empty' }, h('span', { class: 'halo' }, icon('check')), h('h2', null, 'Nada de novo'), h('p', null, 'Tudo o que está nessa conversa já está no app.'))], foot: h('button', { class: 'btn', type: 'button', onclick: () => api.close(true) }, 'Fechar') };
        }
        return { body: [
          h('div', null, h('h1', { class: 'bigtitle' }, recs.length ? plural(recs.length, 'cirurgia encontrada', 'cirurgias encontradas') : nEd && !nLoose && !p.fill.length ? plural(nEd, 'legenda editada', 'legendas editadas') : 'Fotos novas'),
            dates.length ? h('p', { class: 'muted', style: 'margin-top:6px' }, `De ${dataLonga(dates[0], { semDia: true, ano: true })} a ${dataLonga(dates[dates.length - 1], { semDia: true, ano: true })}`) : null),
          // só legendas editadas: sem contagem de fotos nem aviso de arquivo sem fotos
          recs.length || nLoose || p.fill.length ? h('div', { class: 'statgrid' }, h('div', null, h('b', null, nPh), h('span', null, nPh === 1 ? 'foto' : 'fotos')), h('div', null, h('b', null, nLoose), h('span', null, 'para organizar')), h('div', null, h('b', null, rev), h('span', null, 'para completar'))) : null,
          zip || !recs.length ? null : tip('Arquivo sem fotos', ' As cirurgias entram sem fotos. Para trazê-las, exporte de novo escolhendo Anexar mídia.', null, null, 'photo', 'warn'),
          recs.length ? h('section', { class: 'sec' }, h('div', { class: 'sec-h' }, h('h2', { style: 'font-size:1.1875rem' }, 'Veja como ficou')), h('div', { class: 'group' }, [...recs].sort(byDateDesc).slice(0, 40).map((r) => recordItem({ ...r, photoIds: r.photoNames }, () => {})))) : null,
          recs.length > 40 ? h('p', { class: 'note' }, `E mais ${recs.length - 40}.`) : null,
          nEd ? h('section', { class: 'sec' }, h('div', { class: 'sec-h' }, h('h2', { style: 'font-size:1.1875rem' }, 'Legendas editadas no WhatsApp')),
            h('p', { class: 'note' }, 'São cirurgias que já estão no app. A ficha recebe a legenda nova; se você já tinha mexido nela, ela aparece em Para completar para você conferir.'),
            h('div', { class: 'group' }, p.editadas.map(({ e, r }) => h('div', { class: 'ritem lx' }, dateBadge(r),
              h('span', { class: 'rmain' }, h('span', { class: 'p' }, e.caption), h('span', { class: 'm' }, `Antes: ${r.caption}`)))))) : null],
          foot: h('button', { class: 'btn primary', type: 'button', onclick: () => runImport(api) }, 'Trazer para o app') };
      }
      if (st.step === 'importando') return { body: [h('div', { class: 'empty' }, h('span', { class: 'halo' }, icon('photo')), h('p', { id: 'imp-lab' }, 'Guardando…'), h('div', { class: 'progress', style: 'width:100%' }, h('span', { id: 'imp-bar' })))] };
      const dn = st.done;
      const extras = [dn.loose ? plural(dn.loose, 'foto para organizar', 'fotos para organizar') : null, dn.rev ? plural(dn.rev, 'para completar', 'para completar') : null, dn.fill ? `fotos em ${plural(dn.fill, 'cirurgia', 'cirurgias')} que já estavam no app` : null, dn.edit ? plural(dn.edit, 'legenda editada atualizada', 'legendas editadas atualizadas') : null, dn.err ? `${dn.err} fotos não puderam ser lidas` : null].filter(Boolean);
      return { body: [h('div', { class: 'empty' }, h('span', { class: 'halo' }, icon('check')), h('h2', null, 'Pronto!'), dn.recs ? h('p', null, `${plural(dn.recs, 'cirurgia nova', 'cirurgias novas')} no app.`) : null, extras.length ? h('p', null, cap(extras.join(', ')) + '.') : null),
        !PREVIEW && (dn.recs || dn.loose || dn.edit) ? tip('Faça um backup agora', ' Depois do backup, o arquivo da conversa que você salvou em Arquivos já pode ser apagado do iPhone.', 'Fazer backup', () => { api.close(true); exportBackup(); }, 'share') : null,
        h('button', { class: 'link', type: 'button', 'data-act': 'desfazer-importacao', onclick: async () => { const imp = S.imports.find((x) => x.id === dn.impId); if (imp && (await desfazerImportacao(imp, true))) { api.close(true); go('inicio'); toast('Importação desfeita.'); } } }, 'Desfazer esta importação')],
        foot: [dn.loose ? h('button', { class: 'btn', type: 'button', onclick: () => { api.close(true); sheetLoose(); } }, 'Organizar fotos') : null, h('button', { class: 'btn primary', type: 'button', onclick: () => { api.close(true); go('lista', {}); } }, 'Ver cirurgias')] };
    } });
    // Grava aos poucos: cada cirurgia entra com as suas fotos e o seu número assim que fica pronta, e cada foto sem legenda
    // entra logo depois de guardada. Se o app fechar no meio, o que já entrou fica, a importação aparece como "não terminou"
    // e, ao escolher o arquivo de novo, o app traz só o que faltou. Fotos guardadas sem ficha saem na próxima abertura.
    async function runImport(api) {
      st.step = 'importando'; api.update();
      const lab = () => $('#imp-lab'), bar = () => $('#imp-bar');
      const entryOf = new Map(zip ? zip.entries.map((e) => [e.base, e]) : []);
      const precisaFotos = (r, e) => zip && !(r.photoIds || []).length && e.photos.length;
      const total = Math.max(1, recs.reduce((s, r) => s + r.photoNames.length, 0) + p.fill.reduce((s, e) => s + e.photos.length, 0) + p.loose.length
        + p.editadas.reduce((s, { e, r }) => s + (precisaFotos(r, e) ? e.photos.length : 0), 0));
      let n = 0, err = 0;
      const one = async (name) => {
        n++; if (lab()) lab().textContent = `Guardando foto ${n} de ${total}`; if (bar()) bar().style.width = Math.round((n / total) * 100) + '%';
        const e = entryOf.get(name); if (!e) return null;
        try { return await storePhoto(await C.zipEntryBlob(zip, e, extType(name)), name); } catch (x) { err++; anotaErro(x && x.message, 'guardar foto'); return null; }
      };
      // a importação que parou no meio continua com o mesmo número: desfazer depois tira tudo de uma vez
      let imp = S.imports.find((x) => x.estado === 'andamento');
      if (!imp) { imp = { id: C.uid('i'), inicio: Date.now(), arquivo: (file && file.name) || '', grupo: S.settings.grupo || '', fill: [] }; S.imports.push(imp); }
      imp.estado = 'andamento'; imp.fim = null; imp.fill = imp.fill || []; imp.editadas = imp.editadas || [];
      await Store.put('imports', imp);
      let feitas = 0, fotosSoltas = 0, editadasFeitas = 0; const filled = [];
      for (const r of recs) {
        for (const nm of r.photoNames) { const id = zip ? await one(nm) : null; if (id) r.photoIds.push(id); }
        S.settings.seq += 1; r.num = S.settings.seq; r.importId = imp.id; r.createdAt = r.updatedAt = Date.now();
        await Store.apply([{ s: 'records', put: r }, { s: 'meta', put: S.settings }]);   // a ficha entra junto com o número dela
        S.records.push(r); feitas++;
      }
      // legendas editadas: a ficha que já existe recebe a legenda nova. Se ela ainda não foi mexida (nem paga), o app relê
      // a legenda inteira; se foi, só troca o texto e pede para conferir. A versão de antes fica na importação, para desfazer.
      for (const { e, r: r0 } of p.editadas) {
        const i = S.records.findIndex((x) => x.id === r0.id); if (i < 0) continue;
        const r = S.records[i];
        const novo = C.recordFromEntry(e, S.index, { chatName: chat.chatName, feriados: S.hol });
        const upd = { ...r, caption: novo.caption, legendaAnterior: r.caption, chavesAntigas: uniq([...(r.chavesAntigas || []), r.key]), key: e.key, updatedAt: Date.now() };
        if (sit(r) === 'aberto' && !r.editadaEm) Object.assign(upd, { date: novo.date, time: novo.time, msgDate: novo.msgDate, msgTime: novo.msgTime, procs: novo.procs, hosp: novo.hosp, cols: novo.cols, conv: novo.conv, valorPrevisto: novo.valorPrevisto, devido: novo.devido, devidoOrigem: novo.devidoOrigem, notas: novo.notas, revisar: novo.revisar, omitted: novo.omitted });
        else upd.revisar = uniq([...(r.revisar || []), 'Legenda editada']);
        if (precisaFotos(r, e)) {
          const novas = []; for (const nm of e.photos) { const id = await one(nm); if (id) novas.push(id); }
          upd.photoIds = novas; if (novas.length) imp.fill.push({ recId: r.id, photoIds: novas });
        }
        imp.editadas.push({ recId: r.id, antes: clone(r), em: upd.updatedAt });   // em: para saber, ao desfazer, se ela mudou depois
        await Store.apply([{ s: 'records', put: upd }, { s: 'imports', put: imp }]);
        S.records[i] = upd; editadasFeitas++;
      }
      for (const e of p.fill) {
        const r = p.ex.get(e.key); const novas = [];
        for (const nm of e.photos) { const id = await one(nm); if (id) novas.push(id); }
        if (!novas.length) continue;
        r.photoIds.push(...novas); imp.fill.push({ recId: r.id, photoIds: novas });
        await Store.apply([{ s: 'records', put: r }, { s: 'imports', put: imp }]);
        filled.push(r);
      }
      for (const l of p.loose) {
        const id = await one(l.name); if (!id) continue;
        const item = { id: C.uid('l'), key: l.key, date: l.date, time: l.time, photoId: id, importId: imp.id };
        await Store.put('loose', item); S.loose.push(item); fotosSoltas++;
      }
      imp.estado = 'pronta'; imp.fim = Date.now();
      await Store.put('imports', imp);
      await saveSettings(); persistStorage(); derive(); render();
      st.done = { recs: feitas, loose: fotosSoltas, rev: recs.filter((r) => pendencias(r).length).length, fill: filled.length, edit: editadasFeitas, err, impId: imp.id };
      st.step = 'pronto'; api.update();
    }
  }

  // ================= conversas importadas =================
  // Cada importação do WhatsApp tem um número: as fichas e as fotos sem legenda que ela trouxe levam esse número, e as
  // fotos que ela pôs em fichas que já existiam ficam anotadas nela. Desfazer tira tudo isso de uma vez (sem lixeira:
  // trazer a conversa de novo traz tudo de volta).
  function resumoImportacao(x) {
    const recs = S.records.filter((r) => r.importId === x.id);
    const loose = S.loose.filter((l) => l.importId === x.id);
    const fill = (x.fill || []).map((f) => { const r = S.records.find((y) => y.id === f.recId && y.importId !== x.id); return r ? { r, ids: f.photoIds.filter((id) => (r.photoIds || []).includes(id)) } : null; }).filter((f) => f && f.ids.length);
    const fotos = recs.reduce((s, r) => s + (r.photoIds || []).length, 0) + loose.length + fill.reduce((s, f) => s + f.ids.length, 0);
    const mexidas = recs.filter((r) => r.status !== 'aberto' || r.editadaEm).length;
    const editadas = (x.editadas || []).filter((ed) => S.records.some((r) => r.id === ed.recId && r.importId !== x.id));
    return { recs, loose, fill, fotos, mexidas, editadas };
  }
  async function desfazerImportacao(x, perguntar) {
    const z = resumoImportacao(x);
    if (perguntar) {
      const mex = z.mexidas ? (z.mexidas === 1 ? ' Uma delas já tinha mudanças suas, como um pagamento, que também saem.' : ` ${z.mexidas} delas já tinham mudanças suas, como pagamentos, que também saem.`) : '';
      const ed = z.editadas.length ? ` ${z.editadas.length === 1 ? 'A legenda editada volta' : `As ${z.editadas.length} legendas editadas voltam`} a ser como era${z.editadas.length === 1 ? '' : 'm'}.` : '';
      const ok = await confirmDialog({ title: 'Desfazer esta importação?', text: `Saem do app ${plural(z.recs.length, 'cirurgia', 'cirurgias')} e ${plural(z.fotos, 'foto', 'fotos')} que ela trouxe.${mex}${ed} Se você trouxer a conversa de novo, elas voltam.`, ok: 'Desfazer', danger: true });
      if (!ok) return false;
    }
    const fotos = [...z.recs.flatMap((r) => r.photoIds || []), ...z.loose.map((l) => l.photoId)];
    const ops = [...z.recs.map((r) => ({ s: 'records', del: r.id })), ...z.loose.map((l) => ({ s: 'loose', del: l.id })), { s: 'imports', del: x.id }];
    const voltam = new Map(z.editadas.map((ed) => [ed.recId, ed]));   // a ficha de antes da legenda editada
    const mudadas = z.fill.filter((f) => !voltam.has(f.r.id)).map((f) => { const tira = new Set(f.ids); fotos.push(...f.ids); return { ...f.r, photoIds: f.r.photoIds.filter((id) => !tira.has(id)), updatedAt: Date.now() }; });
    for (const f of z.fill) if (voltam.has(f.r.id)) fotos.push(...f.ids);
    for (const ed of voltam.values()) {
      const r = S.records.find((y) => y.id === ed.recId); if (!r) continue;
      if (r.updatedAt === ed.em) { mudadas.push(ed.antes); continue; }   // nada mudou depois: a ficha volta inteira
      // ela mudou a ficha depois (pagamento, edição): volta só a legenda, e saem as fotos que esta importação pôs
      const f = z.fill.find((y) => y.r.id === r.id); const tira = new Set(f ? f.ids : []);
      const v = { ...r, caption: ed.antes.caption, key: ed.antes.key, photoIds: (r.photoIds || []).filter((id) => !tira.has(id)), updatedAt: Date.now() };
      for (const k of ['chavesAntigas', 'legendaAnterior']) { if (ed.antes[k] !== undefined) v[k] = ed.antes[k]; else delete v[k]; }
      if (!(ed.antes.revisar || []).includes('Legenda editada')) v.revisar = (v.revisar || []).filter((y) => y !== 'Legenda editada');
      mudadas.push(v);
    }
    for (const r of mudadas) ops.push({ s: 'records', put: r });
    await Store.apply(ops);
    const saiRec = new Set(z.recs.map((r) => r.id)), saiLoose = new Set(z.loose.map((l) => l.id));
    S.records = S.records.filter((r) => !saiRec.has(r.id)).map((r) => mudadas.find((m) => m.id === r.id) || r);
    S.loose = S.loose.filter((l) => !saiLoose.has(l.id));
    S.imports = S.imports.filter((y) => y.id !== x.id);
    await apagarFotosSemUso(fotos);   // só as que não ficaram em outra ficha (por exemplo, juntada)
    derive(); render();
    return true;
  }
  function sheetImports() {
    return openSheet({ title: 'Conversas do WhatsApp', back: true, render(api) {
      if (!S.imports.length) return { body: [h('div', { class: 'empty' }, h('span', { class: 'halo' }, icon('chat')), h('p', null, 'As conversas que você trouxer do WhatsApp aparecem aqui, e dá para desfazer cada uma.'))] };
      const lista = [...S.imports].sort((a, b) => (b.inicio || 0) - (a.inicio || 0));
      return { body: [h('p', { class: 'lead' }, 'Cada vez que você traz a conversa, o app guarda o que ela trouxe. Desfazer tira essas cirurgias e fotos de uma vez.'),
        h('div', { class: 'group' }, lista.map((x) => { const z = resumoImportacao(x);
          const sub = x.estado === 'andamento' ? 'Não terminou. Escolha o arquivo da conversa de novo para continuar.'
            : z.recs.length || z.fotos || z.editadas.length ? [z.recs.length || z.fotos ? `${plural(z.recs.length, 'cirurgia', 'cirurgias')} e ${plural(z.fotos, 'foto', 'fotos')}` : null, z.editadas.length ? plural(z.editadas.length, 'legenda editada', 'legendas editadas') : null].filter(Boolean).join(', ') : 'Nada dela continua no app.';
          return h('div', { class: 'rowbtn' }, h('span', { class: 'bubble ok' }, icon('chat')),
            h('span', { class: 't' }, `Trazida em ${ddmmyyyy(C.todayStr(new Date(x.inicio)))}`, h('small', null, sub)),
            h('button', { class: 'btn sm', type: 'button', onclick: async () => { if (await desfazerImportacao(x, true)) { api.update(); toast('Importação desfeita.'); } } }, 'Desfazer'));
        }))] };
    } });
  }

  // ---- planilha de repasse ----
  function firstName(full, taken) {
    const parts = String(full || '').split(/\s+/).filter(Boolean).map((w) => C.capFirst(w.toLowerCase()));
    let name = parts[0] || 'Colega';
    if (taken.some((t) => C.norm(t) === C.norm(name)) && parts[1]) name += ' ' + parts[1];
    return name;
  }
  function compName(comp) {
    const m = String(comp || '').match(/^(\d{1,2})(?:\D+(\d{2,4}))?$/);
    if (!m || +m[1] < 1 || +m[1] > 12) return comp ? 'competência ' + comp : '';
    return 'referente a ' + MES_LONGO[+m[1] - 1] + (m[2] ? ' de ' + (m[2].length === 2 ? '20' + m[2] : m[2]) : '');
  }
  async function flowRepasse(file) {
    const b = busy('Lendo a planilha…');
    let rep;
    try { rep = C.parseRepasse(await C.readXlsx(file), file.name); } finally { b.done(); }
    if (!rep.lines.length) throw new Error('Não encontrei linhas com data e valor nessa planilha.');
    clearDemo();
    for (const s of sheets.slice()) s.close(true);
    const hosps = uniq([...usedValues('hosp'), ...namesOf('hosp')]);
    const st = { step: S.repasses.some((x) => x.id === rep.id) ? 'repetido' : 'plano', hosp: S.settings.hospRepasse || (hosps.includes('UMC') ? 'UMC' : hosps[0] || ''), quando: 'hoje', pay: today(), over: new Map(), ligar: new Map(), separar: new Set(), mesmo: new Map(), caiu: null };
    const execs = uniq(rep.lines.map((l) => l.exec));
    const colNames = namesOf('col');
    // nome completo com o mesmo primeiro nome de um colega: pergunta. Se o colega já tem outro nome completo, o app parte
    // de "colega novo" e deixa escolher o colega, se for a mesma pessoa.
    // Dois nomes completos diferentes com o mesmo primeiro nome na mesma planilha: o segundo também parte de "colega novo".
    const nomeNaPlanilha = new Map();
    for (const ex of execs) {
      const m = C.mapExecutor(ex, S.index);
      let outra = false;
      if (m && m.how === 'primeiro-nome') {
        const visto = nomeNaPlanilha.get(m.term.name);
        outra = m.outroNome || (visto != null && visto !== C.norm(ex));
        if (visto == null) nomeNaPlanilha.set(m.term.name, C.norm(ex));
      }
      st.over.set(ex, !m ? { col: '__novo__', how: 'novo', novo: firstName(ex, colNames) }
        : outra ? { col: '__novo__', how: 'novo', novo: firstName(ex, colNames), suspeita: m.term.name }
          : { col: m.term.name, how: m.how });
    }
    const tempIndex = () => {
      const terms = S.terms.map((t) => ({ ...t, aliases: [...(t.aliases || [])] }));
      for (const [ex, o] of st.over) { const n = C.norm(ex); if (o.col === '__novo__') terms.push({ id: 'tmp' + n, type: 'col', name: o.novo, aliases: [n] }); else { const t = terms.find((x) => x.type === 'col' && x.name === o.col); if (t) t.aliases.push(n); } }
      return C.buildIndex(terms);
    };
    let acts = [];
    // ligar: linhas ligadas à mão (ou marcadas como cirurgia nova); separar: atos que ela separou, uma cirurgia por linha
    const replan = () => { acts = C.planRepasse(rep, S.records, tempIndex(), { hosp: st.hosp || null, ligar: st.ligar, separar: st.separar, mesmo: st.mesmo }); };
    replan();
    const colName = (a) => { const o = st.over.get(a.exec); return o ? (o.col === '__novo__' ? o.novo : o.col) : ''; };
    const api = openSheet({ title: 'Planilha de repasse', render(api) {
      if (st.step === 'repetido') {
        const old = S.repasses.find((x) => x.id === rep.id);
        return { body: [h('div', { class: 'empty' }, h('span', { class: 'halo' }, icon('sheet')), h('h2', null, 'Essa planilha já foi aberta'), h('p', null, `Ela entrou no app em ${ddmmyyyy(C.todayStr(new Date(old.importedAt)))}. Se abrir de novo, o app desfaz a anterior e usa esta.`))],
          foot: [h('button', { class: 'btn', type: 'button', onclick: () => api.close(true) }, 'Cancelar'), h('button', { class: 'btn primary', type: 'button', onclick: async () => { await undoRepasse(old, false); replan(); st.step = 'plano'; api.update(); } }, 'Abrir de novo')] };
      }
      if (st.step === 'pronto') {
        return { body: [h('div', { class: 'empty' }, h('span', { class: 'halo' }, icon('check')), h('h2', null, 'Pronto!'), h('p', null, `${brl(rep.total)} registrados.`),
          h('p', null, cap(frase([st.res.matched ? plural(st.res.matched, 'cirurgia do WhatsApp ficou paga', 'cirurgias do WhatsApp ficaram pagas') : null,
            st.res.complementos ? plural(st.res.complementos, 'complemento somado a uma cirurgia já paga', 'complementos somados a cirurgias já pagas') : null,
            st.res.mesmos ? plural(st.res.mesmos, 'pagamento que você tinha registrado agora consta da planilha', 'pagamentos que você tinha registrado agora constam da planilha') : null,
            st.res.created ? `${plural(st.res.created, 'cirurgia nova', 'cirurgias novas')}, que não estavam no WhatsApp` : null])) + '.'),
          st.res.dif ? h('p', { class: 'note' }, st.res.dif) : null),
          !PREVIEW ? tip('Faça um backup agora', ' Assim os pagamentos desta planilha ficam guardados fora do iPhone.', 'Fazer backup', () => { api.close(true); exportBackup(); }, 'share') : null],
          foot: h('button', { class: 'btn primary', type: 'button', onclick: () => { api.close(true); go('lista', { status: 'recebido' }); } }, 'Ver cirurgias pagas') };
      }
      // Revisão antes de gravar (item 25): o que casou com segurança, o que precisa conferir (outra candidata, complemento,
      // data ou valor diferente, certeza baixa) e o que entra como cirurgia nova, com ligar à mão e separar.
      const assoc = acts.filter((a) => a.recordId);
      const novas = acts.filter((a) => !a.recordId);
      const conferir = assoc.filter((a) => a.certeza !== 'manual' && (a.certeza === 'confira' || a.certeza === 'complemento' || a.outras.length || a.difData || a.difValor != null));
      const seguras = assoc.filter((a) => !conferir.includes(a));
      const doubtful = execs.filter((ex) => { const o = st.over.get(ex); return o.how === 'parecido' || o.how === 'primeiro-nome' || o.how === 'novo' || o.forced; });
      const payIn = h('input', { type: 'date', value: st.pay, 'aria-label': 'Dia em que o dinheiro caiu', oninput: (e) => { st.pay = e.target.value; } });
      const difTxt = () => { const d = st.caiu != null ? C.round2(rep.total - st.caiu) : null;
        return d == null ? 'Opcional. Com ele, o "Recebido no mês" bate com o extrato do banco.' : Math.abs(d) < 0.005 ? 'Igual ao liberado na planilha.' : d > 0 ? `${brl(d)} a menos que o liberado: retenções e taxas.` : `${brl(-d)} a mais que o liberado.`; };
      const difEl = h('small', { id: 'rep-caiu-dif' }, difTxt());
      const caiuIn = h('input', { id: 'rep-caiu', type: 'text', inputmode: 'decimal', placeholder: moneyInput(rep.total), value: moneyInput(st.caiu), 'aria-label': 'Quanto caiu na conta', oninput: (e) => { st.caiu = parseMoney(e.target.value); difEl.textContent = difTxt(); } });
      const smallLink = (label, fn) => h('button', { class: 'link', type: 'button', style: 'padding:2px 0;font-size:.875rem', onclick: fn }, label);
      const mexer = (fn) => () => { fn(); replan(); api.update(); };
      const porPerto = (a) => S.records.filter((r) => Math.abs(C.dayNum(r.date) - C.dayNum(a.date)) <= 1).sort((x, y) => Math.abs(C.dayNum(x.date) - C.dayNum(a.date)) - Math.abs(C.dayNum(y.date) - C.dayNum(a.date)));
      const escolher = (a) => sheetPick('Qual é a cirurgia desta linha?', porPerto(a), async (r) => { st.ligar.set(a.key, r.id); replan(); api.update(); });
      const baseKey = (a) => a.key.replace(/#\d+$/, '');
      const actLine = (a) => {
        const r = a.recordId ? S.records.find((x) => x.id === a.recordId) : null;
        const avisos = [];
        if (a.complemento) { const f = fin(r);
          avisos.push(a.mesmo ? `Você já tinha registrado este pagamento${f.semValorAnotado ? '' : ` (${brl(f.recebido)})`}. A planilha passa a ser o registro dele, sem somar.`
            : `Esta cirurgia já foi paga (${brl(f.recebido)}). O valor desta linha soma a ela, como complemento.`); }
        if (a.outras.length) avisos.push(a.outras.length === 1 ? 'Há outra cirurgia parecida perto dessa data.' : `Há outras ${a.outras.length} cirurgias parecidas perto dessa data.`);
        if (a.certeza === 'confira') avisos.push('Confira se é a mesma cirurgia.');
        if (a.difData) avisos.push(`No app está em ${ddmmyyyy(a.difData)}; vale a data da planilha.`);
        if (a.difValor != null) avisos.push(`O valor combinado era ${brl(a.difValor)}; a planilha paga ${brl(a.valor)}.`);
        if (a.separadoSozinho) avisos.push('Sem hora na planilha: o app separou porque há uma cirurgia para cada linha.');
        const links = [];
        if (r) {
          if (a.podeSerMesmo) links.push(smallLink(a.mesmo ? 'É um complemento' : 'É o mesmo pagamento', mexer(() => st.mesmo.set(a.key, !a.mesmo))));
          links.push(smallLink(a.complemento ? 'É outra cirurgia' : 'Não é esta', mexer(() => st.ligar.set(a.key, null))));
          if (porPerto(a).length > 1) links.push(smallLink('Trocar', () => escolher(a)));
        } else {
          if (porPerto(a).length) links.push(smallLink('Ligar a uma cirurgia', () => escolher(a)));
          if (a.manual) links.push(smallLink('Desfazer', mexer(() => st.ligar.delete(a.key))));
        }
        if (a.lines.length > 1 && !a.time) links.push(smallLink(`Separar em ${a.lines.length}`, mexer(() => { st.separar.add(a.key); st.ligar.delete(a.key); })));
        if (a.separado && st.separar.has(baseKey(a))) links.push(smallLink('Juntar de novo', mexer(() => st.separar.delete(baseKey(a)))));
        return h('div', { class: 'ritem rv', 'data-ato': a.key }, dateBadge(a),
          h('span', { class: 'rmain' }, h('span', { class: 'p' }, a.procNames.join(' + ')),
            h('span', { class: 'm' }, r ? `No app: ${dataLonga(r.date, { semDia: true })}${r.time ? ', ' + horaTxt(r.time) : ''}, ${ondeCom(r) || procText(r)}` : [st.hosp, colName(a) ? 'com ' + colName(a) : ''].filter(Boolean).join(', ')),
            avisos.length ? h('span', { class: 'm warn-txt' }, avisos.join(' ')) : null,
            h('span', { class: 'row', style: 'gap:14px;flex-wrap:wrap' }, r && !avisos.length ? h('span', { class: 'st ok' }, a.certeza === 'manual' ? 'ligada por você' : 'mesmo dia e colega') : null, ...links)),
          h('span', { class: 'rside' }, h('span', { class: 'val' }, brl0(a.valor))));
      };
      const sec = (titulo, nota, lista, id) => h('section', { class: 'sec', id }, h('div', { class: 'sec-h' }, h('h2', { style: 'font-size:1.1875rem' }, titulo)), nota ? h('p', { class: 'note' }, nota) : null, lista.length ? h('div', { class: 'group' }, lista.map(actLine)) : null);
      const body = [
        h('div', null, h('h1', { class: 'bigtitle' }, brl(rep.total)), h('p', { class: 'muted', style: 'margin-top:6px' }, [plural(rep.lines.length, 'linha', 'linhas') + ' na planilha', rep.numero ? 'repasse nº ' + rep.numero : null, compName(rep.comp) || null].filter(Boolean).join(', '))),
        h('div', { class: 'group' },
          h('div', { class: 'qrow' }, h('div', { class: 'q' }, 'Quando esse dinheiro caiu na sua conta?', h('small', null, 'Nas planilhas antigas, escolha o dia certo.')),
            seg([['hoje', 'Hoje'], ['outro', 'Outro dia']], st.quando, (v) => { st.quando = v; if (v === 'hoje') st.pay = today(); api.update(); }, 'Quando'), st.quando === 'outro' ? payIn : null),
          h('div', { class: 'qrow' }, h('div', { class: 'q' }, 'Quanto caiu na conta?', difEl), caiuIn),
          h('div', { class: 'qrow' }, h('div', { class: 'q' }, 'De qual hospital é a planilha?'),
            h('div', { class: 'qchips' }, [...hosps.slice(0, 5), ''].map((x) => h('button', { class: 'qchip', type: 'button', 'aria-pressed': String(st.hosp === x), onclick: () => { st.hosp = x; replan(); api.update(); } }, x || 'Não sei'))))),
        doubtful.length ? h('section', { class: 'sec' }, h('div', { class: 'sec-h' }, h('h2', { style: 'font-size:1.1875rem' }, 'Confirme os nomes')), h('div', { class: 'group' }, doubtful.map((ex) => { const o = st.over.get(ex);
          const pickSel = h('select', { 'aria-label': 'Quem é ' + ex, onchange: (e) => { st.over.set(ex, e.target.value === '__novo__' ? { col: '__novo__', how: 'novo', novo: firstName(ex, colNames), forced: true } : { col: e.target.value, how: 'escolhido', forced: true }); replan(); api.update(); } },
            colNames.map((c) => h('option', { value: c, selected: o.col === c }, c)), h('option', { value: '__novo__', selected: o.col === '__novo__' }, 'Colega novo: ' + firstName(ex, colNames)));
          const pergunta = o.how === 'parecido' || o.how === 'primeiro-nome';
          const sub = pergunta ? (o.how === 'primeiro-nome' ? `É a mesma pessoa que ${o.col}?` : `É ${o.col}?`)
            : o.col === '__novo__' ? (o.suspeita && !o.forced ? `Tem o mesmo primeiro nome de ${o.suspeita}, mas parece outra pessoa. Vai entrar como colega novo; se for ${o.suspeita}, escolha abaixo.` : 'Vai entrar como colega novo.') : `Ligado a ${o.col}.`;
          return h('div', { class: 'qrow' }, h('div', { class: 'q' }, ex, h('small', null, sub)),
            pergunta ? seg([['sim', 'Sim'], ['nao', 'Não, é outra pessoa']], 'sim', (v) => { if (v === 'nao') { st.over.set(ex, { col: '__novo__', how: 'novo', novo: firstName(ex, colNames), forced: true }); replan(); api.update(); } }, 'É a mesma pessoa?') : pickSel); }))) : null,
        conferir.length ? sec('Confira', `O app não tem certeza ${conferir.length === 1 ? 'desta linha' : `destas ${conferir.length} linhas`}. Se estiver certo, não precisa fazer nada.`, conferir, 'rep-conferir') : null,
        sec('Já estavam no app', seguras.length ? `Vão ficar como pagas (${seguras.length}).` : conferir.length ? null : 'Nenhuma cirurgia a receber do WhatsApp aparece nesta planilha.', seguras, 'rep-seguras'),
        novas.length ? sec('Não estavam no app', `Entram como cirurgias novas, já pagas (${novas.length}). Por exemplo, as que colocaram seu nome sem avisar.${novas.some((a) => porPerto(a).length) ? ' Se uma delas já estiver no app, toque em Ligar.' : ''}`, novas, 'rep-novas') : null];
      return { body, foot: h('button', { class: 'btn primary', type: 'button', onclick: () => apply(api) }, 'Confirmar') };
    } });
    async function apply(api) {
      if (st.quando === 'hoje') st.pay = today();
      const termsAdd = [], termsUpd = [];
      for (const [ex, o] of st.over) {
        const n = C.norm(ex);
        if (o.col === '__novo__') { if (!termsAdd.some((t) => t.name === o.novo)) termsAdd.push({ id: C.uid('t'), type: 'col', name: o.novo, aliases: [n] }); }
        else { const t = S.terms.find((x) => x.type === 'col' && x.name === o.col); if (t && !t.aliases.includes(n)) { t.aliases.push(n); termsUpd.push(t); } }
      }
      for (const l of rep.lines) {
        if (!C.mapRepasseProc(l.proc, S.index) && !termsAdd.some((t) => t.type === 'proc' && t.aliases[0] === C.norm(l.proc))) {
          const n = C.norm(l.proc); const key = n.split(' ').find((w) => w.length > 3) || n.split(' ')[0];
          termsAdd.push({ id: C.uid('t'), type: 'proc', name: C.sentenceCase(l.proc), fam: key, aliases: [n], kw: [[key]] });
        }
        if (l.conv && !S.terms.some((t) => t.type === 'conv' && C.norm(t.name) === C.norm(l.conv)) && !termsAdd.some((t) => t.type === 'conv' && C.norm(t.name) === C.norm(l.conv))) termsAdd.push({ id: C.uid('t'), type: 'conv', name: l.conv, aliases: [C.norm(l.conv)] });
      }
      S.terms.push(...termsAdd); await Store.putMany('terms', [...termsAdd, ...termsUpd]); derive();
      const changed = []; let matched = 0, complementos = 0, mesmos = 0, created = 0;
      for (const a of acts) {
        const lines = a.lines.map((l) => { const t = C.mapRepasseProc(l.proc, S.index); const procName = t ? t.name : C.sentenceCase(l.proc); return { date: l.date, time: l.time, valor: l.valor, conv: l.conv, cod: l.cod, proc: l.proc, procName, fam: C.famOf(S.index, procName), funcao: l.funcao, exec: l.exec, repId: rep.id }; });
        const col = colName(a) || null;
        const pag = { id: C.uid('g'), valor: a.valor, data: st.pay || today(), origem: 'repasse', repId: rep.id };
        const r = a.recordId ? S.records.find((x) => x.id === a.recordId) : null;
        if (r) {
          const complemento = !isOpen(r);   // já paga: o valor soma a ela (complemento) ou é o mesmo pagamento, sem mexer no resto
          if (!complemento) {
            if (!r.conv) r.conv = lines[0].conv; if (!r.funcao) r.funcao = lines[0].funcao;
            // a planilha é o registro do ato: valem a data e a hora dela (a de antes fica guardada para desfazer)
            const saem = (r.revisar || []).filter((f) => f === 'Confira a data' || (a.time && f === 'Confira a hora'));
            if (r.date !== a.date || (a.time && r.time !== a.time) || saem.length) { if (!r.antesDaPlanilha) r.antesDaPlanilha = { date: r.date, time: r.time, avisos: saem }; r.horaDaPlanilha = true; }
            r.date = a.date; if (a.time) r.time = a.time;
            r.revisar = (r.revisar || []).filter((f) => !saem.includes(f));
            if (!(r.cols || []).length && col) r.cols = [col]; if (!r.procs.length) r.procs = uniq(lines.map((l) => l.procName));
            if (!r.hosp && st.hosp) r.hosp = st.hosp;
            r.revisar = (r.revisar || []).filter((f) => f !== 'Sem procedimento');
          }
          const mesmo = complemento && a.mesmo;
          C.pagarPeloRepasse(r, a, lines, pag, { substituir: mesmo }); r.updatedAt = Date.now();
          changed.push(r); if (mesmo) mesmos++; else if (complemento) complementos++; else matched++;
        } else {
          S.settings.seq += 1;
          const nr = newRecord({ num: S.settings.seq, origem: 'repasse', repCriador: rep.id, date: a.date, time: a.time, procs: uniq(lines.map((l) => l.procName)), hosp: st.hosp || null, cols: col ? [col] : [], conv: lines[0].conv, funcao: lines[0].funcao });
          C.pagarPeloRepasse(nr, a, lines, pag);
          S.records.push(nr); changed.push(nr); created++;
        }
      }
      await Store.putMany('records', changed);
      const doc = { id: rep.id, numero: rep.numero, comp: rep.comp, nome: rep.nome, total: rep.total, n: rep.lines.length, hosp: st.hosp || null, pay: st.pay || today(), importedAt: Date.now(), caiu: st.caiu != null ? st.caiu : null };
      S.repasses.push(doc); await Store.put('repasses', doc);
      S.settings.hospRepasse = st.hosp || S.settings.hospRepasse; await saveSettings(); persistStorage();
      derive(); render();
      const dif = doc.caiu != null ? C.round2(doc.total - doc.caiu) : 0;
      st.res = { matched, complementos, mesmos, created, dif: Math.abs(dif) >= 0.005 ? `Caíram ${brl(doc.caiu)} na conta, ${dif > 0 ? brl(dif) + ' a menos' : brl(-dif) + ' a mais'} que o liberado.` : null };
      st.step = 'pronto'; api.update();
    }
  }

  // ---- backup ----
  // O backup sai em partes de até 40 MB, montadas uma de cada vez: nunca carrega todas as fotos juntas.
  // A parte 1 leva os dados (dados.json); toda parte leva um backup.json dizendo de qual backup ela é.
  // Com uma parte só, o arquivo tem o mesmo formato das versões antigas.
  const PARTE_BYTES = 40 * 1048576;
  const typeExt = (t) => ({ 'image/png': 'png', 'image/heic': 'heic', 'image/webp': 'webp', 'image/gif': 'gif' }[t] || 'jpg');
  const mb = (b) => (b < 52429 ? 'menos de 0,1 MB' : `${(b / 1048576).toFixed(1).replace('.', ',')} MB`);
  const fotosUsadas = (records, loose) => new Set([...(records || []).flatMap((r) => r.photoIds || []), ...(loose || []).map((l) => l.photoId)].filter(Boolean));
  async function planejarBackup() {
    const usadas = fotosUsadas(S.records, S.loose);
    const fotos = [];
    for (const id of await Store.keys('photos')) {   // uma foto por vez, só para saber o tamanho
      if (!usadas.has(id)) continue;
      const p = await Store.get('photos', id); if (!p) continue;
      const t = await Store.get('thumbs', id);
      const mini = t && t.buf ? t.buf.byteLength : p.tbuf ? p.tbuf.byteLength : 0;
      fotos.push({ id, bytes: (p.buf ? p.buf.byteLength : 0) + mini });
    }
    const limite = S.parteBytes || PARTE_BYTES;
    const partes = [[]]; let soma = 0;
    for (const f of fotos) {
      if (soma + f.bytes > limite && partes[partes.length - 1].length) { partes.push([]); soma = 0; }
      partes[partes.length - 1].push(f.id); soma += f.bytes;
    }
    return { id: C.uid('b'), em: new Date().toISOString(), dia: today(), partes, total: fotos.reduce((s, f) => s + f.bytes, 0), nFotos: fotos.length };
  }
  // ignored segue como lista de chaves, que as versões antigas sabem ler; ignoradas leva também o motivo de cada uma.
  // A lixeira não vai no backup: o backup guarda o que está em uso.
  function dadosBackup(plano) {
    return { app: 'registro-cirurgias', versao: 2, exportadoEm: plano.em, backupId: plano.id, partes: plano.partes.length, fotos: plano.nFotos,
      records: S.records, terms: S.terms, repasses: S.repasses, loose: S.loose, ignored: [...S.ignored], ignoradas: [...S.ignoredInfo.values()], imports: S.imports,
      settings: { ...S.settings, lastBackup: plano.dia, pinHash: null, pinSalt: null } };
  }
  async function montarParte(plano, i) {
    const P = plano.partes.length;
    const files = [{ name: 'backup.json', data: JSON.stringify({ app: 'registro-cirurgias', versao: 2, backupId: plano.id, parte: i + 1, partes: P, exportadoEm: plano.em, fotos: plano.partes[i] }) }];
    if (i === 0) files.push({ name: 'dados.json', data: JSON.stringify(dadosBackup(plano)) });
    for (const id of plano.partes[i]) {
      const p = await Store.get('photos', id); if (!p) continue;
      files.push({ name: `fotos/${p.id}.${typeExt(p.type)}`, data: new Uint8Array(p.buf) });
      const t = await Store.get('thumbs', id); const mini = t && t.buf ? t.buf : p.tbuf;
      if (mini) files.push({ name: `fotos/${p.id}.t.jpg`, data: new Uint8Array(mini) });
    }
    return C.zipWrite(files);
  }
  async function exportBackup() {
    if (PREVIEW) { await confirmDialog({ title: 'Backup só no app instalado', text: 'Nesta prévia nada fica salvo. Depois de instalar, este botão gera um arquivo com tudo para você guardar em Arquivos.', ok: 'Entendi', cancel: false }); return; }
    const b = busy('Preparando o backup…');
    let plano;
    try { plano = await planejarBackup(); }
    catch (e) { b.done(); anotaErro(e && e.message, 'backup'); await confirmDialog({ title: 'Não deu para preparar o backup', text: (e && e.message) || String(e), ok: 'Entendi', cancel: false }); return; }
    b.done();
    sheetBackup(plano);
  }
  function sheetBackup(plano) {
    const P = plano.partes.length;
    const st = { i: 0, blob: null, salvas: 0, preparando: false, erro: null };
    const nome = (k) => (P === 1 ? `cirurgias-backup-${plano.dia}.zip` : `cirurgias-backup-${plano.dia}-parte-${k}-de-${P}.zip`);
    let api = null;
    async function preparar() {   // monta só a parte da vez; a anterior já foi salva e sai da memória
      st.preparando = true; st.erro = null; if (api) api.update();
      try { st.blob = await montarParte(plano, st.i); } catch (e) { st.erro = (e && e.message) || String(e); anotaErro(st.erro, 'backup'); }
      st.preparando = false; if (api) api.update();
    }
    api = openSheet({ title: 'Backup',
      beforeClose: async () => st.salvas === 0 || st.salvas === P || confirmDialog({ title: 'Parar o backup?', text: `${P - st.salvas === 1 ? 'Falta 1 parte' : `Faltam ${P - st.salvas} partes`}. O backup só vale com todas.`, ok: 'Parar', danger: true }),
      render() {
        const fim = st.salvas === P;
        const linhas = plano.partes.map((ids, i) => {
          const [tom, txt] = i < st.salvas ? ['ok', 'Salva'] : i === st.i ? (st.preparando ? ['plain', 'Preparando…'] : st.erro ? ['danger', 'Deu erro'] : ['accent', 'Pronta']) : ['plain', 'Na fila'];
          return h('div', { class: 'rowbtn' }, h('span', { class: 'bubble ' + (i < st.salvas ? 'ok' : 'plain') }, icon(i < st.salvas ? 'check' : 'folder')),
            h('span', { class: 't' }, P === 1 ? 'Arquivo do backup' : `Parte ${i + 1} de ${P}`, h('small', null, plural(ids.length, 'foto', 'fotos') + (i === 0 ? ' e os dados' : ''))),
            h('span', { class: 'st ' + tom }, txt));
        });
        const texto = fim ? (P === 1 ? 'Guarde o arquivo no iCloud Drive para ter uma cópia fora do iPhone.' : `As ${P} partes foram salvas. Para restaurar, escolha as ${P} juntas.`)
          : `${plural(S.records.length, 'cirurgia', 'cirurgias')} e ${plural(plano.nFotos, 'foto', 'fotos')}, ${mb(plano.total)}. ` +
            (P === 1 ? 'Salve em Arquivos, de preferência no iCloud Drive.' : `Vai em ${P} partes: salve todas na mesma pasta, de preferência no iCloud Drive.`);
        const body = [h('div', { class: 'empty' }, h('span', { class: 'halo' }, icon(fim ? 'check' : 'folder')), h('h2', null, fim ? 'Backup completo' : 'Backup pronto para salvar'), h('p', null, texto)),
          h('div', { class: 'group' }, linhas)];
        if (st.erro) body.push(tip('Não deu para preparar esta parte', ' ' + st.erro, 'Tentar de novo', () => preparar(), 'alert', 'warn'));
        const foot = fim ? h('button', { class: 'btn primary', type: 'button', onclick: () => api.close(true) }, 'Concluir')
          : h('button', { class: 'btn primary', type: 'button', 'data-act': 'salvar-parte', disabled: !st.blob || st.preparando, onclick: () => {
            compartilhar(st.blob, nome(st.i + 1), 'application/zip').then(async (ok) => {
              if (!ok) return;
              st.salvas++; st.blob = null; st.i++;
              if (st.i < P) { preparar(); return; }
              S.settings.lastBackup = plano.dia; await saveSettings(); render();
              if (P === 1) { api.close(true); toast('Backup salvo. Confira se ficou em Arquivos.'); }   // uma parte só: igual a antes
              else { api.update(); toast(`Backup completo: ${P} partes salvas.`); }
            });
          } }, icon('share'), P === 1 ? 'Salvar em Arquivos' : `Salvar a parte ${Math.min(st.i + 1, P)} de ${P}`);
        return { body, foot };
      } });
    preparar();
  }

  // ---- restaurar ----
  // Primeiro confere tudo sem mexer em nada: as partes, as fotos, se algum arquivo está danificado e o espaço livre.
  // Depois guarda as fotos que faltam e troca os dados de uma vez só: se algo falhar no caminho, nada muda.
  function pickBackup() {
    const inp = $('#file-in'); inp.value = ''; inp.multiple = true;
    inp.onchange = async () => {
      const fs = [...(inp.files || [])]; inp.multiple = false; if (!fs.length) return;
      try { await flowRestore(fs); } catch (e) { anotaErro(e && e.message, 'restaurar'); await confirmDialog({ title: 'Não deu para restaurar', text: (e && e.message) || String(e), ok: 'Entendi', cancel: false }); }
    };
    inp.click();
  }
  async function flowRestore(files) {
    files = [].concat(files);
    const b = busy('Conferindo o backup…');
    let pk;
    try { pk = await lerBackup(files, (i, n) => b.set(i / n, `Conferindo as fotos: ${i} de ${n}`)); } finally { b.done(); }
    const d = pk.data;
    const ok = await confirmDialog({ title: 'Restaurar o backup?', text: `Backup de ${d.exportadoEm ? ddmmyyyy(d.exportadoEm.slice(0, 10)) : 'data desconhecida'}, com ${plural((d.records || []).length, 'cirurgia', 'cirurgias')} e ${plural(pk.usadas.size, 'foto', 'fotos')}${pk.P > 1 ? `, em ${pk.P} partes` : ''}. O app já conferiu tudo. O que está neste iPhone agora será trocado por ele.`, ok: 'Restaurar', danger: true });
    if (!ok) return;
    await restaurar(pk);
  }
  async function lerJson(z, nome) {
    const e = z.entries.find((x) => x.name === nome); if (!e) return null;
    try { return JSON.parse(await (await C.zipEntryChecked(z, e)).text()); } catch (x) { throw new Error('O arquivo de dados do backup está danificado.'); }
  }
  async function lerBackup(files, progresso) {
    const arq = [];
    for (const f of files) {
      let z = null; try { z = await C.zipOpen(f); } catch (e) { z = null; }
      if (!z) {   // backup bem antigo, em .json e sem fotos
        if (files.length === 1 && /^\s*\{/.test(await f.slice(0, 200).text())) {
          let data; try { data = JSON.parse(await f.text()); } catch (e) { throw new Error('Não consegui ler esse backup.'); }
          if (!data || data.app !== 'registro-cirurgias') throw new Error('Esse arquivo não é um backup do app.');
          return { data, fotos: new Map(), usadas: new Set(), P: 1, bytes: 0 };
        }
        throw new Error(`O arquivo ${f.name} não é um backup do app.`);
      }
      arq.push({ z, info: await lerJson(z, 'backup.json'), temDados: z.entries.some((e) => e.name === 'dados.json') });
    }
    const principais = arq.filter((x) => x.temDados);
    if (!principais.length) throw new Error(arq.length > 1 ? 'Falta a parte 1 do backup, a que tem os dados.' : 'Este arquivo é só uma parte do backup. Toque em Restaurar e escolha todas as partes juntas.');
    if (principais.length > 1) throw new Error('Esses arquivos são de backups diferentes. Escolha as partes de um backup só.');
    const data = await lerJson(principais[0].z, 'dados.json');
    if (!data || data.app !== 'registro-cirurgias') throw new Error('Esse arquivo não é um backup do app.');
    const P = data.partes || 1;
    const partes = data.backupId ? arq.filter((x) => x.info && x.info.backupId === data.backupId) : [principais[0]];
    if (partes.length !== arq.length) throw new Error('Há arquivos de outro backup na escolha. Escolha só as partes de um backup.');
    const tem = new Set(partes.map((x) => (x.info ? x.info.parte : 1)));
    const faltam = []; for (let k = 1; k <= P; k++) if (!tem.has(k)) faltam.push(k);
    if (faltam.length) throw new Error(`${faltam.length === 1 ? 'Falta a parte' : 'Faltam as partes'} ${faltam.join(', ')} de ${P}. Toque em Restaurar e escolha todas as partes juntas.`);
    const fotos = new Map();
    for (const x of partes) for (const e of x.z.entries) {
      const m = e.name.match(/^fotos\/([^/]+?)(\.t)?\.[a-z0-9]+$/i); if (!m) continue;
      const o = fotos.get(m[1]) || { z: x.z }; if (m[2]) o.te = e; else o.e = e; fotos.set(m[1], o);
    }
    const usadas = fotosUsadas(data.records, data.loose);
    const sumidas = [...usadas].filter((id) => !(fotos.get(id) || {}).e);
    if (sumidas.length) throw new Error(`O backup está incompleto: ${plural(sumidas.length, 'foto não está', 'fotos não estão')} nos arquivos escolhidos.`);
    // confere cada foto agora, uma por vez, para avisar antes de pedir a confirmação
    let i = 0;
    for (const id of usadas) { const o = fotos.get(id); await C.zipEntryChecked(o.z, o.e); if (o.te) await C.zipEntryChecked(o.z, o.te); if (progresso) progresso(++i, usadas.size); }
    const bytes = [...usadas].reduce((s, id) => { const o = fotos.get(id); return s + o.e.usize + (o.te ? o.te.usize : 0); }, 0);
    let est = null; try { if (navigator.storage && navigator.storage.estimate) est = await navigator.storage.estimate(); } catch (e) { est = null; }
    if (est && est.quota && est.usage != null && est.quota - est.usage < bytes * 1.2) throw new Error(`Falta espaço no iPhone para restaurar: o backup tem ${mb(bytes)} de fotos.`);
    return { data, fotos, usadas, P, bytes };
  }
  async function restaurar(pk) {
    const d = pk.data;
    const b = busy('Restaurando…');
    const novas = [];
    try {
      const antes = new Set(await Store.keys('photos'));
      const lista = [...pk.usadas]; let i = 0;
      for (const id of lista) {
        if (!antes.has(id)) {   // a mesma foto que já está no iPhone não é gravada de novo
          const o = pk.fotos.get(id);
          const buf = await (await C.zipEntryChecked(o.z, o.e)).arrayBuffer();
          const tbuf = o.te ? await (await C.zipEntryChecked(o.z, o.te)).arrayBuffer() : null;
          await Store.apply([{ s: 'photos', put: { id, name: o.e.base, type: extType(o.e.base), buf } }, tbuf ? { s: 'thumbs', put: { id, buf: tbuf } } : null]);
          novas.push(id);
        }
        b.set(++i / Math.max(1, lista.length), `Conferindo e guardando as fotos: ${i} de ${lista.length}`);
      }
      b.set(1, 'Trocando os dados…');
      const keepPin = { pinHash: S.settings.pinHash, pinSalt: S.settings.pinSalt };
      const ignoradas = Array.isArray(d.ignoradas) ? d.ignoradas.filter((g) => g && g.key) : (d.ignored || []).map((key) => ({ key }));
      // a lixeira fica vazia: o que estava nela não está no backup
      await Store.replaceAll({ records: d.records || [], terms: d.terms || [], repasses: d.repasses || [], loose: d.loose || [],
        ignored: ignoradas, imports: Array.isArray(d.imports) ? d.imports : [], trash: [], meta: [{ ...DEFAULT_SETTINGS, ...(d.settings || {}), ...keepPin, k: 'settings' }] });
    } catch (e) {
      for (const id of novas) { try { await deletePhotos([id]); } catch (x) { /* fica para a próxima limpeza */ } }
      b.done(); anotaErro(e && e.message, 'restaurar');
      throw new Error('Nada foi mudado neste iPhone. ' + ((e && e.message) || ''));
    }
    try { for (const id of await Store.keys('photos')) if (!pk.usadas.has(id)) await deletePhotos([id]); } catch (e) { anotaErro(e && e.message, 'limpar fotos'); }
    urlCache.forEach((u) => URL.revokeObjectURL(u)); urlCache.clear();
    S.demo = false; await load(); persistStorage();
    b.done();
    for (const s of sheets.slice()) s.close(true);
    go('inicio'); toast('Backup restaurado.');
  }
  function csvCell(v) { const s = v == null ? '' : String(v); return /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
  async function exportCSV() {
    if (PREVIEW) { await confirmDialog({ title: 'Disponível no app instalado', text: 'Nesta prévia o navegador não deixa salvar arquivos.', ok: 'Entendi', cancel: false }); return; }
    const head = ['Nº', 'Data', 'Hora', 'Urgência', 'Procedimentos', 'Hospital', 'Colegas', 'Função', 'Convênio', 'Situação', 'Valor recebido', 'Data do pagamento', 'Valor a receber (aprox.)', 'Origem', 'Repasse', 'Fotos', 'Legenda'];
    const money = (v) => (v == null ? '' : nf2.format(v).replace(/\./g, ''));
    const rows = [...S.records].sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || ''))).map((r) => {
      // as mesmas colunas de antes: valor recebido é a soma dos pagamentos (também da cirurgia paga em parte), e a data é
      // a do último pagamento
      const v = valueOf(r); const f = fin(r); const ult = f.pg[f.pg.length - 1] || {};
      const reps = uniq(f.pg.filter((p) => p.origem === 'repasse').map((p) => (S.repasses.find((x) => x.id === p.repId) || {}).numero).filter(Boolean)).join(', ');
      return [r.num || '', ddmmyyyy(r.date), r.time || '', urgOf(r) ? 'sim' : '', procText(r), r.hosp || '', (r.cols || []).join(', '), r.funcao || '', r.conv || '', { aberto: 'A receber', parcial: 'Parcial', recebido: 'Recebida', semcobranca: 'Sem cobrança' }[f.s],
        f.pg.length && !f.semValorAnotado ? money(f.recebido) : '', ult.data ? ddmmyyyy(ult.data) : '', isOpen(r) ? money(v.v) : '', r.origem, reps, (r.photoIds || []).length, (r.caption || '').replace(/\s+/g, ' ')];
    });
    const text = '﻿' + [head, ...rows].map((r) => r.map(csvCell).join(';')).join('\r\n');
    await offerFile(new Blob([text], { type: 'text/csv;charset=utf-8' }), `cirurgias-${today()}.csv`, 'text/csv', 'Planilha pronta', `${plural(rows.length, 'cirurgia', 'cirurgias')}. Abre no Excel, no Numbers e no Google Planilhas.`);
  }
  // abre a folha do iPhone para salvar em Arquivos; no computador, baixa o arquivo. Tem de ser chamada direto no toque.
  async function compartilhar(blob, name, type) {
    let f = new File([blob], name, { type });
    try {
      if (navigator.canShare && !navigator.canShare({ files: [f] })) { const alt = new File([blob], name, { type: 'application/octet-stream' }); if (navigator.canShare({ files: [alt] })) f = alt; }
      if (navigator.canShare && navigator.canShare({ files: [f] })) await navigator.share({ files: [f], title: name });
      else { const u = URL.createObjectURL(blob); const a = h('a', { href: u, download: name }); document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(u); a.remove(); }, 4000); }
      return true;
    } catch (e) { if (e && e.name !== 'AbortError') { toast('Não deu para salvar: ' + e.message); anotaErro(e.message, 'salvar arquivo'); } return false; }
  }
  function offerFile(blob, name, type, title, text) {
    return new Promise((res) => {
      let done = false;
      const api = openSheet({ title, onClose: () => { if (!done) res(false); }, render() {
        return { body: [h('div', { class: 'empty' }, h('span', { class: 'halo' }, icon('folder')), h('h2', null, title), h('p', null, text))],
          foot: h('button', { class: 'btn primary', type: 'button', onclick: () => {
            compartilhar(blob, name, type).then((ok) => { if (ok) { done = true; res(true); api.close(true); toast('Arquivo pronto. Confira se salvou em Arquivos.'); } });
          } }, icon('share'), 'Salvar em Arquivos') };
      } });
    });
  }

  // ================= diagnóstico =================
  // Texto para mandar quando algo der errado: versão, contagens e erros recentes. Nenhuma cirurgia, nome, valor ou foto.
  async function textoDiagnostico() {
    const n = (f) => S.records.filter(f).length;
    const onde = PREVIEW ? 'prévia do Claude' : TESTE ? 'modo de teste (banco separado)' : isStandalone() ? 'app instalado na Tela de Início' : 'navegador';
    let espaco = 'espaço não informado';
    try { if (navigator.storage && navigator.storage.estimate) { const e = await navigator.storage.estimate(); if (e.usage != null) espaco = `${mb(e.usage)} usados${e.quota ? ` de ${mb(e.quota)}` : ''}`; } } catch (e) { /* sem estimativa */ }
    let sw = 'desligado';
    try { if (navigator.serviceWorker && navigator.serviceWorker.controller) sw = 'ligado'; if (window.caches) { const ks = await caches.keys(); if (ks.length) sw += ` (${ks.join(', ')})`; } } catch (e) { /* sem cache */ }
    let nFotos = '?', nMinis = '?'; try { nFotos = (await Store.keys('photos')).length; nMinis = (await Store.keys('thumbs')).length; } catch (e) { /* sem banco */ }
    const paradas = S.imports.filter((x) => x.estado === 'andamento').length;
    let copias = ''; try { copias = (await Store.keys('meta')).map(String).filter((k) => k.startsWith('copia-migracao-')).map((k) => k.slice(15)).join(', '); } catch (e) { /* sem banco */ }
    const quando = (iso) => { const d = new Date(iso); const z = (n) => String(n).padStart(2, '0'); return `${z(d.getDate())}/${z(d.getMonth() + 1)}/${d.getFullYear()} ${z(d.getHours())}:${z(d.getMinutes())}`; };
    return [
      'Controle de Cirurgias: diagnóstico',
      `Gerado em ${quando(new Date().toISOString())}`,
      `Versão do app ${VERSION}; versão dos dados ${S.settings.dataVersion || 0} (esperada ${DATA_VERSION})${S.dadosNovos ? '; os dados são de uma versão mais nova do app' : ''}`,
      `Onde: ${onde}`,
      `Armazenamento: ${S.storage === 'idb' ? 'banco do aparelho' : 'só na memória, nada é salvo'}; ${espaco}`,
      `Cirurgias: ${S.records.length} (a receber ${n((r) => sit(r) === 'aberto')}, pagas em parte ${n((r) => sit(r) === 'parcial')}, recebidas ${n(isPaid)}, sem cobrança ${n((r) => sit(r) === 'semcobranca')}, para completar ${n(needsReview)})`,
      `Fotos guardadas: ${nFotos} (miniaturas: ${nMinis}); fotos sem legenda: ${S.loose.length}`,
      `Nomes e abreviações: ${S.terms.length}; planilhas de repasse: ${S.repasses.length}; conversas importadas: ${S.imports.length}${paradas ? ` (${paradas} sem terminar)` : ''}`,
      `Lixeira: ${S.trash.length}; mensagens ignoradas: ${S.ignored.size}`,
      `Cópias guardadas antes de migrações: ${copias || 'nenhuma'}`,
      `Último backup: ${S.settings.lastBackup ? ddmmyyyy(S.settings.lastBackup) : 'nunca'}`,
      `Senha para abrir: ${S.settings.pinHash ? 'ligada' : 'desligada'}`,
      `Uso sem internet: ${sw}`,
      `Aparelho: ${navigator.userAgent}`,
      `Tela: ${screen.width}×${screen.height}, ${window.devicePixelRatio || 1}x`,
      ERROS.length ? `Erros recentes (${Math.min(ERROS.length, 10)}):` : 'Erros recentes: nenhum',
      ...ERROS.slice(-10).map((e) => `- ${quando(e.em)} ${e.onde ? e.onde + ': ' : ''}${e.msg}`),
    ].join('\n');
  }
  function sheetDiagnostico() {
    let texto = null;
    const api = openSheet({ title: 'Diagnóstico', back: true, render() {
      const area = h('textarea', { id: 'diag-texto', class: 'diag', rows: 14, readonly: true, 'aria-label': 'Texto do diagnóstico' }); area.value = texto || 'Preparando…';
      return { body: [h('p', { class: 'lead' }, 'Mande este texto quando algo der errado. Ele não leva cirurgias, nomes, valores nem fotos: só contagens, a versão do app e os erros recentes.'), area],
        foot: h('button', { class: 'btn primary', type: 'button', disabled: !texto, onclick: () => {
          const manual = () => { const el = $('#diag-texto'); if (el) { el.focus(); el.select(); } toast('Toque e segure no texto para copiar.'); };
          try { navigator.clipboard.writeText(texto).then(() => toast('Diagnóstico copiado. É só colar na conversa.'), manual); } catch (e) { manual(); }
        } }, 'Copiar') };
    } });
    textoDiagnostico().then((t) => { texto = t; api.update(); });
  }

  // ================= instalar =================
  function sheetInstall() {
    openSheet({ title: 'Instalar no iPhone', render() {
      const body = [];
      if (PREVIEW) body.push(h('p', { class: 'lead' }, 'Esta prévia mostra cirurgias de exemplo e não guarda nada. As suas cirurgias entram no app de verdade, instalado pelo endereço do GitHub.'));
      body.push(h('section', { class: 'sec' }, h('div', { class: 'sec-h' }, h('h2', { style: 'font-size:1.1875rem' }, 'No iPhone')), h('ol', { class: 'steps' },
        h('li', null, h('span', null, 'Abra o endereço do app no ', h('b', null, 'Safari'), PREVIEW ? ': ' : '.', PREVIEW ? h('code', null, 'goborges.github.io/Carol_Controlecirurgias') : null)),
        h('li', null, h('span', null, 'Toque em ', h('b', null, 'Compartilhar'), ' e depois em ', h('b', null, 'Adicionar à Tela de Início'), '.')),
        h('li', null, h('span', null, 'Abra pelo ícone novo e só então traga a conversa do WhatsApp, pelo botão +. O que for importado no Safari não aparece no ícone.')))));
      body.push(tip('Faça backup de vez em quando', ' Se o ícone for apagado, os dados vão junto.', null, null, 'share'));
      if (!PREVIEW && !isStandalone()) body.push(h('button', { class: 'link', type: 'button', onclick: async () => { S.settings.installHidden = true; await saveSettings(); render(); toast('Aviso escondido.'); } }, 'Não mostrar mais o aviso'));
      return { body };
    } });
  }

  // ================= senha =================
  async function hashPin(pin, salt) {
    const data = new TextEncoder().encode(salt + ':' + pin);
    if (window.crypto && crypto.subtle) { const d = await crypto.subtle.digest('SHA-256', data); return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, '0')).join(''); }
    let hsh = 0; for (const x of data) hsh = (hsh * 31 + x) | 0; return 'w' + (hsh >>> 0).toString(16);
  }
  function sheetPin() {
    const st = { a: '', b: '', cur: '', fid: null };
    faceIdDisponivel().then((ok) => { st.fid = ok; if (sheets.includes(api)) api.update(); });
    const api = openSheet({ title: 'Senha para abrir', back: true, render(api) {
      const pinIn = (k, label) => field(label, h('input', { type: 'password', inputmode: 'numeric', pattern: '[0-9]*', maxlength: 6, autocomplete: 'off', value: st[k], oninput: (e) => { st[k] = e.target.value.replace(/\D/g, ''); } }));
      const body = [h('p', { class: 'lead' }, 'Com a senha ligada, o app pede os números sempre que é aberto. A proteção principal continua sendo o bloqueio do iPhone.')];
      if (S.settings.pinHash) {
        // Face ID (item 34): só no app instalado (e no modo de teste), e só liga se o próprio iPhone passar no teste
        if (st.fid || S.settings.faceId) body.push(h('section', { class: 'sec' }, h('div', { class: 'sec-h' }, h('h2', { class: 'sm' }, 'Face ID')),
          h('div', { class: 'group' }, S.settings.faceId
            ? rowBtn('check', 'ok', 'Face ID ligado', 'Para entrar, olhe para o iPhone. A senha continua valendo.', null, h('button', { class: 'btn sm', type: 'button', onclick: async () => { delete S.settings.faceId; await saveSettings(); api.update(); toast('Face ID desligado. Vale só a senha.'); } }, 'Desligar'))
            : rowBtn('lock', 'accent', 'Usar Face ID', 'O app testa no seu iPhone antes de ligar. A senha continua valendo.', async () => {
              if (await ligarFaceId()) { api.update(); toast('Face ID ligado.'); } else toast('O Face ID não funcionou neste iPhone. A senha continua valendo.', 4500);
            }))));
        body.push(h('form', { class: 'form', onsubmit: (e) => e.preventDefault() }, pinIn('cur', 'Senha atual')));
        return { body, foot: h('button', { class: 'btn danger', type: 'button', onclick: async () => {
          if ((await hashPin(st.cur, S.settings.pinSalt)) !== S.settings.pinHash) { toast('Senha errada.'); return; }
          S.settings.pinHash = null; S.settings.pinSalt = null; delete S.settings.faceId; await saveSettings(); render(); api.close(true); toast('Senha desligada.');
        } }, 'Desligar a senha') };
      }
      body.push(h('form', { class: 'form', onsubmit: (e) => e.preventDefault() }, pinIn('a', 'Nova senha (4 a 6 números)'), pinIn('b', 'Repita a senha')));
      return { body, foot: h('button', { class: 'btn primary', type: 'button', onclick: async () => {
        if (st.a.length < 4) { toast('Use de 4 a 6 números.'); return; }
        if (st.a !== st.b) { toast('As duas senhas estão diferentes.'); return; }
        S.settings.pinSalt = C.uid('s'); S.settings.pinHash = await hashPin(st.a, S.settings.pinSalt); await saveSettings(); render(); api.close(true); toast('Senha ligada.');
      } }, 'Ligar a senha') };
    } });
  }
  // ---- Face ID (item 34) ----
  // Uma chave de acesso do próprio iPhone (WebAuthn) no lugar de digitar a senha. Continua sendo só um bloqueio de tela,
  // como a senha: nada é criptografado. A chave fica no iPhone; o app guarda só o número dela.
  const b64u = { de: (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
    para: (t) => Uint8Array.from(atob(t.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((t.length + 3) % 4)), (c) => c.charCodeAt(0)) };
  const aleatorio = (n) => crypto.getRandomValues(new Uint8Array(n));
  async function faceIdDisponivel() {
    try { return !PREVIEW && (isStandalone() || TESTE) && !!window.PublicKeyCredential && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(); } catch (e) { return false; }
  }
  async function entrarComFaceId(id) {
    const c = await navigator.credentials.get({ publicKey: { challenge: aleatorio(32), allowCredentials: [{ type: 'public-key', id: b64u.para(id) }], userVerification: 'required', timeout: 60000 } });
    return !!c && b64u.de(c.rawId) === id;
  }
  // o teste antes de ligar: criar a chave e, logo depois, entrar com ela. Só liga se as duas coisas derem certo.
  async function ligarFaceId() {
    try {
      const c = await navigator.credentials.create({ publicKey: { challenge: aleatorio(32), rp: { name: APP_NAME }, user: { id: aleatorio(16), name: APP_NAME + (TESTE ? ' (teste)' : ''), displayName: S.settings.nome || APP_NAME },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }], authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred' }, timeout: 60000 } });
      const id = b64u.de(c.rawId);
      if (!(await entrarComFaceId(id))) return false;
      S.settings.faceId = { id, em: today() }; await saveSettings(); return true;
    } catch (e) { anotaErro(e && (e.name || e.message), 'face id'); return false; }
  }
  let locked = false;
  function lockScreen() {
    if (locked || !S.settings.pinHash) return Promise.resolve();
    locked = true;
    return new Promise((res) => {
      const err = h('p', { class: 'err', role: 'alert' });
      const inp = h('input', { type: 'password', inputmode: 'numeric', pattern: '[0-9]*', maxlength: 6, autocomplete: 'off', 'aria-label': 'Senha' });
      const tryPin = async () => { if ((await hashPin(inp.value, S.settings.pinSalt)) === S.settings.pinHash) abrir(); else { err.textContent = 'Senha errada.'; inp.value = ''; inp.focus(); } };
      const abrir = () => { wrap.remove(); locked = false; res(); };
      // Face ID ligado: um toque para entrar; a senha continua valendo embaixo
      const fid = S.settings.faceId && window.PublicKeyCredential ? h('button', { class: 'btn primary', type: 'button', id: 'lock-faceid', style: 'min-width:220px', onclick: async () => {
        try { if (await entrarComFaceId(S.settings.faceId.id)) { abrir(); return; } } catch (e) { anotaErro(e && (e.name || e.message), 'face id'); }
        err.textContent = 'O Face ID não abriu. Digite a senha.'; inp.focus();
      } }, 'Entrar com Face ID') : null;
      const wrap = h('div', { class: 'lock' }, h('span', { class: 'halo' }, icon('lock')), h('h2', null, S.settings.nome ? `Oi, ${S.settings.nome}` : APP_NAME), fid,
        h('form', { class: 'form', style: 'align-items:center;gap:12px', onsubmit: (e) => { e.preventDefault(); tryPin(); } }, fid ? h('p', { class: 'muted' }, 'ou digite a senha') : null, inp, err,
          h('button', { class: fid ? 'btn' : 'btn primary', type: 'submit', style: 'min-width:180px' }, 'Entrar')));
      document.body.append(wrap); if (!fid) setTimeout(() => inp.focus(), 50);
    });
  }
  let hiddenAt = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) hiddenAt = Date.now();
    else if (S.settings.pinHash && hiddenAt && Date.now() - hiddenAt > 60000) lockScreen();
  });

  // ================= exemplos (prévia) =================
  function loadDemo() {
    // cirurgias inventadas, só para a prévia mostrar como o app fica
    const T0 = today();
    const day = (n) => C.fromDayNum(C.dayNum(T0) - n);
    const [A, P, N] = ['Dra. Alves', 'Dr. Prado', 'Dr. Nogueira'];
    const [HC, HV, CH] = ['Hospital Central', 'Hospital Vida', 'Clínica Horizonte'];
    const terms = [[A, 'col', 'alves'], [P, 'col', 'prado'], [N, 'col', 'nogueira'], [HC, 'hosp', 'central'], [HV, 'hosp', 'vida'], [CH, 'hosp', 'horizonte'], ['Plano Exemplo', 'conv', 'plano exemplo']]
      .map(([name, type, al], i) => ({ id: 'tdemo' + i, type, name, aliases: [al], demo: true }));
    const cvl = 'Colecistectomia videolaparoscópica', apvl = 'Apendicectomia videolaparoscópica', hern = 'Herniorrafia', le = 'Laparotomia exploradora', dren = 'Drenagem de abscesso';
    const base = { [cvl]: 444.02, [apvl]: 222.01, [hern]: 310.5, [le]: 380.4, [dren]: 150.2 };
    // dias atrás, hora, procedimentos, hospital, colega, pago (1 = pago certo, 2 = pago sem o adicional noturno, 0 = a receber)
    const plan = [
      [236, '14:10', [cvl], HC, A, 1], [229, '21:30', [apvl], HC, P, 2], [221, '10:05', [hern], HV, A, 1], [214, '20:15', [cvl], HC, N, 1],
      [205, '09:40', [apvl], CH, P, 1], [199, '16:20', [cvl], HV, A, 1], [190, '22:10', [le], HC, N, 1], [182, '08:30', [cvl], HC, A, 1],
      [171, '19:45', [apvl], HV, P, 1], [163, '11:20', [cvl, dren], HC, A, 1], [155, '15:00', [hern], CH, N, 1], [147, '20:40', [apvl], HC, A, 1],
      [139, '13:15', [cvl], HV, P, 1], [131, '07:50', [le], HC, A, 0], [122, '18:05', [cvl], CH, N, 1], [116, '23:20', [apvl], HC, P, 0],
      [108, '10:30', [hern], HV, A, 1], [99, '14:45', [cvl], HC, N, 1], [91, '21:05', [apvl], HV, A, 0], [83, '09:15', [cvl], HC, P, 0],
      [74, '16:40', [cvl], CH, A, 0], [66, '20:30', [apvl], HC, N, 0], [57, '11:10', [hern], HV, P, 0], [49, '19:55', [le], HC, A, 0],
      [41, '08:45', [cvl], HV, N, 0], [33, '15:30', [apvl], HC, A, 0], [26, '22:40', [cvl, dren], HC, P, 0], [18, '10:20', [hern], CH, A, 0],
      [11, '17:35', [apvl], HV, N, 0], [5, '13:05', [cvl], HC, A, 0]];
    let num = 0, total = 0, nLines = 0;
    const recs = plan.map(([n, time, procs, hosp, col, pago]) => {
      const r = newRecord({ num: ++num, origem: 'whatsapp', date: day(n), time, procs, hosp, cols: [col], caption: `${procs.join(' + ')} - ${col} ${hosp} (exemplo)`, demo: true });
      if (pago) {
        const urg = pago === 1 && C.isUrgent(r.date, time, S.hol || []);
        const lines = procs.map((p, i) => ({ date: r.date, time, valor: C.round2(base[p] * (urg ? 1.3 : 1) * (i ? 0.5 : 1)), conv: 'Plano Exemplo', cod: '', proc: p.toUpperCase(), procName: p, fam: C.famOf(S.index, p), funcao: 'Primeiro Auxiliar', exec: col, repId: 'repdemo' }));
        const valor = C.round2(lines.reduce((s, l) => s + l.valor, 0));
        r.status = 'recebido'; r.recebido = { valor, data: day(Math.max(0, n - 40)), origem: 'repasse', repId: 'repdemo' }; r.rep = lines; r.conv = 'Plano Exemplo'; r.funcao = 'Primeiro auxiliar';
        total += valor; nLines += lines.length;
      }
      return r;
    });
    recs.push(newRecord({ num: ++num, origem: 'whatsapp', date: day(3), time: '17:50', procs: [], hosp: HC, cols: [A], caption: '(exemplo sem procedimento)', revisar: ['Sem procedimento'], demo: true }));
    recs.push(newRecord({ num: ++num, origem: 'whatsapp', date: day(8), time: '12:30', procs: [hern], hosp: null, cols: [P], caption: 'Hérnia - Prado (exemplo sem hospital)', demo: true }));
    for (const r of recs) { delete r.pagamentos; C.migrarFinanceiro(r); C.compatFinanceiro(r); }
    S.terms.push(...terms); S.records.push(...recs);
    S.repasses.push({ id: 'repdemo', numero: '000123', comp: 'exemplo', nome: 'Repasse de exemplo', total: C.round2(total), n: nLines, hosp: HC, pay: day(70), importedAt: Date.now(), demo: true });
    S.settings.seq = num; S.demo = true; derive();
  }

  // ================= início =================
  // ---- tamanho de letra do iPhone (item 34) ----
  // No iPhone, "-apple-system-body" segue Ajustes > Tela e Brilho > Tamanho do Texto (17 px no tamanho padrão). O app usa a
  // mesma proporção na letra base (16 px no padrão), entre 0,85 e 1,5 vez, para as telas não desmontarem.
  function escalaDoIphone() {
    try {
      if (!(window.CSS && CSS.supports && CSS.supports('font', '-apple-system-body'))) return 1;
      const el = document.createElement('span'); el.style.cssText = 'font:-apple-system-body;position:absolute;visibility:hidden'; el.textContent = 'x';
      document.body.append(el); const px = parseFloat(getComputedStyle(el).fontSize); el.remove();
      return px > 0 ? px / 17 : 1;
    } catch (e) { return 1; }
  }
  function aplicarLetra(k) {
    const esc = Math.min(1.5, Math.max(0.85, k || escalaDoIphone()));
    document.documentElement.style.fontSize = Math.abs(esc - 1) < 0.01 ? '' : (16 * esc).toFixed(2) + 'px';
  }
  async function init() {
    aplicarLetra();
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') aplicarLetra(); });
    try { await load(); } catch (e) {
      $('#main').replaceChildren(h('div', { class: 'empty' }, h('span', { class: 'halo' }, icon('alert')), h('p', null, 'Não consegui abrir os dados deste aparelho: ' + (e && e.message))));
      return;
    }
    if (PREVIEW && !S.records.length) loadDemo();
    const tab = (t, ic, l) => h('button', { class: 'tab', type: 'button', 'data-tab': t, onclick: () => go(t) }, icon(ic), l);
    $('#tabbar').replaceChildren(h('div', { class: 'tabbar-in' }, tab('inicio', 'home', 'Início'), tab('lista', 'list', 'Cirurgias'),
      h('button', { class: 'fab', id: 'fab', type: 'button', 'aria-label': 'Adicionar', onclick: sheetAdd }, icon('plus')),
      tab('recebimentos', 'cash', 'Recebimentos'), tab('relatorios', 'chart', 'Relatórios')));
    render();
    // filete embaixo do título quando a página rola
    let rolou = false;
    window.addEventListener('scroll', () => { const s = window.scrollY > 4; if (s !== rolou) { rolou = s; document.documentElement.classList.toggle('scrolled', s); } }, { passive: true });
    if (S.settings.pinHash) await lockScreen();
    watchUpdates();
  }
  // ================= atualização =================
  // O sw.js guarda o app para abrir sem internet. Se uma versão nova for publicada com o app aberto, aparece o aviso
  // "Nova versão disponível". O app confere sempre que volta para a tela e a cada hora.
  const swOk = () => !PREVIEW && 'serviceWorker' in navigator && (location.protocol === 'https:' || /^(localhost|127\.0\.0\.1)$/.test(location.hostname));
  function watchUpdates() {
    if (!swOk()) return;
    const tinha = !!navigator.serviceWorker.controller;  // na primeira instalação não há o que avisar
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (tinha) showUpdate(); });
    navigator.serviceWorker.register('sw.js').then((reg) => {
      const conferir = () => reg.update().catch(() => {});
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') conferir(); });
      setInterval(conferir, 60 * 60 * 1000);
    }).catch((e) => anotaErro(e && e.message, 'sw.js'));
  }
  function showUpdate() {
    if ($('#update-bar')) return;
    document.body.append(h('div', { class: 'updatebar', id: 'update-bar', role: 'status' },
      h('span', { class: 't' }, h('b', null, 'Nova versão disponível'), h('small', null, 'Seus dados continuam iguais.')),
      h('button', { class: 'btn sm', type: 'button', onclick: () => location.reload() }, 'Atualizar')));
  }
  // para os testes automáticos e o diagnóstico no computador (não muda nada sozinho)
  window.__app = { S, go, render, routeFile, Store, VERSION, DATA_VERSION, DB_VERSION, TESTE, erros: ERROS, mostrarAviso: () => showUpdate(), abrirFicha: (id) => sheetRecord(S.records.find((r) => r.id === id)), letra: (k) => { aplicarLetra(k); render(); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
