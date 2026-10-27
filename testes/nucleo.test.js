/* Testes do núcleo (core.js) com dados inventados (pasta testes/dados).
   Registram o que o app faz hoje. Os problemas já listados no ROADMAP entram como "falha esperada":
   quando um deles for corrigido, o teste passa a passar e avisa para virar teste normal.
   Rodar: abra testes/index.html no navegador (no GitHub: .../Carol_Controlecirurgias/testes/)
   ou, com o Node instalado, na pasta do app: node testes/nucleo.test.js */
(function (root) {
  'use strict';

  function definir(C, io) {
    const lista = [];
    const teste = (grupo, nome, fn, falhaEsperada) => lista.push({ grupo, nome, fn, falhaEsperada: falhaEsperada || null });
    const igual = (atual, esperado, oque) => {
      const a = JSON.stringify(atual), e = JSON.stringify(esperado);
      if (a !== e) throw new Error(`${oque || 'valor'}: esperado ${e}, veio ${a}`);
    };
    const verdade = (cond, oque) => { if (!cond) throw new Error(oque || 'condição falsa'); };
    const perto = (atual, esperado, oque) => { if (atual == null || Math.abs(atual - esperado) > 0.005) throw new Error(`${oque}: esperado ${esperado}, veio ${atual}`); };
    const memo = (fn) => { let p = null; return () => (p = p || fn()); };

    const CVL = 'Colecistectomia videolaparoscópica', APVL = 'Apendicectomia videolaparoscópica';
    const colegas = [['Bruno', 'bruno'], ['Lia', 'lia'], ['Otávio', 'otavio']].map(([name, a]) => ({ id: 'tc-' + a, type: 'col', name, aliases: [a] }));
    const indice = (extra) => C.buildIndex(C.defaultTerms().concat(colegas, extra || []));

    // conversa do iPhone, lida como o app lê: zip -> mensagens -> cirurgias; colegas confirmados em "Quem é quem?"
    const conversa = memo(async () => {
      const z = await C.zipOpen(await io.blob('conversa-iphone.zip'));
      const txt = await (await C.zipEntryBlob(z, z.entries.find((e) => e.base === '_chat.txt'))).text();
      const chat = C.parseChat(txt);
      const g = C.groupMessages(chat.messages);
      const novos = C.collectUnknown(g.entries, C.buildIndex(C.defaultTerms()));
      const index = C.buildIndex(C.defaultTerms().concat(novos.map((u) => ({ id: 't-' + u.norm, type: u.guess, name: u.text, aliases: [u.norm] }))));
      const recs = g.entries.map((e) => C.recordFromEntry(e, index, { chatName: chat.chatName }));
      return { z, txt, chat, g, novos, index, recs };
    });
    const repasse = memo(async () => C.parseRepasse(await C.readXlsx(await io.blob('EXEMPLO_LTDA_-_Repasse_-_900001_-_Comp._09.xlsx')), 'EXEMPLO_LTDA_-_Repasse_-_900001_-_Comp._09.xlsx'));
    const doDia = (recs, d, hora) => recs.find((r) => r.date === d && (hora === undefined || r.time === hora));

    // ---------- legendas ----------
    const LEG = [
      ['CVL Bruno UMC', { procs: [CVL], hosp: 'UMC', cols: ['Bruno'] }],
      ['APVL - Mater Dei - Lia', { procs: [APVL], hosp: 'Santa Clara', cols: ['Lia'] }],
      ['Hérnia interna - UMC Bruno', { procs: ['Correção de hérnia interna'], hosp: 'UMC', cols: ['Bruno'] }],
      ['LE + drenagem de abscesso Genoveva Otávio 13h', { procs: ['Laparotomia exploradora', 'Drenagem de abscesso'], hosp: 'Santa Genoveva', cols: ['Otávio'], time: '13:00' }],
      ['Colecistectomia VLP Santa Clara Lia 21:30', { procs: [CVL], hosp: 'Santa Clara', cols: ['Lia'], time: '21:30' }],
      ['Apendicectomia - VLP', { procs: [APVL] }],
      ['07/09 hérnia UMC Bruno', { procs: ['Herniorrafia'], hosp: 'UMC', cols: ['Bruno'], date: '2026-09-07' }],
      ['28/11/25 CVL', { procs: [CVL], date: '2025-11-28' }],
      ['CVL UMC Bruno R$ 1.500,00', { procs: [CVL], hosp: 'UMC', cols: ['Bruno'], valor: 1500 }],
      ['Cisto pilonidal UMC', { procs: ['Cisto sacrococcígeo (tratamento cirúrgico)'], hosp: 'UMC' }],
      ['Colecisto', { procs: ['Colecistectomia'] }],
      ['Volvo Santa Clara', { procs: ['Distorção de volvo (VLP)'], hosp: 'Santa Clara' }],
      ['Fechamento de parede UMC Lia 18:30', { procs: ['Fechamento de parede abdominal'], hosp: 'UMC', cols: ['Lia'], time: '18:30' }],
    ];
    for (const [leg, esp] of LEG) teste('Legendas', `"${leg}"`, () => {
      const p = C.parseCaption(leg, indice(), '2026-09-12');
      for (const [k, v] of Object.entries(esp)) igual(p[k], v, k);
    });
    teste('Legendas', 'procedimento que o app não conhece entra como "Procedimento novo"', () => {
      const p = C.parseCaption('Gastrectomia UMC Lia', indice(), '2026-09-12');
      igual(p.procs, ['Gastrectomia'], 'procedimentos');
      verdade(p.unknown.some((u) => u.guess === 'proc'), 'deveria marcar como procedimento novo');
    });
    teste('Legendas', '"VLP colecisto" vira um procedimento só', () => igual(C.parseCaption('VLP colecisto UMC Bruno', indice(), '2026-09-12').procs, [CVL], 'procedimentos'), 'item 15');
    teste('Legendas', '"VLP colecistectomia" vira um procedimento só', () => igual(C.parseCaption('VLP colecistectomia', indice(), '2026-09-12').procs, [CVL], 'procedimentos'), 'item 15');

    // ---------- conversa do iPhone ----------
    teste('Conversa do iPhone', 'lê as 19 mensagens, separa as 2 de sistema e acha o nome do grupo', async () => {
      const { chat } = await conversa();
      igual(chat.messages.length, 19, 'mensagens'); igual(chat.messages.filter((m) => m.system).length, 2, 'de sistema'); igual(chat.chatName, 'Cirurgias Teste', 'grupo');
    });
    teste('Conversa do iPhone', 'monta 12 cirurgias e separa 2 fotos sem legenda', async () => {
      const { g } = await conversa();
      igual(g.entries.length, 12, 'cirurgias'); igual(g.loose.length, 2, 'fotos sem legenda');
    });
    teste('Conversa do iPhone', 'toda foto citada está no zip, e toda foto do zip foi usada uma vez', async () => {
      const { z, g, recs } = await conversa();
      const noZip = z.entries.filter((e) => /\.jpe?g$/i.test(e.base)).map((e) => e.base).sort();
      const usadas = recs.flatMap((r) => r.photoNames).concat(g.loose.flatMap((l) => l.photos)).sort();
      igual(usadas, noZip, 'fotos'); igual(noZip.length, 13, 'fotos no zip');
    });
    teste('Conversa do iPhone', '"Quem é quem?" sugere Bruno, Lia e Otávio como colegas', async () => {
      const { novos } = await conversa();
      igual(novos.map((u) => [u.text, u.guess, u.count]), [['Bruno', 'col', 6], ['Lia', 'col', 3], ['Otávio', 'col', 2]], 'nomes novos');
    });
    teste('Conversa do iPhone', 'o nome de quem manda as mensagens não vira colega', async () => {
      const { novos } = await conversa();
      verdade(!novos.some((u) => /ana|exemplo/i.test(u.text)), 'o remetente virou nome');
    });
    teste('Conversa do iPhone', 'duas fotos seguidas ficam na mesma cirurgia', async () => {
      const r = doDia((await conversa()).recs, '2026-09-02');
      igual([r.procs, r.hosp, r.cols, r.time, r.photoNames.length], [[CVL], 'UMC', ['Bruno'], '10:15', 2], 'cirurgia de 02/09');
    });
    teste('Conversa do iPhone', 'legenda mandada logo depois da foto vale para a foto', async () => {
      const r = doDia((await conversa()).recs, '2026-09-05');
      igual([r.procs, r.hosp, r.cols, r.time, r.photoNames.length], [['Laparotomia exploradora', 'Drenagem de abscesso'], 'Santa Genoveva', ['Otávio'], '13:00', 1], 'cirurgia de 05/09');
    });
    teste('Conversa do iPhone', '"Convertida para..." corrige o procedimento e pede conferência', async () => {
      const r = doDia((await conversa()).recs, '2026-09-09');
      igual(r.procs, ['Colecistectomia'], 'procedimentos');
      verdade(r.revisar.some((x) => /convers/i.test(x)), 'deveria pedir conferência');
    });
    teste('Conversa do iPhone', 'data escrita na legenda vale mais que a data do envio', async () => {
      const r = doDia((await conversa()).recs, '2026-09-07');
      verdade(r, 'não achou a cirurgia de 07/09'); igual([r.msgDate, r.time, r.procs], ['2026-09-12', null, ['Herniorrafia']], 'cirurgia de 07/09');
    });
    teste('Conversa do iPhone', 'foto exportada sem mídia conta como foto que faltou', async () => {
      const r = doDia((await conversa()).recs, '2026-09-16');
      igual([r.photoNames.length, r.omitted], [0, 1], 'fotos');
    });
    teste('Conversa do iPhone', 'hoje uma anotação sem cirurgia vira ficha "Sem procedimento"', async () => {
      const r = doDia((await conversa()).recs, '2026-09-19');
      igual([r.procs, r.revisar], [[], ['Sem procedimento']], 'anotação de 19/09');
    });
    teste('Conversa do iPhone', 'importar a mesma conversa de novo gera as mesmas chaves (não duplica)', async () => {
      const { txt, g } = await conversa();
      igual(C.groupMessages(C.parseChat(txt).messages).entries.map((e) => e.key), g.entries.map((e) => e.key), 'chaves');
    });
    teste('Conversa do iPhone', 'sem hora na legenda, a hora do envio não vira hora da cirurgia', async () => {
      const r = doDia((await conversa()).recs, '2026-09-04');
      verdade(r.time == null || r.horaAproximada === true, `a ficha usou a hora do envio (${r.time}) como hora da cirurgia`);
    }, 'item 16');

    // ---------- legenda editada ----------
    const editada = memo(async () => C.groupMessages(C.parseChat(await io.texto('conversa-iphone-editada.txt')).messages).entries);
    teste('Legenda editada', 'a legenda editada continua sendo a mesma mensagem', async () => {
      const antes = (await conversa()).g.entries, depois = await editada();
      igual(depois[depois.length - 1].key, antes[antes.length - 1].key, 'chave');
    }, 'item 20');
    teste('Legenda editada', 'o aviso "Esta mensagem foi editada" sai do texto', async () => {
      const depois = await editada();
      verdade(!/editada/i.test(depois[depois.length - 1].caption), 'o aviso ficou na legenda');
    }, 'item 20');

    // ---------- conversa do Android ----------
    const android = memo(async () => { const chat = C.parseChat(await io.texto('conversa-android.txt')); return { chat, g: C.groupMessages(chat.messages) }; });
    teste('Conversa do Android', 'lê as 6 mensagens e separa a de sistema', async () => {
      const { chat } = await android();
      igual(chat.messages.length, 6, 'mensagens'); igual(chat.messages.filter((m) => m.system).length, 1, 'de sistema');
    });
    teste('Conversa do Android', 'monta as 3 cirurgias iguais às do iPhone', async () => {
      const { g } = await android(); const ios = (await conversa()).recs; const idx = (await conversa()).index;
      igual(g.entries.length, 3, 'cirurgias');
      for (const e of g.entries) {
        const a = C.recordFromEntry(e, idx, {}); const b = doDia(ios, a.date);
        igual([a.procs, a.hosp, a.cols, a.time], [b.procs, b.hosp, b.cols, b.time], `cirurgia de ${a.date}`);
      }
    });
    teste('Conversa do Android', '"<Mídia oculta>" vira foto sem legenda que faltou', async () => {
      const { g } = await android();
      igual(g.loose.map((l) => l.omitted), [1], 'fotos sem legenda');
    });

    // ---------- zip ----------
    teste('Zip', 'abre o zip exportado e lê uma foto JPEG', async () => {
      const { z } = await conversa();
      igual(z.entries.length, 14, 'arquivos no zip');
      const u = new Uint8Array(await (await C.zipEntryBlob(z, z.entries.find((e) => /\.jpg$/.test(e.base)))).arrayBuffer());
      igual([u[0], u[1]], [0xff, 0xd8], 'início do JPEG');
    });
    teste('Zip', 'backup: grava e lê de volta texto com acento e foto, sem mudar nada', async () => {
      const { z } = await conversa();
      const foto = await C.zipEntryBlob(z, z.entries.find((e) => /\.jpg$/.test(e.base)));
      const bk = await C.zipWrite([{ name: 'dados.json', data: JSON.stringify({ texto: 'ação, cirurgião' }) }, { name: 'fotos/x.jpg', data: foto }]);
      const z2 = await C.zipOpen(bk);
      igual(JSON.parse(await (await C.zipEntryBlob(z2, z2.entries[0])).text()).texto, 'ação, cirurgião', 'texto');
      const a = new Uint8Array(await foto.arrayBuffer()), b = new Uint8Array(await (await C.zipEntryBlob(z2, z2.entries[1])).arrayBuffer());
      igual([b.length, C.crc32(b)], [a.length, C.crc32(a)], 'foto');
    });

    teste('Zip', 'confere o código de cada arquivo (CRC) e aceita a foto boa', async () => {
      const { z } = await conversa();
      const e = z.entries.find((x) => /\.jpg$/.test(x.base));
      verdade(typeof e.crc === 'number', 'o zip não trouxe o código de conferência');
      const u = new Uint8Array(await (await C.zipEntryChecked(z, e)).arrayBuffer());
      igual(C.crc32(u), e.crc, 'código da foto');
    });
    teste('Zip', 'percebe uma foto danificada no zip e não a devolve', async () => {
      const bytes = new Uint8Array(await (await io.blob('conversa-iphone.zip')).arrayBuffer());
      const z = await C.zipOpen(new Blob([bytes])); const e = z.entries.find((x) => /\.jpg$/.test(x.base));
      const lh = new DataView(bytes.buffer, e.off, 30); const inicio = e.off + 30 + lh.getUint16(26, true) + lh.getUint16(28, true);
      bytes[inicio + 100] ^= 0xff;   // estraga um byte no meio da foto
      const z2 = await C.zipOpen(new Blob([bytes]));
      let erro = null; try { await C.zipEntryChecked(z2, z2.entries.find((x) => x.base === e.base)); } catch (x) { erro = x; }
      verdade(erro && /danificad/.test(erro.message), 'não percebeu a foto danificada');
    });

    // ---------- planilha de repasse ----------
    teste('Planilha de repasse', 'acha as colunas e lê as 8 linhas, sem a linha de total', async () => {
      const rep = await repasse();
      igual(rep.lines.length, 8, 'linhas'); perto(rep.total, 2819.73, 'total');
    });
    teste('Planilha de repasse', 'pega número e competência do nome do arquivo', async () => {
      const rep = await repasse();
      igual([rep.id, rep.numero, rep.comp], ['rep900001', '900001', '09'], 'número e competência');
    });
    teste('Planilha de repasse', 'descarta paciente, atendimento e conta', async () => {
      const rep = await repasse(); const tudo = JSON.stringify(rep);
      verdade(rep.lines.every((l) => Object.keys(l).every((k) => ['date', 'time', 'valor', 'conv', 'cod', 'proc', 'funcao', 'exec'].includes(k))), 'linha com coluna a mais');
      verdade(!/paciente|7000\d\d|8000\d\d/i.test(tudo), 'sobrou dado de paciente, atendimento ou conta');
    });
    teste('Planilha de repasse', 'lê data, hora, valor, função e executor', async () => {
      const l = (await repasse()).lines[1];
      igual([l.date, l.time, l.valor, l.conv, l.funcao, l.exec], ['2026-09-07', '09:30', 403.65, 'Convênio Teste', 'Primeiro Auxiliar', 'Bruno Teixeira Lima'], 'linha de 07/09');
    });
    teste('Planilha de repasse', 'hoje a linha glosada (liberado zero) entra como valor zero', async () => {
      const l = (await repasse()).lines[7];
      igual([l.date, l.valor], ['2026-09-23', 0], 'linha de 23/09');
    });
    teste('Planilha de repasse', 'linha sem hora fica sem hora, e não meia-noite', async () => {
      const l = (await repasse()).lines[4];
      igual([l.date, l.time], ['2026-09-17', null], 'linha de 17/09');
    }, 'item 25');
    teste('Planilha de repasse', 'reconhece os procedimentos da planilha', () => {
      const idx = indice();
      igual(['COLECISTECTOMIA SEM COLANGIOGRAFIA POR VIDEOLAPAROSCOPIA', 'HERNIORRAFIA INGUINAL', 'FECHAMENTO DE PAREDE ABDOMINAL', 'APENDICECTOMIA POR VIDEOLAPAROSCOPIA', 'GASTRECTOMIA PARCIAL']
        .map((p) => { const t = C.mapRepasseProc(p, idx); return t ? t.name : null; }), [CVL, 'Herniorrafia', 'Fechamento de parede abdominal', APVL, null], 'procedimentos');
    });

    // ---------- cruzamento repasse x cirurgias ----------
    const plano = memo(async () => { const c = await conversa(); return { c, acts: C.planRepasse(await repasse(), c.recs, c.index, { hosp: 'UMC' }) }; });
    teste('Cruzamento', 'liga cada linha clara à cirurgia certa, com certeza alta', async () => {
      const { c, acts } = await plano();
      for (const [d, h] of [['2026-09-02', '10:15'], ['2026-09-07', '09:30'], ['2026-09-15', '18:30'], ['2026-09-16', '07:20']]) {
        const a = acts.find((x) => x.date === d && x.time === h); const r = c.recs.find((x) => x.id === a.recordId);
        verdade(r && r.date === d, `a linha de ${d} não casou com a cirurgia do dia`); igual(a.certeza, 'alta', `certeza em ${d}`);
      }
    });
    teste('Cruzamento', 'cirurgia que não está na conversa vira cirurgia nova', async () => {
      const { acts } = await plano();
      igual(acts.find((x) => x.date === '2026-09-22').certeza, 'novo', 'linha de 22/09');
    });
    teste('Cruzamento', 'liga o nome completo do executor ao colega', async () => {
      const { acts } = await plano();
      igual(acts.find((x) => x.date === '2026-09-16').col, 'Otávio', 'colega de 16/09');
    });
    teste('Cruzamento', 'duas cirurgias no mesmo dia e colega, sem hora na planilha, viram dois atos', async () => {
      const { c, acts } = await plano();
      const do17 = acts.filter((x) => x.date === '2026-09-17');
      igual(do17.length, 2, 'atos de 17/09');
      igual(do17.map((a) => (c.recs.find((r) => r.id === a.recordId) || {}).time).sort(), ['08:30', '15:10'], 'cirurgias de 17/09');
    }, 'item 25');
    teste('Cruzamento', 'complemento de cirurgia já paga cai na mesma cirurgia', async () => {
      const c = await conversa(); const rep = await repasse();
      const recs = c.recs.map((r) => (r.date === '2026-09-02' ? { ...r, status: 'recebido', recebido: { valor: 444.02, data: '2026-10-05' }, rep: [rep.lines[0]] } : r));
      const comp = { id: 'repX', lines: [{ ...rep.lines[0], valor: 50 }] };
      const a = C.planRepasse(comp, recs, c.index, { hosp: 'UMC' })[0];
      igual(a.recordId, recs.find((r) => r.date === '2026-09-02').id, 'complemento');
    }, 'item 23');
    teste('Cruzamento', 'nome completo novo com o mesmo primeiro nome não é ligado sem perguntar', () => {
      const idx = C.buildIndex(C.defaultTerms().concat([{ id: 'tb', type: 'col', name: 'Bruno', aliases: ['bruno', 'bruno teixeira lima'] }]));
      const m = C.mapExecutor('Bruno Carvalho Dias', idx);
      verdade(!(m && m.how === 'nome'), 'ligou "Bruno Carvalho Dias" ao Bruno sozinho');
    }, 'item 21');

    // ---------- estimativa ----------
    const idxE = indice();
    const linha = (date, time, procName, valor, extra) => ({ date, time, valor, conv: 'Plano Exemplo Saúde', cod: '', proc: procName.toUpperCase(), procName, fam: C.famOf(idxE, procName), funcao: 'Primeiro Auxiliar', exec: 'Bruno Teixeira Lima', ...(extra || {}) });
    const pago = (...lines) => ({ id: C.uid('r'), status: 'recebido', date: lines[0].date, time: lines[0].time, procs: lines.map((l) => l.procName), rep: lines });
    const aberta = (date, time, procs, extra) => ({ id: C.uid('r'), status: 'aberto', date, time, procs, ...(extra || {}) });
    const refs = C.buildRefs([
      pago(linha('2026-09-02', '10:15', CVL, 444.02)), pago(linha('2026-09-16', '07:20', CVL, 444.02)),
      pago(linha('2026-09-20', '22:10', CVL, 577.23)),                       // domingo à noite: base = 577,23 / 1,3
      pago(linha('2026-08-12', '10:00', APVL, 222.02)), pago(linha('2026-08-13', '11:00', 'Drenagem de abscesso', 150)),
    ], []);
    const est = (r) => C.estimate(r, refs, idxE, []);
    teste('Estimativa', 'mediana do procedimento em horário normal', () => perto(est(aberta('2026-09-15', '10:00', [CVL])).valor, 444.02, 'CVL de terça às 10h'));
    teste('Estimativa', '+30% das 19h às 7h', () => perto(est(aberta('2026-09-15', '20:00', [CVL])).valor, 577.23, 'CVL de terça às 20h'));
    teste('Estimativa', '+30% no fim de semana', () => perto(est(aberta('2026-09-19', '10:00', [CVL])).valor, 577.23, 'CVL de sábado'));
    teste('Estimativa', '+30% no feriado, mesmo sem hora', () => perto(est(aberta('2026-09-07', null, [CVL])).valor, 577.23, 'CVL em 07/09'));
    teste('Estimativa', 'segundo procedimento conta pela metade', () => perto(est(aberta('2026-09-15', '10:00', [CVL, 'Drenagem de abscesso'])).valor, 519.02, 'CVL + drenagem'));
    teste('Estimativa', 'sem referência do procedimento, usa a da mesma família', () => perto(est(aberta('2026-09-15', '10:00', ['Colecistectomia'])).valor, 444.02, 'colecistectomia aberta'));
    teste('Estimativa', 'sem nenhuma referência, fica sem valor', () => igual([est(aberta('2026-09-15', '10:00', ['Histerectomia'])).valor, est(aberta('2026-09-15', '10:00', ['Histerectomia'])).parcial], [null, true], 'histerectomia'));
    teste('Estimativa', 'com um procedimento sem referência, avisa que é parcial', () => { const e = est(aberta('2026-09-15', '10:00', [CVL, 'Gastrectomia'])); igual([C.round2(e.valor), e.parcial, e.faltam], [444.02, true, 1], 'CVL + gastrectomia'); });
    teste('Estimativa', 'o valor do 1º auxiliar não se mistura com o do cirurgião principal', () => {
      const prin = { funcao: 'Cirurgião' };
      const r2 = C.buildRefs([pago(linha('2026-09-02', '10:15', CVL, 444.02)), pago(linha('2026-09-03', '10:15', CVL, 444.02)),
        pago(linha('2026-09-04', '10:15', CVL, 1480, prin)), pago(linha('2026-09-08', '10:15', CVL, 1480, prin)), pago(linha('2026-09-09', '10:15', CVL, 1480, prin))], []);
      perto(C.estimate(aberta('2026-09-15', '10:00', [CVL], { funcao: 'Primeiro auxiliar' }), r2, idxE, []).valor, 444.02, 'CVL do 1º auxiliar');
    }, 'item 18');

    // ---------- urgência e feriados ----------
    teste('Urgência e feriados', 'Páscoa de 2026 em 5 de abril e Sexta-feira Santa como feriado', () => { igual(C.easter(2026), '2026-04-05', 'Páscoa'); verdade(C.isHoliday('2026-04-03'), 'Sexta-feira Santa'); });
    teste('Urgência e feriados', 'feriado nacional e feriado da cidade', () => {
      verdade(C.isHoliday('2026-09-07'), '7 de setembro'); verdade(!C.isHoliday('2026-08-31'), '31/08 sem estar na lista');
      verdade(C.isHoliday('2026-08-31', C.parseExtraHolidays('31/08')), '31/08 na lista da cidade');
    });
    teste('Urgência e feriados', 'lê a lista de feriados da cidade (dia/mês)', () => igual(C.parseExtraHolidays('31/08; 1/1'), ['08-31', '01-01'], 'feriados'));
    teste('Urgência e feriados', 'aceita feriado com ano, como 04/06/2026', () => verdade(C.parseExtraHolidays('04/06/2026').length === 1, 'a data com ano foi ignorada'), 'item 19');
    teste('Urgência e feriados', 'limites do horário: 18h59 normal, 19h urgência, 6h59 urgência, 7h normal', () =>
      igual(['18:59', '19:00', '06:59', '07:00'].map((h) => C.isUrgent('2026-09-15', h, [])), [false, true, true, false], 'terça-feira'));
    teste('Urgência e feriados', 'sábado, domingo e feriado contam o dia todo', () =>
      igual([C.isUrgent('2026-09-19', '10:00', []), C.isUrgent('2026-09-20', null, []), C.isUrgent('2026-09-07', '10:00', [])], [true, true, true], 'urgência'));
    teste('Urgência e feriados', 'dia útil sem hora fica indefinido', () => igual(C.isUrgent('2026-09-15', null, []), null, 'terça sem hora'));
    teste('Urgência e feriados', 'hoje toda cirurgia nesse horário conta como urgência, eletiva ou não (regra do item 17, a confirmar)', () => verdade(C.isUrgent('2026-09-15', '20:00', []) === true, 'terça às 20h'));
    teste('Urgência e feriados', 'conferência: fim de semana pago pelo valor normal é apontado, e com +30% não', () => {
      const sab = pago(linha('2026-09-19', '10:00', CVL, 444.02)), dom = pago(linha('2026-09-20', '22:10', CVL, 577.23));
      const recs = [pago(linha('2026-09-02', '10:15', CVL, 444.02)), sab, dom];
      const ch = C.urgencyChecks(recs, C.buildRefs(recs, []), []);
      igual(ch.map((x) => [x.recId === sab.id, x.pago, x.esperado]), [[true, 444.02, 577.23]], 'conferências');
    });

    return lista;
  }

  async function rodar(C, io) {
    const res = [];
    for (const t of definir(C, io)) {
      let erro = null;
      try { await t.fn(); } catch (e) { erro = e; }
      const situacao = t.falhaEsperada ? (erro ? 'falha esperada' : 'passou') : (erro ? 'falhou' : 'ok');
      res.push({ grupo: t.grupo, nome: t.nome, item: t.falhaEsperada, situacao, detalhe: erro ? String(erro.message || erro) : '' });
    }
    return res;
  }
  // "passou" = era falha esperada e agora passa: o problema foi corrigido, e o teste deve virar normal
  const resumo = (res) => ({ total: res.length, ok: res.filter((r) => r.situacao === 'ok').length, esperadas: res.filter((r) => r.situacao === 'falha esperada').length,
    falharam: res.filter((r) => r.situacao === 'falhou').length, corrigidas: res.filter((r) => r.situacao === 'passou').length });

  const api = { definir, rodar, resumo };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.TestesNucleo = api;

  // no Node: node testes/nucleo.test.js
  if (typeof require === 'function' && typeof module === 'object' && require.main === module) {
    const fs = require('fs'), path = require('path');
    const C = require(path.join(__dirname, '..', 'core.js'));
    const pasta = path.join(__dirname, 'dados');
    const io = { texto: async (n) => fs.readFileSync(path.join(pasta, n), 'utf8'), blob: async (n) => new Blob([fs.readFileSync(path.join(pasta, n))]) };
    rodar(C, io).then((res) => {
      let grupo = '';
      const marca = { ok: '  ok  ', 'falha esperada': '  ~   ', falhou: ' FALHOU', passou: ' PASSOU' };
      for (const r of res) {
        if (r.grupo !== grupo) { grupo = r.grupo; console.log('\n' + grupo); }
        console.log(`${marca[r.situacao]} ${r.nome}${r.item ? ` (${r.item})` : ''}${r.situacao === 'falhou' ? '\n         ' + r.detalhe : ''}${r.situacao === 'passou' ? '\n         era falha esperada e agora passa: transforme em teste normal' : ''}`);
      }
      const s = resumo(res);
      console.log(`\n${s.total} testes: ${s.ok} ok, ${s.esperadas} falhas esperadas, ${s.falharam} falharam, ${s.corrigidas} corrigidas.`);
      process.exit(s.falharam || s.corrigidas ? 1 : 0);
    }).catch((e) => { console.error(e); process.exit(2); });
  }
})(typeof self !== 'undefined' ? self : this);
