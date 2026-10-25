// ==========================================
// 1. ESTADO GLOBAL DA APLICAÇÃO (Memória)
// ==========================================
// Usamos window.appState para garantir que qualquer outro ficheiro JS acede à mesma memória
window.appState = {
    databases: {
        sinapi_csd: [], sinapi_ccd: [], sinapi_isd: [], sinapi_icd: [], sinapi_analitico: [],
        sco_csd: [], sco_ccd: [], sco_isd: [], sco_icd: [], sco_analitico: [], base_propria: [],
        sinapi_csd_sp: [], sinapi_ccd_sp: [], sinapi_isd_sp: [], sinapi_icd_sp: [] // SP Fallback
    },
    loadedCacheMeta: {
        dataBase: null,
        estado: null,
        isLoading: false
    },
    searchResult: [],
    fabricaRecipe: [],
    cachedMaoDeObra: [],
    cachedMateriaisABC: [],
    cachedServicosABC: [],
    orcamento: [],
    nextId: 1,
    bancoPrazos: [],            // Usado pelo Gráfico de Gantt
    baseComposicoesPrazos: {},  // Usado pela Fábrica IA
    composicaoBdi: {
        padrao: { ac: 4.00, sg: 0.80, r: 1.27, df: 1.23, l: 7.40, pis: 0.65, cofins: 3.00, iss: 2.50, cprb: 0.00 },
        diferenciado: { ac: 3.00, sg: 0.48, r: 0.56, df: 0.85, l: 5.11, pis: 0.65, cofins: 3.00, iss: 0.00, cprb: 0.00 }
    }
};

// ==========================================
// 2. FUNÇÕES UTILITÁRIAS GLOBAIS
// ==========================================

// Formatador visual para moeda (R$ 0,00)
window.currencyFormatter = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
});

window.formatBRL = function(valor) {
    return window.currencyFormatter.format(parseFloat(valor) || 0);
};

// Função universal de arredondamento financeiro (2 casas decimais exatas para o TCU)
window.arredondarMoeda = function(valor) {
    return Math.round(((parseFloat(valor) || 0) + Number.EPSILON) * 100) / 100;
};

// Fórmula Oficial do Acórdão 2622/2013 - TCU para cálculo do BDI (%)
window.calcularFormulaBdiTCU = function(p) {
    const ac = (parseFloat(p.ac) || 0) / 100;
    const sg = (parseFloat(p.sg) || 0) / 100;
    const r = (parseFloat(p.r) || 0) / 100;
    const df = (parseFloat(p.df) || 0) / 100;
    const l = (parseFloat(p.l) || 0) / 100;
    const tributos = ((parseFloat(p.pis) || 0) + (parseFloat(p.cofins) || 0) + (parseFloat(p.iss) || 0) + (parseFloat(p.cprb) || 0)) / 100;
    if (tributos >= 0.99) return 0;
    const bdi = (((1 + ac + sg + r) * (1 + df) * (1 + l)) / (1 - tributos)) - 1;
    return window.arredondarMoeda(bdi * 100);
};

// Retorna o percentual de BDI aplicável ao item (Padrão ou Diferenciado para Equipamentos)
window.obterBdiDoItem = function(item, bdiPadraoFallback, bdiDifFallback) {
    const bdiPadrao = bdiPadraoFallback !== undefined ? (parseFloat(bdiPadraoFallback) || 0) : (parseFloat(document.getElementById('input-bdi')?.value) || 0);
    const bdiDif = bdiDifFallback !== undefined ? (parseFloat(bdiDifFallback) || 0) : (parseFloat(document.getElementById('input-bdi-dif')?.value) || 0);
    return (item && item.usarBdiDiferenciado) ? bdiDif : bdiPadrao;
};

