# ROADMAP — Controle de Cirurgias

Acompanha o roteiro do documento "Prompt do projeto — Controle de Cirurgias". A numeração dos itens é a mesma do documento.

**Status:** feito · em andamento · pendente · descartado

| | |
|---|---|
| Versão do app entregue | 1.7 (27/10/2026, pull request no GitHub) |
| Versão publicada no GitHub | 1.7 (27/10/2026) |
| Forma de entrega | Em lotes de 3 a 5 itens (pedido de 27/10/2026). Desde a 1.6, o Claude publica direto no GitHub: cada lote é um pull request, já aprovado (o Gustavo deu permissão total). Para desfazer um lote, use o botão Revert do pull request. |
| Uso real | A Carol ainda não instalou nem usa o app (confirmado em 26/10/2026): não há dados reais a proteger até ela começar. |
| Última atualização deste arquivo | 27/10/2026 |

## P0 — Preservar, auditar e montar a rede de segurança

| Nº | Item | Status | Observações |
|---|---|---|---|
| 1 | Auditar o repositório (arquivos atuais e histórico) | feito (26/10/2026) | 3 commits, todos de 25/10: `README.md`, `registro-cirurgias.zip` (o pacote do próprio app, sem dados) e os 6 arquivos do app 1.0. Nenhuma conversa, foto, planilha ou nome real, nem no histórico. Nada a remover. |
| 2 | Congelar a v1.3 e fazer backup dos dados da Carol antes de atualizar | feito (27/10/2026) | Cópia congelada em `versoes/app-cirurgias-1.3.zip`. Backup dispensado: a Carol ainda não usa o app. O formato salvo é o mesmo da 1.0 à 1.4 (banco `registro-cirurgias` versão 1, mesmos stores). |
| 3 | Testes automáticos do núcleo (Node) com fixtures anonimizadas | feito (27/10/2026, v1.5) | 69 testes em `testes/nucleo.test.js` (67 na 1.5, mais 2 de foto danificada no backup na 1.6), com dados inventados em `testes/dados/`: conversa do iPhone com fotos, a mesma conversa com uma legenda editada, conversa do Android e planilha no formato da UMC. Rodam no navegador (`testes/`) e no Node. 11 falhas esperadas: itens 15 (2), 16, 18, 19, 20 (2), 21, 23 e 25 (2). Achado novo, registrado como comportamento atual para decidir depois: uma anotação de texto sem cirurgia vira ficha "Sem procedimento". A glosa (item 24) é tratada na tela, não no núcleo; o teste entra quando o item for feito. |
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
| 14 | Blindar a privacidade: sem fonte do Google, Content-Security-Policy, explicar a origem compartilhada | em andamento (v1.7) | Feito: a fonte do Google saiu (no iPhone, os títulos já usavam a SF Pro Rounded) e entrou a regra de segurança (CSP) no `index.html` e na página dos testes, que bloqueia conexões com outros sites (testado: nenhum pedido para fora). Falta: a decisão do Gustavo sobre o endereço compartilhado. Opções explicadas em 27/10/2026: manter, sem publicar outros sites na conta Goborges; mover para uma organização gratuita do GitHub só do app, de preferência antes de a Carol instalar; ou domínio próprio, com custo anual. |

## P2 — Números corretos

| Nº | Item | Status | Observações |
|---|---|---|---|
| 15 | "VLP" antes do procedimento | pendente | Confirmado: "VLP colecisto" vira Colecistectomia videolaparoscópica + Colecistectomia. |
| 16 | Hora do envio não é hora da cirurgia | pendente | Confirmado: sem hora na legenda, a ficha usa a hora da mensagem. |
| 17 | Eletiva × urgência e hora de término | pendente | Confirmado: `isUrgent` trata todo horário especial como urgência. Antes de mudar, confirmar a regra que vale para os pagadores dela. |
| 18 | Estimativa por função e convênio, com base visível | pendente | A estimativa usa só a mediana por procedimento (ou família), sem separar função nem convênio. A referência por convênio já existe, mas só na conferência de urgência. Segundo procedimento: sempre 50%. |
| 19 | Feriados móveis (Carnaval, Corpus Christi) e datas com ano | pendente | Confirmado: só aceita dia/mês; uma data com ano é ignorada. |
| 20 | Legenda editada vira duplicata | pendente | Confirmado: a chave da mensagem usa data e hora com segundos mais o começo do texto. |
| 21 | Colegas com o mesmo primeiro nome | pendente | Confirmado: `mapExecutor` liga um nome completo novo pelo primeiro nome, sem perguntar. |

## P3 — Financeiro e conciliação do repasse

| Nº | Item | Status | Observações |
|---|---|---|---|
| 22 | Modelo financeiro com migração (estimativa, valor devido, recebimentos, saldo) | pendente | Hoje cada ficha tem `status`, `recebido` (um pagamento) e `valorPrevisto`. |
| 23 | Pagamentos parciais e complementos | pendente | Confirmado: `planRepasse` só procura fichas em aberto. |
| 24 | Glosa não é recebimento | pendente | |
| 25 | Revisão completa da planilha antes de gravar | pendente | Confirmado: `groupActs` junta num ato só duas cirurgias do mesmo dia e colega quando a planilha não tem hora. Achado no item 3: linha sem hora vira 00:00 e conta como urgência. |
| 26 | Quanto caiu de fato na conta | pendente | |

## P4 — Recebimentos e uso diário

| Nº | Item | Status | Observações |
|---|---|---|---|
| 27 | Aba Recebimentos; Ajustes vira ícone no topo do Início | pendente | Muda a navegação: Início · Cirurgias · + · Recebimentos · Relatórios. |
| 28 | Prazo típico e previsão de 30, 60 e 90 dias | pendente | Hoje "atrasada" é mais de 90 dias para todos (ajustável em Ajustes). |
| 29 | Cobrar (mensagem pronta para o WhatsApp) | pendente | |
| 30 | Contestação acompanhada | pendente | |
| 31 | "Precisa de atenção" no Início (até 3 linhas) | pendente | Conflita com o pedido de 26/10 (Início só com pendências de cadastro; atrasos em Relatórios). Vale o documento; confirmar ao chegar neste item. |
| 32 | Salvar a edição conta como conferida | pendente | Hoje salvar só tira o aviso "Sem procedimento". |
| 33 | Lembrete mensal no Calendário (.ics) | pendente | |
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
