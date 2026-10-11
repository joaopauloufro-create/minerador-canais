# ⛏️ Minerador de Outliers

Ferramenta gratuita para encontrar **vídeos e canais do YouTube que estão performando muito acima da média** — por exemplo, um canal pequeno de "jazz lofi" que normalmente tem 1 mil views por vídeo e de repente fez 12 mil (**12x a média do canal**).

- Funciona direto no navegador (computador ou celular). Não tem servidor nem banco de dados.
- Sua chave da API e seus favoritos ficam **só no seu navegador**.
- Pode ser publicada de graça no GitHub Pages.

---

## Sumário

1. [Passo 1 — Criar sua chave da YouTube Data API (grátis)](#passo-1--criar-sua-chave-da-youtube-data-api-grátis)
2. [Passo 2 — Colocar o site no ar com o GitHub Pages](#passo-2--colocar-o-site-no-ar-com-o-github-pages)
3. [Passo 3 — Cadastrar a chave no site](#passo-3--cadastrar-a-chave-no-site)
4. [Como usar cada função](#como-usar-cada-função)
5. [Entendendo a cota diária (10.000 unidades)](#entendendo-a-cota-diária-10000-unidades)
6. [Perguntas frequentes e problemas comuns](#perguntas-frequentes-e-problemas-comuns)
7. [Para quem quiser mexer no código](#para-quem-quiser-mexer-no-código)

---

## Passo 1 — Criar sua chave da YouTube Data API (grátis)

A "chave da API" é como uma senha que permite ao site consultar dados públicos do YouTube em seu nome. É gratuita e não pede cartão de crédito.

1. Acesse **<https://console.cloud.google.com/>** e entre com sua conta Google (pode ser a mesma do Gmail).
   - Se for a primeira vez, aceite os termos de uso.
2. **Crie um projeto:**
   - No topo da página, clique no seletor de projetos (ao lado do logo "Google Cloud").
   - Clique em **"Novo projeto"**.
   - Dê um nome, por exemplo `Minerador de Outliers`, e clique em **"Criar"**.
   - Espere alguns segundos e confira se o projeto novo está selecionado no topo da página.
3. **Ative a YouTube Data API v3:**
   - Acesse **<https://console.cloud.google.com/apis/library/youtube.googleapis.com>**
     (ou, pelo menu ☰, vá em **"APIs e serviços" → "Biblioteca"** e pesquise por `YouTube Data API v3`).
   - Clique no botão azul **"Ativar"**.
4. **Crie a chave:**
   - No menu ☰, vá em **"APIs e serviços" → "Credenciais"**.
   - Clique em **"+ Criar credenciais"** → **"Chave de API"**.
   - Abre um painel **"Criar chave de API"**. Preencha assim:
     - **Nome:** pode deixar "Chave de API 1" ou trocar por `Minerador de Outliers`.
     - **Selecionar restrições da API:** clique no campo **"Nenhuma API selecionada"**. Na lista que abre, digite `YouTube` no campo **"Filtrar"**, marque **"YouTube Data API v3"** e clique em **"OK"**.
       - Se "YouTube Data API v3" **não aparecer** na lista, a API ainda não foi ativada: feche o painel, faça o item 3 acima e tente de novo.
       - Ignore o aviso cinza sobre "Conta de serviço necessária" — ele vale só para as APIs Agent Platform e Gemini, não para o YouTube.
     - **Restrições do aplicativo:** por enquanto deixe em **"Nenhum"**. Você volta aqui depois de colocar o site no ar (item 5).
   - Clique em **"Criar"** no fim do painel.
   - Vai aparecer a chave — um texto longo que começa com `AIza...`.
   - Clique no ícone de copiar e guarde a chave em um lugar seguro (por exemplo, um bloco de notas).
5. **(Recomendado, depois do Passo 2) Proteja sua chave:** assim, mesmo que alguém veja sua chave, não consegue usá-la em outro site.
   - Em **"APIs e serviços" → "Credenciais"**, clique no nome da chave que você criou.
   - Em **"Restrições do aplicativo"**, escolha **"Sites"** e clique em **"Adicionar"**. Digite o endereço do seu site seguido de `*`, por exemplo:
     `https://SEU-USUARIO.github.io/*`
     (você descobre esse endereço no Passo 2).
   - Confira se em **"Restrições da API"** está marcada só a **"YouTube Data API v3"**.
   - Clique em **"Salvar"**. Pode levar até 5 minutos para valer.

> ⚠️ **Nunca** cole sua chave dentro dos arquivos do projeto nem publique em lugar nenhum. O site pede a chave numa tela própria e guarda só no seu navegador.

---

## Passo 2 — Colocar o site no ar com o GitHub Pages

O GitHub Pages hospeda sites como este de graça.

1. Abra este repositório no GitHub (a página onde você está lendo este arquivo).
2. **O repositório precisa ser público** para usar o GitHub Pages de graça. Se ele estiver privado:
   - Clique em **"Settings"** (Configurações, aba no topo do repositório).
   - Role até o fim, na seção **"Danger Zone"**, clique em **"Change visibility"** → **"Make public"** e confirme.
   - Não se preocupe: sua chave da API **não** fica no código, então nada sensível fica público.
3. Clique em **"Settings"** → no menu da esquerda, clique em **"Pages"**.
4. Em **"Build and deployment"**:
   - **Source:** escolha **"Deploy from a branch"**.
   - **Branch:** clique no botão **"None ▾"** (ao lado de "Save"). Na lista, escolha a branch onde está o código (normalmente **`main`**; se só existir uma branch, escolha ela).
   - Ao lado aparece um segundo botão com a pasta: deixe **`/ (root)`**.
   - Clique em **"Save"**.
   - Pode ignorar a seção "Visibility / GitHub Enterprise" — é paga e não é necessária.
5. Espere de 1 a 3 minutos e recarregue a página. Vai aparecer no topo:
   **"Your site is live at `https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/`"**.
   Esse é o endereço do seu site! Salve nos favoritos do navegador e do celular.
6. Volte ao Passo 1, item 5, e use esse endereço na restrição da chave (`https://SEU-USUARIO.github.io/*`).

> 💡 Sempre que o código for atualizado no GitHub, o site se atualiza sozinho em alguns minutos.

---

## Passo 3 — Cadastrar a chave no site

1. Abra o seu site.
2. Clique na aba **⚙️ Configurações** (no celular aparece como **Ajustes**).
3. Cole sua chave no campo **"Sua chave"** e clique em **"Testar chave"**.
4. Se aparecer **"✅ Tudo certo!"**, pode começar a usar.

A chave fica salva no navegador. Se você usar outro navegador ou outro aparelho (por exemplo, o celular), precisa colar a chave lá também — uma vez só.

---

## Como usar cada função

### 🔎 1. Busca por nicho

Na aba **Buscar**:

| Campo | O que faz |
|---|---|
| **Palavras-chave do nicho** | O que você quer pesquisar, como no YouTube: `jazz lofi`, `oração narrada`, `motivação disciplina`. |
| **Idioma** | Dá preferência a vídeos nesse idioma. |
| **País** | Busca como se você estivesse nesse país. |
| **Publicados nos últimos** | 7, 30 ou 90 dias. Períodos curtos acham tendências mais "quentes". |
| **Tipo de vídeo** | Vídeos longos, Shorts ou ambos. (Shorts = vídeos de até 3 minutos.) |
| **Ordem no YouTube** | "Mais vistos" costuma achar mais outliers. "Mais recentes" ajuda a pegar coisas que acabaram de estourar. |
| **Quantidade de vídeos** | 50, 100 ou 150. Cada 50 vídeos custam 100 unidades da cota. |

Embaixo do formulário aparece **quanto a busca vai custar** antes de você clicar em "Buscar outliers".

### 📊 2. Cálculo de outlier (o "multiplicador")

Para cada vídeo encontrado, a ferramenta:

1. Pega os **últimos 30 vídeos do mesmo canal** (dá para mudar para 15 ou 50 em Configurações).
2. Calcula a **mediana** das views desses vídeos — ou seja, o "valor do meio": metade dos vídeos tem mais views que isso e metade tem menos. A mediana é melhor que a média comum porque um único vídeo viral não distorce o resultado.
3. Divide as views do vídeo pela mediana. Exemplo: o vídeo tem 12.000 views e a mediana do canal é 1.000 → **12x**.

Alguns cuidados que a ferramenta toma automaticamente:
- O próprio vídeo avaliado **não entra** na mediana (senão ele "puxaria" a média para cima).
- Vídeos com menos de 48 horas de vida são ignorados na mediana, porque ainda não tiveram tempo de juntar views.
- **Shorts são comparados com Shorts e vídeos longos com vídeos longos** (quando o canal tem pelo menos 3 de cada), pois os números costumam ser bem diferentes.

Cores do multiplicador: **cinza** (menos de 3x), **azul** (3x a 5x), **laranja** (5x a 10x) e **vermelho** (10x ou mais). Passe o mouse (ou toque) sobre o número para ver a mediana usada.

No filtro **"Multiplicador mínimo"** você escolhe mostrar só vídeos com 2x, 3x, 5x, 10x, 20x ou 50x ou mais.

### 👥 3. Filtros de canal

Ficam em **"Filtros de canal"**, dentro do formulário de busca:

- **Máximo de inscritos:** por exemplo, "50 mil" para achar canais pequenos que viralizaram. Canais que escondem o número de inscritos são deixados de fora quando há limite.
- **Idade máxima do canal:** por exemplo, "1 ano" para ver só canais novos.
- **Vídeos publicados no canal:** mínimo e/ou máximo (ex.: de 5 até 100 vídeos).

Esses filtros são aplicados **antes** de calcular a mediana, então canais que não passam neles não gastam cota.

### 🙈 4. Filtro de canais faceless (sem rosto)

Detectar rosto automaticamente é muito difícil, então a ferramenta usa dois métodos:

- **(a) Palpite automático:** olha o nome, a descrição e os títulos dos vídeos do canal procurando palavras típicas de canais sem rosto — `lofi`, `music`, `AI`/`IA`, `narração`, `oração`, `relaxing`, `sleep`, `documentário`, `motivação`, `stories` etc. Palavras como `vlog`, `react`, `podcast`, `minha rotina` contam contra. Quando o palpite é "faceless", o card mostra **🙈 Faceless (auto)**. Passe o mouse para ver quais palavras foram encontradas.
- **(b) Sua marcação manual:** em cada card há os botões **🙈 Faceless** e **🙂 Com rosto**. Clique para marcar o canal (clique de novo para desmarcar). Sua marcação **sempre vence** o palpite automático e fica salva no navegador, valendo para todas as buscas futuras.

No filtro **"Faceless"** dos resultados você escolhe:
- **Mostrar todos**
- **Só faceless (auto + manual)** — palpite automático + suas marcações
- **Só os que marquei como faceless** — apenas o que você confirmou
- **Esconder os marcados "com rosto"**

### 🗂️ 5. Resultados

Cada card mostra: miniatura, multiplicador, título, canal, views, inscritos, mediana do canal, data de publicação, quantidade de vídeos e idade do canal. Clique na miniatura ou no título para abrir o vídeo no YouTube; clique no nome do canal para abrir o canal.

Em **"Ordenar por"** você ordena por **multiplicador**, **visualizações**, **data** ou **inscritos** (menores primeiro). Os filtros de resultado (multiplicador, faceless, formato, ordem) são instantâneos e **não gastam cota**.

A última busca fica salva: se você fechar e abrir o site de novo, os resultados continuam lá.

### ⭐ 6. Favoritos e exportação para CSV

- Em cada card, clique em **⭐ Vídeo** para salvar o vídeo ou **⭐ Canal** para salvar o canal.
- Na aba **⭐ Favoritos**, escreva suas anotações no campo de texto de cada item (ideias de título, estilo da thumbnail etc.). Salva sozinho enquanto você digita.
- Clique em **⬇️ Exportar CSV** para baixar uma planilha com tudo.

**Para abrir no Google Planilhas:**
1. Acesse <https://sheets.google.com> e crie uma planilha em branco.
2. Clique em **Arquivo → Importar → Fazer upload** e escolha o arquivo `minerador-favoritos-AAAA-MM-DD.csv` que foi baixado.
3. Em "Tipo de separador", deixe **"Detectar automaticamente"** (ou escolha **"Vírgula"**) e clique em **"Importar dados"**.

> ⚠️ Favoritos e marcações ficam salvos **neste navegador**. Se você limpar os dados de navegação, eles somem. Exporte o CSV de vez em quando como backup.

---

## Entendendo a cota diária (10.000 unidades)

O Google dá **10.000 unidades por dia, de graça**. A contagem zera à meia-noite do horário do Pacífico (Califórnia) — por volta das 4h ou 5h da manhã no horário de Brasília.

| Ação | Custo |
|---|---|
| Buscar 50 vídeos (uma "página" de busca) | 100 unidades |
| Pegar estatísticas de até 50 vídeos ou 50 canais | 1 unidade |
| Calcular a mediana de um canal | 2 unidades |
| Repetir a mesma busca nas próximas 12 horas | 0 (usa o cache) |
| Canal já analisado nas últimas 24 horas | 0 (usa o cache) |

**Na prática:** uma busca de 50 vídeos costuma gastar entre **100 e 200 unidades**. Dá para fazer umas **50 buscas por dia**.

Dicas para economizar:
- Use o filtro de **máximo de inscritos**: canais grandes deixam de ser analisados e não gastam cota.
- Comece com **50 vídeos**; só aumente para 100 ou 150 se o nicho for promissor.
- Mudar os filtros de resultado (multiplicador, faceless, ordem) é grátis.

O contador de cota na aba Configurações é uma **estimativa** feita pelo seu navegador. O número oficial fica em <https://console.cloud.google.com/apis/api/youtube.googleapis.com/quotas>.

---

## Perguntas frequentes e problemas comuns

**"A chave da API é inválida."**
Confira se copiou a chave inteira, sem espaços. Ela começa com `AIza`.

**"A YouTube Data API v3 não está ativada no seu projeto."**
Volte ao Passo 1, item 3, e clique em "Ativar". Confira se o projeto certo está selecionado no topo da página do Google Cloud.

**"Sua chave tem restrição de site e não aceita este endereço."**
No Google Cloud, em Credenciais → sua chave → Restrições de aplicativo → Sites, confira se o endereço está como `https://SEU-USUARIO.github.io/*` (com o `/*` no final). Se você abriu o arquivo `index.html` direto do computador, a restrição bloqueia — use o site publicado.

**"A cota diária da sua chave acabou."**
Espere até o dia seguinte (≈ 4h–5h da manhã). Os resultados já buscados continuam aparecendo.

**A busca trouxe poucos resultados.**
- Diminua o **multiplicador mínimo** (ex.: "Todos") para ver tudo que foi analisado.
- Aumente o **máximo de inscritos** ou o **período**.
- Tente outras palavras-chave ou mude o idioma/país para "Qualquer".

**O palpite "faceless" errou.**
É normal — é só uma pista baseada em palavras. Use os botões 🙈 Faceless / 🙂 Com rosto para corrigir; sua marcação sempre vale mais.

**Minha chave fica segura?**
Ela fica apenas no armazenamento do seu navegador e só é enviada para o próprio Google (`googleapis.com`). Ela não está no código do site. Para ainda mais segurança, faça a restrição de site do Passo 1, item 5.

---

## Para quem quiser mexer no código

Estrutura dos arquivos:

```
index.html          → a página (abas Buscar, Favoritos e Configurações)
css/style.css       → visual (modo claro/escuro, celular)
js/outlier.js       → cálculo do multiplicador e palpite faceless (lógica pura)
js/storage.js       → tudo que é salvo no navegador (chave, cache, favoritos, cota)
js/youtube.js       → chamadas à YouTube Data API v3 com cache e contagem de cota
js/app.js           → interface: busca, filtros, cards, favoritos, CSV
tests/              → testes automáticos do cálculo de outlier
```

Para rodar os testes (precisa do [Node.js](https://nodejs.org/) instalado):

```bash
node --test tests/outlier.test.js
```

Para testar o site no computador, abra o `index.html` no navegador (se sua chave tiver restrição de site, ela só funciona no endereço publicado).
