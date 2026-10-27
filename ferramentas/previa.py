"""Monta a prévia do app para o Claude: um arquivo só, com cirurgias de exemplo e nada salvo.
Não faz parte do app. O app publicado no GitHub usa os arquivos separados, sem esta etapa.
Uso: python3 ferramentas/previa.py <arquivo-de-saida.html>"""
import os, re, sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ler = lambda nome: open(os.path.join(RAIZ, nome), encoding='utf-8').read()
index, css, core, ui = ler('index.html'), ler('style.css'), ler('core.js'), ler('ui.js')
corpo = index.split('<body>', 1)[1].split('<!-- APP_MODE', 1)[0].strip()
fontes = '\n'.join(re.findall(r'<link rel="(?:preconnect|stylesheet)" href="https://fonts[^>]*>', index))
for nome, codigo in (('core.js', core), ('ui.js', ui)):
    assert '</script' not in codigo.lower(), f'{nome} não pode conter </script>'
saida = f"""<title>Controle de Cirurgias</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="color-scheme" content="light">
{fontes}
<style>
{css}
</style>
{corpo}
<script>window.APP_MODE = 'preview';</script>
<script>
{core}
</script>
<script>
{ui}
</script>
"""
destino = sys.argv[1] if len(sys.argv) > 1 else 'previa.html'
with open(destino, 'w', encoding='utf-8') as f:
    f.write(saida)
print('prévia:', destino, len(saida.encode('utf-8')), 'bytes')
