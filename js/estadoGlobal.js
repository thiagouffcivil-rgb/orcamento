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
    searchResult: [],
    fabricaRecipe: [],
    cachedMaoDeObra: [],
    cachedMateriaisABC: [],
    cachedServicosABC: [],
    orcamento: [],
    nextId: 1,
    bancoPrazos: [],            // Usado pelo Gráfico de Gantt
    baseComposicoesPrazos: {}   // Usado pela Fábrica IA
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
    return Math.round((parseFloat(valor) || 0) * 100) / 100;
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
    if (evt) evt.currentTarget.classList.add("active");
};