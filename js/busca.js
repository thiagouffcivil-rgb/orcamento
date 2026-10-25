// ==========================================
// MÓDULO DE BUSCA GLOBAL E FILTROS (busca.js)
// ==========================================

// 1. LISTA ESTÁTICA DE UNIDADES (Para o Datalist HTML)
window.LISTA_ESTATICA_UNIDADES = [
    "%","BUI","CAM","CG","CH","CHP","CJ","CM","CM2","CX","DIA","DM3","DUZ","FL","GL","H",
    "JG","KG","KM","KW","L","M","M2","M3","MES","MIL","MIN","ML","PAR","PT","RL","SC","TON","UN"
];

window.addEventListener('DOMContentLoaded', () => {
    const datalist = document.getElementById('lista-unidades-datalist');
    if (datalist) {
        datalist.innerHTML = window.LISTA_ESTATICA_UNIDADES.map(u => `<option value="${u}">`).join('');
    }
});

// Funções de ação rápida nos resultados da busca
window.preencherFormularioDaBusca = function(idx) {
    const r = window.appState.searchResult[idx];
    if (!r) return;
    const rBtn = document.querySelector(`input[name="tipo_lancamento"][value="${r.tipo}"]`);
    if (rBtn && rBtn.parentElement) {
        window.selectLancamentoTypeRadio(rBtn.parentElement, r.tipo);
    }
    const cInput = document.getElementById('input-add-codigo');
    const eapInput = document.getElementById('input-item-eap');
    if (eapInput && !eapInput.value.trim()) {
        eapInput.value = window.sugerirProximoEAP(r.tipo);
    }
    cInput.value = r.codigo;
    window.buscarCodigoParaAdicionar();
    cInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
};

window.adicionarDiretoDaBusca = function(idx, btnEl) {
    const r = window.appState.searchResult[idx];
    if (!r) return;

    const eapInput = document.getElementById('input-item-eap');
    let eapUsar = (eapInput && eapInput.value.trim()) ? eapInput.value.trim() : window.sugerirProximoEAP(r.tipo);

    window.appState.orcamento.push({
        id: window.appState.nextId++,
        tipo: r.tipo,
        itemEap: eapUsar,
        codigo: r.codigo,
        descricao: r.descricao,
        unidade: r.unidade || 'UN',
        qtd: 1.000,
        precoUnitario: r.preco || 0,
        grupo: 'COMPOSICAO',
        memoria: '-',
        justificativa: '',
        usarBdiDiferenciado: false
    });

    if (eapInput) {
        eapInput.value = eapUsar;
        window.incrementarEAP();
    }

    window.renderizarOrcamento();

    if (btnEl) {
        const originalText = btnEl.innerHTML;
        btnEl.innerHTML = '✅';
        btnEl.disabled = true;
        setTimeout(() => {
            btnEl.innerHTML = originalText;
            btnEl.disabled = false;
        }, 900);
    }
};

