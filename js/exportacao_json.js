// ==========================================
// MÓDULO DE EXPORTAÇÃO E IMPORTAÇÃO JSON (BACKUP)
// ==========================================

window.exportarOrcamentoJSON = function() {
    const data = { 
        configuracoes: { 
            estado: document.getElementById('select-estado').value, 
            tabela: document.getElementById('select-tabela').value, 
            bdi: document.getElementById('input-bdi').value, 
            bdiDif: document.getElementById('input-bdi-dif')?.value || '14.02',
            data_base: document.getElementById('select-data-base').value,
            nomeObra: document.getElementById('input-obra-nome')?.value || '',
            local: document.getElementById('input-obra-local')?.value || '',
            processo: document.getElementById('input-obra-processo')?.value || '',
            revisao: document.getElementById('input-obra-revisao')?.value || 'R00',
            orcamentista: document.getElementById('input-obra-orcamentista')?.value || '',
            cargoOrcamentista: document.getElementById('input-obra-cargo')?.value || '',
            registroOrcamentista: document.getElementById('input-obra-registro')?.value || '',
            artObra: document.getElementById('input-obra-art')?.value || ''
        }, 
        itens: window.appState.orcamento,
        dataInicioObra: document.getElementById('input-data-inicio-obra')?.value || window.appState.dataInicioObra || '',
        baseComposicoesPrazos: window.appState.baseComposicoesPrazos || {},
        composicaoBdi: window.appState.composicaoBdi || null
    };
    window.downloadArquivo(JSON.stringify(data, null, 2), `orcamento_obra_${new Date().toISOString().slice(0,10)}.json`, 'application/json');
};

window.importarOrcamentoJSON = function(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (data.itens && Array.isArray(data.itens)) {
                const estadoAnterior = document.getElementById('select-estado').value;
                const dataBaseAnterior = document.getElementById('select-data-base').value;

                window.appState.orcamento = data.itens;
                window.appState.nextId = Math.max(...data.itens.map(i => i.id || 0), 0) + 1;
                window.orcamentoAtualId = null;
                window.orcamentoAtualNome = null;
                if (typeof window.atualizarBadgeOrcamentoNuvem === 'function') window.atualizarBadgeOrcamentoNuvem();
                
                if (data.configuracoes) {
                    if (data.configuracoes.estado) document.getElementById('select-estado').value = data.configuracoes.estado;
                    if (data.configuracoes.tabela) document.getElementById('select-tabela').value = data.configuracoes.tabela;
                    if (data.configuracoes.bdi) document.getElementById('input-bdi').value = data.configuracoes.bdi;
                    if (data.configuracoes.bdiDif !== undefined && document.getElementById('input-bdi-dif')) document.getElementById('input-bdi-dif').value = data.configuracoes.bdiDif;
                    if (data.configuracoes.data_base) document.getElementById('select-data-base').value = data.configuracoes.data_base;
                    
                    if (data.configuracoes.nomeObra !== undefined && document.getElementById('input-obra-nome')) document.getElementById('input-obra-nome').value = data.configuracoes.nomeObra;
                    if (data.configuracoes.local !== undefined && document.getElementById('input-obra-local')) document.getElementById('input-obra-local').value = data.configuracoes.local;
                    if (data.configuracoes.processo !== undefined && document.getElementById('input-obra-processo')) document.getElementById('input-obra-processo').value = data.configuracoes.processo;
                    if (data.configuracoes.revisao !== undefined && document.getElementById('input-obra-revisao')) document.getElementById('input-obra-revisao').value = data.configuracoes.revisao;
                    if (data.configuracoes.orcamentista !== undefined && document.getElementById('input-obra-orcamentista')) document.getElementById('input-obra-orcamentista').value = data.configuracoes.orcamentista;
                    if (data.configuracoes.cargoOrcamentista !== undefined && document.getElementById('input-obra-cargo')) document.getElementById('input-obra-cargo').value = data.configuracoes.cargoOrcamentista;
                    if (data.configuracoes.registroOrcamentista !== undefined && document.getElementById('input-obra-registro')) document.getElementById('input-obra-registro').value = data.configuracoes.registroOrcamentista;
                    if (data.configuracoes.artObra !== undefined && document.getElementById('input-obra-art')) document.getElementById('input-obra-art').value = data.configuracoes.artObra;
                }

                if (data.dataInicioObra) {
                    window.appState.dataInicioObra = data.dataInicioObra;
                    const inputData = document.getElementById('input-data-inicio-obra');
                    if (inputData) inputData.value = data.dataInicioObra;
                }
                if (data.baseComposicoesPrazos) {
                    window.appState.baseComposicoesPrazos = data.baseComposicoesPrazos;
                }
                if (data.composicaoBdi) {
                    window.appState.composicaoBdi = data.composicaoBdi;
                }

                const novoEstado = document.getElementById('select-estado').value;
                const novaDataBase = document.getElementById('select-data-base').value;
                if (novoEstado !== estadoAnterior || novaDataBase !== dataBaseAnterior) {
                    window.carregarBases();
                } else {
                    window.atualizarOrcamentoEBusca();
                }
                alert('📂 Orçamento importado e carregado com sucesso!');
            } else {
                alert('Formato de arquivo inválido.');
            }
        } catch (err) { alert('Erro ao ler o arquivo JSON.'); }
    };
    reader.readAsText(file);
    event.target.value = ''; 
};