// Obtém os dados do Orçamentista / Responsável Técnico preenchidos no cabeçalho
window.obterDadosOrcamentista = function() {
    return {
        nome: document.getElementById('input-obra-orcamentista')?.value.trim() || '',
        cargo: document.getElementById('input-obra-cargo')?.value.trim() || 'Engenheiro(a) / Arquiteto(a) Orçamentista',
        registro: document.getElementById('input-obra-registro')?.value.trim() || '',
        art: document.getElementById('input-obra-art')?.value.trim() || 'ANEXADA AO PROCESSO'
    };
};

// Cálculo padronizado TCU/INCA por linha (garante Tela == CSV == Curva ABC == Excel)
window.calcularValoresItemTCU = function(precoUnitarioBruto, qtd, bdiPerc) {
    const quantidade = parseFloat(qtd) || 0;
    const bdi = parseFloat(bdiPerc) || 0;
    const precoUn = window.arredondarMoeda(precoUnitarioBruto);
    const precoComBdi = window.arredondarMoeda(precoUn * (1 + bdi / 100));
    const subtotalSemBdi = window.arredondarMoeda(precoUn * quantidade);
    const totalComBdi = window.arredondarMoeda(precoComBdi * quantidade);
    return { precoUn, precoComBdi, subtotalSemBdi, totalComBdi, bdiAplicado: bdi };
};

// Avaliador seguro para expressões matemáticas da Memória de Cálculo
window.avaliarFormulaSegura = function(expressao) {
    if (!expressao || typeof expressao !== 'string') return NaN;
    const limpa = expressao.replace(/\s+/g, '');
    if (!limpa || !/^[0-9+\-*/().]+$/.test(limpa)) return NaN;
    try {
        const resultado = Function('"use strict";return (' + limpa + ')')();
        return (typeof resultado === 'number' && !isNaN(resultado) && isFinite(resultado)) ? resultado : NaN;
    } catch (e) {
        return NaN;
    }
};

// Comparador natural de códigos EAP (ex: 1.0, 1.1, 1.2, 1.10, 1.10.A, 2.0)
window.compararEAP = function(eapA, eapB) {
    const partesA = String(eapA || '').trim().split('.');
    const partesB = String(eapB || '').trim().split('.');
    const maxLen = Math.max(partesA.length, partesB.length);

    for (let i = 0; i < maxLen; i++) {
        const segA = partesA[i];
        const segB = partesB[i];
        if (segA === undefined) return -1;
        if (segB === undefined) return 1;
        if (segA === segB) continue;

        const numA = Number(segA);
        const numB = Number(segB);
        if (!isNaN(numA) && !isNaN(numB)) {
            if (numA !== numB) return numA - numB;
        } else {
            return String(segA).localeCompare(String(segB), 'pt-BR', { numeric: true, sensitivity: 'base' });
        }
    }
    return 0;
};

// Calcula os subtotais (com e sem BDI) de cada etapa considerando a hierarquia EAP ou blocos sequenciais
window.calcularSubtotaisPorEtapa = function(orcamentoLista, estado, tabela, bdiPerc, bdiDifPerc) {
    const lista = orcamentoLista || window.appState.orcamento || [];
    const etapas = lista.filter(i => i.tipo === 'etapa').map(et => ({
        id: et.id,
        eap: String(et.itemEap || '').trim(),
        prefixo: String(et.itemEap || '').trim().replace(/\.0+$/, ''),
        descricao: et.descricao,
        subtotalSemBdi: 0,
        totalComBdi: 0,
        qtdItens: 0
    }));

    const mapaPorId = {};
    etapas.forEach(e => { mapaPorId[e.id] = e; });

    let ultimaEtapaSequencial = null;
    lista.forEach(item => {
        if (item.tipo === 'etapa') {
            ultimaEtapaSequencial = mapaPorId[item.id];
            return;
        }

        const precoUnBruto = window.obterPrecoAtualizadoDoItem(item, estado, tabela);
        const bdiItem = window.obterBdiDoItem(item, bdiPerc, bdiDifPerc);
        const { subtotalSemBdi, totalComBdi } = window.calcularValoresItemTCU(precoUnBruto, item.qtd, bdiItem);
        const itemEapStr = String(item.itemEap || '').trim();

        let matchedHierarchy = false;
        etapas.forEach(et => {
            if (et.prefixo && (itemEapStr === et.prefixo || itemEapStr.startsWith(et.prefixo + '.'))) {
                et.subtotalSemBdi = window.arredondarMoeda(et.subtotalSemBdi + subtotalSemBdi);
                et.totalComBdi = window.arredondarMoeda(et.totalComBdi + totalComBdi);
                et.qtdItens++;
                matchedHierarchy = true;
            }
        });

        // Fallback sequencial se o código EAP do item não seguir o prefixo da etapa acima dele
        if (!matchedHierarchy && ultimaEtapaSequencial) {
            ultimaEtapaSequencial.subtotalSemBdi = window.arredondarMoeda(ultimaEtapaSequencial.subtotalSemBdi + subtotalSemBdi);
            ultimaEtapaSequencial.totalComBdi = window.arredondarMoeda(ultimaEtapaSequencial.totalComBdi + totalComBdi);
            ultimaEtapaSequencial.qtdItens++;
        }
    });

    return { listaEtapas: etapas, mapaPorId };
};

