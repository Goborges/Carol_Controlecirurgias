# ROADMAP — Controle de Cirurgias

Acompanha o roteiro do documento "Prompt do projeto — Controle de Cirurgias". A numeração dos itens é a mesma do documento.

**Status:** feito · em andamento · pendente · descartado

| | |
|---|---|
| Versão do app entregue | 1.10 (27/10/2026, pull request no GitHub) |
| Versão publicada no GitHub | 1.10 (27/10/2026) |
| Forma de entrega | Em lotes de 3 a 5 itens (pedido de 27/10/2026). Desde a 1.6, o Claude publica direto no GitHub: cada lote é um pull request, já aprovado (o Gustavo deu permissão total). Para desfazer um lote, use o botão Revert do pull request. |
| Uso real | A Carol ainda não instalou nem usa o app (confirmado em 26/10/2026): não há dados reais a proteger até ela começar. |
| Última atualização deste arquivo | 27/10/2026 |
| Próximo passo | Itens 27, 31 e 34, que fecham a fase P4. O item 27 muda a navegação do jeito que o documento já decidiu (Início · Cirurgias · + · Recebimentos · Relatórios, com Ajustes num ícone no topo do Início). O item 31 conflita com o pedido de 26/10 (Início só com pendências de cadastro): vale o documento, e o Claude avisa na entrega. No item 34, o Face ID só entra se funcionar bem no app instalado. |
| Como decidir | Pedido do Gustavo em 27/10/2026: não travar o trabalho com perguntas pequenas. Regra de pagamento que ele não sabe e que não atrapalha o controle fica como está, anotada aqui, e o trabalho segue. Perguntar só o que for irreversível ou mudar a navegação. |

## P0 — Preservar, auditar e montar a rede de segurança

| Nº | Item | Status | Observações |
|---|---|---|---|
| 1 | Auditar o repositório (arquivos atuais e histórico) | feito (26/10/2026) | 3 commits, todos de 25/10: `README.md`, `registro-cirurgias.zip` (o pacote do próprio app, sem dados) e os 6 arquivos do app 1.0. Nenhuma conversa, foto, planilha ou nome real, nem no histórico. Nada a remover. |
| 2 | Congelar a v1.3 e fazer backup dos dados da Carol antes de atualizar | feito (27/10/2026) | Cópia congelada em `versoes/app-cirurgias-1.3.zip`. Backup dispensado: a Carol ainda não usa o app. O formato salvo é o mesmo da 1.0 à 1.4 (banco `registro-cirurgias` versão 1, mesmos stores). |
| 3 | Testes automáticos do núcleo (Node) com fixtures anonimizadas | feito (27/10/2026, v1.5) | 69 testes em `testes/nucleo.test.js` (67 na 1.5, mais 2 de foto danificada no backup na 1.6), com dados inventados em `testes/dados/`: conversa do iPhone com fotos, a mesma conversa com uma legenda editada, conversa do Android e planilha no formato da UMC. Rodam no navegador (`testes/`) e no Node. 11 falhas esperadas: itens 15 (2), 16, 18, 19, 20 (2), 21, 23 e 25 (2). Na 1.8: 82 testes, com 2 falhas esperadas (itens 23 e 25); a do item 18 saiu quando o item foi descartado. Na 1.9: 98 testes, sem falha esperada (as dos itens 23 e 25 viraram testes normais). Na 1.10: 103 testes. Achado novo, registrado como comportamento atual para decidir depois: uma anotação de texto sem cirurgia vira ficha "Sem procedimento". A glosa (item 24) foi descartada. |
| 4 | Roteiro de teste manual no iPhone | feito (27/10/2026, v1.6) | `ROTEIRO-TESTE.md`, com os dados inventados de `testes/dados`. Novo modo de teste: o endereço com `?teste` usa outro banco (`registro-cirurgias-teste`), mostra uma faixa e não convida a instalar. |
| 5 | Infraestrutura de atualização: versão dos dados com migrações, aviso "Nova versão disponível", botão "Copiar diagnóstico" | feito (27/10/2026, v1.6) | Versão dos dados em `settings.dataVersion`, com migrações numeradas em `MIGRATIONS` (a 1 é a dos nomes padrão, que já existia). A versão vai junto no backup, e restaurar um backup antigo roda as migrações que faltam. Uma migração pode guardar uma cópia das listas antes de mexer. O aviso de versão nova aparece com o app aberto, e o app confere ao voltar para a tela e a cada hora. "Copiar diagnóstico" leva versão, contagens e os últimos erros, sem nenhum dado das cirurgias. O app também abre o banco quando uma versão mais nova já o atualizou: voltar de versão nunca deixa os dados de fora. |
| 6 | Dividir o código, se necessário | feito (27/10/2026, v1.4) | Adiantado. O app agora é publicado em arquivos separados (`index.html`, `style.css`, `core.js`, `ui.js`), sem etapa de build: o GitHub guarda o próprio código. O `sw.js` passou a buscar sempre a versão nova quando há internet e a usar a cópia sem internet. Testado: passagem da 1.3 para a 1.4 com os dados mantidos, abertura sem internet e atualização seguinte na primeira recarga. O `ui.js` segue com 131 KB; dividir em módulos só se ficar difícil de editar. |

