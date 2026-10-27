/* Roda os testes do núcleo no navegador e mostra o resultado. Não usa o banco do app nem guarda nada. */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const ROTULO = { ok: ['ok', 'ok'], 'falha esperada': ['esperada', 'esperada'], falhou: ['falhou', 'falhou'], passou: ['passou', 'passou'] };
  const io = {
    texto: (n) => fetch('dados/' + n, { cache: 'no-cache' }).then((r) => { if (!r.ok) throw new Error('não achei ' + n); return r.text(); }),
    blob: (n) => fetch('dados/' + n, { cache: 'no-cache' }).then((r) => { if (!r.ok) throw new Error('não achei ' + n); return r.blob(); }),
  };

  function mostrar(res) {
    const s = window.TestesNucleo.resumo(res);
    const box = $('#resumo'); box.replaceChildren(); box.classList.remove('rodando');
    if (s.falharam) {
      box.classList.add('vermelho');
      box.append(el('b', null, `${s.falharam} ${s.falharam === 1 ? 'teste falhou' : 'testes falharam'}`), el('span', null, 'Algo mudou no comportamento do app. Mande um print desta página para o Claude.'));
    } else if (s.corrigidas) {
      box.classList.add('azul');
      box.append(el('b', null, `${s.corrigidas} ${s.corrigidas === 1 ? 'problema conhecido agora passa' : 'problemas conhecidos agora passam'}`), el('span', null, 'Ótimo sinal: avise o Claude para transformar em teste normal.'));
    } else {
      box.classList.add('verde');
      box.append(el('b', null, 'Tudo certo'), el('span', null, `${s.ok} testes passaram. ${s.esperadas} falhas esperadas: problemas já anotados no roteiro, com o número do item.`));
    }
    const lista = $('#lista'); lista.replaceChildren();
    const ordem = ['falhou', 'passou', 'falha esperada', 'ok'];
    const grupos = new Map();
    for (const r of res) { if (!grupos.has(r.grupo)) grupos.set(r.grupo, []); grupos.get(r.grupo).push(r); }
    for (const [g, itens] of grupos) {
      const sec = el('section', 'grupo'); sec.append(el('h2', null, g));
      const ul = el('ul');
      for (const r of [...itens].sort((a, b) => ordem.indexOf(a.situacao) - ordem.indexOf(b.situacao))) {
        const li = el('li'); const [cls, txt] = ROTULO[r.situacao];
        const nome = el('span', 'nome', r.nome);
        if (r.item) { nome.append(' '); nome.append(el('span', 'item', '(' + r.item + ')')); }
        li.append(el('span', 'pill ' + cls, txt), nome);
        if (r.situacao === 'falha esperada' && r.detalhe) { const d = el('details', 'detalhe'); d.append(el('summary', null, 'ver o que o app faz hoje'), el('span', null, r.detalhe)); li.append(d); }
        else if (r.situacao !== 'ok' && r.detalhe) li.append(el('span', 'detalhe', r.detalhe));
        ul.append(li);
      }
      sec.append(ul); lista.append(sec);
    }
    const agora = new Date();
    $('#rodape').textContent = `${s.total} testes, rodados em ${agora.toLocaleDateString('pt-BR')} às ${agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.`;
  }

  if (!window.Core || !window.TestesNucleo) { $('#resumo').replaceChildren(el('b', null, 'Não consegui carregar os arquivos dos testes.')); return; }
  window.TestesNucleo.rodar(window.Core, io).then(mostrar).catch((e) => {
    const box = $('#resumo'); box.className = 'resumo vermelho'; box.replaceChildren(el('b', null, 'Os testes não rodaram'), el('span', null, String(e && e.message || e)));
  });
})();