// Persistência automática em localStorage para evitar perda acidental (F5)
const STORAGE_KEY_ORCAMENTO = 'diengi_orcamento_autosave_v1';

window.salvarEstadoLocal = function() {
    try {
        const payload = {
            orcamento: window.appState.orcamento || [],
            nextId: window.appState.nextId || 1,
            base_propria: (window.appState.databases && window.appState.databases.base_propria) ? window.appState.databases.base_propria : [],
            baseComposicoesPrazos: window.appState.baseComposicoesPrazos || {},
            composicaoBdi: window.appState.composicaoBdi || null,
            dataInicioObra: document.getElementById('input-data-inicio-obra')?.value || window.appState.dataInicioObra || '',
            orcamentoAtualId: window.orcamentoAtualId || null,
            orcamentoAtualNome: window.orcamentoAtualNome || null,
            configuracoes: {
                estado: document.getElementById('select-estado')?.value || 'RJ',
                tabela: document.getElementById('select-tabela')?.value || 'nao_desonerada',
                bdi: document.getElementById('input-bdi')?.value || '22.30',
                bdiDif: document.getElementById('input-bdi-dif')?.value || '14.02',
                data_base: document.getElementById('select-data-base')?.value || '2026_09',
                nomeObra: document.getElementById('input-obra-nome')?.value || '',
                local: document.getElementById('input-obra-local')?.value || '',
                processo: document.getElementById('input-obra-processo')?.value || '',
                revisao: document.getElementById('input-obra-revisao')?.value || 'R00',
                orcamentista: document.getElementById('input-obra-orcamentista')?.value || '',
                cargoOrcamentista: document.getElementById('input-obra-cargo')?.value || '',
                registroOrcamentista: document.getElementById('input-obra-registro')?.value || '',
                artObra: document.getElementById('input-obra-art')?.value || ''
            },
            salvoEm: new Date().toISOString()
        };
        localStorage.setItem(STORAGE_KEY_ORCAMENTO, JSON.stringify(payload));
    } catch (e) {
        console.warn('Não foi possível salvar rascunho no localStorage:', e);
    }
};

