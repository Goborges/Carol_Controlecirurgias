"""Gera os dados de exemplo dos testes (pasta testes/dados). Tudo é inventado: nomes, pacientes, números.
Formatos iguais aos reais: conversa exportada do WhatsApp no iPhone (zip com _chat.txt e fotos) e no Android,
e a planilha de repasse da UMC (mesmas colunas). Só é preciso rodar de novo se os exemplos mudarem.
Precisa do Pillow e do openpyxl. Uso: python3 ferramentas/gerar_dados_teste.py"""
import io, os, zipfile
from datetime import datetime
from PIL import Image
from openpyxl import Workbook

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DADOS = os.path.join(RAIZ, 'testes', 'dados')
os.makedirs(DADOS, exist_ok=True)
LRM = '‎'
GRUPO, EU = 'Cirurgias Teste', 'Ana Exemplo'

# ---------- conversa do iPhone ----------
# (data, hora com segundos, texto, fotos). Fotos: True = uma foto; 2 = duas; 'oculta' = exportada sem a foto.
MSGS = [
    ('01/09/2026', '08:00:00', None, 'sistema:As mensagens e as chamadas são protegidas com a criptografia de ponta a ponta e ficam somente entre você e os participantes desta conversa.'),
    ('01/09/2026', '08:00:01', None, f'sistema:Você criou o grupo “{GRUPO}”'),
    ('02/09/2026', '10:15:22', 'CVL Bruno UMC', 1),                                  # quarta, horário normal
    ('02/09/2026', '10:15:23', '', 1),                                               # 2ª foto da mesma cirurgia
    ('04/09/2026', '21:40:10', 'APVL Mater Dei Lia', 1),                             # sexta à noite, sem hora na legenda
    ('05/09/2026', '14:05:00', '', 1),                                               # foto primeiro...
    ('05/09/2026', '14:07:30', 'LE + drenagem de abscesso Genoveva Otávio 13h', 0),  # ...legenda depois (sábado)
    ('08/09/2026', '16:20:00', 'VLP colecisto UMC Bruno', 1),                        # item 15 do roteiro
    ('09/09/2026', '09:10:00', 'Colecistectomia VLP Santa Clara Lia', 1),
    ('09/09/2026', '11:45:00', 'Convertida para colecistectomia aberta', 0),         # correção da anterior
    ('10/09/2026', '09:00:00', '', 1),                                               # duas fotos sem legenda
    ('10/09/2026', '09:00:02', '', 1),
    ('12/09/2026', '11:30:00', '07/09 hérnia UMC Bruno', 1),                         # data na legenda: feriado
    ('15/09/2026', '18:45:10', 'Fechamento de parede UMC Lia 18:30', 1),
    ('16/09/2026', '07:20:00', 'CVL UMC Otávio', 'oculta'),
    ('17/09/2026', '08:30:00', 'CVL UMC Bruno', 1),                                  # duas no mesmo dia, mesmo colega
    ('17/09/2026', '15:10:00', 'CVL UMC Bruno', 1),
    ('19/09/2026', '10:00:00', 'Lembrar de ver o repasse de agosto', 0),             # anotação, não é cirurgia
    ('20/09/2026', '22:10:05', 'CVL UMC Bruno', 1),                                  # será editada (item 20)
]
EDITADA = ('20/09/2026', '22:10:05', 'CVL UMC Bruno 21h')

def foto_jpg(n):
    cor = [(180, 120, 160), (120, 160, 190), (150, 190, 140), (210, 170, 120)][n % 4]
    b = io.BytesIO(); Image.new('RGB', (8, 8), cor).save(b, 'JPEG', quality=80); return b.getvalue()

def linhas_iphone(editar=False):
    out, fotos, seq = [], [], 2
    for data, hora, texto, extra in MSGS:
        if isinstance(extra, str) and extra.startswith('sistema:'):
            out.append(f'[{data}, {hora}] {GRUPO}: {LRM}{extra[8:]}'); continue
        if editar and (data, hora) == EDITADA[:2]:
            texto = EDITADA[2]
        partes = [texto] if texto else []
        if extra == 'oculta':
            partes.append(f'{LRM}imagem ocultada')
        elif extra:
            d, m, a = data.split('/'); hh, mi, ss = hora.split(':')
            seq += 1; nome = f'{seq:08d}-PHOTO-{a}-{m}-{d}-{hh}-{mi}-{ss}.jpg'
            fotos.append(nome); partes.append(f'{LRM}<anexado: {nome}>')
        if editar and (data, hora) == EDITADA[:2]:
            partes.append(f'{LRM}<Esta mensagem foi editada>')
        corpo = ' '.join(partes) if texto else (partes[0] if partes else '')
        out.append(f'[{data}, {hora}] {EU}: {corpo}')
    return '\r\n'.join(out) + '\r\n', fotos