## P1 — Proteger os dados

| Nº | Item | Status | Observações |
|---|---|---|---|
| 7 | Backup que aguenta o crescimento (em partes) | feito (27/10/2026, v1.6) | Partes de até 40 MB, montadas uma de cada vez e salvas uma por vez. A parte 1 leva os dados. Com uma parte só, o arquivo tem o mesmo formato de antes. Testado: nenhum passo lê todas as fotos juntas. |
| 8 | Backup na hora certa (logo depois de cada importação) | feito (27/10/2026, v1.6) | Convite "Faça um backup agora" no fim da importação da conversa (avisando que o .zip do WhatsApp pode ser apagado depois) e da planilha. O lembrete de 30 dias continua. |
| 9 | Restauração segura (validar antes, trocar no final) | feito (27/10/2026, v1.6) | Antes de pedir confirmação, o app confere as partes, cada foto (código CRC) e o espaço livre. Depois grava só as fotos que faltam e troca os dados numa transação única: se algo falhar, nada muda. Aceita várias partes de uma vez e os backups das versões antigas. Testado com parte faltando, parte danificada e backup da 1.5. |
| 10 | Lixeira de 30 dias, "Desfazer" e recuperar ignoradas | feito (27/10/2026, v1.7) | Excluir uma cirurgia, apagar uma foto sem legenda ou tirar uma foto de uma ficha manda para a lixeira (lista `trash`), com as fotos, e o aviso ganha "Desfazer". Em Ajustes > Lixeira: recuperar, e a lista "Mensagens que o app ignora", com "Trazer de volta" (a mensagem volta na próxima importação). Depois de 30 dias o item sai de vez. Cada mensagem ignorada guarda o motivo (excluída, apagada, organizada, juntada). |
| 11 | Desfazer importação do WhatsApp | feito (27/10/2026, v1.7) | Cada importação tem um número (lista `imports`); fichas e fotos sem legenda levam esse número, e as fotos postas em fichas que já existiam ficam anotadas nela. Desfazer pelo "Pronto!" da importação ou em Ajustes > Conversas do WhatsApp. Avisa quando há cirurgias com mudanças dela (pagamento, edição). Sem lixeira: trazer a conversa de novo traz tudo de volta. Só vale para importações da 1.7 em diante. |
| 12 | Importação que não se perde (lotes, retomar, limpar órfãs) | feito (27/10/2026, v1.7) | Cada cirurgia entra com as suas fotos e o seu número assim que fica pronta. Se o app fechar no meio, o Início avisa que a importação não terminou; escolher o arquivo de novo traz só o que faltou, na mesma importação. Fotos guardadas sem ficha saem ao abrir o app (menos quando há outra janela do app aberta). A numeração das fichas nunca volta. A tela de importação não fecha enquanto guarda as fotos. |
| 13 | Miniaturas separadas das originais (com migração) | feito (27/10/2026, v1.7) | Lista nova `thumbs` (banco na versão 2) e migração 2: copia cada miniatura, uma foto por vez; a antiga fica no registro da foto como cópia. Falta, numa versão futura, a migração 3, que apaga essa cópia depois de a 1.7 rodar sem problema. Mostrar miniaturas não lê mais a foto inteira (testado). Backup e restauração já usam a lista nova e continuam no mesmo formato. Testado: passagem da 1.6 para a 1.7 no mesmo endereço, volta para a 1.6 e ida de novo, com uma janela antiga aberta. |
| 14 | Blindar a privacidade: sem fonte do Google, Content-Security-Policy, explicar a origem compartilhada | feito (27/10/2026, v1.7) | A fonte do Google saiu (no iPhone, os títulos já usavam a SF Pro Rounded) e entrou a regra de segurança (CSP) no `index.html` e na página dos testes, que bloqueia conexões com outros sites (testado: nenhum pedido para fora). Endereço compartilhado: todo site da conta Goborges no GitHub Pages fica em goborges.github.io e, no navegador, divide os dados com o app. Decisão do Gustavo em 27/10/2026: manter o endereço, com a regra de não publicar outros sites no GitHub Pages da conta Goborges, e a Carol usar o app pelo ícone na Tela de Início. Opções descartadas: organização só do app (endereço novo) e domínio próprio (custo anual). |

