#!/usr/bin/env node

const axios = require('axios');
const core = require('@actions/core');

// Função para calcular data limite baseada em dias
function calculateCutoffDate(daysOld) {
  const now = new Date();
  const cutoffDate = new Date(now.getTime() - daysOld * 24 * 60 * 60 * 1000);
  return cutoffDate;
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
    
    // Configurar cliente axios com headers de autenticação
    const api = axios.create({
      baseURL: 'https://api.github.com',
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      }
    });

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
      const response = await api.get(`${apiBasePath}?package_type=container`);
      packages = response.data.map(pkg => pkg.name);
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
        const response = await api.get(`${apiBasePath}/container/${pkg}/versions`);
        versions = response.data.map(version => ({
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
            await api.delete(`${apiBasePath}/container/${pkg}/versions/${version.id}`);
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