texto, fotos = linhas_iphone()
with zipfile.ZipFile(os.path.join(DADOS, 'conversa-iphone.zip'), 'w', zipfile.ZIP_DEFLATED) as z:
    z.writestr('_chat.txt', texto.encode('utf-8'))
    for i, nome in enumerate(fotos):
        z.writestr(nome, foto_jpg(i), compress_type=zipfile.ZIP_STORED)
editada, _ = linhas_iphone(editar=True)
open(os.path.join(DADOS, 'conversa-iphone-editada.txt'), 'w', encoding='utf-8', newline='').write(editada)

# ---------- conversa do Android (as três primeiras cirurgias) ----------
android = '\n'.join([
    '02/09/2026 10:15 - As mensagens e as chamadas são protegidas com a criptografia de ponta a ponta e ficam somente entre você e os participantes desta conversa.',
    f'02/09/2026 10:15 - {EU}: IMG-20260902-WA0001.jpg (arquivo anexado)',
    'CVL Bruno UMC',
    f'04/09/2026 21:40 - {EU}: IMG-20260904-WA0002.jpg (arquivo anexado)',
    'APVL Mater Dei Lia',
    f'05/09/2026 14:05 - {EU}: IMG-20260905-WA0003.jpg (arquivo anexado)',
    f'05/09/2026 14:07 - {EU}: LE + drenagem de abscesso Genoveva Otávio 13h',
    f'10/09/2026 09:00 - {EU}: <Mídia oculta>',
]) + '\n'
open(os.path.join(DADOS, 'conversa-android.txt'), 'w', encoding='utf-8', newline='').write(android)

# ---------- planilha de repasse (mesmas colunas da planilha da UMC) ----------
CAB = ['Regra', 'Convênio', 'Data procedimento', 'Atendimento', 'Conta paciente', 'Paciente', 'Código', 'Procedimento', 'Liberado', 'Função médico', 'Medico', 'Médico executor']
CVL = 'COLECISTECTOMIA SEM COLANGIOGRAFIA POR VIDEOLAPAROSCOPIA'
LINHAS = [  # data e hora, convênio, código, procedimento, liberado, executor
    ('02/09/2026 10:15', 'Plano Exemplo Saúde', 31005497, CVL, 444.02, 'Bruno Teixeira Lima'),
    ('07/09/2026 09:30', 'Convênio Teste', 30000001, 'HERNIORRAFIA INGUINAL', 403.65, 'Bruno Teixeira Lima'),   # feriado: +30%
    ('15/09/2026 18:30', 'Plano Exemplo Saúde', 30000002, 'FECHAMENTO DE PAREDE ABDOMINAL', 120.00, 'Lia Monteiro Alves'),
    ('16/09/2026 07:20', 'Plano Exemplo Saúde', 31005497, CVL, 444.02, 'Otavio Prado Reis'),
    ('17/09/2026', 'Plano Exemplo Saúde', 31005497, CVL, 444.02, 'Bruno Teixeira Lima'),                     # sem hora (item 25)
    ('17/09/2026', 'Plano Exemplo Saúde', 31005497, CVL, 444.02, 'Bruno Teixeira Lima'),
    ('22/09/2026 10:00', 'Plano Exemplo Saúde', 30000003, 'GASTRECTOMIA PARCIAL', 520.00, 'Lia Monteiro Alves'),  # não está na conversa
    ('23/09/2026 14:00', 'Convênio Teste', 31003583, 'APENDICECTOMIA POR VIDEOLAPAROSCOPIA', 0.00, 'Bruno Carvalho Dias'),  # glosa; outro Bruno
]
wb = Workbook(); ws = wb.active; ws.title = 'Repasse'
ws.append(CAB)
for i, (dh, conv, cod, proc, val, exe) in enumerate(LINHAS, 1):
    dt = datetime.strptime(dh, '%d/%m/%Y %H:%M') if ' ' in dh else datetime.strptime(dh, '%d/%m/%Y')
    ws.append(['Repasse por produção', conv, dt, 700000 + i, 800000 + i, f'PACIENTE FICTÍCIO {i:02d}', cod, proc, val, 'Primeiro Auxiliar', EU, exe])
    ws.cell(row=i + 1, column=3).number_format = 'dd/mm/yyyy hh:mm'
ws.append([None] * 7 + ['Total', round(sum(l[4] for l in LINHAS), 2)])
wb.properties.creator = 'Exemplo'
wb.save(os.path.join(DADOS, 'EXEMPLO_LTDA_-_Repasse_-_900001_-_Comp._09.xlsx'))
print('dados de teste prontos em', DADOS, '| fotos:', len(fotos))