## P2 — Números corretos

| Nº | Item | Status | Observações |
|---|---|---|---|
| 15 | "VLP" antes do procedimento | feito (27/10/2026, v1.8) | "VLP colecisto" e "VLP colecistectomia" viram só Colecistectomia videolaparoscópica (antes, também a aberta, e a estimativa somava as duas). O "VLP" solto vale para o procedimento do mesmo trecho da legenda; sem ele, para o do trecho anterior. Testes de falha esperada viraram testes normais, mais dois casos novos. |
| 16 | Hora do envio não é hora da cirurgia | feito (27/10/2026, v1.8) | Sem hora na legenda, a ficha fica sem hora (a hora do envio fica guardada à parte). O app só pede para conferir quando ela muda o valor: "Confira a hora" (envio entre 19h e 7h em dia útil, considerando os feriados da cidade) e "Confira a data" (envio de madrugada). Salvar a edição tira esses avisos. Quando a planilha casa, valem a data e a hora dela (a de antes fica guardada, e desfazer a planilha devolve). A hora do envio continua como pista para casar a planilha com a ficha certa. Migração 3, com cópia das fichas antes: tira a hora do envio das fichas antigas (as que ela editou não mudam). Junto, parte do item 25: linha da planilha sem hora fica sem hora, e não meia-noite. Efeito nos dados reais de teste: o "a receber" estimado caiu cerca de 5%, porque as cirurgias postadas à noite deixam de ganhar os 30% até a hora ser confirmada. |
| 17 | Eletiva × urgência e hora de término | descartado (27/10/2026) | O Gustavo não sabe a regra dos pagadores dela e decidiu seguir sem o item: não atrapalha o controle. Fica como está: `isUrgent` trata todo horário especial como urgência, e a hora de término não é pedida. |
| 18 | Estimativa por função e convênio, com base visível | descartado (27/10/2026) | O Gustavo decidiu seguir sem o item: não atrapalha o controle. Fica como está: a estimativa usa a mediana por procedimento (ou família), sem separar função nem convênio, e o segundo procedimento conta pela metade. O teste de falha esperada do item saiu. |
| 19 | Feriados móveis (Carnaval, Corpus Christi) e datas com ano | feito (27/10/2026, v1.8) | Em Ajustes > Feriados da cidade: Carnaval (segunda e terça) e Corpus Christi como opções, calculados pela Páscoa, e datas com ano (04/06/2026 vale só naquele ano). Data que não existe é recusada. Continua guardado num texto só, que as versões antigas sabem ler. |
| 20 | Legenda editada vira duplicata | feito (27/10/2026, v1.8) | O aviso "Esta mensagem foi editada" sai do texto e marca a mensagem. A importação reconhece a ficha pela hora exata (com segundos) e pelo número de fotos, sem mudar o formato das chaves: a chave nova entra na ficha e a antiga fica guardada (`chavesAntigas`), para a conversa antiga não duplicar. A tela da importação mostra o antes e o depois. Ficha ainda não mexida (nem paga): o app relê a legenda; ficha mexida: só troca o texto e pede conferência ("Legenda editada"). Desfazer a importação devolve a ficha como era; se ela mexeu na ficha depois (pagamento, edição), volta só a legenda. O teste da chave igual foi trocado pelo de reconhecimento. |
| 21 | Colegas com o mesmo primeiro nome | feito (27/10/2026, v1.8) | `mapExecutor` não liga mais sozinho pelo primeiro nome: a planilha pergunta "É a mesma pessoa que Bruno?" na primeira vez que um nome completo aparece, e guarda a resposta. Se o colega já tem outro nome completo, ou se dois nomes completos diferentes com o mesmo primeiro nome aparecem na mesma planilha, o app parte de "colega novo" e deixa escolher o colega. |

## P3 — Financeiro e conciliação do repasse

