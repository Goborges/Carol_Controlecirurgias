# Roteiro de teste no iPhone

Use depois de subir cada lote no GitHub. Leva uns 15 minutos e nunca mexe nos dados da Carol: tudo acontece no **modo de teste**, um banco separado, com dados inventados.

Endereço do app: `goborges.github.io/Carol_Controlecirurgias`

## Antes de começar: baixar os arquivos de exemplo

No Safari do iPhone, abra cada endereço abaixo e toque em **Baixar**. Se abrir uma prévia, toque em **Compartilhar → Salvar em Arquivos**.

1. `goborges.github.io/Carol_Controlecirurgias/testes/dados/conversa-iphone.zip`
2. `goborges.github.io/Carol_Controlecirurgias/testes/dados/EXEMPLO_LTDA_-_Repasse_-_900001_-_Comp._09.xlsx`

Os dois ficam em **Arquivos → Downloads**. São inventados: colegas Bruno, Lia e Otávio, pacientes fictícios.

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
- "Pronto! 12 cirurgias novas no app", com 2 fotos para organizar e o convite "Faça um backup agora".

## 4. Trazer a planilha de exemplo

Toque em **+ → Planilha de repasse** e escolha o arquivo `EXEMPLO...xlsx`. Escolha a data em que o dinheiro caiu e toque em **Confirmar**.

**Deve aparecer:** "Pronto!", com 5 cirurgias do WhatsApp pagas e 2 cirurgias novas, que não estavam na conversa, e de novo o convite de backup.

## 5. Conferir as telas

- **Início:** o cartão "Para receber" com valor e, em "Para completar", cirurgias e fotos sem legenda.
- **Cirurgias:** 14 cirurgias.
- **Relatórios → Tabela:** 14 linhas, da mais nova para a mais antiga.

## 6. Fechar e abrir de novo

Feche a aba do Safari e abra outra vez o endereço com `?teste`.

**Deve aparecer:** as mesmas 14 cirurgias.

## 7. Fazer backup

Em **Ajustes → Fazer backup**, toque em **Salvar em Arquivos** e salve no iCloud Drive.

**Deve aparecer:** "Backup salvo". Com poucas fotos sai um arquivo só. Com muitas, o app pede para salvar parte por parte, e todas as partes ficam na mesma pasta.

## 8. Apagar e restaurar

1. Em **Ajustes → Apagar os dados de teste**, confirme duas vezes. **Deve aparecer** a tela de boas-vindas, vazia.
2. Em **Ajustes → Restaurar um backup**, escolha o arquivo do backup (todas as partes juntas, se houver). **Deve aparecer** "Restaurar o backup?" com 14 cirurgias.
3. Toque em **Restaurar**. **Deve aparecer** "Backup restaurado." e as 14 cirurgias de volta, com as fotos.

## 9. Diagnóstico

Em **Ajustes → Copiar diagnóstico**, toque em **Copiar** e cole numa conversa.

**Deve aparecer:** a versão do app, "modo de teste" e contagens, sem nenhum nome, procedimento ou valor.

## 10. Sair do modo de teste

Toque em **Sair do modo de teste**, na faixa amarela.

**Deve aparecer:** o app de verdade, sem nenhuma das 14 cirurgias de teste.

## 11. O app instalado

1. Abra pelo ícone. Em Ajustes, no fim, aparece a versão nova.
2. Ligue o modo avião e abra pelo ícone. O app abre normalmente. Depois desligue o modo avião.
3. Se uma versão nova for publicada com o app aberto, aparece "Nova versão disponível". Toque em **Atualizar**.

## Se algo der errado

Em **Ajustes → Copiar diagnóstico**, copie o texto e mande junto com um print da tela.
