# Roteiro de teste no iPhone

Use depois de cada lote publicado no GitHub. Leva uns 30 minutos e nunca mexe nos dados da Carol: tudo acontece no **modo de teste**, um banco separado, com dados inventados.

Endereço do app: `goborges.github.io/Carol_Controlecirurgias`

## Antes de começar: baixar os arquivos de exemplo

No Safari do iPhone, abra cada endereço abaixo e toque em **Baixar**. Se abrir uma prévia, toque em **Compartilhar → Salvar em Arquivos**.

1. `goborges.github.io/Carol_Controlecirurgias/testes/dados/conversa-iphone.zip`
2. `goborges.github.io/Carol_Controlecirurgias/testes/dados/EXEMPLO_LTDA_-_Repasse_-_900001_-_Comp._09.xlsx`
3. `goborges.github.io/Carol_Controlecirurgias/testes/dados/conversa-iphone-editada.txt` (a mesma conversa, com uma legenda editada)

Os três ficam em **Arquivos → Downloads**. São inventados: colegas Bruno, Lia e Otávio, pacientes fictícios.

Desde a versão 1.11, **Ajustes** fica no ícone de engrenagem, no topo do **Início**. Onde o roteiro diz "Em Ajustes", toque nesse ícone.

## 1. Testes automáticos

Abra `goborges.github.io/Carol_Controlecirurgias/testes/`.

**Deve aparecer:** "Tudo certo" em verde.

## 2. Entrar no modo de teste

Abra `goborges.github.io/Carol_Controlecirurgias/?teste` no Safari. Não instale esse endereço na Tela de Início.

**Deve aparecer:** a faixa amarela "Modo de teste" no topo e a tela de boas-vindas, vazia.

## 3. Trazer a conversa de exemplo

Toque em **Começar → Escolher o arquivo** e escolha `conversa-iphone.zip` em Downloads.

**Deve aparecer:**
- "Quem é quem?" com Bruno, Lia e Otávio como colegas. Toque em **Continuar**.
- "12 cirurgias encontradas". Toque em **Trazer para o app**.
- "Pronto! 12 cirurgias novas no app", com "2 fotos para organizar, 3 para completar" e o convite "Faça um backup agora".

Agora teste o desfazer: no "Pronto!", toque em **Desfazer esta importação** e confirme.

**Deve aparecer:** a tela de boas-vindas, vazia de novo. Repita este passo 3 para trazer a conversa outra vez. Desta vez o app não pergunta "Quem é quem?", porque já guardou a resposta.

Depois, em **Cirurgias**, abra a de **4 de setembro** (Apendicectomia videolaparoscópica). **Deve aparecer:** "Hora não informada. A foto foi enviada às 21h40." e, em "Para completar", o pedido para conferir a hora. A legenda não diz a hora, e a foto foi enviada no horário de urgência.

Toque em **Editar** e, sem mudar nada, em **Salvar**. **Deve aparecer:** a ficha sem o "Para completar". Salvar já conta como conferida.

## 4. Trazer a planilha de exemplo

Toque em **+ → Planilha de repasse** e escolha o arquivo `EXEMPLO...xlsx`. Escolha a data em que o dinheiro caiu.

Em **Confirme os nomes**, o app pergunta se Bruno Teixeira Lima, Lia Monteiro Alves e Otavio Prado Reis são a mesma pessoa que Bruno, Lia e Otávio. Deixe **Sim**. Bruno Carvalho Dias aparece como colega novo, porque já há outro Bruno na planilha.

Cada linha da planilha **deve mostrar** o nome do paciente, por exemplo "Paciente: Paciente Fictício 01". Mais abaixo, **deve aparecer** a parte **Confira**, com as duas cirurgias de 17 de setembro: a planilha não tem a hora delas, e cada uma é de um paciente. Não precisa mexer.

Em **Quanto caiu na conta?**, escreva `2800`. Logo abaixo da pergunta **deve aparecer** "R$ 19,73 a menos que o liberado: retenções e taxas". Toque em **Confirmar**.

**Deve aparecer:** "Pronto!", com 6 cirurgias do WhatsApp pagas e 2 cirurgias novas, que não estavam na conversa, a frase "Caíram R$ 2.800,00 na conta, R$ 19,73 a menos que o liberado" e de novo o convite de backup.

