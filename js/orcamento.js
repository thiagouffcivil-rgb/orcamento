// ==========================================
// 1. CARREGAMENTO DAS BASES DE DADOS (GITHUB)
// ==========================================
window.carregarBases = function() {
    const dataBase = document.getElementById('select-data-base').value; 
    const estado = document.getElementById('select-estado').value; 

    const githubUrlRaiz = `https://raw.githubusercontent.com/thiagouffcivil-rgb/orcamento/main/${dataBase}/`;
    const githubUrlEstados = `${githubUrlRaiz}Por_Estado/`;

    const urlScoCSD = `${githubUrlEstados}sco_csd_${dataBase}.json`;
    const urlScoCCD = `${githubUrlEstados}sco_ccd_${dataBase}.json`;
    const urlScoISD = `${githubUrlEstados}sco_isd_${dataBase}.json`;
    const urlScoICD = `${githubUrlEstados}sco_icd_${dataBase}.json`;

    const urlSinapiCSD = `${githubUrlEstados}sinapi_csd_${dataBase}_${estado}.json`;
    const urlSinapiCCD = `${githubUrlEstados}sinapi_ccd_${dataBase}_${estado}.json`;
    const urlSinapiISD = `${githubUrlEstados}sinapi_isd_${dataBase}_${estado}.json`;
    const urlSinapiICD = `${githubUrlEstados}sinapi_icd_${dataBase}_${estado}.json`;

    // SP FALLBACK URLs
    const urlSinapiCSD_SP = `${githubUrlEstados}sinapi_csd_${dataBase}_SP.json`;
    const urlSinapiCCD_SP = `${githubUrlEstados}sinapi_ccd_${dataBase}_SP.json`;
    const urlSinapiISD_SP = `${githubUrlEstados}sinapi_isd_${dataBase}_SP.json`;
    const urlSinapiICD_SP = `${githubUrlEstados}sinapi_icd_${dataBase}_SP.json`;

    const urlScoAnalitico = `${githubUrlRaiz}sco_analitico_${dataBase}.json`;
    const urlSinapiAnalitico = `${githubUrlRaiz}sinapi_analitico_${dataBase}.json`;

    Promise.all([
        fetch(urlScoCSD).then(res => res.ok ? res.json() : []),
        fetch(urlScoCCD).then(res => res.ok ? res.json() : []),
        fetch(urlScoISD).then(res => res.ok ? res.json() : []),
        fetch(urlScoICD).then(res => res.ok ? res.json() : []),
        fetch(urlSinapiCSD).then(res => res.ok ? res.json() : []),
        fetch(urlSinapiCCD).then(res => res.ok ? res.json() : []),
        fetch(urlSinapiISD).then(res => res.ok ? res.json() : []),
        fetch(urlSinapiICD).then(res => res.ok ? res.json() : []),
        fetch(urlScoAnalitico).then(res => res.ok ? res.json() : []),
        fetch(urlSinapiAnalitico).then(res => res.ok ? res.json() : []),
        // Carregar SP Fallback (Lida com o erro silenciosamente se não encontrar)
        fetch(urlSinapiCSD_SP).then(res => res.ok ? res.json() : []),
        fetch(urlSinapiCCD_SP).then(res => res.ok ? res.json() : []),
        fetch(urlSinapiISD_SP).then(res => res.ok ? res.json() : []),
        fetch(urlSinapiICD_SP).then(res => res.ok ? res.json() : [])
    ]).then(([
        scoOnerada, scoDesonerada, scoInsOnerado, scoInsDesonerado, 
        sinapiOnerada, sinapiDesonerada, sinapiInsOnerado, sinapiInsDesonerado,
        scoAnalitico, sinapiAnalitico,
        sinapiOneradaSP, sinapiDesoneradaSP, sinapiInsOneradoSP, sinapiInsDesoneradoSP
    ]) => {
        window.appState.databases.sco_csd = scoOnerada;
        window.appState.databases.sco_ccd = scoDesonerada;
        window.appState.databases.sco_isd = scoInsOnerado;
        window.appState.databases.sco_icd = scoInsDesonerado;
        
        window.appState.databases.sinapi_csd = sinapiOnerada;
        window.appState.databases.sinapi_ccd = sinapiDesonerada;
        window.appState.databases.sinapi_isd = sinapiInsOnerado;
        window.appState.databases.sinapi_icd = sinapiInsDesonerado;

        window.appState.databases.sinapi_csd_sp = sinapiOneradaSP;
        window.appState.databases.sinapi_ccd_sp = sinapiDesoneradaSP;
        window.appState.databases.sinapi_isd_sp = sinapiInsOneradoSP;
        window.appState.databases.sinapi_icd_sp = sinapiInsDesoneradoSP;
        
        window.appState.databases.sco_analitico = scoAnalitico;
        window.appState.databases.sinapi_analitico = sinapiAnalitico;

        window.atualizarOrcamentoEBusca();
        console.log("Bases de dados (incluindo SP Fallback) carregadas com sucesso!");
    }).catch(erro => {
        console.error("Erro ao carregar as bases do GitHub:", erro);
    });
};

