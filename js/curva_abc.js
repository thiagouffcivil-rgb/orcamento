// ==========================================
// 2. CURVA ABC E LEVANTAMENTO
// ==========================================

window.calcularInsumosExplodidos = function(estadoConfig, tabela) {
    const insumosMap = new Map();

    function adicionarAoMap(codigo, descricao, unidade, tipoItem, qtd, precoUnitarioManual, origem, grupoExplicito) {
        if (!codigo || codigo === '-') return; 
        const key = String(codigo).trim();
        if (insumosMap.has(key)) {
            const existing = insumosMap.get(key); 
            existing.qtdTotal += qtd;
            if (!existing.descricao && descricao) existing.descricao = descricao;
            if ((!existing.unidade || existing.unidade === 'UN') && unidade) existing.unidade = unidade;
            if (!existing.grupo && grupoExplicito) existing.grupo = grupoExplicito;
        } else {
            insumosMap.set(key, { codigo: key, descricao: descricao, unidade: unidade || 'UN', tipoItem: tipoItem || '', qtdTotal: qtd, precoUnitarioManual: precoUnitarioManual || 0, origem: origem || '', grupo: grupoExplicito || tipoItem || '' });
        }
    }

    function explodirComposicao(codigoComp, qtdComp, tipoBase, nivel = 0, visitados = new Set(), descOriginal = '', unidOriginal = '') {
        const chaveCompOriginal = String(codigoComp || '').trim();
        const chaveComp = typeof window.normalizarCodigoComposicao === 'function'
            ? window.normalizarCodigoComposicao(chaveCompOriginal)
            : chaveCompOriginal.replace(/\s*\(\/?\)\s*$/, '').trim();
        if (!chaveComp || visitados.has(chaveComp)) return;
        const novosVisitados = new Set(visitados);
        novosVisitados.add(chaveComp);

        if (tipoBase === 'base_propria') {
            const compPropria = window.appState.databases.base_propria.find(i => {
                const c = typeof window.normalizarCodigoComposicao === 'function' ? window.normalizarCodigoComposicao(i['Código']) : String(i['Código']).trim();
                return c === chaveComp;
            });
            if (compPropria && Array.isArray(compPropria.ingredientes) && compPropria.ingredientes.length > 0) {
                compPropria.ingredientes.forEach(ing => {
                    const qtdTotalFilho = qtdComp * (parseFloat(ing.coeficiente) || 1.0);
                    if (ing.tipoItem === 'avulso_inventado') { 
                        adicionarAoMap(ing.codigoItem, ing.descricao, ing.unidade, ing.grupo, qtdTotalFilho, ing.precoUnitario, 'base_propria', ing.grupo); 
                        return; 
                    }
                    const descIngUpper = String(ing.descricao || '').toUpperCase();
                    const ehAtomicoMOouEqp = descIngUpper.includes('COM ENCARGOS COMPLEMENTARES') || /\s-\s*CH[PI]\b/.test(descIngUpper);
                    const isSubComp = !ehAtomicoMOouEqp && (String(ing.tipoItem).includes('composicao') || String(ing.tipoItem) === 'sco_composicao' || String(ing.tipoItem) === 'base_propria');
                    if (isSubComp && nivel < 6) explodirComposicao(ing.codigoItem, qtdTotalFilho, ing.tipoItem, nivel + 1, novosVisitados, ing.descricao, ing.unidade);
                    else adicionarAoMap(ing.codigoItem, ing.descricao, ing.unidade, ing.tipoItem, qtdTotalFilho, ing.precoUnitario, 'base_propria', ing.grupo);
                });
                return;
            }
            adicionarAoMap(chaveCompOriginal, compPropria ? compPropria['Descrição'] : (descOriginal || `Composição ${chaveCompOriginal}`), compPropria ? compPropria['Unidade'] : (unidOriginal || 'UN'), 'COMPOSICAO', qtdComp, 0, 'base_propria', compPropria ? compPropria.Grupo : 'COMPOSICAO'); 
            return;
        }

        const isSCO = tipoBase === 'sco_composicao' || chaveComp.startsWith('SCO-') || /^[A-Z]{2,4}\s+\d{2}\./i.test(chaveComp) || chaveComp.startsWith('IEQ') || chaveComp.startsWith('RSE');
        const analiticoBase = isSCO ? window.appState.databases.sco_analitico : window.appState.databases.sinapi_analitico;
        const filhos = (analiticoBase || []).filter(item => {
            const cMae = String(item['Código Mãe'] || item['Código'] || '').trim().replace(/\s*\(\/?\)\s*$/, '').trim();
            return cMae === chaveComp;
        });

        if (filhos.length === 0) {
            adicionarAoMap(chaveCompOriginal, descOriginal || `Composição ${chaveCompOriginal}`, unidOriginal || 'UN', 'COMPOSICAO', qtdComp, 0, tipoBase);
            return;
        }

        filhos.forEach(filho => {
            const codFilho = String(filho['Código do Item'] || filho['Código Item'] || filho['Código'] || '').trim();
            if (!codFilho || codFilho === chaveComp) return;
            const descFilho = filho['Descrição'] || ''; 
            const unidFilho = filho['Unidade'] || ''; 
            const coefFilho = parseFloat(filho['Coeficiente']) || 1.0;
            const tipoItem = String(filho['Tipo Item'] || filho['Grupo'] || '').toUpperCase(); 
            const qtdTotalFilho = qtdComp * coefFilho;

            // Ignora taxas percentuais de EPI/ferramentas do SCO (EVE000050) na lista de materiais físicos se não tiver preço direto
            if (codFilho.startsWith('EVE') && unidFilho === '%') return;

            const descFilhoUpper = descFilho.toUpperCase();
            // No SINAPI, composições de Mão de Obra ("COM ENCARGOS COMPLEMENTARES") e de Equipamentos Horários ("- CHP" / "- CHI")
            // são unidades atômicas de recurso e NÃO devem ser explodidas em Exames, Seguro, Curso de Capacitação, Depreciação ou Juros.
            const ehRecursoAtomico = descFilhoUpper.includes('COM ENCARGOS COMPLEMENTARES')
                || /\s-\s*CH[PI]\b/.test(descFilhoUpper)
                || codFilho.startsWith('IEQ')
                || codFilho.startsWith('MOD')
                || codFilho.startsWith('MOI');

            const isSubComp = !ehRecursoAtomico && (tipoItem.includes('COMPOS') || tipoItem === 'COMP');

            if (isSubComp && nivel < 6) explodirComposicao(codFilho, qtdTotalFilho, tipoBase, nivel + 1, novosVisitados, descFilho, unidFilho);
            else adicionarAoMap(codFilho, descFilho, unidFilho, tipoItem, qtdTotalFilho, 0, tipoBase, ehRecursoAtomico && descFilhoUpper.includes('COM ENCARGOS COMPLEMENTARES') ? 'MÃO DE OBRA' : tipoItem);
        });
    }

    (window.appState.orcamento || []).forEach(item => {
        if (item.tipo === 'etapa') return;
        if (item.tipo === 'composicao' || item.tipo === 'sco_composicao' || item.tipo === 'base_propria') explodirComposicao(item.codigo, item.qtd, item.tipo, 0);
        else if (item.tipo === 'insumo' || item.tipo === 'sco_insumo') adicionarAoMap(item.codigo, item.descricao, item.unidade, 'INSUMO', item.qtd, item.precoUnitario, item.tipo);
        else if (item.tipo === 'item_avulso') { 
            const chaveAvulso = item.id ? `AVULSO-${item.id}` : item.descricao; 
            adicionarAoMap(chaveAvulso, item.descricao, item.unidade, item.grupo || 'MATERIAL', item.qtd, item.precoUnitario, 'item_avulso', item.grupo); 
        }
    });

    const mapaSCO = { 'MOD': 'MÃO DE OBRA', 'MOI': 'MÃO DE OBRA', 'MAT': 'MATERIAL', 'IEQ': 'EQUIPAMENTO', 'REQ': 'EQUIPAMENTO', 'EQ ': 'EQUIPAMENTO', 'EVE': 'EVENTUAIS', 'TRI': 'TRIBUTOS', 'RSE': 'SERVIÇOS' };

    const listaInsumos = Array.from(insumosMap.values()).map(insumo => {
        let precoUnitario = parseFloat(insumo.precoUnitarioManual) || 0;
        const isSCO = insumo.origem === 'sco_composicao' || insumo.origem === 'sco_insumo' || insumo.codigo.startsWith('SCO-') || insumo.codigo.startsWith('MOD') || insumo.codigo.startsWith('MOI') || insumo.codigo.startsWith('MAT') || insumo.codigo.startsWith('IEQ') || insumo.codigo.startsWith('REQ') || insumo.codigo.startsWith('EQ ') || insumo.codigo.startsWith('EVE') || insumo.codigo.startsWith('TRI') || insumo.codigo.startsWith('RSE') || insumo.codigo.startsWith('AD ');

        let baseInsumos = isSCO ? ((tabela === 'desonerada') ? window.appState.databases.sco_icd : window.appState.databases.sco_isd) : ((tabela === 'desonerada') ? window.appState.databases.sinapi_icd : window.appState.databases.sinapi_isd);
        let baseInsumosSP = isSCO ? [] : ((tabela === 'desonerada') ? window.appState.databases.sinapi_icd_sp : window.appState.databases.sinapi_isd_sp);
        
        let achado = (baseInsumos || []).find(i => String(i['Código']).trim() === insumo.codigo);

        if (!achado && !isSCO && insumo.origem !== 'base_propria') achado = (baseInsumosSP || []).find(i => String(i['Código']).trim() === insumo.codigo);

        if (!achado) {
            const baseComps = isSCO ? ((tabela === 'desonerada') ? window.appState.databases.sco_ccd : window.appState.databases.sco_csd) : ((tabela === 'desonerada') ? window.appState.databases.sinapi_ccd : window.appState.databases.sinapi_csd);
            const baseCompsSP = isSCO ? [] : ((tabela === 'desonerada') ? window.appState.databases.sinapi_ccd_sp : window.appState.databases.sinapi_csd_sp);
            achado = (baseComps || []).find(i => String(i['Código']).trim() === insumo.codigo);
            if (!achado && !isSCO && insumo.origem !== 'base_propria') achado = (baseCompsSP || []).find(i => String(i['Código']).trim() === insumo.codigo);
        }

        if (achado) {
            if (precoUnitario <= 0) {
                const tipoInferido = (insumo.origem.includes('composicao') || insumo.tipoItem.includes('composicao')) ? 'composicao' : 'insumo';
                precoUnitario = window.obterPrecoItemPorCodigoETipo(insumo.codigo, isSCO ? `sco_${tipoInferido}` : tipoInferido, estadoConfig, tabela);
            }
            if (!insumo.descricao || insumo.descricao.startsWith('Composição ')) insumo.descricao = achado['Descrição'] || insumo.descricao;
            if (!insumo.unidade || insumo.unidade === 'UN') insumo.unidade = achado['Unidade'] || insumo.unidade;
        }

        const prefixoSCO = insumo.codigo.substring(0, 3).toUpperCase();
        if (mapaSCO[prefixoSCO]) insumo.grupo = mapaSCO[prefixoSCO];
        else if (achado && achado['Grupo']) insumo.grupo = String(achado['Grupo']).toUpperCase().trim();
        else if (!insumo.grupo && insumo.tipoItem) insumo.grupo = insumo.tipoItem.toUpperCase();

        return { ...insumo, precoUnitario: precoUnitario, custoTotal: window.arredondarMoeda((insumo.qtdTotal * precoUnitario) || 0) };
    });

    const listaMaoDeObra = []; const listaMateriais = [];

    listaInsumos.forEach(item => {
        const grupo = (item.grupo || item.tipoItem || '').toUpperCase(); 
        const cod = (item.codigo || '').toUpperCase(); 
        const desc = (item.descricao || '').toUpperCase(); 

        let isMaoDeObra = false;
        let isEquipamento = false;
        if (grupo.includes('MÃO DE OBRA') || grupo.includes('MAO DE OBRA') || cod.startsWith('MOD') || cod.startsWith('MOI') || desc.includes('(HORISTA)') || desc.includes('(MENSALISTA)') || desc.includes('COM ENCARGOS COMPLEMENTARES')) {
            isMaoDeObra = true;
        }
        if (cod.startsWith('EQ ') || cod.startsWith('IEQ') || cod.startsWith('REQ') || grupo.includes('EQUIPAMENTO') || item.unidade === 'CHP' || item.unidade === 'CHI' || /\s-\s*CH[PI]\b/.test(desc)) {
            isMaoDeObra = false;
            isEquipamento = true;
        }

        item.categoria = isMaoDeObra ? 'MÃO DE OBRA' : (isEquipamento ? 'EQUIPAMENTO' : 'MATERIAL / SERVIÇO');

        if (isMaoDeObra) listaMaoDeObra.push(item);
        else listaMateriais.push(item);
    });

    listaInsumos.sort((a, b) => b.custoTotal - a.custoTotal);
    listaMaoDeObra.sort((a, b) => b.custoTotal - a.custoTotal); 
    listaMateriais.sort((a, b) => b.custoTotal - a.custoTotal);

    return { listaInsumos, listaMaoDeObra, listaMateriais };
};