## 5. Conferir as telas

- **Início:** o cartão "Para receber" com valor; embaixo dele, "Recebido em" este mês com R$ 2.800, o que caiu na conta. Em "Precisa de atenção", no máximo 3 linhas: cirurgias para completar, fotos sem legenda e, se houver, cirurgias atrasadas. No topo, o ícone de engrenagem de **Ajustes**, com uma bolinha vermelha enquanto não houver backup.
- **Barra de baixo:** Início · Cirurgias · + · Recebimentos · Relatórios.
- **Recebimentos** (ou toque no cartão "Para receber"): o que falta receber, o que entrou no mês, "Quando deve cair", com os próximos 30, 60 e 90 dias, e o histórico, com a planilha nº 900001.
- **Cirurgias:** 14 cirurgias.
- **Relatórios:** no topo, "14 cirurgias · R$ 2.820 recebidos · ≈ R$ … a receber". Em **Meses**, "Quanto rendeu cada mês" e "Quanto entrou em cada mês", com R$ 2.800 neste mês, o mesmo valor do Início.
- **Relatórios → Tabela:** 14 linhas, da mais nova para a mais antiga.
- **Relatórios → Relatório do ano:** **deve aparecer** R$ 2.819,73 liberados, "Caiu na conta: R$ 2.800,00" e os quadros por fonte pagadora, hospital, colega e convênio. Toque em **Imprimir ou salvar em PDF**. Abre a tela de impressão do iPhone. Para guardar o PDF, toque em **Compartilhar → Salvar em Arquivos**. Confira se o PDF mostra os quadros mês a mês, numa folha deitada.

## 6. Pagamento em parte

1. Em **Cirurgias**, abra a de **5 de setembro** (Laparotomia exploradora + Drenagem de abscesso) e toque em **Já recebi**. Escreva `100`, toque em **Não, só uma parte** e, em "Quanto ainda falta", escreva `250`. Toque em **Confirmar**.
2. **Deve aparecer:** "Falta receber R$ 250,00". Embaixo, o valor devido de R$ 350,00, o pagamento de R$ 100,00 e "Falta receber R$ 250,00".
3. Toque em **Registrar pagamento**. O valor já vem com 250,00. Toque em **Confirmar**. **Deve aparecer** "Recebida", com os dois pagamentos.
4. Toque em **Desfazer**. **Deve aparecer** de novo "Falta receber R$ 250,00". Feche a cirurgia.
5. No **Início**, o cartão "Para receber" **deve mostrar** "R$ 250 confirmados + ≈ R$ … estimados". Em **Recebimentos**, a cirurgia aparece em "Pagas em parte".

## 7. Nome do paciente

1. Em **Cirurgias**, abra a de **2 de setembro**. **Deve aparecer** "Paciente: Paciente Fictício 01", que veio da planilha.
2. Abra a de **8 de setembro**, toque em **Editar** e, em **Paciente**, escreva `Fulana Exemplo`. Toque em **Salvar**. A ficha **deve mostrar** o nome.
3. Em **Cirurgias**, toque em **Todas**. A lista **deve mostrar** o nome na de 8 de setembro. Na busca, escreva `fulana`: **deve aparecer** só ela.
4. Em **Relatórios → Tabela**, o nome **deve aparecer** embaixo da operação. Em **Relatórios → Relatório do ano**, toque em **Ver cada pagamento**: **deve aparecer** a lista com o nome de cada paciente.

## 8. Lixeira e Desfazer

1. Em **Cirurgias**, abra uma cirurgia e toque em **Excluir cirurgia**. Confirme. **Deve aparecer** o aviso "Cirurgia excluída" com **Desfazer**. Toque em **Desfazer**: ela volta.
2. Exclua a mesma cirurgia de novo, sem desfazer. Em **Ajustes**, a linha **Lixeira** mostra "1 item". Abra e toque em **Recuperar**: ela volta para a lista.
3. Em **Ajustes → Conversas do WhatsApp**, **deve aparecer** a conversa trazida, com o botão **Desfazer**. Não toque nele agora.

## 9. Legenda editada, feriados e lembrete

