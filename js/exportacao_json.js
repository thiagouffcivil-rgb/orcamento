// ==========================================
// MÓDULO DE EXPORTAÇÃO E IMPORTAÇÃO JSON (BACKUP)
// ==========================================

window.exportarOrcamentoJSON = function() {
    const data = { 
        configuracoes: { 
            estado: document.getElementById('select-estado').value, 
            tabela: document.getElementById('select-tabela').value, 
            bdi: document.getElementById('input-bdi').value, 
            data_base: document.getElementById('select-data-base').value,
            nomeObra: document.getElementById('input-obra-nome')?.value || '',
            local: document.getElementById('input-obra-local')?.value || '',
            processo: document.getElementById('input-obra-processo')?.value || '',
            revisao: document.getElementById('input-obra-revisao')?.value || 'R00'
        }, 
        itens: window.appState.orcamento 
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
                window.appState.orcamento = data.itens;
                window.appState.nextId = Math.max(...data.itens.map(i => i.id || 0), 0) + 1;
                
                if (data.configuracoes) {
                    if (data.configuracoes.estado) document.getElementById('select-estado').value = data.configuracoes.estado;
                    if (data.configuracoes.tabela) document.getElementById('select-tabela').value = data.configuracoes.tabela;
                    if (data.configuracoes.bdi) document.getElementById('input-bdi').value = data.configuracoes.bdi;
                    if (data.configuracoes.data_base) document.getElementById('select-data-base').value = data.configuracoes.data_base;
                    
                    if (data.configuracoes.nomeObra !== undefined && document.getElementById('input-obra-nome')) document.getElementById('input-obra-nome').value = data.configuracoes.nomeObra;
                    if (data.configuracoes.local !== undefined && document.getElementById('input-obra-local')) document.getElementById('input-obra-local').value = data.configuracoes.local;
                    if (data.configuracoes.processo !== undefined && document.getElementById('input-obra-processo')) document.getElementById('input-obra-processo').value = data.configuracoes.processo;
                    if (data.configuracoes.revisao !== undefined && document.getElementById('input-obra-revisao')) document.getElementById('input-obra-revisao').value = data.configuracoes.revisao;
                }
                
                window.atualizarOrcamentoEBusca();
                alert('📂 Orçamento importado e carregado com sucesso!');
            } else {
                alert('Formato de ficheiro inválido.');
            }
        } catch (err) { alert('Erro ao ler o ficheiro JSON.'); }
    };
    reader.readAsText(file);
    event.target.value = ''; 
};