# Axiom — Personal AI Governance

> Seu consultor estratégico pessoal com IA. Gerencie tarefas, hábitos, finanças, projetos e muito mais.

## 🏗️ Stack Tecnológica

| Camada | Tecnologia |
|---|---|
| **Build** | Vite 5 + SWC |
| **Framework** | React 18 + TypeScript |
| **Roteamento** | React Router Dom 7 |
| **Estilização** | Tailwind CSS 3 + tailwindcss-animate |
| **Componentes** | shadcn/ui (Radix UI) |
| **Animações** | Framer Motion 12 |
| **Backend** | Supabase (Edge Functions, Auth, PostgreSQL) |
| **State** | React Context + TanStack React Query 5 |
| **Formulários** | React Hook Form + Zod |
| **Gráficos** | Recharts 2 |
| **PWA** | vite-plugin-pwa + Service Worker |

## 📁 Estrutura de Pastas

```
src/
├── components/       # Componentes React
│   ├── chat/         # Chat com IA (Axiom)
│   ├── intelligence/ # Score e evolução
│   ├── layout/       # Sidebar, AppLayout, Logo
│   ├── memory/       # Dashboard de memórias
│   ├── mobile/       # BottomNav, PullToRefresh, gestos
│   ├── pwa/          # InstallPrompt
│   ├── settings/     # NotificationSettings
│   └── ui/           # shadcn/ui components
├── contexts/         # React Contexts (Chat, Memory, Sidebar)
├── hooks/            # Custom hooks (20+)
├── integrations/     # Supabase client + types
├── lib/              # Utils, animations, PDF, validations
└── pages/            # Páginas da aplicação (15)
```

## 🚀 Como Rodar

```bash
# 1. Clonar o repositório
git clone https://github.com/deivithi/app-axiom.git
cd app-axiom

# 2. Copiar variáveis de ambiente
cp .env.example .env
# Editar .env com suas credenciais Supabase

# 3. Instalar dependências
npm install

# 4. Iniciar servidor de desenvolvimento
npm run dev
```

## 📦 Scripts Disponíveis

| Script | Comando | Descrição |
|---|---|---|
| Dev | `npm run dev` | Servidor local (porta 8080) |
| Build | `npm run build` | Build de produção |
| Preview | `npm run preview` | Preview do build |
| Lint | `npm run lint` | Verificação de código |

## 🌐 Deploy

O projeto está configurado para deploy na **Vercel**. A configuração está em `vercel.json`.

```bash
# Deploy de preview
vercel

# Deploy de produção
vercel --prod
```

## 📄 Licença

Projeto privado.