1. Toque em **+ → Conversa do WhatsApp** e escolha `conversa-iphone-editada.txt`. **Deve aparecer** "1 legenda editada", com "Antes: CVL UMC Bruno". Toque em **Trazer para o app**. No "Pronto!", **deve aparecer** "1 legenda editada atualizada".
2. Em **Cirurgias** continuam 14. A de **20 de setembro** mostra a legenda nova, "CVL UMC Bruno 21h", e embaixo "Editada no WhatsApp. Antes era…".
3. Em **Ajustes → Feriados da cidade**, **deve aparecer** Carnaval e Corpus Christi, com "Conta" e "Não conta", e o campo com 31/08. Volte sem salvar.
4. Em **Ajustes → Lembrete no Calendário**, toque em **Criar o lembrete** e salve o arquivo em Arquivos. Abra o arquivo em **Arquivos**. **Deve aparecer** o evento "Controle de Cirurgias: conversa, planilha e backup", todo dia 5, às 19h. Toque em **Adicionar ao Calendário** e confira no Calendário. Depois, se quiser, apague o evento.

## 10. Acabamento de iPhone

1. Abra uma cirurgia e arraste a barra do topo para baixo. **Deve:** a tela fechar, como em Fechar. Toque no **+** e arraste o menu para baixo: ele também fecha.
2. No iPhone, abra **Ajustes → Tela e Brilho → Tamanho do Texto** e aumente o tamanho. Volte ao app. **Deve aparecer:** as letras maiores, sem nada cortado. Depois, volte o tamanho ao de antes.
3. Em **Ajustes → Senha para abrir**, ligue a senha `2468`. Abra **Senha para abrir** de novo e toque em **Usar Face ID**. O iPhone pede o Face ID duas vezes: uma para criar a chave e outra para o app testar. **Deve aparecer:** "Face ID ligado".
4. Feche a aba do Safari e abra outra vez o endereço com `?teste`. **Deve aparecer:** "Entrar com Face ID" e, embaixo, o campo da senha. Toque em **Entrar com Face ID**: o app abre.
5. Em **Ajustes → Senha para abrir**, escreva `2468` e toque em **Desligar a senha**. O Face ID desliga junto.

## 11. Fechar e abrir de novo

Feche a aba do Safari e abra outra vez o endereço com `?teste`.

**Deve aparecer:** as mesmas 14 cirurgias.

## 12. Fazer backup

Em **Ajustes → Fazer backup**, toque em **Salvar em Arquivos** e salve no iCloud Drive.

**Deve aparecer:** "Backup salvo". Com poucas fotos sai um arquivo só. Com muitas, o app pede para salvar parte por parte, e todas as partes ficam na mesma pasta.

## 13. Apagar e restaurar

1. Em **Ajustes → Apagar os dados de teste**, confirme duas vezes. **Deve aparecer** a tela de boas-vindas, vazia.
2. Em **Ajustes → Restaurar um backup**, escolha o arquivo do backup (todas as partes juntas, se houver). **Deve aparecer** "Restaurar o backup?" com 14 cirurgias.
3. Toque em **Restaurar**. **Deve aparecer** "Backup restaurado." e as 14 cirurgias de volta, com as fotos.

## 14. Diagnóstico

Em **Ajustes → Copiar diagnóstico**, toque em **Copiar** e cole numa conversa.

**Deve aparecer:** a versão do app, "modo de teste" e contagens, sem nenhum nome (nem de paciente), procedimento ou valor.

## 15. Sair do modo de teste

Toque em **Sair do modo de teste**, na faixa amarela.

**Deve aparecer:** o app de verdade, sem nenhuma das 14 cirurgias de teste.

## 16. O app instalado

1. Abra pelo ícone. Em Ajustes, no fim, aparece a versão nova. Na primeira abertura depois de uma versão que mexe no banco, o app pode mostrar "Atualizando o app" por alguns segundos.
2. Ligue o modo avião e abra pelo ícone. O app abre normalmente. Depois desligue o modo avião.
3. Se uma versão nova for publicada com o app aberto, aparece "Nova versão disponível". Toque em **Atualizar**.

## Se algo der errado

Em **Ajustes → Copiar diagnóstico**, copie o texto e mande junto com um print da tela.