window.carregarEstadoLocal = function() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY_ORCAMENTO);
        if (!raw) return false;
        const dados = JSON.parse(raw);
        if (!dados) return false;

        if (Array.isArray(dados.orcamento) && dados.orcamento.length > 0) {
            window.appState.orcamento = dados.orcamento;
            window.appState.nextId = Math.max(...dados.orcamento.map(i => i.id || 0), 0) + 1;
        }
        if (Array.isArray(dados.base_propria) && dados.base_propria.length > 0) {
            window.appState.databases.base_propria = dados.base_propria;
        }
        if (dados.baseComposicoesPrazos && typeof dados.baseComposicoesPrazos === 'object') {
            window.appState.baseComposicoesPrazos = dados.baseComposicoesPrazos;
        }
        if (dados.composicaoBdi && typeof dados.composicaoBdi === 'object') {
            window.appState.composicaoBdi = dados.composicaoBdi;
        }
        if (dados.dataInicioObra) {
            window.appState.dataInicioObra = dados.dataInicioObra;
            const inputData = document.getElementById('input-data-inicio-obra');
            if (inputData) inputData.value = dados.dataInicioObra;
        }
        if (dados.orcamentoAtualId) {
            window.orcamentoAtualId = dados.orcamentoAtualId;
            window.orcamentoAtualNome = dados.orcamentoAtualNome || null;
        }
        if (dados.configuracoes) {
            const cfg = dados.configuracoes;
            if (cfg.estado && document.getElementById('select-estado')) document.getElementById('select-estado').value = cfg.estado;
            if (cfg.tabela && document.getElementById('select-tabela')) document.getElementById('select-tabela').value = cfg.tabela;
            if (cfg.bdi && document.getElementById('input-bdi')) document.getElementById('input-bdi').value = cfg.bdi;
            if (cfg.bdiDif && document.getElementById('input-bdi-dif')) document.getElementById('input-bdi-dif').value = cfg.bdiDif;
            if (cfg.data_base && document.getElementById('select-data-base')) document.getElementById('select-data-base').value = cfg.data_base;
            if (cfg.nomeObra !== undefined && document.getElementById('input-obra-nome')) document.getElementById('input-obra-nome').value = cfg.nomeObra;
            if (cfg.local !== undefined && document.getElementById('input-obra-local')) document.getElementById('input-obra-local').value = cfg.local;
            if (cfg.processo !== undefined && document.getElementById('input-obra-processo')) document.getElementById('input-obra-processo').value = cfg.processo;
            if (cfg.revisao !== undefined && document.getElementById('input-obra-revisao')) document.getElementById('input-obra-revisao').value = cfg.revisao;
            if (cfg.orcamentista !== undefined && document.getElementById('input-obra-orcamentista')) document.getElementById('input-obra-orcamentista').value = cfg.orcamentista;
            if (cfg.cargoOrcamentista !== undefined && document.getElementById('input-obra-cargo')) document.getElementById('input-obra-cargo').value = cfg.cargoOrcamentista;
            if (cfg.registroOrcamentista !== undefined && document.getElementById('input-obra-registro')) document.getElementById('input-obra-registro').value = cfg.registroOrcamentista;
            if (cfg.artObra !== undefined && document.getElementById('input-obra-art')) document.getElementById('input-obra-art').value = cfg.artObra;
        }
        return true;
    } catch (e) {
        console.warn('Erro ao restaurar rascunho local:', e);
        return false;
    }
};

// Motor invisível para descarregar ficheiros (CSV, JSON, etc.) gerados pelo navegador
window.downloadArquivo = function(conteudo, nomeArquivo, mimeType) {
    const blob = new Blob([conteudo], { type: mimeType }); 
    const url = URL.createObjectURL(blob); 
    const a = document.createElement('a'); 
    a.href = url; 
    a.download = nomeArquivo; 
    document.body.appendChild(a); 
    a.click(); 
    document.body.removeChild(a); 
    URL.revokeObjectURL(url);
};

// ==========================================
// 3. NAVEGAÇÃO DA INTERFACE
// ==========================================

// Função responsável por alternar as abas do menu superior
window.abrirAba = function(evt, nomeAba) {
    const conteudos = document.getElementsByClassName("tab-content");
    for (let i = 0; i < conteudos.length; i++) {
        conteudos[i].classList.remove("active");
    }
    
    const botoes = document.getElementsByClassName("tab-btn");
    for (let i = 0; i < botoes.length; i++) {
        botoes[i].classList.remove("active");
    }
    
    document.getElementById(nomeAba).classList.add("active");
    if (evt && evt.currentTarget) evt.currentTarget.classList.add("active");
};
