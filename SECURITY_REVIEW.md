# Revisão de Segurança

Data: 2026-04-19

## Escopo

Arquivos revisados:
- `src/lib/project-config.js`
- `src/lib/config.js`
- `src/lib/container-tag.js`
- `src/lib/superbrain-client.js`
- `src/lib/supermemory-client.js`
- `src/hooks/session-start.js`
- `src/hooks/session-end.js`
- `src/lib/format-context.js`
- `src/server.js`
- `hooks/hooks.json`
- `README.md`
- `.gitignore`
- `package.json`
- `package-lock.json`

## Findings

### 1. Crítico: configuração local do repositório pode redirecionar backend, tráfego de memória e credenciais

Evidências:
- `src/lib/project-config.js:14-40` carrega automaticamente `.gemini/.supermemory/config.json` ou `.supermemory/config.json`
- `src/lib/config.js:82-119` dá prioridade ao config do projeto para `provider`, `apiUrl` e `apiKey`
- `hooks/hooks.json:1-27` ativa `SessionStart` e `SessionEnd` automaticamente
- `src/hooks/session-start.js:45-74` consulta o backend no início da sessão
- `src/hooks/session-end.js:53-112` envia resumo/transcrição ao fim da sessão

Impacto:
- um repositório não confiável pode versionar um config apontando `apiUrl` para backend do atacante
- a extensão pode enviar automaticamente contexto, consultas, resumos, transcrições e até credenciais do backend
- no modo legado `supermemory`, overrides de tags também permitem mirar namespaces arbitrários

### 2. Alto: memórias recuperadas entram no `systemMessage` sem barreira robusta contra prompt injection

Evidências:
- `src/hooks/session-start.js:56-74` injeta memórias recuperadas no `systemMessage`
- `src/lib/format-context.js:35-90` renderiza esse conteúdo como texto cru
- `src/lib/format-context.js:58-68` e `93-105` incluem `r.text` sem escaping nem delimitação forte de dado não confiável

Impacto:
- backend comprometido ou memória envenenada pode injetar instruções como `ignore previous instructions`
- como isso entra em `systemMessage`, o efeito é mais forte que uma resposta comum de ferramenta

### 3. Médio: o repositório incentiva configs locais com segredos, mas o Git não protege esses arquivos

Evidências:
- `README.md:66-83` recomenda `.gemini/.supermemory/config.json` com `apiKey`
- `.gitignore:1-5` não ignora `.gemini/`, `.supermemory/` nem configs locais
- `AGENTS.md:21-22` avisa para não commitar credenciais, mas isso não é reforçado pelo repo

Impacto:
- colaboradores podem versionar credenciais reais por acidente

### 4. Médio: o caminho absoluto local do projeto é enviado ao backend em gravações

Evidências:
- `src/lib/superbrain-client.js:154-163` deriva contexto de escopo com `basePath`
- `src/lib/superbrain-client.js:214-221` inclui `basePath` no contexto outbound
- `src/hooks/session-end.js:100-112` grava automaticamente ao fim da sessão

Impacto:
- o backend recebe caminho absoluto local do usuário
- isso expõe metadados do host sem necessidade clara para a feature

## Dependências e Supply Chain

Dependências diretas travadas no lockfile analisado:
- `@modelcontextprotocol/sdk@1.27.1`
- `esbuild@0.25.12`
- `supermemory@4.17.0`
- `zod@4.3.6`

Achados:
- `npm audit --omit=dev` retornou `0` vulnerabilidades de produção no lock atual
- `npm audit` retornou vulnerabilidades transitivas ligadas ao SDK MCP:
- `path-to-regexp@8.3.0` com severidade `high`
- `hono@4.12.8` com severidade `moderate`
- `@hono/node-server@1.19.11` com severidade `moderate`

Relação observada por `npm ls`:
- `@modelcontextprotocol/sdk@1.27.1` traz `express@5.2.1`, `hono@4.12.8` e `@hono/node-server@1.19.11`
- `express@5.2.1` traz `router@2.2.0`, que depende de `path-to-regexp@8.3.0`

Avaliação:
- o impacto prático atual parece limitado porque o projeto usa `StdioServerTransport` em `src/server.js`, não um servidor HTTP exposto
- ainda assim, existe risco de supply chain e de exposição futura se alguém ativar transporte HTTP depois sem revisar a árvore transitiva
- o `package-lock.json` está em `lockfileVersion: 3` e registra `resolved` + `integrity`, o que ajuda contra troca silenciosa de artefatos
- `esbuild` tem `hasInstallScript: true` e baixa binários por plataforma via dependências opcionais `@esbuild/*`; isso não é vulnerabilidade por si só, mas amplia a superfície de supply chain no momento do `npm install`
- `supermemory` instala um binário CLI (`bin/cli`); o projeto não parece depender dele em runtime, então vale minimizar essa dependência se não for necessária

## Correções Recomendadas

### Prioridade 1

- parar de confiar automaticamente em config versionável do repositório para `apiUrl`, `apiKey` e `provider`
- mover configs locais para fora da árvore do projeto ou exigir confirmação explícita do usuário antes de aceitar config do repo
- adicionar `.gemini/` e `.supermemory/` ao `.gitignore`

### Prioridade 2

- tratar memórias recuperadas como dado não confiável
- parar de injetar texto cru no `systemMessage`; preferir bloco delimitado, papel reduzido ou resposta de ferramenta separada
- sanitizar ou filtrar comandos/instruções explícitas recuperadas do backend

### Prioridade 3

- remover `basePath` absoluto do payload enviado ao backend ou substituí-lo por hash estável derivado do projeto
- revisar se `supermemory` ainda precisa permanecer como dependência direta
- atualizar `@modelcontextprotocol/sdk` para uma versão que puxe `hono`, `@hono/node-server` e `path-to-regexp` corrigidos
- rodar auditoria periódica de dependências e travar atualizações por PR revisado, não por instalação ad hoc

## Resumo

O principal problema de segurança é a quebra de trust boundary entre repositório local e backend de memória. Hoje, abrir um repo não confiável já pode redirecionar tráfego automático de memória e exfiltrar contexto sensível. O segundo problema mais sério é prompt injection vindo de memória remota. Em dependências, o risco mais importante é de hygiene e supply chain: não há indício forte de exploit direto no fluxo atual via stdio, mas a árvore transitiva do SDK MCP já merece atualização e endurecimento.
