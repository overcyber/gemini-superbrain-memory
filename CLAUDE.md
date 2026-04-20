# CLAUDE.md

Este arquivo fornece orientação para o Claude Code (claude.ai/code) ao trabalhar com código neste repositório.

## Visão Geral do Projeto

Esta é uma **extensão do Gemini CLI** que fornece memória persistente entre sessões de codificação de IA usando SuperBrain/OpenMemory como backend. A extensão expõe ferramentas MCP e hooks de ciclo de vida que salvam/carregam memórias automaticamente.

## Comandos de Desenvolvimento

```bash
# Build do projeto (bundle src/ para dist/ com esbuild)
npm run build

# Link para desenvolvimento local
gemini extensions link .

# Atualizar a chave de API do backend
gemini extensions config brain-extension

# Ou configurar via variáveis de ambiente
export MEMORY_PROVIDER="superbrain"
export SUPERBRAIN_API_URL="http://localhost:8082/api/v1"
export SUPERBRAIN_API_KEY="dev-key-123"
```

**Nunca edite `dist/` diretamente** — é gerado automaticamente pelo `npm run build`.

## Arquitetura

A extensão segue uma arquitetura modular limpa:

- **`src/server.js`** — Servidor MCP com 3 ferramentas: `search_memory`, `add_memory`, `save_project_memory`
- **`src/hooks/session-start.js`** — Carrega memórias passadas automaticamente ao iniciar sessão
- **`src/hooks/session-end.js`** — Salva resumo da sessão automaticamente ao encerrar
- **`src/lib/`** — Utilitários principais (config, clientes, validação, formatação)
- **`commands/index.toml`** — Define o comando `/index` de escaneamento de código

### Prioridade de Carregamento de Configuração

1. Específico do projeto: `.gemini/.supermemory/config.local.json` (preferido) ou `.gemini/.supermemory/config.json`
2. Variáveis de ambiente (`MEMORY_PROVIDER`, `SUPERBRAIN_API_URL`, `SUPERBRAIN_API_KEY`)
3. Valores padrão

### Escopos de Memória

- **Memórias pessoais** — Preferências, decisões e aprendizados do usuário
- **Memórias de projeto** — Conhecimento compartilhado da equipe sobre arquitetura e convenções

Memórias são classificadas em setores: `episodic`, `semantic`, `procedural`, `emotional`, `reflective`.

## Convenções de Código

- **ESM apenas**: Use `import`/`export` com extensões `.js` explícitas em imports relativos
- **Estilo**: Aspas duplas, ponto e vírgula, indentação de 4 espaços
- **Nomenclatura**: `camelCase` para funções, `PascalCase` para classes, `kebab-case` para nomes de arquivos
- **Mantenha utilitários pequenos**: Extraia helpers puros para `src/lib/` para facilitar testes futuros

## Arquivos de Configuração

- **`gemini-extension.json`** — Manifesto da extensão
- **`hooks/hooks.json`** — Configuração dos hooks SessionStart/End
- **`.gemini/.supermemory/config.json`** — Configurações de backend por repositório (não committed)

## Testes

Não há suite de testes automatizada ainda. Valide alterações por:
1. Executando `npm run build`
2. Link local: `gemini extensions link .`
3. Testando manualmente as ferramentas MCP e o comando `/index`

## Segurança

Nunca faça commit de credenciais de backend em produção. Use o fluxo de configuração do Gemini ou variáveis de ambiente. Configurações específicas do projeto ficam em `.gemini/.supermemory/config.json` e devem permanecer locais.
