# J2C ~Jira to Clockify~

Este projeto foi criado para auxiliar os colaboradores da SouthSystem à sincronizarem as horas lançadas no Jira do Banco Topázio para o Clockify

## 1. Instalando o projeto

No terminal, rode o comando abaixo para instalar a ferramenta globalmente

```bash
npm i -g git+https://github.com/JonatanColussi/j2c.git
```

## 2. Fazendo a configuração

No terminal, rode o comando abaixo para iniciar a configuração

```bash
j2c configure
```

a ferramenta irá pedir:

1. seu usuário do Jira
2. sua senha do Jira
3. seu token do Clockfy (obtenha a `API key` em: <https://clockify.me/user/settings>)
4. escolha seu projeto em que as horas serão lançadas (PRJ - Topázio)
5. escolha sua task padrão (Desenvolvimento, Analise, Testes, ...)

> *Durante a configuração, a ferramenta irá logar no Jira para validar as credenciais informadas, por isso é importante que a VPN esteja conectada

> *Essas configurações ficarão salvas em seu computador, você não precisará configurar novamente.

## 3. Fazendo a sincronização

No terminal, rode o comando abaixo para fazer a sinconização

```bash
j2c sync
```

> *Durante a sincronização, a ferramenta irá logar no Jira para obter as horas lançadas, por isso é importante que a VPN esteja conectada

Ao final do processo, as horas sincronizadas aparecerão no terminal para conferência