// ==========================================
// 2. BUSCADOR DE PREÇOS (NÚCLEO COM SP FALLBACK)
// ==========================================
window.obterPrecoItemPorCodigoETipo = function(codigo, tipo, estadoConfig, tabela) {
    if (tipo === 'avulso_inventado') {
        const itemExistente = window.appState.fabricaRecipe.find(i => String(i.codigoItem).trim() === String(codigo).trim());
        return itemExistente ? (parseFloat(itemExistente.precoUnitario) || 0) : 0;
    }

    const isSCO = (tipo === 'sco_composicao' || tipo === 'sco_insumo' || String(codigo).startsWith('MAT') || String(codigo).startsWith('MOD') || String(codigo).startsWith('MOI') || String(codigo).startsWith('EQ ') || String(codigo).startsWith('IEQ') || String(codigo).startsWith('REQ') || String(codigo).startsWith('AD ') || String(codigo).startsWith('SCO'));
    
    let estadoEfetivo = isSCO ? 'RJ' : estadoConfig;
    let baseData = [];
    let baseDataSP = [];
    let tipoEfetivo = tipo;

    // Auto-correção para itens SCO que cheguem com tipo genérico
    if (isSCO && tipo === 'composicao') tipoEfetivo = 'sco_composicao';
    if (isSCO && tipo === 'insumo') tipoEfetivo = 'sco_insumo';

    if (tipoEfetivo === 'composicao') {
        baseData = (tabela === 'desonerada') ? window.appState.databases.sinapi_ccd : window.appState.databases.sinapi_csd;
        baseDataSP = (tabela === 'desonerada') ? window.appState.databases.sinapi_ccd_sp : window.appState.databases.sinapi_csd_sp;
    } else if (tipoEfetivo === 'insumo') {
        baseData = (tabela === 'desonerada') ? window.appState.databases.sinapi_icd : window.appState.databases.sinapi_isd;
        baseDataSP = (tabela === 'desonerada') ? window.appState.databases.sinapi_icd_sp : window.appState.databases.sinapi_isd_sp;
    } else if (tipoEfetivo === 'sco_composicao') {
        baseData = (tabela === 'desonerada') ? window.appState.databases.sco_ccd : window.appState.databases.sco_csd;
    } else if (tipoEfetivo === 'sco_insumo') {
        baseData = (tabela === 'desonerada') ? window.appState.databases.sco_icd : window.appState.databases.sco_isd;
    } else if (tipoEfetivo === 'base_propria') {
        baseData = window.appState.databases.base_propria;
    }

    let dbItem = baseData.find(i => String(i['Código']).trim() === String(codigo).trim());

    // BUSCA CRUZADA: Se a base analítica classificou errado
    if (!dbItem) {
        if (isSCO) {
            const outraBaseSCO = (tipoEfetivo === 'sco_composicao') ? ((tabela === 'desonerada') ? window.appState.databases.sco_icd : window.appState.databases.sco_isd) : ((tabela === 'desonerada') ? window.appState.databases.sco_ccd : window.appState.databases.sco_csd);
            dbItem = outraBaseSCO.find(i => String(i['Código']).trim() === String(codigo).trim());
        } else if (tipoEfetivo !== 'base_propria') {
            const outraBaseSINAPI = (tipoEfetivo === 'composicao') ? ((tabela === 'desonerada') ? window.appState.databases.sinapi_icd : window.appState.databases.sinapi_isd) : ((tabela === 'desonerada') ? window.appState.databases.sinapi_ccd : window.appState.databases.sinapi_csd);
            dbItem = outraBaseSINAPI.find(i => String(i['Código']).trim() === String(codigo).trim());
        }
    }

    // FALLBACK PARA SP (Apenas SINAPI)
    if (!dbItem && !isSCO && tipoEfetivo !== 'base_propria' && estadoEfetivo !== 'SP') {
        dbItem = baseDataSP.find(i => String(i['Código']).trim() === String(codigo).trim());
        if (!dbItem) {
            const outraBaseSINAPI_SP = (tipoEfetivo === 'composicao') ? ((tabela === 'desonerada') ? window.appState.databases.sinapi_icd_sp : window.appState.databases.sinapi_isd_sp) : ((tabela === 'desonerada') ? window.appState.databases.sinapi_ccd_sp : window.appState.databases.sinapi_csd_sp);
            dbItem = outraBaseSINAPI_SP.find(i => String(i['Código']).trim() === String(codigo).trim());
        }
        if (dbItem) estadoEfetivo = 'SP';
    }

    if (dbItem) {
        let val = dbItem[estadoEfetivo];
        if (val === undefined || val === null || parseFloat(val) === 0) {
            if (isSCO) val = dbItem['RJ'];
            else if (tipoEfetivo !== 'base_propria' && estadoEfetivo !== 'SP') {
                const dbItemSP = baseDataSP.find(i => String(i['Código']).trim() === String(codigo).trim());
                if (dbItemSP && dbItemSP['SP']) val = dbItemSP['SP'];
                else {
                    const outraBaseSINAPI_SP = (tipoEfetivo === 'composicao') ? ((tabela === 'desonerada') ? window.appState.databases.sinapi_icd_sp : window.appState.databases.sinapi_isd_sp) : ((tabela === 'desonerada') ? window.appState.databases.sinapi_ccd_sp : window.appState.databases.sinapi_csd_sp);
                    const dbItemSPCruzado = outraBaseSINAPI_SP.find(i => String(i['Código']).trim() === String(codigo).trim());
                    if (dbItemSPCruzado && dbItemSPCruzado['SP']) val = dbItemSPCruzado['SP'];
                }
            }
        }
        return parseFloat(val) || 0;
    }
    return 0;
};

