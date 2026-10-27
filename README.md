# Controle de Cirurgias

App pessoal para o iPhone (PWA): registra as cirurgias a partir da conversa do WhatsApp e das planilhas de repasse, e mostra quanto falta receber. Os dados ficam só no aparelho; não há servidor.

Endereço: https://goborges.github.io/Carol_Controlecirurgias/

## Arquivos

| Arquivo | O que é |
|---|---|
| `index.html` | A página do app: estrutura e ordem em que os outros arquivos carregam. |
| `style.css` | O visual. |
| `core.js` | O núcleo, sem interface: leitura do WhatsApp e das planilhas, cruzamento repasse × cirurgias, estimativas, feriados e urgência. Roda no navegador e no Node. |
| `ui.js` | A interface: telas, importações, backup. Guarda a versão do app (`VERSION`). |
| `sw.js` | Guarda o app no aparelho para abrir sem internet. Guarda o nome do cache (`CACHE`). |
| `manifest.webmanifest`, `icon-*.png` | Nome e ícone na Tela de Início. |
| `ROADMAP.md` | A situação de cada item do roteiro. |
| `ROTEIRO-TESTE.md` | O passo a passo para testar no iPhone, no modo de teste, depois de cada lote. |
| `testes/` | Testes automáticos do núcleo, com dados inventados em `testes/dados/`. |
| `versoes/` | Cópias congeladas de versões anteriores, para voltar atrás. |
| `ferramentas/` | Scripts de apoio: a prévia do Claude, os ícones e os dados de teste. O app não depende deles. |

## Regras

- Sem etapa de build: os arquivos publicados são o próprio código.
- A cada versão, suba `VERSION` em `ui.js` e `CACHE` em `sw.js`, com o mesmo número.
- Nenhum dado real neste repositório, que é público: nada de conversa exportada, fotos ou planilhas.

## Testes

- **Modo de teste:** `goborges.github.io/Carol_Controlecirurgias/?teste` abre o app num banco separado, com uma faixa avisando. Serve para testar sem tocar nos dados de verdade.
- **No navegador, sem instalar nada:** abra https://goborges.github.io/Carol_Controlecirurgias/testes/. "Tudo certo" em verde quer dizer que o núcleo se comporta como esperado. Em vermelho, algo mudou: mande um print.
- **No computador, com o Node:** na pasta do repositório, rode `node testes/nucleo.test.js`.
- **Falha esperada** é um problema já anotado no `ROADMAP.md`, com o número do item. Quando ele for corrigido, o teste passa a passar e vira um teste normal.
- Os dados de exemplo são inventados. Para gerar de novo: `python3 ferramentas/gerar_dados_teste.py` (precisa do Pillow e do openpyxl).
