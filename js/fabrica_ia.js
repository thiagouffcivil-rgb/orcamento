// ==========================================
// MÓDULO: FÁBRICA DA IA E RECUPERAÇÃO DE DADOS
// Arquivo: js/fabrica_ia.js
// ==========================================

// O Super Limpador de Códigos
const limparCodBusca = (cod) => cod ? String(cod).replace(/[^a-zA-Z0-9]/g, '').toUpperCase() : '';

// 1. Atualiza o menu mantendo a seleção e incluindo data-desc
window.atualizarSelectFabricaIA = function() {
    const select = document.getElementById('fabrica-select-item');
    if (!select || !window.appState.orcamento) return;
    
    const valorAtual = select.value; 
    
    let html = '<option value="">-- Escolha um item do orçamento --</option>';
    window.appState.orcamento.forEach(item => {
        if (item.tipo !== 'etapa' && item.codigo && item.codigo !== '-') {
            const descEsc = String(item.descricao || '').replace(/"/g, '&quot;');
            html += `<option value="${item.codigo}" data-desc="${descEsc}">${item.itemEap} - Cód: ${item.codigo} - ${item.descricao.substring(0, 50)}...</option>`;
        }
    });
    
    select.innerHTML = html;
    if (valorAtual) select.value = valorAtual; 
};

// 2. FUNÇÃO PARA RECUPERAR O JSON DA IA (Fábrica)
window.recuperarJsonIA = function() {
    const select = document.getElementById('fabrica-select-item');
    const codigoSelecionado = select ? select.value : null;

    if (!codigoSelecionado) {
        alert("Por favor, selecione um serviço no menu pendente primeiro.");
        return;
    }

    const codLimpoSelect = limparCodBusca(codigoSelecionado);

    let jsonSalvo = null;
    if (window.appState.baseComposicoesPrazos) {
        if (window.appState.baseComposicoesPrazos[codLimpoSelect]) {
            jsonSalvo = window.appState.baseComposicoesPrazos[codLimpoSelect];
        } else if (window.appState.baseComposicoesPrazos[codigoSelecionado]) {
            jsonSalvo = window.appState.baseComposicoesPrazos[codigoSelecionado];
        }
    }

    if (jsonSalvo) {
        const textarea = document.getElementById('fabrica-json-entrada');
        if (textarea) {
            textarea.value = JSON.stringify(jsonSalvo, null, 4);
            textarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
            textarea.style.backgroundColor = '#f0fdf4';
            setTimeout(() => textarea.style.backgroundColor = '#fff', 800);
        }
    } else {
        alert(`⚠️ Não existe nenhum JSON da IA salvo na memória para o código ${codigoSelecionado}.\n\nLembre-se: O botão "Recuperar" serve para ver um JSON que você já tenha colado e salvo anteriormente para este serviço.`);
    }
};

// 3. MÓDULO UNIFICADO: SALVAR JSON DA IA (Produtividade + Equipe + Equipamentos)
window.salvarComposicaoFabrica = function() {
    const textarea = document.getElementById('fabrica-json-entrada');
    if (!textarea) return;
    const rawJson = textarea.value.trim();
    
    if (!rawJson) { 
        alert("Cole o JSON da IA primeiro na caixa de texto!"); 
        return; 
    }
    
    try {
        const cleanJson = rawJson.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/, "");
        const config = JSON.parse(cleanJson);
        const codLimpoIA = limparCodBusca(config.codigo);

        if (!codLimpoIA) {
            alert("⚠️ Erro: O JSON precisa conter a chave 'codigo'.");
            return;
        }

        if (!window.appState.baseComposicoesPrazos) window.appState.baseComposicoesPrazos = {};
        window.appState.baseComposicoesPrazos[codLimpoIA] = config;

        let aplicados = 0;
        if (window.appState && window.appState.orcamento) {
            window.appState.orcamento.forEach(item => {
                if (limparCodBusca(item.codigo) === codLimpoIA) {
                    if (!item.cronograma) item.cronograma = { hh: 0, equipe: 1, ritmo: 100, predecessora: '', terminoJunto: '', espera: 0 };
                    
                    const tamanhoEquipe = parseInt(config.tamanhoEquipeTotal) || 1;
                    item.cronograma.equipe = tamanhoEquipe;
                    item.cronograma.equipeDetalhada = config.equipeFiscalizacao || [];
                    item.cronograma.equipamentosDetalhe = config.equipamentosFiscalizacao || [];
                    if (config.espera !== undefined) item.cronograma.espera = parseFloat(config.espera) || 0;

                    if (config.producaoDiaria && parseFloat(config.producaoDiaria) > 0 && parseFloat(item.qtd) > 0) {
                        const dias = Math.ceil(parseFloat(item.qtd) / parseFloat(config.producaoDiaria));
                        if (!item.cronograma.hh || item.cronograma.hh === 0) {
                            item.cronograma.hh = dias * 8 * tamanhoEquipe;
                        }
                    }
                    aplicados++;
                }
            });
        }

        window.salvarEstadoLocal();

        if (aplicados > 0) {
            alert(`✅ Sucesso! Parâmetros de equipe e produtividade alocados ao serviço ${config.codigo} (${aplicados} item(ns) no orçamento)!`);
            if (typeof window.carregarTabelaCronograma === 'function') window.carregarTabelaCronograma();
            if (typeof window.gerarGraficoGantt === 'function') window.gerarGraficoGantt();
        } else {
            alert(`✅ Parâmetros salvos no banco local para o código "${config.codigo}". (Nenhum item com esse código está no orçamento atual.)`);
        }
        
        textarea.value = ''; 
        
    } catch (err) {
        alert("❌ Erro ao ler o JSON. Verifique se copiou todo o código, incluindo as chaves { e }.");
        console.error(err);
    }
};
