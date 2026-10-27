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
    teste('Legendas', '"VLP colecisto" vira um procedimento só', () => igual(C.parseCaption('VLP colecisto UMC Bruno', indice(), '2026-09-12').procs, [CVL], 'procedimentos'));
    teste('Legendas', '"VLP colecistectomia" vira um procedimento só', () => igual(C.parseCaption('VLP colecistectomia', indice(), '2026-09-12').procs, [CVL], 'procedimentos'));
    teste('Legendas', '"VLP" vale para o procedimento do mesmo trecho, não para o anterior', () => igual(C.parseCaption('Apendicectomia + VLP colecisto', indice(), '2026-09-12').procs, ['Apendicectomia', CVL], 'procedimentos'));
    teste('Legendas', '"VLP" sem versão por vídeo conhecida não some com o procedimento', () => igual(C.parseCaption('VLP histerectomia', indice(), '2026-09-12').procs, ['Histerectomia'], 'procedimentos'));

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
      igual([r.procs, r.hosp, r.cols, r.msgTime, r.photoNames.length], [[CVL], 'UMC', ['Bruno'], '10:15', 2], 'cirurgia de 02/09');
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
    teste('Conversa do iPhone', 'a chave de cada mensagem se lê de volta: data, hora, começo do texto e fotos', async () => {
      const { g } = await conversa();
      const e = g.entries.find((x) => x.caption.startsWith('CVL Bruno UMC'));
      igual(C.describeKey(e.key), { date: '2026-09-02', time: '10:15', seg: '22', texto: 'cvl bruno umc', arquivos: 1, foto: null }, 'cirurgia');
      const l = g.loose[0];
      igual(C.describeKey(l.key + '~1'), { date: l.date, time: l.time, seg: '00', texto: '', arquivos: 1, foto: 1 }, 'foto solta');
      igual([C.describeKey(''), C.describeKey('qualquer coisa')], [null, null], 'chave estranha');
    });
    teste('Conversa do iPhone', 'sem hora na legenda, a hora do envio não vira hora da cirurgia', async () => {
      const r = doDia((await conversa()).recs, '2026-09-04');
      igual([r.time, r.msgTime], [null, '21:40'], 'hora da cirurgia e hora do envio');
    });
    teste('Conversa do iPhone', 'enviada entre 19h e 7h em dia útil, pede para conferir a hora', async () => {
      igual(doDia((await conversa()).recs, '2026-09-04').revisar, ['Confira a hora'], 'sexta às 21h40');
    });
    teste('Conversa do iPhone', 'enviada de dia, no fim de semana ou com a hora na legenda, não pergunta nada', async () => {
      const recs = (await conversa()).recs;
      igual([doDia(recs, '2026-09-02').revisar, doDia(recs, '2026-09-20').revisar, doDia(recs, '2026-09-15').revisar], [[], [], []], 'quarta 10h15, domingo 22h10, legenda com 18:30');
    });
    teste('Conversa do iPhone', 'enviada de madrugada, pede para conferir a data', () => {
      const e = { key: 'k', date: '2026-09-23', time: '01:30', caption: 'CVL UMC Bruno', photos: [], amends: [] };
      const r = C.recordFromEntry(e, indice(), {});
      igual([r.date, r.time, r.revisar], ['2026-09-23', null, ['Confira a data']], 'quarta à 1h30');
    });
    teste('Conversa do iPhone', 'feriado da cidade conta o dia todo: não pergunta a hora', () => {
      const e = { key: 'k', date: '2026-08-31', time: '21:00', caption: 'CVL UMC Bruno', photos: [], amends: [] };
      igual([C.recordFromEntry(e, indice(), {}).revisar, C.recordFromEntry(e, indice(), { feriados: ['08-31'] }).revisar], [['Confira a hora'], []], 'segunda 31/08 às 21h');
    });

    // ---------- legenda editada ----------
    const editada = memo(async () => C.groupMessages(C.parseChat(await io.texto('conversa-iphone-editada.txt')).messages).entries);
    teste('Legenda editada', 'a legenda editada é reconhecida como a mesma mensagem (hora exata e número de fotos)', async () => {
      const { recs } = await conversa(); const depois = await editada(); const e = depois[depois.length - 1];
      verdade(e.editada, 'a mensagem não foi marcada como editada');
      verdade(!recs.some((r) => r.key === e.key), 'a chave nova já existia');
      igual((C.findEdited(e, recs) || {}).date, '2026-09-20', 'ficha achada');
    });
    teste('Legenda editada', 'o aviso "Esta mensagem foi editada" sai do texto', async () => {
      const depois = await editada();
      igual(depois[depois.length - 1].caption, 'CVL UMC Bruno 21h', 'legenda');
    });
    teste('Legenda editada', 'com duas fichas no mesmo segundo, não adivinha', async () => {
      const { recs } = await conversa(); const depois = await editada(); const e = depois[depois.length - 1];
      const orig = C.findEdited(e, recs); const gemea = { ...orig, id: 'outra', key: orig.key.replace('|cvl umc bruno|', '|outra coisa|') };
      igual(C.findEdited(e, [...recs, gemea]), null, 'ficha achada');
    });
    teste('Legenda editada', 'mensagem que não foi editada continua com a mesma chave', async () => {
      const antes = (await conversa()).g.entries, depois = await editada();
      igual(depois.slice(0, -1).map((x) => x.key), antes.slice(0, -1).map((x) => x.key), 'chaves das outras');
    });

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
    });
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
      igual(do17.map((a) => (c.recs.find((r) => r.id === a.recordId) || {}).msgTime).sort(), ['08:30', '15:10'], 'cirurgias de 17/09');
    });
    teste('Cruzamento', 'complemento de cirurgia já paga cai na mesma cirurgia', async () => {
      const c = await conversa(); const rep = await repasse();
      const recs = c.recs.map((r) => (r.date === '2026-09-02' ? { ...r, devido: 444.02, devidoOrigem: 'repasse', pagamentos: [{ id: 'p', valor: 444.02, data: '2026-10-05', origem: 'repasse', repId: 'rep900001' }], rep: [rep.lines[0]] } : r));
      const comp = { id: 'repX', lines: [{ ...rep.lines[0], valor: 50 }] };
      const a = C.planRepasse(comp, recs, c.index, { hosp: 'UMC' })[0];
      igual([a.recordId, a.certeza], [recs.find((r) => r.date === '2026-09-02').id, 'complemento'], 'complemento');
    });
    teste('Cruzamento', 'duas cirurgias iguais no mesmo dia, sem hora na legenda: a hora do envio ajuda a casar na ordem certa', () => {
      const idx = indice();
      const ficha = (id, msgTime) => ({ id, status: 'aberto', date: '2026-09-10', time: null, msgDate: '2026-09-10', msgTime, procs: [CVL], hosp: 'UMC', cols: ['Bruno'] });
      const recs = [ficha('tarde', '15:40'), ficha('manha', '09:50')];
      const ln = (time) => ({ date: '2026-09-10', time, valor: 444.02, conv: 'Convênio Teste', cod: '1', proc: 'COLECISTECTOMIA SEM COLANGIOGRAFIA POR VIDEOLAPAROSCOPIA', funcao: 'Primeiro Auxiliar', exec: 'Bruno Teixeira Lima' });
      const acts = C.planRepasse({ id: 'r', lines: [ln('09:10'), ln('14:30')] }, recs, idx, { hosp: 'UMC' });
      igual(acts.map((a) => a.recordId), ['manha', 'tarde'], 'casamento');
    });
    teste('Cruzamento', 'nome completo novo com o mesmo primeiro nome não é ligado sem perguntar', () => {
      const idx = C.buildIndex(C.defaultTerms().concat([{ id: 'tb', type: 'col', name: 'Bruno', aliases: ['bruno', 'bruno teixeira lima'] }]));
      const m = C.mapExecutor('Bruno Carvalho Dias', idx);
      igual([m.term.name, m.how, m.outroNome], ['Bruno', 'primeiro-nome', true], 'outro Bruno');
    });
    teste('Cruzamento', 'na primeira vez que o nome completo aparece, pergunta se é o colega', () => {
      const idx = C.buildIndex(C.defaultTerms().concat([{ id: 'tb', type: 'col', name: 'Bruno', aliases: ['bruno'] }]));
      const m = C.mapExecutor('Bruno Teixeira Lima', idx);
      igual([m.how, m.outroNome], ['primeiro-nome', false], 'primeira vez');
    });
    teste('Cruzamento', 'nome completo já confirmado liga direto', () => {
      const idx = C.buildIndex(C.defaultTerms().concat([{ id: 'tb', type: 'col', name: 'Bruno', aliases: ['bruno', 'bruno teixeira lima'] }]));
      igual(C.mapExecutor('BRUNO TEIXEIRA LIMA', idx).how, 'exato', 'confirmado');
    });

    teste('Cruzamento', 'mesmo procedimento duas vezes sem hora, mas uma cirurgia só no app: continua um ato (pode ser bilateral)', async () => {
      const c = await conversa(); const rep = await repasse();
      const recs = c.recs.filter((r) => !(r.date === '2026-09-17' && r.msgTime === '15:10'));
      igual(C.planRepasse(rep, recs, c.index, { hosp: 'UMC' }).filter((x) => x.date === '2026-09-17').map((a) => a.lines.length), [2], 'atos de 17/09');
    });
    teste('Cruzamento', 'ligar à mão, marcar como nova e separar à mão', async () => {
      const c = await conversa(); const rep = await repasse();
      const r04 = c.recs.find((r) => r.date === '2026-09-04');
      const k22 = C.planRepasse(rep, c.recs, c.index, { hosp: 'UMC' }).find((x) => x.date === '2026-09-22').key;
      const k02 = C.planRepasse(rep, c.recs, c.index, { hosp: 'UMC' }).find((x) => x.date === '2026-09-02').key;
      const acts = C.planRepasse(rep, c.recs, c.index, { hosp: 'UMC', ligar: new Map([[k22, r04.id], [k02, null]]) });
      const a22 = acts.find((x) => x.key === k22), a02 = acts.find((x) => x.key === k02);
      igual([a22.recordId, a22.certeza, a02.recordId, a02.certeza], [r04.id, 'manual', null, 'novo'], 'à mão');
      const dois = { id: 'r2', lines: [{ ...rep.lines[0], time: null }, { ...rep.lines[2], time: null, exec: rep.lines[0].exec }] };
      const k = C.planRepasse(dois, c.recs, c.index, { hosp: 'UMC' })[0].key;
      igual(C.planRepasse(dois, c.recs, c.index, { hosp: 'UMC', separar: new Set([k]) }).length, 2, 'separado');
    });
    teste('Cruzamento', 'duas cirurgias parecidas no mesmo dia: o ato avisa que há outra candidata', async () => {
      const { acts } = await plano();
      verdade(acts.filter((x) => x.date === '2026-09-17').every((a) => a.outras.length === 1), 'as duas de 17/09 têm outra candidata');
      igual(acts.find((x) => x.date === '2026-09-02').outras, [], 'a de 02/09 não');
    });
    teste('Cruzamento', 'aponta diferença de data e de valor combinado', () => {
      const idx = indice();
      const r = { id: 'x', status: 'aberto', pagamentos: [], devido: 500, devidoOrigem: 'combinado', date: '2026-09-09', time: null, procs: [CVL], hosp: 'UMC', cols: ['Bruno'] };
      const a = C.planRepasse({ id: 'r', lines: [{ date: '2026-09-10', time: '10:00', valor: 444.02, conv: 'X', cod: '1', proc: 'COLECISTECTOMIA SEM COLANGIOGRAFIA POR VIDEOLAPAROSCOPIA', funcao: 'Primeiro Auxiliar', exec: 'Bruno' }] }, [r], idx, { hosp: 'UMC' })[0];
      igual([a.recordId, a.difData, a.difValor], ['x', '2026-09-09', 500], 'diferenças');
    });

    // ---------- modelo financeiro ----------
    const antiga = (extra) => ({ id: 'r1', origem: 'whatsapp', date: '2026-09-02', time: '10:15', procs: [CVL], status: 'aberto', recebido: null, valorPrevisto: null, rep: [], ...(extra || {}) });
    const semId = (pg) => pg.map(({ id, ...p }) => p);
    teste('Modelo financeiro', 'ficha antiga a receber com valor combinado: valor devido combinado, sem pagamento', () => {
      const r = antiga({ valorPrevisto: 1500 }); verdade(C.migrarFinanceiro(r), 'mudou');
      igual([r.devido, r.devidoOrigem, r.pagamentos, C.situacao(r)], [1500, 'combinado', [], 'aberto'], 'ficha');
    });
    teste('Modelo financeiro', 'ficha antiga paga pela planilha: um pagamento e o devido da planilha', () => {
      const r = antiga({ status: 'recebido', recebido: { valor: 444.02, data: '2026-10-05', origem: 'repasse', repId: 'rep900001' }, valorPrevisto: 400 });
      C.migrarFinanceiro(r);
      igual([semId(r.pagamentos), r.devido, r.devidoOrigem, r.devidoAntes, C.situacao(r)],
        [[{ valor: 444.02, data: '2026-10-05', origem: 'repasse', repId: 'rep900001', fonte: null }], 444.02, 'repasse', { valor: 400, origem: 'combinado' }, 'recebido'], 'ficha');
    });
    teste('Modelo financeiro', 'ficha antiga paga à mão continua recebida, mesmo abaixo do combinado', () => {
      const r = antiga({ status: 'recebido', recebido: { valor: 450, data: '2026-10-01', origem: 'manual' }, valorPrevisto: 500 });
      C.migrarFinanceiro(r);
      igual([r.devido, r.pagamentos.length, C.situacao(r), r.valorPrevisto], [null, 1, 'recebido', 500], 'ficha');
    });
    teste('Modelo financeiro', 'sem cobrança continua sem cobrança, e migrar de novo não muda nada', () => {
      const r = antiga({ status: 'semcobranca' }); C.migrarFinanceiro(r);
      igual([C.situacao(r), C.migrarFinanceiro(r)], ['semcobranca', false], 'ficha');
    });
    teste('Modelo financeiro', 'pagamento abaixo do devido fica parcial, com saldo; o resto quita', () => {
      const r = antiga(); C.migrarFinanceiro(r); r.devido = 500; r.devidoOrigem = 'combinado';
      r.pagamentos.push({ id: 'a', valor: 300, data: '2026-10-01', origem: 'manual' });
      igual([C.situacao(r), C.totalRecebido(r)], ['parcial', 300], 'parte');
      r.pagamentos.push({ id: 'b', valor: 200, data: '2026-10-20', origem: 'manual' });
      igual(C.situacao(r), 'recebido', 'resto');
    });
    teste('Modelo financeiro', 'sem valor devido: parte marcada fica parcial; pagamento sem valor anotado quita', () => {
      const r = antiga(); C.migrarFinanceiro(r);
      r.pagamentos.push({ id: 'a', valor: 200, data: '2026-10-01', origem: 'manual', parcial: true });
      igual(C.situacao(r), 'parcial', 'parte');
      const q = antiga(); C.migrarFinanceiro(q); q.devido = 500; q.pagamentos.push({ id: 'b', valor: null, data: '2026-10-01', origem: 'manual' });
      igual(C.situacao(q), 'recebido', 'sem valor anotado');
    });
    teste('Modelo financeiro', 'espelho para a versão 1.8: parcial aparece a receber; quitada com o total e a última data', () => {
      const r = antiga(); C.migrarFinanceiro(r); r.devido = 500; r.devidoOrigem = 'combinado';
      r.pagamentos.push({ id: 'a', valor: 300, data: '2026-10-01', origem: 'manual' }); C.compatFinanceiro(r);
      igual([r.status, r.recebido, r.valorPrevisto], ['aberto', null, 500], 'parcial');
      r.pagamentos.push({ id: 'b', valor: 200, data: '2026-10-20', origem: 'manual' }); C.compatFinanceiro(r);
      igual([r.status, r.recebido.valor, r.recebido.data], ['recebido', 500, '2026-10-20'], 'quitada');
    });
    teste('Modelo financeiro', 'complemento soma no devido e no recebido; desfazer volta ao que era', () => {
      const r = antiga({ devido: 500, devidoOrigem: 'combinado', pagamentos: [] });
      const lin = (repId, valor) => [{ date: '2026-09-02', time: '10:15', valor, procName: CVL, repId }];
      C.pagarPeloRepasse(r, { valor: 444.02 }, lin('A', 444.02), { id: 'p1', valor: 444.02, data: '2026-10-05', origem: 'repasse', repId: 'A' });
      C.pagarPeloRepasse(r, { valor: 50 }, lin('B', 50), { id: 'p2', valor: 50, data: '2026-11-05', origem: 'repasse', repId: 'B' });
      igual([r.devido, C.totalRecebido(r), C.situacao(r), r.rep.length], [494.02, 494.02, 'recebido', 2], 'com complemento');
      igual(C.desfazerRepasseNaFicha(r, 'B'), 'mudou', 'desfaz o complemento');
      igual([r.devido, C.totalRecebido(r), r.rep.length], [444.02, 444.02, 1], 'sem o complemento');
      C.desfazerRepasseNaFicha(r, 'A');
      igual([r.devido, r.devidoOrigem, r.pagamentos.length, C.situacao(r), 'devidoAntes' in r], [500, 'combinado', 0, 'aberto', false], 'sem planilha');
    });
    teste('Modelo financeiro', 'cirurgia criada pela planilha: desfazer apaga, a não ser que outra planilha também tenha pago', () => {
      const nova = () => ({ id: 'n', origem: 'repasse', repCriador: 'A', devido: 300, devidoOrigem: 'repasse', pagamentos: [{ id: 'p1', valor: 300, data: '2026-10-05', origem: 'repasse', repId: 'A' }], rep: [{ repId: 'A', valor: 300 }] });
      igual(C.desfazerRepasseNaFicha(nova(), 'A'), 'apagar', 'só ela');
      const r = nova(); C.pagarPeloRepasse(r, { valor: 40 }, [{ repId: 'B', valor: 40 }], { id: 'p2', valor: 40, data: '2026-11-05', origem: 'repasse', repId: 'B' });
      igual([C.desfazerRepasseNaFicha(r, 'A'), r.repCriador, r.devido, C.situacao(r)], ['mudou', 'B', 40, 'recebido'], 'com complemento de outra');
    });

    teste('Modelo financeiro', 'linha da planilha numa cirurgia que ela marcou como recebida: o mesmo pagamento, sem somar', async () => {
      const c = await conversa(); const rep = await repasse();
      const paga = (valor) => c.recs.map((r) => (r.date === '2026-09-02' ? { ...r, devido: null, devidoOrigem: null, pagamentos: [{ id: 'm', valor, data: '2026-10-01', origem: 'manual' }] } : r));
      const ato = (recs, opts) => C.planRepasse(rep, recs, c.index, { hosp: 'UMC', ...(opts || {}) }).find((x) => x.date === '2026-09-02');
      const igualValor = ato(paga(444.02)), semValor = ato(paga(null)), outroValor = ato(paga(300));
      igual([igualValor.certeza, igualValor.mesmo, semValor.mesmo, outroValor.mesmo, outroValor.podeSerMesmo], ['complemento', true, true, false, true], 'parte de "mesmo" com o mesmo valor ou sem valor anotado');
      igual(ato(paga(300), { mesmo: new Map([[outroValor.key, true]]) }).mesmo, true, 'ela pode escolher');
      const r = paga(null).find((x) => x.date === '2026-09-02');
      C.pagarPeloRepasse(r, igualValor, [{ repId: 'A', valor: 444.02 }], { id: 'p', valor: 444.02, data: '2026-10-05', origem: 'repasse', repId: 'A' }, { substituir: true });
      igual([r.pagamentos.map((x) => x.origem), r.devido, C.totalRecebido(r), C.situacao(r)], [['repasse'], 444.02, 444.02, 'recebido'], 'a planilha passa a ser o registro');
      C.desfazerRepasseNaFicha(r, 'A');
      igual([r.pagamentos.map((x) => [x.origem, x.valor]), r.devido, 'substituidos' in r, C.situacao(r)], [[['manual', null]], null, false, 'recebido'], 'desfazer devolve o pagamento dela');
    });
    teste('Modelo financeiro', 'complemento de outra planilha soma na referência da cirurgia, em vez de virar uma linha solta', () => {
      const idx = indice(); const linha = (repId, valor, time) => ({ date: '2026-09-02', time, valor, conv: 'Plano', proc: 'X', procName: CVL, fam: C.famOf(idx, CVL), funcao: 'Primeiro Auxiliar', exec: 'Bruno', repId });
      const refs = C.buildRefs([{ id: 'a', rep: [linha('A', 400, '10:15'), linha('B', 44.02, null)] }, { id: 'b', rep: [linha('A', 444.02, '10:15')] }], []);
      igual(refs.byProc.get(CVL), [444.02, 444.02], 'referência');
    });
    teste('Modelo financeiro', 'voltar de versão: o que ela fez na versão anterior não se perde', () => {
      const nova = (extra) => { const r = antiga(); C.migrarFinanceiro(r); Object.assign(r, extra || {}); C.compatFinanceiro(r); return r; };
      // a) marcou como recebida à mão
      let r = nova(); r.status = 'recebido'; r.recebido = { valor: 300, data: '2026-10-10', origem: 'manual' };
      verdade(C.reconciliarFinanceiro(r), 'mudou'); igual([semId(r.pagamentos).map((p) => p.valor), C.situacao(r)], [[300], 'recebido'], 'recebida à mão');
      // b) pagou o resto de uma paga em parte, com valor combinado: continua recebida, e o pagamento de antes fica
      r = nova({ devido: 350, devidoOrigem: 'combinado', pagamentos: [{ id: 'a', valor: 100, data: '2026-10-01', origem: 'manual' }] });
      r.status = 'recebido'; r.recebido = { valor: 200, data: '2026-10-10', origem: 'manual' }; C.reconciliarFinanceiro(r);
      igual([r.pagamentos.map((p) => p.valor), C.situacao(r)], [[100, 200], 'recebido'], 'resto pago lá');
      // c) desfez a planilha: os pagamentos saem e o valor combinado volta
      r = nova({ devido: 444.02, devidoOrigem: 'repasse', devidoAntes: { valor: 500, origem: 'combinado' }, pagamentos: [{ id: 'p', valor: 444.02, data: '2026-10-05', origem: 'repasse', repId: 'A' }] });
      r.status = 'aberto'; r.recebido = null; C.reconciliarFinanceiro(r);
      igual([r.pagamentos, r.devido, r.devidoOrigem, C.situacao(r)], [[], 500, 'combinado', 'aberto'], 'planilha desfeita lá');
      // d) corrigiu o valor recebido
      r = nova({ pagamentos: [{ id: 'a', valor: 400, data: '2026-10-01', origem: 'manual' }] });
      r.recebido = { ...r.recebido, valor: 420 }; C.reconciliarFinanceiro(r);
      igual([r.pagamentos.map((p) => p.valor), C.situacao(r)], [[420], 'recebido'], 'valor corrigido lá');
      // e) mudou o valor combinado de uma paga em parte: o pagamento fica
      r = nova({ devido: 350, devidoOrigem: 'combinado', pagamentos: [{ id: 'a', valor: 100, data: '2026-10-01', origem: 'manual' }] });
      r.valorPrevisto = 400; C.reconciliarFinanceiro(r);
      igual([r.devido, r.pagamentos.length, C.situacao(r)], [400, 1, 'parcial'], 'valor combinado mudado lá');
      // f) pagou pela planilha lá: o devido passa a ser o da planilha
      r = nova({ devido: 350, devidoOrigem: 'combinado' }); r.status = 'recebido'; r.recebido = { valor: 444.02, data: '2026-10-05', origem: 'repasse', repId: 'A' };
      C.reconciliarFinanceiro(r); igual([r.devido, r.devidoOrigem, r.devidoAntes, C.situacao(r)], [444.02, 'repasse', { valor: 350, origem: 'combinado' }, 'recebido'], 'paga pela planilha lá');
      // g) nada mudou lá
      r = nova(); igual(C.reconciliarFinanceiro(r), false, 'sem mudança');
    });

    // ---------- prazo de pagamento e previsão ----------
    const paga = (id, date, data, extra) => ({ id, date, hosp: 'UMC', conv: 'Plano Exemplo Saúde', cols: ['Bruno'], devido: 100, devidoOrigem: 'repasse',
      pagamentos: [{ id: 'p' + id, valor: 100, data, origem: 'repasse', repId: 'A' }], ...(extra || {}) });
    const historico = () => [paga('a', '2026-01-10', '2026-02-09'), paga('b', '2026-02-10', '2026-03-22'), paga('c', '2026-03-10', '2026-04-29'), paga('d', '2026-04-10', '2026-06-09')];
    teste('Prazo e previsão', 'prazo de costume do hospital: a mediana para a previsão e o prazo de 9 em cada 10 para "atrasada"', () => {
      const pz = C.prazosDePagamento(historico());
      igual([pz.get('hosp:umc').tipico, pz.get('hosp:umc').limite, pz.get('hosp:umc').n, pz.get('hosp:umc').nome], [45, 60, 4, 'UMC'], 'UMC');
      igual(C.prazoDe({ hosp: 'UMC', cols: [] }, pz).tipico, 45, 'cirurgia do UMC');
      igual(C.prazoDe({ hosp: 'Outro', conv: 'Plano Exemplo Saúde', cols: [] }, pz).nome, 'Plano Exemplo Saúde', 'sem histórico do hospital, vale o do convênio');
      igual(C.prazoDe({ hosp: 'Outro', cols: ['Lia'] }, pz), null, 'sem histórico');
    });
    teste('Prazo e previsão', 'sem 3 cirurgias pagas, ou com "Já recebi" sem valor, o pagador não tem prazo', () => {
      const semValor = historico().map((r) => ({ ...r, pagamentos: [{ ...r.pagamentos[0], valor: null }] }));
      igual([C.prazosDePagamento(historico().slice(0, 2)).size, C.prazosDePagamento(semValor).size], [0, 0], 'sem prazo');
    });
    teste('Prazo e previsão', 'atrasada pelo prazo do pagador; sem histórico, pelo padrão de Ajustes', () => {
      const pz = C.prazosDePagamento(historico());
      igual([C.limiteAtraso({ hosp: 'UMC', cols: [] }, pz, 90), C.limiteAtraso({ hosp: 'Outro', cols: [] }, pz, 90)], [60, 90], 'limites');
      const rapido = C.prazosDePagamento(['a', 'b', 'c'].map((id) => paga(id, '2026-01-10', '2026-01-15')));
      igual(C.limiteAtraso({ hosp: 'UMC', cols: [] }, rapido, 90), 30, 'pelo menos 30 dias');
    });
    teste('Prazo e previsão', 'previsão de 30, 60 e 90 dias, atrasadas e sem previsão', () => {
      const pz = C.prazosDePagamento(historico());
      const item = (date, hosp, valor, aprox) => ({ r: { date, hosp, cols: [] }, valor, aprox: !!aprox });
      const p = C.previsaoRecebimento([item('2026-10-20', 'UMC', 100), item('2026-09-20', 'UMC', 200, true), item('2026-10-25', 'UMC', 50), item('2026-08-01', 'UMC', 300), item('2026-10-01', 'Outro', 70)], pz, '2026-10-27', 90);
      igual(p.faixas.map((f) => [f.ate, f.valor, f.n, f.aprox]), [[30, 200, 1, true], [60, 150, 2, false], [90, 0, 0, false]], 'faixas');
      igual([p.atrasadas.valor, p.semPrazo.valor, p.depois.n], [300, 70, 0], 'atrasadas e sem previsão');
    });

    // ---------- relatórios ----------
    const carteira = () => {
      const pg = (valor, data, extra) => ({ id: 'p' + valor + data, valor, data, origem: 'manual', ...(extra || {}) });
      const recs = [
        { id: 'r1', date: '2026-09-02', hosp: 'UMC', conv: 'Plano A', cols: ['Bruno'], devido: 444.02, devidoOrigem: 'repasse', devidoAntes: { valor: 500, origem: 'combinado' }, pagamentos: [pg(444.02, '2026-10-05', { origem: 'repasse', repId: 'A' })] },
        { id: 'r2', date: '2026-09-10', hosp: 'UMC', conv: 'Plano A', cols: ['Bruno', 'Lia'], devido: 300, devidoOrigem: 'repasse', pagamentos: [pg(300, '2026-10-05', { origem: 'repasse', repId: 'A' })] },
        { id: 'r3', date: '2026-08-20', hosp: 'HC', conv: 'Plano B', cols: ['Lia'], devido: 350, devidoOrigem: 'combinado', pagamentos: [pg(100, '2026-09-15', { fonte: 'Lia', parcial: true })] },
        { id: 'r4', date: '2026-09-25', hosp: null, conv: null, cols: [], devido: null, pagamentos: [] },
        { id: 'r5', date: '2026-09-26', hosp: 'HC', conv: null, cols: [], status: 'semcobranca', devido: null, pagamentos: [] },
        { id: 'r6', date: '2025-12-10', hosp: 'HC', conv: null, cols: ['Otávio'], devido: 900, devidoOrigem: 'combinado', pagamentos: [pg(1000, '2025-12-30')] }];
      const reps = [{ id: 'A', total: 744.02, caiu: 700, hosp: 'UMC', pay: '2026-10-05' }];
      const aberto = (r) => (r.id === 'r3' ? { valor: 250, aprox: false } : { valor: 200, aprox: true });
      return { recs, reps, aberto };
    };
    const soma = (m, k) => Math.round([...m.values()].reduce((t, o) => t + o[k], 0) * 100) / 100;
    teste('Relatórios', 'o que caiu na conta é dividido entre os pagamentos da planilha, sem perder centavo', () => {
      const { recs, reps } = carteira();
      const pags = C.pagamentosComValor(recs, reps).filter((x) => x.p.repId === 'A');
      igual([pags.map((x) => x.entrou), Math.round(pags.reduce((t, x) => t + x.entrou, 0) * 100) / 100], [[417.75, 282.25], 700], 'proporção');
      const comZero = C.pagamentosComValor([{ id: 'z', pagamentos: [{ valor: 0.01, data: '2026-10-05', origem: 'repasse', repId: 'B' }, { valor: 10, data: '2026-10-05', origem: 'repasse', repId: 'B' }, { valor: 0, data: '2026-10-05', origem: 'repasse', repId: 'B' }] }], [{ id: 'B', total: 10.01, caiu: 9 }]);
      igual(comZero.map((x) => x.entrou), [0.01, 8.99, 0], 'os centavos vão no maior; a linha de R$ 0,00 continua zero');
    });
    teste('Relatórios', 'os totais batem: mês da cirurgia, hospital, convênio e mês do pagamento', () => {
      const { recs, reps, aberto } = carteira(); const rel = C.relatorio(recs, reps, aberto); const t = rel.totais;
      igual([t.n, t.nRec, t.nAb, t.recebido, t.aReceber, t.aprox, t.entrou], [6, 3, 2, 1844.02, 450, true, 1800], 'totais');
      igual([soma(rel.mesCirurgia, 'recebido'), soma(rel.por.hospital, 'recebido'), soma(rel.por.convenio, 'recebido'), soma(rel.mesPagamento, 'recebido')], [1844.02, 1844.02, 1844.02, 1844.02], 'recebido em cada relatório');
      igual([soma(rel.mesCirurgia, 'aReceber'), soma(rel.por.hospital, 'aReceber'), soma(rel.mesCirurgia, 'n')], [450, 450, 6], 'a receber e quantidade');
      igual(soma(rel.mesPagamento, 'entrou'), Math.round((t.recebido - (744.02 - 700)) * 100) / 100, 'o que entrou = o liberado menos as retenções');
      igual(rel.por.hospital.get('Sem hospital').aReceber, 200, 'cirurgia sem hospital tem a linha dela');
    });
    teste('Relatórios', 'cirurgia com dois colegas entra nos dois', () => {
      const { recs, reps, aberto } = carteira(); const rel = C.relatorio(recs, reps, aberto);
      igual([rel.por.colega.get('Bruno').recebido, rel.por.colega.get('Lia').recebido, soma(rel.por.colega, 'recebido')], [744.02, 400, 2144.02], 'colegas');
    });
    teste('Relatórios', 'diferenças de valor: combinado × planilha e recebido a mais', () => {
      const { recs, reps, aberto } = carteira(); const d = C.relatorio(recs, reps, aberto).diferencas;
      igual(d.map((x) => [x.r.id, x.tipo, x.combinado || null, x.devido, x.recebido]), [['r1', 'combinado', 500, 444.02, 444.02], ['r6', 'a-mais', null, 900, 1000]], 'diferenças');
    });
    teste('Relatórios', 'ano para o Imposto de Renda: mês a mês, por fonte pagadora, hospital, colega e convênio', () => {
      const { recs, reps } = carteira(); const a = C.relatorioAnual(recs, reps, 2026);
      igual([a.meses[8], a.meses[9], a.total, a.totalEntrou, a.n], [100, 744.02, 844.02, 800, 3], 'meses e total');
      igual([...a.porFonte].map(([k, o]) => [k, o.total]), [['UMC', 744.02], ['Lia', 100]], 'fonte: o hospital da planilha; à mão, quem pagou');
      igual([soma(a.porFonte, 'total'), soma(a.porHospital, 'total'), soma(a.porConvenio, 'total')], [844.02, 844.02, 844.02], 'cada quadro soma o total');
      igual([...C.relatorioAnual(recs, reps, 2025).porFonte].map(([k, o]) => [k, o.total]), [['HC', 1000]], 'sem quem pagou, o hospital da cirurgia');
      igual(C.anosComPagamento(recs), ['2026', '2025'], 'anos');
    });

    // ---------- lembrete mensal ----------
    teste('Lembrete', 'evento todo mês no dia escolhido, começando no próximo, com o ritual', () => {
      const ics = C.lembreteIcs({ dia: 5, hora: '19:00', hoje: '2026-12-27', agora: new Date(Date.UTC(2026, 11, 27, 15, 0, 0)) });
      const linhas = ics.split('\r\n');
      verdade(linhas.includes('DTSTART:20270105T190000') && linhas.includes('RRULE:FREQ=MONTHLY;BYMONTHDAY=5') && linhas.includes('DTSTAMP:20261227T150000Z'), 'começa em 05/01/2027, às 19h, e repete todo dia 5');
      verdade(linhas.every((l) => new TextEncoder().encode(l).length <= 75), 'linhas de até 75 bytes');
      const texto = ics.replace(/\r\n /g, '');
      verdade(texto.includes('SUMMARY:Controle de Cirurgias: conversa\\, planilha e backup') && texto.includes('3. Faça um backup.'), 'título e passos');
      igual(C.lembreteIcs({ dia: 30, hora: '7:5', hoje: '2026-10-03' }).match(/DTSTART:(\S+)/)[1], '20261028T070500', 'dia até 28, hora completada');
    });

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

    // ---------- urgência e feriados ----------
    teste('Urgência e feriados', 'Páscoa de 2026 em 5 de abril e Sexta-feira Santa como feriado', () => { igual(C.easter(2026), '2026-04-05', 'Páscoa'); verdade(C.isHoliday('2026-04-03'), 'Sexta-feira Santa'); });
    teste('Urgência e feriados', 'feriado nacional e feriado da cidade', () => {
      verdade(C.isHoliday('2026-09-07'), '7 de setembro'); verdade(!C.isHoliday('2026-08-31'), '31/08 sem estar na lista');
      verdade(C.isHoliday('2026-08-31', C.parseExtraHolidays('31/08')), '31/08 na lista da cidade');
    });
    teste('Urgência e feriados', 'lê a lista de feriados da cidade (dia/mês)', () => igual(C.parseExtraHolidays('31/08; 1/1'), ['08-31', '01-01'], 'feriados'));
    teste('Urgência e feriados', 'aceita feriado com ano, como 04/06/2026, que vale só naquele ano', () => {
      const f = C.parseExtraHolidays('04/06/2026');
      igual([f, C.isHoliday('2026-06-04', f), C.isHoliday('2027-06-04', f)], [['2026-06-04'], true, false], 'feriado de 2026');
    });
    teste('Urgência e feriados', 'Carnaval (segunda e terça) e Corpus Christi, calculados pela Páscoa', () => {
      const f = C.parseExtraHolidays('31/08, carnaval, corpus christi');
      igual(f, ['08-31', 'carnaval', 'corpus'], 'lista');
      igual(['2026-02-16', '2026-02-17', '2026-02-18', '2026-06-04', '2027-02-08', '2027-02-09', '2027-05-27'].map((d) => C.isHoliday(d, f)), [true, true, false, true, true, true, true], 'datas');
      igual([C.isHoliday('2026-02-17', []), C.isHoliday('2026-06-04', [])], [false, false], 'sem escolher, não contam');
    });
    teste('Urgência e feriados', 'data que não existe fica de fora', () => igual(C.parseExtraHolidays('31/02, 30/02/2026, 29/02'), ['02-29'], 'datas'));
    teste('Urgência e feriados', 'limites do horário: 18h59 normal, 19h urgência, 6h59 urgência, 7h normal', () =>
      igual(['18:59', '19:00', '06:59', '07:00'].map((h) => C.isUrgent('2026-09-15', h, [])), [false, true, true, false], 'terça-feira'));
    teste('Urgência e feriados', 'sábado, domingo e feriado contam o dia todo', () =>
      igual([C.isUrgent('2026-09-19', '10:00', []), C.isUrgent('2026-09-20', null, []), C.isUrgent('2026-09-07', '10:00', [])], [true, true, true], 'urgência'));
    teste('Urgência e feriados', 'dia útil sem hora fica indefinido', () => igual(C.isUrgent('2026-09-15', null, []), null, 'terça sem hora'));
    teste('Urgência e feriados', 'toda cirurgia nesse horário conta como urgência, eletiva ou não', () => verdade(C.isUrgent('2026-09-15', '20:00', []) === true, 'terça às 20h'));
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