| Nº | Item | Status | Observações |
|---|---|---|---|
| 22 | Modelo financeiro com migração (estimativa, valor devido, recebimentos, saldo) | feito (27/10/2026, v1.9) | Cada ficha tem valor devido (`devido`, combinado por ela ou da planilha; vazio = a definir) e a lista de pagamentos (`pagamentos`). Saldo e situação são calculados: a receber, parcial, recebida e sem cobrança (glosada e contestada saíram com os itens 24 e 30). Migração 4, com cópia das fichas antes. `status`, `recebido` e `valorPrevisto` continuam gravados como espelho, para a 1.8 abrir os dados se for preciso voltar; ao abrir a 1.9 de novo, o que ela fez na 1.8 entra no modelo novo (testado). A ficha ganhou o bloco Financeiro: valor devido, cada pagamento (com Corrigir) e o saldo; a estimativa aparece com ≈ só enquanto não há valor devido. O "Para receber" mostra "R$ X confirmados + ≈ R$ Y estimados". Limite conhecido: na 1.8, desfazer uma planilha de complemento tira também o pagamento da primeira planilha naquela cirurgia. |
| 23 | Pagamentos parciais e complementos | feito (27/10/2026, v1.9) | "Já recebi" e "Pagamento recebido" aceitam uma parte ("Não, só uma parte" e quanto falta, que vira valor devido). O cruzamento procura primeiro as cirurgias a receber, inclusive as pagas em parte, e depois as já pagas: o que casa muito bem com uma já paga vira complemento e soma. Se ela tinha registrado à mão o mesmo valor (ou sem valor), é o mesmo pagamento: não soma, e a planilha passa a ser o registro dele (desfazer a planilha devolve o registro dela). Na referência da estimativa, o complemento soma na linha da cirurgia. |
| 24 | Glosa não é recebimento | descartado (27/10/2026) | O Gustavo não quer mais. |
| 25 | Revisão completa da planilha antes de gravar | feito (27/10/2026, v1.9) | Antes de gravar: "Confira" (outra cirurgia parecida, complemento, data ou valor combinado diferentes, certeza baixa), "Já estavam no app" e "Não estavam no app". Dá para trocar a cirurgia, ligar à mão uma linha nova, dizer que é outra cirurgia e separar um ato agrupado ("Separar em N" e "Juntar de novo"). O app separa sozinho quando o mesmo procedimento aparece mais de uma vez no ato sem hora e há uma cirurgia dele para cada linha (as duas de 17/09 da planilha de exemplo agora ficam pagas: 6 em vez de 5). A parte da linha sem hora foi feita na 1.8. Os testes de falha esperada dos itens 23 e 25 viraram testes normais. |
| 26 | Quanto caiu de fato na conta | feito (27/10/2026, v1.9) | Na importação, "Quanto caiu na conta?" (opcional), com a diferença para o liberado; dá para anotar depois em Ajustes > Planilhas de repasse > Quanto caiu. O "Recebido no mês" usa o que caiu, quando anotado, para bater com o extrato. |

## P4 — Recebimentos e uso diário

| Nº | Item | Status | Observações |
|---|---|---|---|
| 27 | Aba Recebimentos; Ajustes vira ícone no topo do Início | pendente | Muda a navegação: Início · Cirurgias · + · Recebimentos · Relatórios. |
| 28 | Prazo típico e previsão de 30, 60 e 90 dias | feito (27/10/2026, v1.10) | O prazo de costume de cada hospital, convênio e colega vem do histórico: dias entre a cirurgia e o primeiro pagamento com valor (o "Já recebi" sem valor não conta), com pelo menos 3 cirurgias pagas. Vale o do hospital; sem ele, o do convênio; depois, o do colega. A ficha diz "Deve cair por volta de…" (pela mediana). "Atrasada" passa do prazo em que 9 de cada 10 pagamentos daquele pagador chegaram (no mínimo 30 dias); sem histórico, continuam os dias de Ajustes (90). Relatórios > Meses ganhou "Quando deve cair": próximos 30, 60 e 90 dias; sem histórico de quem paga, a cirurgia fica sem previsão, em vez de inventar uma data. Na aba Recebimentos (item 27), a previsão vai para lá. |
| 29 | Cobrar (mensagem pronta para o WhatsApp) | descartado (27/10/2026) | O Gustavo não quer mais. |
| 30 | Contestação acompanhada | descartado (27/10/2026) | O Gustavo não quer mais. |
| 31 | "Precisa de atenção" no Início (até 3 linhas) | pendente | Conflita com o pedido de 26/10 (Início só com pendências de cadastro; atrasos em Relatórios). Vale o documento; confirmar ao chegar neste item. |
| 32 | Salvar a edição conta como conferida | feito (27/10/2026, v1.10) | Salvar a edição tira todos os avisos da importação ("Procedimento novo", hora do envio, legenda editada, conversão ou observação). O que continua em branco (procedimento, hospital, colega) segue em Para completar até ser preenchido ou até "Está tudo certo". |
| 33 | Lembrete mensal no Calendário (.ics) | feito (27/10/2026, v1.10) | Em Ajustes > Lembrete no Calendário: dia do mês (1 a 28, padrão 5) e hora (padrão 19h). O app gera um evento que se repete todo mês, com o ritual: exportar a conversa, trazer a planilha, fazer backup. Ela salva o arquivo e abre em Arquivos para adicionar ao Calendário. Falta conferir no iPhone (passo 8 do roteiro): o navegador do computador não abre o Calendário do iPhone. |
| 34 | Acabamento de iPhone: Face ID, fechar arrastando, tamanho de letra | pendente | Face ID só se funcionar bem no app instalado. |

