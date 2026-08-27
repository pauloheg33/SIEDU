# SIEDU - Sistema de Evidências SME

Sistema para gestão de evidências e eventos da Secretaria Municipal de Educação.

## 🚀 Tecnologias

- **Frontend:** React 18 + TypeScript + Vite
- **Backend:** Supabase (Auth, Database, Storage)
- **Hosting:** GitHub Pages

## 📁 Estrutura

```
├── frontend/          # Aplicação React
│   ├── src/
│   │   ├── components/   # Componentes reutilizáveis
│   │   ├── pages/        # Páginas da aplicação
│   │   ├── store/        # Estado global (Zustand)
│   │   ├── lib/          # Supabase client e API
│   │   └── types/        # Tipos TypeScript
│   └── public/
├── supabase/
│   └── migration.sql     # Schema do banco de dados
└── .github/workflows/    # CI/CD para GitHub Pages
```

## 🔧 Configuração

### 1. Supabase

1. Crie um projeto em [supabase.com](https://supabase.com)
2. Em um projeto novo, execute `supabase/migration.sql` e depois os arquivos de `supabase/migrations` em ordem
3. Copie a URL e Anon Key do projeto
4. Em **Auth > URL Configuration**, configure:
   - `Site URL`: `https://pauloheg33.github.io/SIEDU/`
   - Redirect de produção: `https://pauloheg33.github.io/SIEDU/reset-password`
   - Redirect local: `http://localhost:3000/SIEDU/reset-password`

### 2. GitHub Secrets

Configure os seguintes secrets no repositório:

- `VITE_SUPABASE_URL` - URL do projeto Supabase
- `VITE_SUPABASE_ANON_KEY` - Chave anônima do Supabase

### 3. GitHub Pages

Em Settings → Pages, selecione "GitHub Actions" como source.

## 🌐 Deploy

O deploy é automático via GitHub Actions ao fazer push na branch `main`.

**URL:** https://pauloheg33.github.io/SIEDU/

## 🔐 Atualização segura do Supabase

Projetos que já possuem dados não devem executar novamente o arquivo `migration.sql`. A evolução atual está em `supabase/migrations` e foi dividida para não interromper o acesso aos eventos existentes:

1. Faça backup e execute `supabase/verification.sql`, guardando as contagens retornadas.
2. Confirme que o schema remoto corresponde ao baseline e marque `20260826000000` como já aplicado no histórico de migrações.
3. Aplique `20260826001000_collaboration_additive.sql`. Essa etapa adiciona campos, colaboradores, índices e faz o backfill sem restringir o acesso atual.
4. Publique a Edge Function `public-event` e o frontend compatível.
5. Aplique `20260826002000_collaboration_security.sql` para ativar as novas políticas e tornar os buckets privados.
6. Aplique `20260827000000_global_event_access.sql` para que toda conta ativa, inclusive as criadas futuramente, possa visualizar e editar a biblioteca completa e seus arquivos.
7. Execute novamente `supabase/verification.sql`. As contagens das tabelas originais devem permanecer iguais e não pode haver órfãos.

Antes de qualquer aplicação remota, use o dry-run da CLI do Supabase. As credenciais e a service role devem permanecer somente nos ambientes do Supabase e do GitHub; nunca no frontend ou no repositório.

## 📋 Funcionalidades

- ✅ Autenticação de usuários
- ✅ Recuperação de senha por e-mail
- ✅ Gestão de eventos (CRUD)
- ✅ Upload de fotos e documentos
- ✅ Controle de presença
- ✅ Notas e observações
- ✅ Diferentes tipos de eventos (Formação, Premiação, Encontro)
- ✅ Controle de status (Planejado, Realizado, Arquivado)

## 👥 Perfis de Usuário

- **ADMIN** - Acesso total
- **TEC_FORMACAO** - Técnico de Formação
- **TEC_ACOMPANHAMENTO** - Técnico SME