// 2. MOTOR PRINCIPAL DE BUSCA (Cruzamento de Termos e Unidades)
window.executarBuscaGlobal = function() {
    const inputBusca = document.getElementById('input-busca').value.trim().toLowerCase();
    
    const inputUnidade = document.getElementById('input-busca-unidade');
    const rawFiltroUnidade = inputUnidade ? inputUnidade.value.trim().toUpperCase() : '';
    const unidadesPermitidas = rawFiltroUnidade.split(/[\s,]+/).filter(u => u.length > 0);
    
    const ordenacao = document.getElementById('select-ordenacao').value;
    const tabela = document.getElementById('select-tabela').value; // 'desonerada' ou 'nao_desonerada'
    const estadoSelecionado = document.getElementById('select-estado').value;
    const tbody = document.getElementById('tbody-busca-resultados');

    if (window.appState.loadedCacheMeta && window.appState.loadedCacheMeta.isLoading) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center" style="color: #1e40af; padding: 20px;">⏳ As bases SINAPI/SCO ainda estão sendo baixadas do GitHub. Aguarde alguns segundos e tente novamente.</td></tr>';
        return;
    }

    if (!inputBusca && unidadesPermitidas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center" style="color: var(--danger); padding: 20px;">Digite um termo de busca ou uma unidade.</td></tr>';
        return;
    }

    const termos = inputBusca.split(/\s+/).filter(t => t.length > 0);
    let resultados = [];

    const normalizarUnd = (u) => String(u).toUpperCase().replace('³', '3').replace('²', '2').replace('^', '').trim();
    const unidadesPermitidasNormalizadas = unidadesPermitidas.map(normalizarUnd);

    const varrerBase = (nomeBase, arrayBase, tagHtml, tipoRadio) => {
        if (!arrayBase || !Array.isArray(arrayBase)) return;
        
        arrayBase.forEach(item => {
            const cod = String(item.codigo || item['Código'] || item['Código do Item'] || '').trim();
            const desc = String(item.descricao || item['Descrição'] || item['Descrição do Item'] || '').trim();
            const und = normalizarUnd(item.unidade || item['Unidade'] || '');
            
            let matchTermos = true;
            if (termos.length > 0) {
                const textoBusca = (cod + ' ' + desc).toLowerCase();
                matchTermos = termos.every(t => textoBusca.includes(t));
            }
            
            let matchUnidade = true;
            if (unidadesPermitidasNormalizadas.length > 0) {
                matchUnidade = unidadesPermitidasNormalizadas.includes(und);
            }

            if (matchTermos && matchUnidade) {
                let precoUn = item.precoUnitario || item.preco || item['Preço Unitário (R$)'] || item['Preço'] || 0;
                
                // Recorre ao motor de preços global para garantir estado/desoneração corretos
                if (typeof window.obterPrecoItemPorCodigoETipo === 'function') {
                    let precoDinamico = window.obterPrecoItemPorCodigoETipo(cod, tipoRadio, estadoSelecionado, tabela);
                    if (precoDinamico > 0) precoUn = precoDinamico;
                }
                
                const undDisplay = item.unidade || item['Unidade'] || und;
                resultados.push({ tag: tagHtml, codigo: cod, descricao: desc, unidade: undDisplay.toUpperCase(), preco: parseFloat(precoUn) || 0, tipo: tipoRadio });
            }
        });
    };

    // Função auxiliar para juntar a base principal com o Fallback de SP
    const juntarComFallbackSP = (basePrincipal, baseSP) => {
        if (!basePrincipal) return [];
        if (!baseSP) return basePrincipal;
        const codigosPrincipais = new Set(basePrincipal.map(i => i['Código']));
        const itensExtrasSP = baseSP.filter(i => !codigosPrincipais.has(i['Código']));
        return [...basePrincipal, ...itensExtrasSP];
    };

    // Aplicação das regras de ponteiros das bases dinâmicas
    if (document.getElementById('chk-base-sinapi-comp').checked) {
        const base = (tabela === 'desonerada') ? window.appState.databases.sinapi_ccd : window.appState.databases.sinapi_csd;
        const baseSP = (tabela === 'desonerada') ? window.appState.databases.sinapi_ccd_sp : window.appState.databases.sinapi_csd_sp;
        varrerBase('sinapi_composicoes', juntarComFallbackSP(base, baseSP), '<span class="badge" style="background:#0ea5e9;color:white;padding:3px 6px;border-radius:4px;font-size:0.75rem;">SINAPI</span>', 'composicao');
    }
    
    if (document.getElementById('chk-base-sinapi-ins').checked) {
        const base = (tabela === 'desonerada') ? window.appState.databases.sinapi_icd : window.appState.databases.sinapi_isd;
        const baseSP = (tabela === 'desonerada') ? window.appState.databases.sinapi_icd_sp : window.appState.databases.sinapi_isd_sp;
        varrerBase('sinapi_insumos', juntarComFallbackSP(base, baseSP), '<span class="badge" style="background:#0284c7;color:white;padding:3px 6px;border-radius:4px;font-size:0.75rem;">SINAPI-INS</span>', 'insumo');
    }
    
    if (document.getElementById('chk-base-sco-comp').checked) {
        const base = (tabela === 'desonerada') ? window.appState.databases.sco_ccd : window.appState.databases.sco_csd;
        varrerBase('sco_composicoes', base, '<span class="badge" style="background:#10b981;color:white;padding:3px 6px;border-radius:4px;font-size:0.75rem;">SCO</span>', 'sco_composicao');
    }
    
    if (document.getElementById('chk-base-sco-ins').checked) {
        const base = (tabela === 'desonerada') ? window.appState.databases.sco_icd : window.appState.databases.sco_isd;
        varrerBase('sco_insumos', base, '<span class="badge" style="background:#059669;color:white;padding:3px 6px;border-radius:4px;font-size:0.75rem;">SCO-INS</span>', 'sco_insumo');
    }
    
    if (document.getElementById('chk-base-propria').checked) {
        varrerBase('base_propria', window.appState.databases.base_propria, '<span class="badge" style="background:#8b5cf6;color:white;padding:3px 6px;border-radius:4px;font-size:0.75rem;">PRÓPRIA</span>', 'base_propria');
    }

    // Ordenação (Alfabeto vs Menor Preço)
    if (ordenacao === 'preco-asc') {
        resultados.sort((a, b) => a.preco - b.preco);
    } else {
        resultados.sort((a, b) => a.descricao.localeCompare(b.descricao));
    }

    const limite = 200; 
    const exibidos = resultados.slice(0, limite);
    window.appState.searchResult = exibidos;
    
    if (exibidos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center" style="color: var(--danger); padding: 20px;">Nenhum item encontrado. Tente ajustar os filtros ou a unidade.</td></tr>';
        return;
    }

    // 3. RENDERIZAÇÃO DA TABELA HTML
    tbody.innerHTML = exibidos.map((r, idx) => `
        <tr>
            <td style="vertical-align: middle;">${r.tag}</td>
            <td style="vertical-align: middle;"><strong>${r.codigo}</strong></td>
            <td style="font-size: 0.85rem; vertical-align: middle;">${r.descricao}</td>
            <td class="text-center" style="vertical-align: middle;">${r.unidade}</td>
            <td class="text-right" style="vertical-align: middle; color: var(--primary); font-weight: bold;">R$ ${r.preco.toFixed(2).replace('.', ',')}</td>
            <td class="text-center" style="vertical-align: middle; white-space: nowrap;">
                <button class="btn btn-sm btn-success" style="padding: 4px 8px; font-weight: bold;" onclick="adicionarDiretoDaBusca(${idx}, this)" title="Adicionar direto ao orçamento (Qtd = 1)">➕ Direto</button>
                <button class="btn btn-sm btn-outline" style="padding: 4px 8px;" onclick="preencherFormularioDaBusca(${idx})" title="Preencher no formulário (para fatiar ou informar memória)">📝</button>
            </td>
        </tr>
    `).join('');

    if (resultados.length > limite) {
        tbody.innerHTML += `<tr><td colspan="6" class="text-center" style="color: var(--text-muted); font-size: 0.85rem; padding: 10px;">Foram encontrados ${resultados.length} resultados. Mostrando os primeiros ${limite}.</td></tr>`;
    }
};