## P5 — Relatórios e acabamento

| Nº | Item | Status | Observações |
|---|---|---|---|
| 35 | Relatórios que respondem perguntas, com totais testados e CSV no novo modelo | pendente | |
| 36 | Relatório anual por fonte pagadora (PDF pela impressão) | pendente | Testar a impressão no app instalado; a prévia não imprime. |
| 37 | Backup criptografado (opcional) | pendente | Só depois de definir como ela recupera o acesso. |

## Fora do escopo

Nuvem, servidor, contas ou sincronização; integração bancária; IA ou OCR nas fotos; app nativo na App Store; dados de paciente de qualquer tipo; relatórios além dos da P5.

## Histórico de entregas

| Data | Entrega |
|---|---|
| 26/10/2026 | ROADMAP criado. Item 1 feito: repositório e histórico sem dados reais. |
| 27/10/2026 | Versão 1.4: itens 2 e 6. App em arquivos separados, cópia da 1.3 guardada em `versoes/`. Nada muda para quem usa. |
| 27/10/2026 | Versão 1.5: item 3. Testes do núcleo e página de testes. O `sw.js` foi corrigido: abrir outra página do endereço, como a dos testes, podia tomar o lugar do app na cópia usada sem internet. Nada muda para quem usa. |
| 27/10/2026 | Versão 1.6, em lote: itens 4, 5, 7, 8 e 9. Modo de teste e roteiro de teste, versão dos dados e aviso de versão nova, diagnóstico, backup em partes, backup depois das importações e restauração segura. Leva também a pasta `testes/` da 1.5, que não subiu com ela. Primeira publicada pelo Claude direto no GitHub. |
| 27/10/2026 | Versão 1.7, em lote: itens 10 a 14. Lixeira de 30 dias com Desfazer e mensagens ignoradas, desfazer importação do WhatsApp, importação que continua de onde parou, miniaturas numa lista separada (banco na versão 2, com migração) e regra de segurança sem fonte de fora. Pull request #2. |
| 27/10/2026 | Item 14 fechado: o Gustavo decidiu manter o endereço goborges.github.io, sem publicar outros sites na conta. Fim da fase P1. Só documentação, sem versão nova do app. |
| 27/10/2026 | Versão 1.8, em lote: itens 15, 16, 19, 20 e 21, e a parte do item 25 sobre linha sem hora. "VLP" antes do procedimento, hora do envio separada da hora da cirurgia (migração 3), feriados móveis, legenda editada sem duplicar e confirmação de colegas com o mesmo primeiro nome. Pull request #4. |
| 27/10/2026 | Itens 17, 18, 24, 29 e 30 descartados a pedido do Gustavo: o cálculo continua como está. Fim da fase P2. |
| 27/10/2026 | Versão 1.9, em lote: itens 22, 23, 25 e 26. Valor devido, pagamentos e saldo em cada cirurgia (migração 4, com cópia antes), pagamento em parte, complemento e "mesmo pagamento" no cruzamento, revisão da planilha antes de gravar (ligar, separar) e quanto caiu na conta. Fim da fase P3. Pull request #5. |
| 27/10/2026 | Versão 1.10, em lote: itens 28, 32 e 33. Prazo de costume de quem paga, com "atrasada" por esse prazo e a previsão de 30, 60 e 90 dias em Relatórios; salvar a edição conta como conferida; lembrete mensal no Calendário. Sem mudança no formato dos dados. Pull request #6. |
