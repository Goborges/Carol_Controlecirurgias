/* Controle de Cirurgias — guarda o app no aparelho para abrir sem internet. Não guarda dados.
   A cada entrega, troque o número em CACHE (igual à versão do app em ui.js): é isso que faz a atualização chegar ao iPhone.
   Arquivos do app (página, estilo e código): com internet, sempre a versão mais nova, e uma cópia fica guardada;
   sem internet, abre a cópia. Assim a página e o código nunca ficam de versões diferentes. Ícones: a cópia guardada.
   Qualquer outra página do mesmo endereço (testes, versões antigas, documentos) vai direto à internet e não é guardada,
   para nunca tomar o lugar do app na cópia usada sem internet. Desde a 1.7, nada vem de outro site (nem a fonte). */
const CACHE = 'cirurgias-1.14';
const APP_FILES = ['index.html', 'style.css', 'core.js', 'ui.js', 'manifest.webmanifest'];
const ICONS = ['icon-180.png', 'icon-192.png', 'icon-512.png'];
const SCOPE = new URL('./', self.location).pathname;  // a pasta do app, por exemplo /Carol_Controlecirurgias/

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE)
    .then((c) => c.addAll(['./', ...APP_FILES, ...ICONS].map((u) => new Request(u, { cache: 'no-cache' }))))
    .then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// guarda só respostas boas do próprio app
function keep(key, res) {
  if (res && res.ok && res.type === 'basic') { const cp = res.clone(); caches.open(CACHE).then((c) => c.put(key, cp)); }
  return res;
}
// com internet: pergunta ao GitHub se mudou (no-cache) e guarda a cópia; sem internet: usa a cópia
function fresh(url, key) {
  return fetch(url, { cache: 'no-cache', credentials: 'same-origin' })
    .then((res) => keep(key, res))
    .catch(() => caches.match(key).then((m) => m || Response.error()));
}
function stored(req) {
  return caches.match(req).then((m) => m || fetch(req).then((res) => keep(req, res)));
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    if (!url.pathname.startsWith(SCOPE)) return;
    const name = url.pathname.slice(SCOPE.length);           // '' é a página inicial do app
    if (req.mode === 'navigate') {
      if (name === '' || name === 'index.html') e.respondWith(fresh(req.url, './index.html'));
      return;                                                // outra página: direto à internet, sem guardar
    }
    if (APP_FILES.includes(name)) { e.respondWith(fresh(req.url, './' + name)); return; }
    if (ICONS.includes(name)) { e.respondWith(stored(req)); return; }
    return;                                                  // o resto (testes, versões): direto à internet
  }
  // outro site: o app não pede nada fora do próprio endereço (a regra de segurança da página também bloqueia)
});