window.obterPrecoAtualizadoDoItem = function(item, estadoConfig, tabela) {
    if (item.tipo === 'etapa' || item.tipo === 'item_avulso') return parseFloat(item.precoUnitario) || 0;
    return window.obterPrecoItemPorCodigoETipo(item.codigo, item.tipo, estadoConfig, tabela);
};

// ==========================================
// 3. BUSCA GLOBAL (PAINEL SUPERIOR)
// ==========================================
window.executarBuscaGlobal = function() {
    const termoBruto = document.getElementById('input-busca').value.trim().toLowerCase();
    if (!termoBruto) { alert("Digite pelo menos um termo."); return; }

    const incluirSinapiComp = document.getElementById('chk-base-sinapi-comp').checked; 
    const incluirSinapiIns = document.getElementById('chk-base-sinapi-ins').checked;
    const incluirScoComp = document.getElementById('chk-base-sco-comp').checked; 
    const incluirScoIns = document.getElementById('chk-base-sco-ins').checked;
    const incluirBasePropria = document.getElementById('chk-base-propria').checked; 
    const criterioOrdenacao = document.getElementById('select-ordenacao').value;
    const estadoConfig = document.getElementById('select-estado').value; 
    const tabela = document.getElementById('select-tabela').value;

    let resultadosBrutos = [];
    const containerResultados = document.getElementById('tbody-busca-resultados');
    containerResultados.innerHTML = `<tr><td colspan="6" class="text-center" style="padding: 20px; color: var(--text-muted);">A pesquisar...</td></tr>`;

    const termosBusca = termoBruto.split(/\s+/);

    if (incluirSinapiComp) {
        const base = (tabela === 'desonerada') ? window.appState.databases.sinapi_ccd : window.appState.databases.sinapi_csd;
        const baseSP = (tabela === 'desonerada') ? window.appState.databases.sinapi_ccd_sp : window.appState.databases.sinapi_csd_sp;
        const baseSet = new Set(base.map(i => i['Código']));

        const processItem = (item, isFallback) => {
            const textoItem = ((item['Código'] || '') + " " + (item['Descrição'] || '')).toLowerCase();
            if (termosBusca.every(t => textoItem.includes(t))) {
                const preco = window.obterPrecoItemPorCodigoETipo(item['Código'], 'composicao', estadoConfig, tabela);
                resultadosBrutos.push({ codigo: item['Código'], descricao: item['Descrição'], unidade: item['Unidade'] || 'UN', preco: preco, tipoBase: 'composicao', baseOrigem: isFallback ? 'Comp. SINAPI (SP)' : 'Comp. SINAPI', badgeCor: 'var(--primary)' });
            }
        };
        base.forEach(item => processItem(item, false));
        baseSP.forEach(item => { if (!baseSet.has(item['Código'])) processItem(item, true); });
    }

    if (incluirSinapiIns) {
        const base = (tabela === 'desonerada') ? window.appState.databases.sinapi_icd : window.appState.databases.sinapi_isd;
        const baseSP = (tabela === 'desonerada') ? window.appState.databases.sinapi_icd_sp : window.appState.databases.sinapi_isd_sp;
        const baseSet = new Set(base.map(i => i['Código']));

        const processItem = (item, isFallback) => {
            const textoItem = ((item['Código'] || '') + " " + (item['Descrição'] || '')).toLowerCase();
            if (termosBusca.every(t => textoItem.includes(t))) {
                const preco = window.obterPrecoItemPorCodigoETipo(item['Código'], 'insumo', estadoConfig, tabela);
                resultadosBrutos.push({ codigo: item['Código'], descricao: item['Descrição'], unidade: item['Unidade'] || 'UN', preco: preco, tipoBase: 'insumo', baseOrigem: isFallback ? 'Insumo SINAPI (SP)' : 'Insumo SINAPI', badgeCor: 'var(--info)' });
            }
        };
        base.forEach(item => processItem(item, false));
        baseSP.forEach(item => { if (!baseSet.has(item['Código'])) processItem(item, true); });
    }

    if (incluirScoComp) {
        const base = (tabela === 'desonerada') ? window.appState.databases.sco_ccd : window.appState.databases.sco_csd;
        base.forEach(item => {
            const textoItem = ((item['Código'] || '') + " " + (item['Descrição'] || '')).toLowerCase();
            if (termosBusca.every(t => textoItem.includes(t))) {
                resultadosBrutos.push({ codigo: item['Código'], descricao: item['Descrição'], unidade: item['Unidade'] || 'UN', preco: parseFloat(item['RJ']) || 0, tipoBase: 'sco_composicao', baseOrigem: 'Comp. SCO', badgeCor: 'var(--purple)' });
            }
        });
    }

    if (incluirScoIns) {
        const base = (tabela === 'desonerada') ? window.appState.databases.sco_icd : window.appState.databases.sco_isd;
        base.forEach(item => {
            const textoItem = ((item['Código'] || '') + " " + (item['Descrição'] || '')).toLowerCase();
            if (termosBusca.every(t => textoItem.includes(t))) {
                resultadosBrutos.push({ codigo: item['Código'], descricao: item['Descrição'], unidade: item['Unidade'] || 'UN', preco: parseFloat(item['RJ']) || 0, tipoBase: 'sco_insumo', baseOrigem: 'Insumo SCO', badgeCor: 'var(--pink)' });
            }
        });
    }

    if (incluirBasePropria) {
        const base = window.appState.databases.base_propria;
        base.forEach(item => {
            const textoItem = ((item['Código'] || '') + " " + (item['Descrição'] || '')).toLowerCase();
            if (termosBusca.every(t => textoItem.includes(t))) {
                const preco = window.obterPrecoItemPorCodigoETipo(item['Código'], 'base_propria', estadoConfig, tabela);
                resultadosBrutos.push({ codigo: item['Código'], descricao: item['Descrição'], unidade: item['Unidade'] || 'UN', preco: preco, tipoBase: 'base_propria', baseOrigem: 'Base Própria', badgeCor: 'var(--success)' });
            }
        });
    }

    resultadosBrutos.sort((a, b) => {
        if (criterioOrdenacao === 'preco-asc') return a.preco - b.preco;
        if (criterioOrdenacao === 'alfabetica') return a.descricao.localeCompare(b.descricao);
        return 0;
    });

    window.appState.searchResult = resultadosBrutos; 
    window.renderizarResultadosBuscaGlobal(resultadosBrutos);
};

