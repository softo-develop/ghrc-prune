# GHCR Pruner (Podador GHCR)

Este projeto fornece uma GitHub Action para limpar automaticamente imagens antigas do GitHub Container Registry (GHCR).

## Funcionalidades

- Remove imagens de contêiner antigas com base em critérios configuráveis
- Preserva as versões mais recentes de cada pacote
- Funciona com pacotes de um usuário ou de uma organização
- Implementado em JavaScript para fácil manutenção e extensibilidade

## Como usar

Para usar esta Action em seu repositório, crie um arquivo de workflow em `.github/workflows/` (por exemplo, `cleanup-containers.yml`) com o seguinte conteúdo:

```yaml
name: Limpar Imagens de Contêiner

on:
  schedule:
    - cron: '0 0 * * 0'  # Executa semanalmente à meia-noite de domingo
  workflow_dispatch:     # Permite execução manual

jobs:
  cleanup:
    runs-on: ubuntu-latest
    name: Limpar contêineres antigos
    steps:
      - name: Limpar imagens de contêiner
        uses: seu-usuario/ghcr-pruner@main
        with:
          token: ${{ secrets.PACKAGES_TOKEN }}
          # Parâmetros opcionais abaixo
          # package_name: 'my-container'     # Nome do pacote específico
          days_old: '30'                     # Remove imagens mais antigas que 30 dias
          keep_latest_count: '5'             # Mantém as 5 versões mais recentes
          # organization: 'sua-organizacao'  # Nome da sua organização
```

## Parâmetros

| Parâmetro | Descrição | Obrigatório | Padrão |
|-----------|-----------|-------------|--------|
| `token` | Token GitHub com permissões para excluir pacotes | Sim | - |
| `package_name` | Nome do pacote para limpar (deixe em branco para todos) | Não | `''` |
| `days_old` | Remove imagens mais antigas que X dias | Não | `'30'` |
| `keep_latest_count` | Mantém as últimas X versões de cada pacote | Não | `'5'` |
| `organization` | Nome da organização (deixe em branco para o usuário atual) | Não | `''` |

## Permissões de Token

O token fornecido deve ter as seguintes permissões:
- `packages:read` - Para listar pacotes e versões
- `packages:delete` - Para remover versões de pacotes

Recomendamos criar um token de acesso pessoal (PAT) com escopo mínimo ou usar o `GITHUB_TOKEN` com as permissões necessárias configuradas no workflow.

## Exemplos

### Limpar todos os pacotes da conta atual

```yaml
- name: Limpar todas as imagens de contêiner
  uses: seu-usuario/ghcr-pruner@main
  with:
    token: ${{ secrets.PACKAGES_TOKEN }}
```

### Limpar um pacote específico

```yaml
- name: Limpar imagens de um contêiner específico
  uses: seu-usuario/ghcr-pruner@main
  with:
    token: ${{ secrets.PACKAGES_TOKEN }}
    package_name: 'meu-container'
    days_old: '60'
    keep_latest_count: '10'
```

### Limpar pacotes de uma organização

```yaml
- name: Limpar imagens de contêiner da organização
  uses: seu-usuario/ghcr-pruner@main
  with:
    token: ${{ secrets.PACKAGES_TOKEN }}
    organization: 'minha-organizacao'
```

## Licença

MIT 