window.gerarLevantamentoCurvaABC = function() {
    if (!window.appState.orcamento || window.appState.orcamento.length === 0) { alert('O orçamento está vazio. Adicione itens ao orçamento primeiro.'); return; }

    const estadoConfig = document.getElementById('select-estado').value; 
    const tabela = document.getElementById('select-tabela').value;
    const { listaMaoDeObra, listaMateriais } = window.calcularInsumosExplodidos(estadoConfig, tabela);
    
    window.appState.cachedMaoDeObra = listaMaoDeObra; 
    window.appState.cachedMateriaisABC = listaMateriais;
    window.renderizarTabelasCurvaABC(listaMaoDeObra, listaMateriais);
};

window.renderizarTabelasCurvaABC = function(listaMaoDeObra, listaMateriais) {
    const containerMaoDeObra = document.getElementById('container-tabela-mao-de-obra'); 
    const containerMateriais = document.getElementById('container-tabela-materiais');
    containerMaoDeObra.classList.remove('hidden'); 
    containerMateriais.classList.remove('hidden');

    const tbodyMaoDeObra = document.getElementById('tbody-mao-de-obra'); 
    let totalCustoHH = 0;
    
    if (listaMaoDeObra.length === 0) {
        tbodyMaoDeObra.innerHTML = `<tr><td colspan="6" class="text-center" style="padding: 15px; color: var(--text-muted);">Nenhum insumo de Mão de Obra encontrado.</td></tr>`;
    } else {
        tbodyMaoDeObra.innerHTML = listaMaoDeObra.map(item => { 
            totalCustoHH += (parseFloat(item.custoTotal) || 0); 
            return `<tr><td><strong>${item.codigo}</strong></td><td>${item.descricao}</td><td class="text-center">${item.unidade}</td><td class="text-right">${item.qtdTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td><td class="text-right">${window.formatBRL(item.precoUnitario)}</td><td class="text-right"><strong>${window.formatBRL(item.custoTotal)}</strong></td></tr>`; 
        }).join('');
    }
    document.getElementById('tfoot-hh-total-custo').innerText = window.formatBRL(totalCustoHH);

    const tbodyMateriais = document.getElementById('tbody-materiais-abc');
    const somaTotalMateriais = listaMateriais.reduce((acc, item) => acc + (parseFloat(item.custoTotal) || 0), 0); 
    let custoAcumulado = 0;
    
    if (listaMateriais.length === 0) {
        tbodyMateriais.innerHTML = `<tr><td colspan="9" class="text-center" style="padding: 15px; color: var(--text-muted);">Nenhum material ou equipamento encontrado.</td></tr>`;
    } else {
        tbodyMateriais.innerHTML = listaMateriais.map((item) => {
            custoAcumulado += (parseFloat(item.custoTotal) || 0);
            const percTotal = somaTotalMateriais > 0 ? (item.custoTotal / somaTotalMateriais) * 100 : 0; 
            const percAcum = somaTotalMateriais > 0 ? (custoAcumulado / somaTotalMateriais) * 100 : 0;
            let classeABC = 'A'; let classeBadge = 'badge-a';
            if (percAcum > 95.0) { classeABC = 'C'; classeBadge = 'badge-c'; } else if (percAcum > 80.0) { classeABC = 'B'; classeBadge = 'badge-b'; }
            item.classeABC = classeABC; item.percTotal = percTotal; item.percAcum = percAcum;
            return `<tr><td class="text-center"><span class="badge-abc ${classeBadge}">${classeABC}</span></td><td><strong>${item.codigo}</strong></td><td>${item.descricao}</td><td class="text-center">${item.unidade}</td><td class="text-right">${item.qtdTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 3 })}</td><td class="text-right">${window.formatBRL(item.precoUnitario)}</td><td class="text-right"><strong>${window.formatBRL(item.custoTotal)}</strong></td><td class="text-right">${percTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</td><td class="text-right">${percAcum.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</td></tr>`;
        }).join('');
    }
    document.getElementById('tfoot-materiais-total-custo').innerText = window.formatBRL(somaTotalMateriais); 
    containerMaoDeObra.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

window.gerarCurvaABCOrcamento = function() {
    if (!window.appState.orcamento || window.appState.orcamento.length === 0) { alert('O orçamento está vazio.'); return; }
    
    const estadoConfig = document.getElementById('select-estado').value; 
    const tabela = document.getElementById('select-tabela').value; 
    const bdi = parseFloat(document.getElementById('input-bdi').value) || 0;
    const bdiDif = parseFloat(document.getElementById('input-bdi-dif')?.value);
    const bdiDifFinal = !isNaN(bdiDif) ? bdiDif : bdi;
    const itensValidos = window.appState.orcamento.filter(item => item.tipo !== 'etapa');

    const listaCalculada = itensValidos.map(item => {
        const precoUnitarioBase = window.obterPrecoAtualizadoDoItem(item, estadoConfig, tabela);
        const bdiItem = window.obterBdiDoItem(item, bdi, bdiDifFinal);
        const { precoComBdi, totalComBdi } = window.calcularValoresItemTCU(precoUnitarioBase, item.qtd, bdiItem);
        return { ...item, precoComBdi: precoComBdi, custoTotal: totalComBdi };
    });
    
    listaCalculada.sort((a, b) => b.custoTotal - a.custoTotal);
    const somaTotal = window.arredondarMoeda(listaCalculada.reduce((acc, item) => acc + item.custoTotal, 0)); 
    let custoAcumulado = 0;

    const tbody = document.getElementById('tbody-abc-orcamento');
    if (listaCalculada.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" class="text-center" style="padding: 15px; color: var(--text-muted);">Nenhum serviço válido para cálculo.</td></tr>`;
    } else {
        tbody.innerHTML = listaCalculada.map((item) => {
            custoAcumulado = window.arredondarMoeda(custoAcumulado + item.custoTotal);
            const percTotal = somaTotal > 0 ? (item.custoTotal / somaTotal) * 100 : 0; 
            const percAcum = somaTotal > 0 ? (custoAcumulado / somaTotal) * 100 : 0;
            let classeABC = 'A'; let classeBadge = 'badge-a';
            if (percAcum > 95.0) { classeABC = 'C'; classeBadge = 'badge-c'; } else if (percAcum > 80.0) { classeABC = 'B'; classeBadge = 'badge-b'; }
            item.classeABC = classeABC; item.percTotal = percTotal; item.percAcum = percAcum;
            return `<tr><td class="text-center"><span class="badge-abc ${classeBadge}">${classeABC}</span></td><td>${item.itemEap}</td><td><strong>${item.codigo}</strong></td><td>${item.descricao}</td><td class="text-center">${item.unidade}</td><td class="text-right">${item.qtd.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 3 })}</td><td class="text-right">${window.formatBRL(item.precoComBdi)}</td><td class="text-right"><strong>${window.formatBRL(item.custoTotal)}</strong></td><td class="text-right">${percTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</td><td class="text-right">${percAcum.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</td></tr>`;
        }).join('');
    }
    document.getElementById('tfoot-abc-orcamento-total').innerText = window.formatBRL(somaTotal); 
    window.appState.cachedServicosABC = listaCalculada;
    
    document.getElementById('container-abc-orcamento').classList.remove('hidden'); 
    document.getElementById('section-abc-orcamento').scrollIntoView({ behavior: 'smooth', block: 'start' });
};