window.renderizarResultadosBuscaGlobal = function(lista) {
    const tbody = document.getElementById('tbody-busca-resultados');
    if (!lista || lista.length === 0) { tbody.innerHTML = `<tr><td colspan="6" class="text-center" style="padding: 15px; color: var(--text-muted);">Nenhum item encontrado.</td></tr>`; return; }
    tbody.innerHTML = lista.map(item => {
        const descEscaped = (item.descricao || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
        return `<tr><td><span class="header-badge" style="background: ${item.badgeCor}; font-size: 0.72rem;">${item.baseOrigem}</span></td><td><strong>${item.codigo}</strong></td><td>${item.descricao}</td><td class="text-center">${item.unidade}</td><td class="text-right">${window.formatBRL(item.preco)}</td><td class="text-center"><button class="btn btn-sm btn-primary" onclick="selecionarItemParaFormulario('${item.codigo}', '${descEscaped}', '${item.unidade}', ${item.preco}, '${item.tipoBase}')">✏️ Usar</button></td></tr>`;
    }).join('');
};

window.selecionarItemParaFormulario = function(codigo, descricao, unidade, preco, tipoBase) {
    const radioEl = document.querySelector(`input[name="tipo_lancamento"][value="${tipoBase}"]`);
    if (radioEl) window.selectLancamentoTypeRadio(radioEl.closest('.radio-option'), tipoBase);
    
    document.getElementById('input-add-codigo').value = codigo; 
    document.getElementById('input-add-descricao').value = descricao;
    document.getElementById('input-add-memoria').value = '';
    document.getElementById('input-add-unidade').value = unidade; 
    document.getElementById('input-add-preco').value = preco.toFixed(2);
    document.getElementById('input-add-qtd').focus();
};

// ==========================================
// 4. GESTÃO DO FORMULÁRIO DE ADIÇÃO
// ==========================================
window.selectLancamentoTypeRadio = function(element, tipo) {
    document.querySelectorAll('#lancamento-tipo-group .radio-option').forEach(el => el.classList.remove('selected'));
    element.classList.add('selected');
    element.querySelector('input[type="radio"]').checked = true;
    window.atualizarCamposDinamicosFormulario(tipo);
};

window.atualizarCamposDinamicosFormulario = function(tipo) {
    const groupCodigo = document.getElementById('group-codigo');
    const groupDescricao = document.getElementById('group-descricao');
    const groupGrupo = document.getElementById('group-grupo');
    const groupUnidade = document.getElementById('group-unidade');
    const groupPreco = document.getElementById('group-preco');
    const groupQtd = document.getElementById('group-qtd');
    const inputDescricao = document.getElementById('input-add-descricao');
    const inputUnidade = document.getElementById('input-add-unidade');
    const inputPreco = document.getElementById('input-add-preco');

    if (tipo === 'etapa') {
        groupCodigo.style.display = 'none'; groupGrupo.style.display = 'none';
        groupUnidade.style.display = 'none'; groupPreco.style.display = 'none';
        groupQtd.style.display = 'none'; groupDescricao.classList.add('full-width');
        inputDescricao.removeAttribute('readonly'); inputDescricao.placeholder = "Ex: 1. SERVIÇOS PRELIMINARES E INFRAESTRUTURA";
    } else if (tipo === 'item_avulso') {
        groupCodigo.style.display = 'none'; groupGrupo.style.display = 'flex';
        groupUnidade.style.display = 'flex'; groupPreco.style.display = 'flex';
        groupQtd.style.display = 'flex'; groupDescricao.classList.remove('full-width');
        inputDescricao.removeAttribute('readonly'); inputUnidade.removeAttribute('readonly'); inputPreco.removeAttribute('readonly');
    } else {
        groupCodigo.style.display = 'flex'; groupGrupo.style.display = 'none';
        groupUnidade.style.display = 'flex'; groupPreco.style.display = 'flex';
        groupQtd.style.display = 'flex'; groupDescricao.classList.remove('full-width');
        inputDescricao.setAttribute('readonly', 'true'); inputUnidade.setAttribute('readonly', 'true'); inputPreco.setAttribute('readonly', 'true');
    }
};

window.buscarCodigoParaAdicionar = function() {
    const tipo = document.querySelector('input[name="tipo_lancamento"]:checked').value;
    if (tipo === 'etapa' || tipo === 'item_avulso') return;

    const codigo = document.getElementById('input-add-codigo').value.trim();
    if (!codigo) return;

    const estadoConfig = document.getElementById('select-estado').value;
    const tabela = document.getElementById('select-tabela').value;

    let dbItem = null;
    if (tipo === 'composicao') dbItem = ((tabela === 'desonerada') ? window.appState.databases.sinapi_ccd : window.appState.databases.sinapi_csd).find(i => String(i['Código']) === codigo) || ((tabela === 'desonerada') ? window.appState.databases.sinapi_ccd_sp : window.appState.databases.sinapi_csd_sp).find(i => String(i['Código']) === codigo);
    else if (tipo === 'insumo') dbItem = ((tabela === 'desonerada') ? window.appState.databases.sinapi_icd : window.appState.databases.sinapi_isd).find(i => String(i['Código']) === codigo) || ((tabela === 'desonerada') ? window.appState.databases.sinapi_icd_sp : window.appState.databases.sinapi_isd_sp).find(i => String(i['Código']) === codigo);
    else if (tipo === 'sco_composicao') dbItem = ((tabela === 'desonerada') ? window.appState.databases.sco_ccd : window.appState.databases.sco_csd).find(i => String(i['Código']) === codigo);
    else if (tipo === 'sco_insumo') dbItem = ((tabela === 'desonerada') ? window.appState.databases.sco_icd : window.appState.databases.sco_isd).find(i => String(i['Código']) === codigo);
    else if (tipo === 'base_propria') dbItem = window.appState.databases.base_propria.find(i => String(i['Código']) === codigo);

    if (dbItem) {
        document.getElementById('input-add-descricao').value = dbItem['Descrição'] || '';
        document.getElementById('input-add-unidade').value = dbItem['Unidade'] || '';
        const preco = window.obterPrecoItemPorCodigoETipo(codigo, tipo, estadoConfig, tabela);
        document.getElementById('input-add-preco').value = preco.toFixed(2);
    }
};

window.incrementarEAP = function() {
    const input = document.getElementById('input-item-eap'); 
    const valor = input.value.trim();
    if (!valor) { input.value = '1.1'; return; }
    
    const partes = valor.split('.'); 
    const ultimoIndice = partes.length - 1; 
    const ultimoNumero = parseInt(partes[ultimoIndice], 10);
    
    if (!isNaN(ultimoNumero)) { 
        partes[ultimoIndice] = ultimoNumero + 1; 
        input.value = partes.join('.'); 
    } else { 
        input.value = valor + '.1'; 
    }
};

// ==========================================
// 5. GESTÃO DO ORÇAMENTO (TABELA PRINCIPAL)
// ==========================================
window.adicionarItemAoOrcamento = function() {
    const tipo = document.querySelector('input[name="tipo_lancamento"]:checked').value; 
    const itemEap = document.getElementById('input-item-eap').value.trim();
    const codigo = document.getElementById('input-add-codigo').value.trim(); 
    const descricao = document.getElementById('input-add-descricao').value.trim();
    const unidade = document.getElementById('input-add-unidade').value.trim(); 
    const precoUnitario = parseFloat(document.getElementById('input-add-preco').value) || 0;
    const qtd = parseFloat(document.getElementById('input-add-qtd').value) || 0;
    const memoria = document.getElementById('input-add-memoria')?.value.trim() || '';
    const grupoSelecionado = (tipo === 'item_avulso') ? document.getElementById('select-add-grupo').value : (tipo === 'etapa' ? 'OUTROS' : 'COMPOSICAO');

    if (!descricao) { alert('Por favor, informe a Descrição do item.'); return; }

    window.appState.orcamento.push({ 
        id: window.appState.nextId++, 
        tipo: tipo, 
        itemEap: itemEap || (window.appState.orcamento.length + 1) + '.0', 
        codigo: (tipo === 'etapa' || tipo === 'item_avulso') ? '-' : codigo, 
        descricao: descricao, 
        unidade: tipo === 'etapa' ? '-' : unidade, 
        qtd: tipo === 'etapa' ? 0 : qtd, 
        precoUnitario: tipo === 'etapa' ? 0 : precoUnitario, 
        grupo: grupoSelecionado,
        memoria: tipo === 'etapa' ? '-' : memoria
    });
    
    window.renderizarOrcamento();

    document.getElementById('input-add-codigo').value = ''; 
    document.getElementById('input-add-descricao').value = ''; 
    document.getElementById('input-add-unidade').value = ''; 
    document.getElementById('input-add-preco').value = ''; 
    document.getElementById('input-add-qtd').value = '1.00';
};

window.atualizarQuantidadeItem = function(id, novaQtd) { 
    const item = window.appState.orcamento.find(i => i.id === id); 
    if (item) { 
        item.qtd = parseFloat(novaQtd) || 0; 
        window.renderizarOrcamento(); 
    } 
};

window.atualizarEapItem = function(id, novoEap) {
    const item = window.appState.orcamento.find(i => i.id === id);
    if (item) {
        item.itemEap = novoEap.trim();
        window.renderizarOrcamento();
    }
};

window.atualizarMemoriaItem = function(id, novaMemoria) {
    const item = window.appState.orcamento.find(i => i.id === id);
    if (item) {
        let formula = novaMemoria.trim();
        item.memoria = formula || '-';
        
        if (formula && formula !== '-') {
            try {
                // Substitui vírgulas por pontos e calcula
                formula = formula.replace(/,/g, '.');
                let resultado = Function('"use strict";return (' + formula + ')')();
                if (!isNaN(resultado) && isFinite(resultado)) {
                    item.qtd = parseFloat(parseFloat(resultado).toFixed(3));
                }
            } catch (e) {
                console.warn("Fórmula inválida na memória da tabela.");
            }
        }
        window.renderizarOrcamento();
    }
};

window.removerItemOrcamento = function(id) { 
    window.appState.orcamento = window.appState.orcamento.filter(item => item.id !== id); 
    window.renderizarOrcamento(); 
};

window.moverItem = function(index, direcao) {
    if (direcao === 'cima' && index > 0) { 
        const temp = window.appState.orcamento[index]; 
        window.appState.orcamento[index] = window.appState.orcamento[index - 1]; 
        window.appState.orcamento[index - 1] = temp; 
    } else if (direcao === 'baixo' && index < window.appState.orcamento.length - 1) { 
        const temp = window.appState.orcamento[index]; 
        window.appState.orcamento[index] = window.appState.orcamento[index + 1]; 
        window.appState.orcamento[index + 1] = temp; 
    }
    window.renderizarOrcamento();
};

window.limparOrcamento = function() {
    if (confirm('Tem certeza que deseja limpar todo o orçamento atual?')) {
        window.appState.orcamento = []; 
        window.renderizarOrcamento();
        document.getElementById('container-tabela-mao-de-obra').classList.add('hidden'); 
        document.getElementById('container-tabela-materiais').classList.add('hidden'); 
        document.getElementById('container-abc-orcamento').classList.add('hidden');
    }
};

window.renderizarOrcamento = function() {
    const estado = document.getElementById('select-estado').value; 
    const tabela = document.getElementById('select-tabela').value;
    const bdi = parseFloat(document.getElementById('input-bdi').value) || 0;

    document.getElementById('info-obra-header').innerHTML = `UF: <strong>${estado}</strong> | Tabela: <strong>${tabela === 'desonerada' ? 'Desonerada' : 'Não Desonerada / Onerada'}</strong> | BDI: <strong>${bdi.toFixed(2)}%</strong>`;
    
    const tbody = document.getElementById('tbody-orcamento');
    
    if (window.appState.orcamento.length === 0) { 
        tbody.innerHTML = `<tr><td colspan="10" class="text-center" style="padding: 20px; color: var(--text-muted);">Nenhum item adicionado ao orçamento ainda.</td></tr>`; 
        document.getElementById('summary-subtotal').innerText = window.formatBRL(0); 
        document.getElementById('summary-bdi-valor').innerText = window.formatBRL(0); 
        document.getElementById('summary-total-geral').innerText = window.formatBRL(0); 
        return; 
    }

    let subtotalAcumulado = 0;
    
    tbody.innerHTML = window.appState.orcamento.map((item, index) => {
        if (item.tipo === 'etapa') {
            return `<tr class="row-etapa">
                <td><input type="text" value="${item.itemEap}" title="Editar EAP" style="width: 55px; text-align: center; font-weight: bold; border: 1px solid transparent; background: transparent; cursor: text;" onchange="atualizarEapItem(${item.id}, this.value)" onfocus="this.style.border='1px solid #cbd5e1'; this.style.background='#fff'" onblur="this.style.border='1px solid transparent'; this.style.background='transparent'"></td>
                <td><span class="header-badge" style="background:#475569;">Etapa</span></td>
                <td>-</td><td colspan="6"><strong>${item.descricao}</strong></td>
                <td class="text-center actions-col"><button class="btn btn-sm btn-outline" onclick="moverItem(${index}, 'cima')">⬆️</button> <button class="btn btn-sm btn-outline" onclick="moverItem(${index}, 'baixo')">⬇️</button> <button class="btn btn-sm btn-danger" onclick="removerItemOrcamento(${item.id})">❌</button></td>
            </tr>`;
        }

        const precoUnitarioAtual = window.obterPrecoAtualizadoDoItem(item, estado, tabela);
        const precoComBdi = window.arredondarMoeda(precoUnitarioAtual * (1 + bdi / 100)); 
        const totalLinha = precoComBdi * item.qtd;
        
        subtotalAcumulado += precoUnitarioAtual * item.qtd;

        let badgeCor = 'var(--primary)'; 
        let tipoLabel = 'Comp. SINAPI';
        
        if (item.tipo === 'insumo') { badgeCor = 'var(--info)'; tipoLabel = 'Insumo SINAPI'; }
        else if (item.tipo === 'sco_composicao') { badgeCor = 'var(--purple)'; tipoLabel = 'Comp. SCO (RJ)'; }
        else if (item.tipo === 'sco_insumo') { badgeCor = 'var(--pink)'; tipoLabel = 'Insumo SCO (RJ)'; }
        else if (item.tipo === 'base_propria') { badgeCor = 'var(--success)'; tipoLabel = 'Própria'; }
        else if (item.tipo === 'item_avulso') { badgeCor = 'var(--secondary)'; tipoLabel = `Avulso (${item.grupo || 'Geral'})`; }

        return `<tr>
            <td><input type="text" value="${item.itemEap}" title="Editar EAP" style="width: 55px; text-align: center; font-weight: bold; color: inherit; border: 1px solid transparent; background: transparent; cursor: text;" onchange="atualizarEapItem(${item.id}, this.value)" onfocus="this.style.border='1px solid #cbd5e1'; this.style.background='#fff'" onblur="this.style.border='1px solid transparent'; this.style.background='transparent'"></td>
            <td><span class="header-badge" style="background:${badgeCor}; font-size:0.75rem;">${tipoLabel}</span></td>
            <td>${item.codigo}</td>
            <td>${item.descricao}</td>
            <td class="text-center">${item.unidade}</td>
            <td class="text-right">
                <input type="number" step="0.001" min="0" value="${item.qtd}" style="width: 95px; text-align: right; padding: 4px 6px;" onchange="atualizarQuantidadeItem(${item.id}, this.value)">
                <div style="font-size: 0.75rem; color: #64748b; margin-top: 4px; display: flex; align-items: center; justify-content: flex-end;" title="Editar Memória de Cálculo">
                    <span>🖩</span>
                    <input type="text" value="${(item.memoria && item.memoria !== '-') ? item.memoria : ''}" placeholder="Fórmula" style="width: 75px; font-size: 0.75rem; padding: 2px 4px; border: 1px solid #e2e8f0; border-radius: 3px; margin-left: 4px; text-align: right;" onchange="atualizarMemoriaItem(${item.id}, this.value)">
                </div>
            </td>
            <td class="text-right">${window.formatBRL(precoUnitarioAtual)}</td>
            <td class="text-right">${window.formatBRL(precoComBdi)}</td>
            <td class="text-right"><strong>${window.formatBRL(totalLinha)}</strong></td>
            <td class="text-center actions-col">
                <button class="btn btn-sm btn-outline" onclick="moverItem(${index}, 'cima')">⬆️</button> 
                <button class="btn btn-sm btn-outline" onclick="moverItem(${index}, 'baixo')">⬇️</button> 
                <button class="btn btn-sm btn-danger" onclick="removerItemOrcamento(${item.id})">❌</button>
            </td>
        </tr>`;
    }).join('');

    const valorBdiTotal = subtotalAcumulado * (bdi / 100); 
    const totalGeral = subtotalAcumulado + valorBdiTotal;
    
    document.getElementById('summary-subtotal').innerText = window.formatBRL(subtotalAcumulado); 
    document.getElementById('summary-bdi-perc').innerText = bdi.toFixed(2); 
    document.getElementById('summary-bdi-valor').innerText = window.formatBRL(valorBdiTotal); 
    document.getElementById('summary-total-geral').innerText = window.formatBRL(totalGeral);
};

window.atualizarOrcamentoEBusca = function() { 
    window.renderizarOrcamento(); 
    if (window.appState.searchResult.length > 0) window.executarBuscaGlobal(); 
};

// Inicializa a aplicação ao abrir o ecrã
window.addEventListener('DOMContentLoaded', () => { 
    window.atualizarCamposDinamicosFormulario('etapa'); 
    window.carregarBases(); 
});