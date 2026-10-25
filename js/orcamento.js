// ==========================================
// 1. CARREGAMENTO DAS BASES DE DADOS (GITHUB COM CACHE INTELIGENTE)
// ==========================================
window.atualizarBannerBases = function(mensagem, tipo = 'info') {
    const banner = document.getElementById('status-bases-banner');
    if (!banner) return;
    banner.style.display = 'flex';
    if (tipo === 'loading') {
        banner.style.background = '#eff6ff';
        banner.style.borderColor = '#bfdbfe';
        banner.style.color = '#1e40af';
    } else if (tipo === 'success') {
        banner.style.background = '#f0fdf4';
        banner.style.borderColor = '#bbf7d0';
        banner.style.color = '#166534';
    } else if (tipo === 'error') {
        banner.style.background = '#fef2f2';
        banner.style.borderColor = '#fecaca';
        banner.style.color = '#991b1b';
    }
    banner.innerHTML = mensagem;
};

window.carregarBases = function(forcarTudo = false) {
    const selectDataBase = document.getElementById('select-data-base');
    const selectEstado = document.getElementById('select-estado');
    const dataBase = selectDataBase ? selectDataBase.value : '2026_09';
    const dataBaseTexto = selectDataBase && selectDataBase.options[selectDataBase.selectedIndex]
        ? selectDataBase.options[selectDataBase.selectedIndex].text
        : dataBase;
    const estado = selectEstado ? selectEstado.value : 'RJ';

    const githubUrlRaiz = `https://raw.githubusercontent.com/thiagouffcivil-rgb/orcamento/main/${dataBase}/`;
    const githubUrlEstados = `${githubUrlRaiz}Por_Estado/`;

    const urlSinapiCSD = `${githubUrlEstados}sinapi_csd_${dataBase}_${estado}.json`;
    const urlSinapiCCD = `${githubUrlEstados}sinapi_ccd_${dataBase}_${estado}.json`;
    const urlSinapiISD = `${githubUrlEstados}sinapi_isd_${dataBase}_${estado}.json`;
    const urlSinapiICD = `${githubUrlEstados}sinapi_icd_${dataBase}_${estado}.json`;

    const mesmaDataBaseJaCarregada = !forcarTudo &&
        window.appState.loadedCacheMeta &&
        window.appState.loadedCacheMeta.dataBase === dataBase &&
        Array.isArray(window.appState.databases.sinapi_analitico) &&
        window.appState.databases.sinapi_analitico.length > 0;

    window.appState.loadedCacheMeta.isLoading = true;

    // Se apenas trocou a UF na mesma Data-Base, baixa somente os 4 arquivos estaduais
    if (mesmaDataBaseJaCarregada) {
        window.atualizarBannerBases(`<span>⏳ Carregando preços estaduais SINAPI para <strong>${estado}</strong> (${dataBaseTexto})...</span>`, 'loading');
        Promise.all([
            fetch(urlSinapiCSD).then(res => res.ok ? res.json() : []),
            fetch(urlSinapiCCD).then(res => res.ok ? res.json() : []),
            fetch(urlSinapiISD).then(res => res.ok ? res.json() : []),
            fetch(urlSinapiICD).then(res => res.ok ? res.json() : [])
        ]).then(([sinapiOnerada, sinapiDesonerada, sinapiInsOnerado, sinapiInsDesonerado]) => {
            window.appState.databases.sinapi_csd = sinapiOnerada;
            window.appState.databases.sinapi_ccd = sinapiDesonerada;
            window.appState.databases.sinapi_isd = sinapiInsOnerado;
            window.appState.databases.sinapi_icd = sinapiInsDesonerado;
            window.appState.loadedCacheMeta.estado = estado;
            window.appState.loadedCacheMeta.isLoading = false;

            window.atualizarOrcamentoEBusca();
            window.atualizarBannerBases(
                `<span>✅ <strong>Bases Prontas:</strong> SINAPI (${estado} + Fallback SP) & SCO-RJ | Data-Base: <strong>${dataBaseTexto}</strong></span>` +
                `<span style="font-size:0.8rem; opacity:0.85;">${sinapiOnerada.length.toLocaleString('pt-BR')} comp. SINAPI | ${window.appState.databases.sco_csd.length.toLocaleString('pt-BR')} comp. SCO</span>`,
                'success'
            );
        }).catch(erro => {
            window.appState.loadedCacheMeta.isLoading = false;
            console.error("Erro ao carregar as bases estaduais do GitHub:", erro);
            window.atualizarBannerBases(`<span>⚠️ Erro ao carregar preços de ${estado}. Verifique sua conexão com a internet.</span>`, 'error');
        });
        return;
    }

    const urlScoCSD = `${githubUrlEstados}sco_csd_${dataBase}.json`;
    const urlScoCCD = `${githubUrlEstados}sco_ccd_${dataBase}.json`;
    const urlScoISD = `${githubUrlEstados}sco_isd_${dataBase}.json`;
    const urlScoICD = `${githubUrlEstados}sco_icd_${dataBase}.json`;

    // SP FALLBACK URLs
    const urlSinapiCSD_SP = `${githubUrlEstados}sinapi_csd_${dataBase}_SP.json`;
    const urlSinapiCCD_SP = `${githubUrlEstados}sinapi_ccd_${dataBase}_SP.json`;
    const urlSinapiISD_SP = `${githubUrlEstados}sinapi_isd_${dataBase}_SP.json`;
    const urlSinapiICD_SP = `${githubUrlEstados}sinapi_icd_${dataBase}_SP.json`;

    const urlScoAnalitico = `${githubUrlRaiz}sco_analitico_${dataBase}.json`;
    const urlSinapiAnalitico = `${githubUrlRaiz}sinapi_analitico_${dataBase}.json`;
    const urlEquipesDefault = `${githubUrlRaiz}equipes_default_${dataBase}.json`;

    window.atualizarBannerBases(`<span>⏳ Baixando tabelas SINAPI (${estado}/SP), SCO-RJ e composições analíticas (${dataBaseTexto})... Aguarde alguns segundos.</span>`, 'loading');

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
        fetch(urlEquipesDefault).then(res => res.ok ? res.json() : {}),
        // Carregar SP Fallback (Lida com o erro silenciosamente se não encontrar)
        fetch(urlSinapiCSD_SP).then(res => res.ok ? res.json() : []),
        fetch(urlSinapiCCD_SP).then(res => res.ok ? res.json() : []),
        fetch(urlSinapiISD_SP).then(res => res.ok ? res.json() : []),
        fetch(urlSinapiICD_SP).then(res => res.ok ? res.json() : [])
    ]).then(([
        scoOnerada, scoDesonerada, scoInsOnerado, scoInsDesonerado, 
        sinapiOnerada, sinapiDesonerada, sinapiInsOnerado, sinapiInsDesonerado,
        scoAnalitico, sinapiAnalitico, equipesDefault,
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

        window.appState.databases.equipes_default = equipesDefault;

        window.appState.loadedCacheMeta.dataBase = dataBase;
        window.appState.loadedCacheMeta.estado = estado;
        window.appState.loadedCacheMeta.isLoading = false;

        window.atualizarOrcamentoEBusca();
        window.atualizarBannerBases(
            `<span>✅ <strong>Bases Prontas:</strong> SINAPI (${estado} + Fallback SP) & SCO-RJ | Data-Base: <strong>${dataBaseTexto}</strong></span>` +
            `<span style="font-size:0.8rem; opacity:0.85;">${sinapiOnerada.length.toLocaleString('pt-BR')} comp. SINAPI | ${scoOnerada.length.toLocaleString('pt-BR')} comp. SCO</span>`,
            'success'
        );
        console.log("Bases de dados (incluindo SP Fallback) carregadas com sucesso!");
    }).catch(erro => {
        window.appState.loadedCacheMeta.isLoading = false;
        console.error("Erro ao carregar as bases do GitHub:", erro);
        window.atualizarBannerBases(`<span>⚠️ Erro ao carregar as bases do GitHub (${dataBaseTexto}). Verifique sua conexão.</span>`, 'error');
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

    let dbItem = (baseData || []).find(i => String(i['Código']).trim() === String(codigo).trim());

    // BUSCA CRUZADA: Se a base analítica classificou errado
    if (!dbItem) {
        if (isSCO) {
            const outraBaseSCO = (tipoEfetivo === 'sco_composicao') ? ((tabela === 'desonerada') ? window.appState.databases.sco_icd : window.appState.databases.sco_isd) : ((tabela === 'desonerada') ? window.appState.databases.sco_ccd : window.appState.databases.sco_csd);
            dbItem = (outraBaseSCO || []).find(i => String(i['Código']).trim() === String(codigo).trim());
        } else if (tipoEfetivo !== 'base_propria') {
            const outraBaseSINAPI = (tipoEfetivo === 'composicao') ? ((tabela === 'desonerada') ? window.appState.databases.sinapi_icd : window.appState.databases.sinapi_isd) : ((tabela === 'desonerada') ? window.appState.databases.sinapi_ccd : window.appState.databases.sinapi_csd);
            dbItem = (outraBaseSINAPI || []).find(i => String(i['Código']).trim() === String(codigo).trim());
        }
    }

    // FALLBACK PARA SP (Apenas SINAPI)
    if (!dbItem && !isSCO && tipoEfetivo !== 'base_propria' && estadoEfetivo !== 'SP') {
        dbItem = (baseDataSP || []).find(i => String(i['Código']).trim() === String(codigo).trim());
        if (!dbItem) {
            const outraBaseSINAPI_SP = (tipoEfetivo === 'composicao') ? ((tabela === 'desonerada') ? window.appState.databases.sinapi_icd_sp : window.appState.databases.sinapi_isd_sp) : ((tabela === 'desonerada') ? window.appState.databases.sinapi_ccd_sp : window.appState.databases.sinapi_csd_sp);
            dbItem = (outraBaseSINAPI_SP || []).find(i => String(i['Código']).trim() === String(codigo).trim());
        }
        if (dbItem) estadoEfetivo = 'SP';
    }

    if (dbItem) {
        let val = dbItem[estadoEfetivo];
        if (val === undefined || val === null || parseFloat(val) === 0) {
            if (isSCO) val = dbItem['RJ'];
            else if (tipoEfetivo !== 'base_propria' && estadoEfetivo !== 'SP') {
                const dbItemSP = (baseDataSP || []).find(i => String(i['Código']).trim() === String(codigo).trim());
                if (dbItemSP && dbItemSP['SP']) val = dbItemSP['SP'];
                else {
                    const outraBaseSINAPI_SP = (tipoEfetivo === 'composicao') ? ((tabela === 'desonerada') ? window.appState.databases.sinapi_icd_sp : window.appState.databases.sinapi_isd_sp) : ((tabela === 'desonerada') ? window.appState.databases.sinapi_ccd_sp : window.appState.databases.sinapi_csd_sp);
                    const dbItemSPCruzado = (outraBaseSINAPI_SP || []).find(i => String(i['Código']).trim() === String(codigo).trim());
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
    const precoDinamico = window.obterPrecoItemPorCodigoETipo(item.codigo, item.tipo, estadoConfig, tabela);
    return precoDinamico > 0 ? precoDinamico : (parseFloat(item.precoUnitario) || 0);
};

// ==========================================
// 3. GESTÃO DO FORMULÁRIO DE ADIÇÃO
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
    const groupMemoria = document.getElementById('group-memoria');
    const inputDescricao = document.getElementById('input-add-descricao');
    const inputUnidade = document.getElementById('input-add-unidade');
    const inputPreco = document.getElementById('input-add-preco');
    const btnCotacoesOrc = document.getElementById('btn-cotacoes-orcamento');
    const avisoJustOrc = document.getElementById('aviso-justificativa-orcamento');
    const labelChkBdiDif = document.getElementById('label-chk-bdi-dif');

    if (tipo === 'etapa') {
        groupCodigo.style.display = 'none'; groupGrupo.style.display = 'none';
        groupUnidade.style.display = 'none'; groupPreco.style.display = 'none';
        groupQtd.style.display = 'none';
        if (groupMemoria) groupMemoria.style.display = 'none';
        if (labelChkBdiDif) labelChkBdiDif.style.display = 'none';
        groupDescricao.classList.add('full-width');
        inputDescricao.removeAttribute('readonly'); inputDescricao.placeholder = "Ex: SERVIÇOS PRELIMINARES E INFRAESTRUTURA";
        if (btnCotacoesOrc) btnCotacoesOrc.style.display = 'none';
        if (avisoJustOrc) avisoJustOrc.style.display = 'none';
    } else if (tipo === 'item_avulso') {
        groupCodigo.style.display = 'none'; groupGrupo.style.display = 'flex';
        groupUnidade.style.display = 'flex'; groupPreco.style.display = 'flex';
        groupQtd.style.display = 'flex';
        if (groupMemoria) groupMemoria.style.display = 'flex';
        if (labelChkBdiDif) labelChkBdiDif.style.display = 'inline-flex';
        groupDescricao.classList.remove('full-width');
        inputDescricao.removeAttribute('readonly'); inputUnidade.removeAttribute('readonly'); inputPreco.removeAttribute('readonly');
        inputDescricao.placeholder = "Descrição detalhada do item avulso...";
        if (btnCotacoesOrc) btnCotacoesOrc.style.display = 'inline-flex';
    } else {
        groupCodigo.style.display = 'flex'; groupGrupo.style.display = 'none';
        groupUnidade.style.display = 'flex'; groupPreco.style.display = 'flex';
        groupQtd.style.display = 'flex';
        if (groupMemoria) groupMemoria.style.display = 'flex';
        if (labelChkBdiDif) labelChkBdiDif.style.display = 'inline-flex';
        groupDescricao.classList.remove('full-width');
        inputDescricao.setAttribute('readonly', 'true'); inputUnidade.setAttribute('readonly', 'true'); inputPreco.setAttribute('readonly', 'true');
        inputDescricao.placeholder = "Preenchido automaticamente pelo código...";
        if (btnCotacoesOrc) btnCotacoesOrc.style.display = 'none';
        if (avisoJustOrc) avisoJustOrc.style.display = 'none';
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

window.sugerirProximoEAP = function(tipoLancamento) {
    const orc = window.appState.orcamento || [];
    if (orc.length === 0) return tipoLancamento === 'etapa' ? '1.0' : '1.1';

    if (tipoLancamento === 'etapa') {
        const etapas = orc.filter(i => i.tipo === 'etapa');
        if (etapas.length === 0) return '1.0';
        const ultimaEtapa = etapas[etapas.length - 1].itemEap || '1.0';
        const numPrincipal = parseInt(String(ultimaEtapa).split('.')[0], 10);
        return (!isNaN(numPrincipal) ? (numPrincipal + 1) : (etapas.length + 1)) + '.0';
    } else {
        const ultimoItem = orc[orc.length - 1];
        const eapBase = String(ultimoItem.itemEap || '1.0').trim();
        if (ultimoItem.tipo === 'etapa') {
            const prefixo = eapBase.replace(/\.0+$/, '');
            return `${prefixo}.1`;
        }
        const partes = eapBase.split('.');
        const ult = parseInt(partes[partes.length - 1], 10);
        if (!isNaN(ult)) {
            partes[partes.length - 1] = ult + 1;
            return partes.join('.');
        }
        return `${eapBase}.1`;
    }
};

window.incrementarEAP = function() {
    const input = document.getElementById('input-item-eap'); 
    const valor = input.value.trim();
    const tipo = document.querySelector('input[name="tipo_lancamento"]:checked')?.value || 'composicao';
    if (!valor) { input.value = window.sugerirProximoEAP(tipo); return; }
    
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
// 4. GESTÃO DO ORÇAMENTO (TABELA PRINCIPAL)
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
    const justificativa = (tipo === 'item_avulso') ? (document.getElementById('input-add-justificativa')?.value.trim() || '') : '';
    const grupoSelecionado = (tipo === 'item_avulso') ? document.getElementById('select-add-grupo').value : (tipo === 'etapa' ? 'OUTROS' : 'COMPOSICAO');
    const usarBdiDiferenciado = (tipo !== 'etapa') ? Boolean(document.getElementById('chk-add-bdi-dif')?.checked) : false;

    if (!descricao) { alert('Por favor, informe a Descrição do item.'); return; }

    const eapFinal = itemEap || window.sugerirProximoEAP(tipo);

    window.appState.orcamento.push({ 
        id: window.appState.nextId++, 
        tipo: tipo, 
        itemEap: eapFinal, 
        codigo: (tipo === 'etapa' || tipo === 'item_avulso') ? '-' : codigo, 
        descricao: descricao, 
        unidade: tipo === 'etapa' ? '-' : (unidade || 'UN'), 
        qtd: tipo === 'etapa' ? 0 : qtd, 
        precoUnitario: tipo === 'etapa' ? 0 : precoUnitario, 
        grupo: grupoSelecionado,
        memoria: tipo === 'etapa' ? '-' : memoria,
        justificativa: justificativa,
        usarBdiDiferenciado: usarBdiDiferenciado
    });
    
    window.renderizarOrcamento();

    document.getElementById('input-add-codigo').value = ''; 
    document.getElementById('input-add-descricao').value = ''; 
    document.getElementById('input-add-unidade').value = ''; 
    document.getElementById('input-add-preco').value = ''; 
    document.getElementById('input-add-qtd').value = '1.000';
    if (document.getElementById('input-add-justificativa')) document.getElementById('input-add-justificativa').value = '';
    if (document.getElementById('aviso-justificativa-orcamento')) document.getElementById('aviso-justificativa-orcamento').style.display = 'none';
    if (document.getElementById('chk-add-bdi-dif')) document.getElementById('chk-add-bdi-dif').checked = false;
};

window.alternarBdiItem = function(id) {
    const item = window.appState.orcamento.find(i => i.id === id);
    if (item && item.tipo !== 'etapa') {
        item.usarBdiDiferenciado = !Boolean(item.usarBdiDiferenciado);
        window.renderizarOrcamento();
    }
};

window.atualizarQuantidadeItem = function(id, novaQtd) { 
    const item = window.appState.orcamento.find(i => i.id === id); 
    if (item) { 
        item.qtd = parseFloat(novaQtd) || 0; 
        window.renderizarOrcamento(); 
    } 
};

window.atualizarPrecoItemManual = function(id, novoPreco) {
    const item = window.appState.orcamento.find(i => i.id === id);
    if (item && item.tipo === 'item_avulso') {
        item.precoUnitario = window.arredondarMoeda(parseFloat(novoPreco) || 0);
        window.renderizarOrcamento();
    }
};

window.atualizarDescricaoItem = function(id, novaDesc) {
    const item = window.appState.orcamento.find(i => i.id === id);
    if (item && novaDesc.trim()) {
        item.descricao = novaDesc.trim();
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

window.ordenarOrcamentoPorEAP = function() {
    if (!window.appState.orcamento || window.appState.orcamento.length <= 1) return;
    window.appState.orcamento.sort((a, b) => {
        const cmp = window.compararEAP(a.itemEap, b.itemEap);
        if (cmp !== 0) return cmp;
        if (a.tipo === 'etapa' && b.tipo !== 'etapa') return -1;
        if (a.tipo !== 'etapa' && b.tipo === 'etapa') return 1;
        return 0;
    });
    window.renderizarOrcamento();
};

// ==========================================
// FUNÇÕES DO QUADRO DE MEMÓRIA E FATIAMENTO
// ==========================================

window.toggleMemoria = function(id) {
    const row = document.getElementById(`row-memoria-${id}`);
    if (row) row.style.display = row.style.display === 'none' ? 'table-row' : 'none';
};

window.inserirModeloFatia = function(id) {
    const textarea = document.getElementById(`memoria-texto-${id}`);
    if (textarea) {
        let textoAtual = textarea.value.trim();
        if (textoAtual) textoAtual += '\n';
        textarea.value = textoAtual + "A: \nB: ";
        textarea.focus();
    }
};

window.resolverFormulaLinhaMemoria = function(linhaLimpa) {
    let formulaMatematica = linhaLimpa.replace(/^[A-Z0-9À-Ú_]+[:)\-]\s*/i, '');
    formulaMatematica = formulaMatematica.replace(/\[.*?\]/g, '').trim();
    formulaMatematica = formulaMatematica.replace(/,/g, '.');
    formulaMatematica = formulaMatematica.replace(/QTD\(([A-Z0-9.]+)\)/gi, (match, eap) => {
        if (window.appState && window.appState.orcamento) {
            let itemPai = window.appState.orcamento.find(i => String(i.itemEap).toUpperCase() === String(eap).toUpperCase());
            return itemPai ? (parseFloat(itemPai.qtd) || 0) : 0;
        }
        return 0;
    });
    return window.avaliarFormulaSegura(formulaMatematica);
};

window.atualizarMemoriaItem = function(id, novaMemoria) {
    const item = window.appState.orcamento.find(i => i.id === id);
    if (item) {
        let formulaRaw = novaMemoria.trim().toUpperCase();
        item.memoria = formulaRaw || '-';
        
        if (formulaRaw && formulaRaw !== '-') {
            let linhas = formulaRaw.split('\n');
            let somaGeral = 0;

            linhas.forEach(linha => {
                let linhaLimpa = linha.trim();
                if (!linhaLimpa) return;
                let resultado = window.resolverFormulaLinhaMemoria(linhaLimpa);
                if (!isNaN(resultado) && isFinite(resultado)) somaGeral += resultado;
            });
            
            if (somaGeral > 0) item.qtd = parseFloat(somaGeral.toFixed(3));
        }
        window.renderizarOrcamento();
        
        // Mantém a gaveta aberta após atualizar os valores!
        setTimeout(() => {
            const row = document.getElementById(`row-memoria-${id}`);
            if (row) row.style.display = 'table-row';
        }, 50);
    }
};

window.fatiarItemOrcamento = function(id) {
    const index = window.appState.orcamento.findIndex(i => i.id === id);
    if (index === -1) return;
    
    const item = window.appState.orcamento[index];
    if (!item.memoria || item.memoria === '-') {
        alert("A memória de cálculo está vazia. Preencha com as fatias primeiro.");
        return;
    }

    const linhas = item.memoria.split('\n').filter(l => l.trim() !== '');
    if (linhas.length <= 1) {
        alert("Escreva pelo menos duas linhas (ex: A: ... e B: ...) para explodir o serviço.");
        return;
    }

    if (!confirm(`Deseja explodir o item ${item.itemEap} em ${linhas.length} subitens?\nA linha original será substituída.`)) return;

    let novosItens = [];
    let eapLetraCodigo = 65; // Letra 'A'

    linhas.forEach((linhaRaw, idx) => {
        let linhaLimpa = linhaRaw.trim();
        let nomeFatia = String.fromCharCode(eapLetraCodigo + idx);
        let memoriaFatia = linhaLimpa;

        let matchPrefixo = linhaLimpa.match(/^([A-Z0-9À-Ú_]+)[:)\-]\s*(.*)/i);
        if (matchPrefixo) {
            nomeFatia = matchPrefixo[1].toUpperCase();
            memoriaFatia = matchPrefixo[2];
        }

        // Calcula a quantidade desta fatia isolada
        let qtdFatia = 0;
        let resultado = window.resolverFormulaLinhaMemoria(memoriaFatia);
        if (!isNaN(resultado) && isFinite(resultado)) qtdFatia = parseFloat(resultado.toFixed(3));

        // Clona a estrutura da equipe do cronograma se já existir
        let cronoCopia = item.cronograma ? JSON.parse(JSON.stringify(item.cronograma)) : null;

        novosItens.push({
            ...item,
            id: window.appState.nextId++,
            itemEap: `${item.itemEap}.${nomeFatia}`,
            descricao: `${item.descricao} (Fatia: ${nomeFatia})`,
            memoria: memoriaFatia,
            qtd: qtdFatia,
            cronograma: cronoCopia
        });
    });

    // Splice: Remove o item original (1) e injeta os vários novos na mesma posição
    window.appState.orcamento.splice(index, 1, ...novosItens);
    window.renderizarOrcamento();
    alert(`Serviço ${item.itemEap} explodido em ${linhas.length} fatias com sucesso!`);
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
    if (confirm('Tem certeza que deseja limpar todo o orçamento da tela para iniciar um novo projeto?\n\n(Isso desvinculará o orçamento atualmente aberto da nuvem para não sobrescrevê-lo por engano.)')) {
        window.appState.orcamento = []; 
        window.orcamentoAtualId = null;
        window.orcamentoAtualNome = null;
        if (typeof window.atualizarBadgeOrcamentoNuvem === 'function') window.atualizarBadgeOrcamentoNuvem();
        window.renderizarOrcamento();
        document.getElementById('container-tabela-mao-de-obra')?.classList.add('hidden'); 
        document.getElementById('container-tabela-materiais')?.classList.add('hidden'); 
        document.getElementById('container-abc-orcamento')?.classList.add('hidden');
    }
};

window.renderizarOrcamento = function() {
    const estado = document.getElementById('select-estado').value; 
    const tabela = document.getElementById('select-tabela').value;
    const bdi = parseFloat(document.getElementById('input-bdi').value) || 0;
    const bdiDif = parseFloat(document.getElementById('input-bdi-dif')?.value);
    const bdiDifFinal = !isNaN(bdiDif) ? bdiDif : bdi;

    document.getElementById('info-obra-header').innerHTML = `UF: <strong>${estado}</strong> | Tabela: <strong>${tabela === 'desonerada' ? 'Desonerada' : 'Não Desonerada / Onerada'}</strong> | BDI Padrão: <strong>${bdi.toFixed(2)}%</strong> | BDI Dif.: <strong>${bdiDifFinal.toFixed(2)}%</strong>`;
    
    // Renderiza o bloco de assinatura do Orçamentista (se preenchido)
    const blocoAssinatura = document.getElementById('bloco-assinatura-orcamentista');
    if (blocoAssinatura && typeof window.obterDadosOrcamentista === 'function') {
        const dadosOrc = window.obterDadosOrcamentista();
        if (dadosOrc.nome || dadosOrc.registro || (dadosOrc.art && dadosOrc.art !== 'ANEXADAS AO PROCESSO')) {
            blocoAssinatura.style.display = 'block';
            blocoAssinatura.innerHTML = `
                <div style="display: inline-block; min-width: 340px; border-top: 1px solid #1e293b; padding-top: 8px; margin-top: 15px;">
                    <div style="font-weight: 700; color: #0f172a; font-size: 0.95rem;">${dadosOrc.nome || 'Responsável Técnico pelo Orçamento'}</div>
                    <div style="color: #475569; font-size: 0.84rem;">${dadosOrc.cargo || 'Orçamentista'}${dadosOrc.registro ? ' — ' + dadosOrc.registro : ''}</div>
                    <div style="color: #64748b; font-size: 0.8rem; margin-top: 2px;">ART / RRT: <strong>${dadosOrc.art}</strong></div>
                </div>
            `;
        } else {
            blocoAssinatura.style.display = 'none';
            blocoAssinatura.innerHTML = '';
        }
    }

    const tbody = document.getElementById('tbody-orcamento');
    const rowBdiDif = document.getElementById('row-summary-bdi-dif');
    
    if (window.appState.orcamento.length === 0) { 
        tbody.innerHTML = `<tr><td colspan="10" class="text-center" style="padding: 20px; color: var(--text-muted);">Nenhum item adicionado ao orçamento ainda.</td></tr>`; 
        document.getElementById('summary-subtotal').innerText = window.formatBRL(0); 
        document.getElementById('summary-bdi-perc').innerText = bdi.toFixed(2);
        document.getElementById('summary-bdi-valor').innerText = window.formatBRL(0); 
        if (rowBdiDif) rowBdiDif.style.display = 'none';
        document.getElementById('summary-total-geral').innerText = window.formatBRL(0); 
        window.salvarEstadoLocal();
        return; 
    }

    const { mapaPorId: subtotaisEtapas } = window.calcularSubtotaisPorEtapa(window.appState.orcamento, estado, tabela, bdi, bdiDifFinal);

    let subtotalAcumuladoSemBdi = 0;
    let totalGeralComBdi = 0;
    let valorBdiPadraoAcum = 0;
    let valorBdiDifAcum = 0;
    let temItemComBdiDif = false;
    
    tbody.innerHTML = window.appState.orcamento.map((item, index) => {
        if (item.tipo === 'etapa') {
            const dadosEtapa = subtotaisEtapas[item.id] || { subtotalSemBdi: 0, totalComBdi: 0 };
            return `<tr class="row-etapa">
                <td><input type="text" value="${item.itemEap}" title="Editar EAP" style="width: 80px; text-align: center; font-weight: bold; border: 1px solid transparent; background: transparent; cursor: text;" onchange="atualizarEapItem(${item.id}, this.value)" onfocus="this.style.border='1px solid #cbd5e1'; this.style.background='#fff'" onblur="this.style.border='1px solid transparent'; this.style.background='transparent'"></td>
                <td><span class="header-badge" style="background:#475569;">Etapa</span></td>
                <td>-</td>
                <td colspan="4">
                    <input type="text" value="${item.descricao.replace(/"/g, '&quot;')}" title="Clique para editar o título da Etapa" style="width: 100%; font-weight: bold; color: #0f172a; border: 1px solid transparent; background: transparent; padding: 4px;" onchange="atualizarDescricaoItem(${item.id}, this.value)" onfocus="this.style.border='1px solid #cbd5e1'; this.style.background='#fff'" onblur="this.style.border='1px solid transparent'; this.style.background='transparent'">
                </td>
                <td class="text-right" title="Subtotal da Etapa Sem BDI" style="font-size: 0.85rem; color: #475569;">${window.formatBRL(dadosEtapa.subtotalSemBdi)}</td>
                <td class="text-right" title="Total da Etapa Com BDI" style="color: #0f172a;"><strong>${window.formatBRL(dadosEtapa.totalComBdi)}</strong></td>
                <td class="text-center actions-col"><button class="btn btn-sm btn-outline" onclick="moverItem(${index}, 'cima')">⬆️</button> <button class="btn btn-sm btn-outline" onclick="moverItem(${index}, 'baixo')">⬇️</button> <button class="btn btn-sm btn-danger" onclick="removerItemOrcamento(${item.id})">❌</button></td>
            </tr>`;
        }

        const precoUnitarioBruto = window.obterPrecoAtualizadoDoItem(item, estado, tabela);
        const bdiItem = window.obterBdiDoItem(item, bdi, bdiDifFinal);
        const { precoUn, precoComBdi, subtotalSemBdi, totalComBdi } = window.calcularValoresItemTCU(precoUnitarioBruto, item.qtd, bdiItem);
        const parcelaBdiItem = window.arredondarMoeda(totalComBdi - subtotalSemBdi);
        
        subtotalAcumuladoSemBdi = window.arredondarMoeda(subtotalAcumuladoSemBdi + subtotalSemBdi);
        totalGeralComBdi = window.arredondarMoeda(totalGeralComBdi + totalComBdi);
        if (item.usarBdiDiferenciado) {
            temItemComBdiDif = true;
            valorBdiDifAcum = window.arredondarMoeda(valorBdiDifAcum + parcelaBdiItem);
        } else {
            valorBdiPadraoAcum = window.arredondarMoeda(valorBdiPadraoAcum + parcelaBdiItem);
        }

        let badgeCor = 'var(--primary)'; 
        let tipoLabel = 'Comp. SINAPI';
        
        if (item.tipo === 'insumo') { badgeCor = 'var(--info)'; tipoLabel = 'Insumo SINAPI'; }
        else if (item.tipo === 'sco_composicao') { badgeCor = 'var(--purple)'; tipoLabel = 'Comp. SCO (RJ)'; }
        else if (item.tipo === 'sco_insumo') { badgeCor = 'var(--pink)'; tipoLabel = 'Insumo SCO (RJ)'; }
        else if (item.tipo === 'base_propria') { badgeCor = 'var(--success)'; tipoLabel = 'Própria'; }
        else if (item.tipo === 'item_avulso') { badgeCor = 'var(--secondary)'; tipoLabel = `Avulso (${item.grupo || 'Geral'})`; }

        const temMemoria = item.memoria && item.memoria !== '-';
        const badgeTCU = item.justificativa
            ? `<span title="${item.justificativa.replace(/"/g, '&quot;')}" style="display:inline-block; margin-left:6px; background:#fef3c7; color:#92400e; border:1px solid #fde68a; padding:1px 6px; border-radius:4px; font-size:0.72rem; font-weight:bold; cursor:help;">📊 Cotado TCU</span>`
            : '';

        const celulaPrecoUn = item.tipo === 'item_avulso'
            ? `<div style="display:flex; align-items:center; justify-content:flex-end; gap:4px;">
                 <input type="number" step="0.01" min="0" value="${precoUn.toFixed(2)}" style="width:90px; text-align:right; padding:4px;" onchange="atualizarPrecoItemManual(${item.id}, this.value)" title="Editar preço manual">
                 <button class="btn btn-sm btn-outline" style="padding:2px 6px;" onclick="abrirModalCotacoes({tipo:'item_tabela', id:${item.id}})" title="Inserir/Editar Mapa de Cotações (Lei 14.133)">📊</button>
               </div>`
            : window.formatBRL(precoUn);

        const badgeBdiLinha = item.usarBdiDiferenciado
            ? `<div onclick="alternarBdiItem(${item.id})" title="Item com BDI Diferenciado (Súmula 253 TCU). Clique para alternar para BDI Padrão." style="display:inline-block; margin-top:2px; background:#fef3c7; color:#b45309; border:1px solid #fcd34d; padding:1px 5px; border-radius:4px; font-size:0.68rem; font-weight:700; cursor:pointer;">⚡ BDI Dif. ${bdiDifFinal.toFixed(2)}%</div>`
            : `<div onclick="alternarBdiItem(${item.id})" title="Item com BDI Padrão. Clique para alternar para BDI Diferenciado (Equipamentos)." style="display:inline-block; margin-top:2px; background:#f1f5f9; color:#64748b; border:1px solid #e2e8f0; padding:1px 5px; border-radius:4px; font-size:0.68rem; cursor:pointer;">BDI ${bdi.toFixed(2)}%</div>`;

        return `<tr>
            <td><input type="text" value="${item.itemEap}" title="Editar EAP" style="width: 80px; text-align: center; font-weight: bold; color: inherit; border: 1px solid transparent; background: transparent; cursor: text;" onchange="atualizarEapItem(${item.id}, this.value)" onfocus="this.style.border='1px solid #cbd5e1'; this.style.background='#fff'" onblur="this.style.border='1px solid transparent'; this.style.background='transparent'"></td>
            <td><span class="header-badge" style="background:${badgeCor}; font-size:0.75rem;">${tipoLabel}</span></td>
            <td>${item.codigo}</td>
            <td>
                <div style="display:flex; align-items:center; flex-wrap:wrap; gap:4px;">
                    <input type="text" value="${item.descricao.replace(/"/g, '&quot;')}" title="Clique para editar a descrição" style="flex:1; min-width:220px; border:1px solid transparent; background:transparent; padding:4px; font-size:0.9rem;" onchange="atualizarDescricaoItem(${item.id}, this.value)" onfocus="this.style.border='1px solid #cbd5e1'; this.style.background='#fff'" onblur="this.style.border='1px solid transparent'; this.style.background='transparent'">
                    ${badgeTCU}
                </div>
            </td>
            <td class="text-center">${item.unidade}</td>
            
            <!-- COLUNA DE QUANTIDADE E BOTÃO DA MEMÓRIA -->
            <td class="text-right">
                <div style="display: flex; align-items: center; justify-content: flex-end; gap: 4px;">
                    <input type="number" step="0.001" min="0" value="${item.qtd}" style="width: 80px; text-align: right; padding: 4px;" onchange="atualizarQuantidadeItem(${item.id}, this.value)">
                    <button class="btn btn-sm ${temMemoria ? 'btn-primary' : 'btn-outline'}" style="padding: 2px 6px; font-size: 0.9rem;" onclick="toggleMemoria(${item.id})" title="${temMemoria ? 'Memória preenchida: ' + item.memoria.replace(/"/g, '&quot;') : 'Abrir Quadro de Memória e Fatiamento'}">📝</button>
                </div>
            </td>
            
            <td class="text-right">${celulaPrecoUn}</td>
            <td class="text-right">
                <div>${window.formatBRL(precoComBdi)}</div>
                ${badgeBdiLinha}
            </td>
            <td class="text-right"><strong>${window.formatBRL(totalComBdi)}</strong></td>
            <td class="text-center actions-col">
                <button class="btn btn-sm btn-outline" onclick="moverItem(${index}, 'cima')" title="Mover para cima">⬆️</button> 
                <button class="btn btn-sm btn-outline" onclick="moverItem(${index}, 'baixo')" title="Mover para baixo">⬇️</button> 
                <button class="btn btn-sm btn-danger" onclick="removerItemOrcamento(${item.id})" title="Remover item">❌</button>
            </td>
        </tr>
        <!-- QUADRO ESCONDIDO DE MEMÓRIA E FATIAMENTO -->
        <tr id="row-memoria-${item.id}" style="display: none; background-color: #f8fafc; border-bottom: 2px solid #cbd5e1;">
            <td colspan="10" style="padding: 12px;">
                <div style="display: flex; gap: 15px; align-items: flex-start;">
                    <div style="flex: 1;">
                        <label style="font-size: 0.8rem; font-weight: bold; color: #475569; display: block; margin-bottom: 4px;">Memória de Cálculo (Linhas "A:", "B:" para fatias. "[]" p/ comentários):</label>
                        <textarea id="memoria-texto-${item.id}" rows="3" class="form-control" style="font-family: monospace; font-size: 0.85rem;" onblur="atualizarMemoriaItem(${item.id}, this.value)">${(item.memoria && item.memoria !== '-') ? item.memoria : ''}</textarea>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 6px; width: 180px; margin-top: 22px;">
                        <button class="btn btn-sm btn-secondary" onclick="inserirModeloFatia(${item.id})">📄 Inserir A / B</button>
                        <button class="btn btn-sm btn-success" onclick="fatiarItemOrcamento(${item.id})">✂️ Explodir Serviço</button>
                    </div>
                </div>
            </td>
        </tr>`;
    }).join('');

    document.getElementById('summary-subtotal').innerText = window.formatBRL(subtotalAcumuladoSemBdi); 
    document.getElementById('summary-bdi-perc').innerText = bdi.toFixed(2); 
    document.getElementById('summary-bdi-valor').innerText = window.formatBRL(valorBdiPadraoAcum); 
    if (rowBdiDif) {
        rowBdiDif.style.display = temItemComBdiDif ? 'flex' : 'none';
        const elPercDif = document.getElementById('summary-bdi-dif-perc');
        const elValDif = document.getElementById('summary-bdi-dif-valor');
        if (elPercDif) elPercDif.innerText = bdiDifFinal.toFixed(2);
        if (elValDif) elValDif.innerText = window.formatBRL(valorBdiDifAcum);
    }
    document.getElementById('summary-total-geral').innerText = window.formatBRL(totalGeralComBdi);

    window.salvarEstadoLocal();
};

// ==========================================
// CALCULADORA ANALÍTICA DE BDI (ACÓRDÃO 2622/2013 - TCU)
// ==========================================
window.abrirModalComposicaoBDI = function() {
    const modal = document.getElementById('modal-composicao-bdi');
    if (!modal) return;
    const comp = window.appState.composicaoBdi || {
        padrao: { ac: 4.00, sg: 0.80, r: 1.27, df: 1.23, l: 7.40, pis: 0.65, cofins: 3.00, iss: 2.00, cprb: 0.00 },
        diferenciado: { ac: 3.00, sg: 0.48, r: 0.85, df: 0.85, l: 5.11, pis: 0.65, cofins: 3.00, iss: 0.00, cprb: 0.00 }
    };
    const campos = ['ac', 'sg', 'r', 'df', 'l', 'pis', 'cofins', 'iss', 'cprb'];
    campos.forEach(c => {
        const elPad = document.getElementById(`bdi-pad-${c}`);
        const elDif = document.getElementById(`bdi-dif-${c}`);
        if (elPad) elPad.value = (parseFloat(comp.padrao?.[c]) || 0).toFixed(2);
        if (elDif) elDif.value = (parseFloat(comp.diferenciado?.[c]) || 0).toFixed(2);
    });
    window.recalcularPreviaModalBDI();
    modal.style.display = 'flex';
};

window.fecharModalComposicaoBDI = function() {
    const modal = document.getElementById('modal-composicao-bdi');
    if (modal) modal.style.display = 'none';
};

window.lerParcelasModalBDI = function() {
    const campos = ['ac', 'sg', 'r', 'df', 'l', 'pis', 'cofins', 'iss', 'cprb'];
    const padrao = {};
    const diferenciado = {};
    campos.forEach(c => {
        padrao[c] = parseFloat(document.getElementById(`bdi-pad-${c}`)?.value) || 0;
        diferenciado[c] = parseFloat(document.getElementById(`bdi-dif-${c}`)?.value) || 0;
    });
    return { padrao, diferenciado };
};

window.recalcularPreviaModalBDI = function() {
    const { padrao, diferenciado } = window.lerParcelasModalBDI();
    const resPad = window.calcularFormulaBdiTCU(padrao);
    const resDif = window.calcularFormulaBdiTCU(diferenciado);
    const elResPad = document.getElementById('modal-bdi-pad-resultado');
    const elResDif = document.getElementById('modal-bdi-dif-resultado');
    if (elResPad) elResPad.innerText = `${resPad.toFixed(2).replace('.', ',')}%`;
    if (elResDif) elResDif.innerText = `${resDif.toFixed(2).replace('.', ',')}%`;
};

window.sincronizarCprbNoModalBdi = function() {
    const tabela = document.getElementById('select-tabela')?.value || 'nao_desonerada';
    const cprbSugerido = (tabela === 'desonerada') ? 4.50 : 0.00;
    const elPadCprb = document.getElementById('bdi-pad-cprb');
    const elDifCprb = document.getElementById('bdi-dif-cprb');
    if (elPadCprb) elPadCprb.value = cprbSugerido.toFixed(2);
    if (elDifCprb) elDifCprb.value = cprbSugerido.toFixed(2);
    window.recalcularPreviaModalBDI();
};

window.aplicarComposicaoBDI = function() {
    const { padrao, diferenciado } = window.lerParcelasModalBDI();
    window.appState.composicaoBdi = { padrao, diferenciado };
    const resPad = window.calcularFormulaBdiTCU(padrao);
    const resDif = window.calcularFormulaBdiTCU(diferenciado);
    const inputBdi = document.getElementById('input-bdi');
    const inputBdiDif = document.getElementById('input-bdi-dif');
    if (inputBdi) inputBdi.value = resPad.toFixed(2);
    if (inputBdiDif) inputBdiDif.value = resDif.toFixed(2);
    window.fecharModalComposicaoBDI();
    window.renderizarOrcamento();
};

window.atualizarOrcamentoEBusca = function() { 
    window.renderizarOrcamento(); 
    const termoBusca = document.getElementById('input-busca')?.value.trim();
    const undBusca = document.getElementById('input-busca-unidade')?.value.trim();
    if (termoBusca || undBusca) window.executarBuscaGlobal(); 
};

// Inicializa a aplicação ao abrir a tela
window.addEventListener('DOMContentLoaded', () => { 
    window.carregarEstadoLocal();
    window.atualizarCamposDinamicosFormulario('etapa'); 
    window.carregarBases(); 

    // Salva metadados da obra no localStorage ao digitar
    ['input-obra-nome', 'input-obra-local', 'input-obra-processo', 'input-obra-revisao'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', () => window.salvarEstadoLocal());
    });

    // Atualiza o bloco de assinatura e salva no localStorage ao editar os dados do Orçamentista
    ['input-obra-orcamentista', 'input-obra-cargo', 'input-obra-registro', 'input-obra-art'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', () => window.renderizarOrcamento());
    });
});

// ==========================================
// MOTOR DE FATIAMENTO E MEMÓRIA DE CÁLCULO
// ==========================================

window.calcularMemoria = function() {
    const inputMemoria = document.getElementById('input-add-memoria');
    const inputQtd = document.getElementById('input-add-qtd');
    let formulaRaw = inputMemoria ? inputMemoria.value.trim().toUpperCase() : '';
    
    if (!formulaRaw) return;

    let linhas = formulaRaw.split('\n');
    let somaGeral = 0;

    linhas.forEach(linha => {
        let linhaLimpa = linha.trim();
        if (!linhaLimpa) return;
        let resultado = window.resolverFormulaLinhaMemoria(linhaLimpa);
        if (!isNaN(resultado) && isFinite(resultado)) somaGeral += resultado;
    });
    
    if (somaGeral > 0) inputQtd.value = somaGeral.toFixed(3);
};

window.adicionarItemFatiadoOuNormal = function() {
    const textareaMemoria = document.getElementById('input-add-memoria');
    if (!textareaMemoria) return;
    
    const linhas = textareaMemoria.value.trim().split('\n').filter(l => l.trim() !== '');

    // Se tiver apenas 1 linha ou nenhuma, adiciona normalmente (Item inteiro)
    if (linhas.length <= 1) {
        if (typeof window.adicionarItemAoOrcamento === 'function') window.adicionarItemAoOrcamento();
        if (typeof window.incrementarEAP === 'function') window.incrementarEAP();
        textareaMemoria.value = '';
        return;
    }

    // ---> O SCRIPT DE EXPLOSÃO (Várias Linhas) <---
    const inputs = {
        eap: document.getElementById('input-item-eap').value.trim() || window.sugerirProximoEAP('composicao'),
        codigo: document.getElementById('input-add-codigo').value,
        desc: document.getElementById('input-add-descricao').value,
        unidade: document.getElementById('input-add-unidade').value,
        preco: document.getElementById('input-add-preco').value,
        justificativa: document.getElementById('input-add-justificativa')?.value || '',
        usarBdiDif: Boolean(document.getElementById('chk-add-bdi-dif')?.checked)
    };

    if (!inputs.desc.trim()) {
        alert('Por favor, informe a Descrição do item antes de adicionar.');
        return;
    }

    let eapLetraCodigo = 65; // 65 é a letra 'A' na tabela ASCII

    linhas.forEach((linhaRaw, index) => {
        let linhaLimpa = linhaRaw.trim();
        
        let nomeFatia = String.fromCharCode(eapLetraCodigo + index);
        let memoriaFatia = linhaLimpa;

        // Se a linha começar com "A:", "TÉRREO:", "BLOCO1:", ele usa esse nome na EAP
        let matchPrefixo = linhaLimpa.match(/^([A-Z0-9À-Ú_]+)[:)\-]\s*(.*)/i);
        if (matchPrefixo) {
            nomeFatia = matchPrefixo[1].toUpperCase();
            memoriaFatia = matchPrefixo[2];
        }

        document.getElementById('input-item-eap').value = `${inputs.eap}.${nomeFatia}`;
        document.getElementById('input-add-descricao').value = `${inputs.desc} (Fatia: ${nomeFatia})`;
        textareaMemoria.value = memoriaFatia;
        if (document.getElementById('input-add-justificativa')) document.getElementById('input-add-justificativa').value = inputs.justificativa;
        if (document.getElementById('chk-add-bdi-dif')) document.getElementById('chk-add-bdi-dif').checked = inputs.usarBdiDif;
        
        window.calcularMemoria();

        if (typeof window.adicionarItemAoOrcamento === 'function') window.adicionarItemAoOrcamento();
        
        document.getElementById('input-add-codigo').value = inputs.codigo;
        document.getElementById('input-add-unidade').value = inputs.unidade;
        document.getElementById('input-add-preco').value = inputs.preco;
    });

    document.getElementById('input-item-eap').value = inputs.eap;
    document.getElementById('input-add-descricao').value = '';
    document.getElementById('input-add-codigo').value = '';
    document.getElementById('input-add-unidade').value = '';
    document.getElementById('input-add-preco').value = '';
    textareaMemoria.value = '';
    document.getElementById('input-add-qtd').value = '1.000';
    if (typeof window.incrementarEAP === 'function') window.incrementarEAP();
    
    alert(`Serviço fatiado com sucesso! Foram criados ${linhas.length} subitens no Orçamento.`);
};
