#!/usr/bin/env node

const core = require('@actions/core');
const github = require('@actions/github');

// Função para calcular data limite baseada em dias
function calculateCutoffDate(daysOld) {
  const now = new Date();
  const cutoffDate = new Date(now.getTime() - daysOld * 24 * 60 * 60 * 1000);
  return cutoffDate;
}

// Função para fazer requisições à API do GitHub
async function githubApiRequest(endpoint, method = 'GET', token) {
  const url = `https://api.github.com${endpoint}`;
  const options = {
    method,
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      'User-Agent': 'GHCR-Pruner'
    }
  };

  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`GitHub API responded with ${response.status}: ${errorData}`);
    }
    
    if (method === 'DELETE') {
      return true;
    }
    
    return await response.json();
  } catch (error) {
    throw new Error(`Error calling GitHub API: ${error.message}`);
  }
}

// Função principal
async function main() {
  try {
    // Obter inputs da Action
    const token = core.getInput('token', { required: true });
    const packageName = core.getInput('package_name') || '';
    const daysOld = parseInt(core.getInput('days_old') || '30', 10);
    const keepLatest = parseInt(core.getInput('keep_latest_count') || '5', 10);
    const organization = core.getInput('organization') || '';

    // Calcular data limite para remoção
    const cutoffDate = calculateCutoffDate(daysOld);
    core.info(`Removendo imagens anteriores a ${cutoffDate.toISOString()}`);

    // Determinar se usar API de usuário ou organização
    let apiBasePath;
    if (!organization) {
      core.info('Buscando pacotes do usuário atual');
      apiBasePath = '/user/packages';
    } else {
      core.info(`Buscando pacotes da organização: ${organization}`);
      apiBasePath = `/orgs/${organization}/packages`;
    }

    // Obter lista de pacotes
    let packages = [];
    if (!packageName) {
      core.info('Buscando todos os pacotes de contêiner...');
      const packagesData = await githubApiRequest(`${apiBasePath}?package_type=container`, 'GET', token);
      packages = packagesData.map(pkg => pkg.name);
    } else {
      packages = [packageName];
    }

    if (packages.length === 0) {
      core.info('Nenhum pacote encontrado');
      return;
    }

    // Processar cada pacote
    for (const pkg of packages) {
      core.info(`Processando pacote: ${pkg}`);
      
      // Obter todas as versões do pacote
      let versions = [];
      try {
        const versionsData = await githubApiRequest(`${apiBasePath}/container/${pkg}/versions`, 'GET', token);
        versions = versionsData.map(version => ({
          id: version.id,
          name: version.metadata?.container?.tags?.[0] || 'sem-tag',
          created_at: version.created_at
        }));
      } catch (error) {
        core.warning(`Erro ao obter versões para ${pkg}: ${error.message}`);
        continue;
      }
      
      if (versions.length === 0) {
        core.info(`Nenhuma versão encontrada para ${pkg}`);
        continue;
      }
      
      // Ordenar versões por data de criação (mais recente primeiro)
      const sortedVersions = versions.sort((a, b) => 
        new Date(b.created_at) - new Date(a.created_at)
      );
      
      // Contar número total de versões
      core.info(`Total de versões para ${pkg}: ${sortedVersions.length}`);
      
      // Processar cada versão
      for (let i = 0; i < sortedVersions.length; i++) {
        const version = sortedVersions[i];
        const versionCreatedAt = new Date(version.created_at);
        
        // Verificar se deve remover com base em:
        // 1. Não está entre as N versões mais recentes e
        // 2. É mais antiga que o limite de dias
        if (i >= keepLatest && versionCreatedAt < cutoffDate) {
          core.info(`Removendo versão ${version.name} (ID: ${version.id}) criada em ${version.created_at}`);
          
          try {
            // Remover versão
            await githubApiRequest(`${apiBasePath}/container/${pkg}/versions/${version.id}`, 'DELETE', token);
            core.info('✅ Versão removida com sucesso!');
          } catch (error) {
            core.error(`❌ Falha ao remover versão: ${error.message}`);
          }
        } else {
          if (i < keepLatest) {
            core.info(`Mantendo versão ${version.name} (está entre as ${keepLatest} mais recentes)`);
          } else {
            core.info(`Mantendo versão ${version.name} (mais recente que ${cutoffDate.toISOString()})`);
          }
        }
      }
    }
  } catch (error) {
    core.setFailed(`Erro ao executar script: ${error.message}`);
  }
}

// Executar a função principal
main(); 