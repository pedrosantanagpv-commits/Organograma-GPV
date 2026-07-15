# Front-end — Vite

## Instalação local

```bash
npm install
npm run dev
```

Sem a variável `VITE_API_URL`, o sistema usa dados de demonstração iguais aos dados iniciais da planilha.

## Vercel

Crie a variável:

```env
VITE_API_URL=https://script.google.com/macros/s/SEU_DEPLOY/exec
```

Depois faça um novo deploy.

## Atualização de dados

Os dados são carregados da planilha sempre que a página abre.

A idade não é armazenada. Ela é calculada no navegador usando `DataNascimento`.

O tempo de empresa também é calculado usando `DataAdmissao`.
