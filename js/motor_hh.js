// ==========================================
// MÓDULO: MOTOR HH (METODOLOGIA DO PROFISSIONAL CHAVE / GARGALO)
// Arquivo: js/motor_hh.js
// ==========================================

window.bancoEquipesDefault = null;

// Normaliza códigos de composições (remove sufixos como " (/)" do SCO)
window.normalizarCodigoComposicao = function(codigo) {
    if (!codigo) return '';
    return String(codigo).trim().replace(/\s*\(\/?\)\s*$/, '').trim();
};

// Limpa descrições de Mão de Obra para exibir apenas o cargo/função real
window.limparNomeCargoMO = function(descricao, codigoFallback = '') {
    if (!descricao) return String(codigoFallback || '').trim();
    let desc = String(descricao).toUpperCase().trim();

    // Corrige caso algum cache antigo tenha salvo o 1º item da composição auxiliar ("CURSO DE CAPACITAÇÃO PARA ...")
    desc = desc.replace(/^CURSO DE CAPACITA[ÇC][ÃA]O PARA\s+/i, '');

    // Remove sufixos padrão SINAPI e SCO de encargos e regime
    desc = desc
        .replace(/\s*\(INCLUSIVE ENCARGOS SOCIAIS[^)]*\)/gi, '')
        .replace(/\s*\(ENCARGOS COMPLEMENTARES[^)]*\)/gi, '')
        .replace(/\s*COM ENCARGOS COMPLEMENTARES.*$/gi, '')
        .replace(/\s*-\s*HORISTA.*$/gi, '')
        .replace(/\s*\(HORISTA\).*$/gi, '')
        .replace(/\s*-\s*MENSALISTA.*$/gi, '')
        .replace(/\s*\(MENSALISTA\).*$/gi, '')
        .replace(/\s*EXCLUSIVE\s+.*$/gi, '')
        .replace(/\s*INCLUSIVE\s+.*$/gi, '')
        .replace(/^SERVENTE DE OBRAS$/i, 'SERVENTE')
        .replace(/^CARPINTEIRO DE FORMAS$/i, 'CARPINTEIRO DE FÔRMAS')
        .replace(/^TECNICO DE SEGURANCA$/i, 'TÉCNICO DE SEGURANÇA')
        .replace(/^OPERADOR DE BETONEIRA ESTACION[ÁA]RIA\/MISTURADOR$/i, 'OPERADOR DE BETONEIRA')
        .trim();

    return desc || String(codigoFallback || '').trim();
};

// Limpa descrições de Equipamentos (unifica CHP e CHI do mesmo equipamento)
window.limparNomeEquipamento = function(descricao, codigoFallback = '') {
    if (!descricao) return String(codigoFallback || '').trim();
    let desc = String(descricao).toUpperCase().trim();

    if (desc.includes('CONTAINER ESCRIT')) return 'CONTAINER ESCRITÓRIO / VESTIÁRIO';
    if (desc.includes('CACAMBA DE ACO') || desc.includes('CAÇAMBA DE AÇO') || desc.includes('CAÇAMBA ESTACIONÁRIA')) return 'CAÇAMBA ESTACIONÁRIA 5M³';
    if (desc.includes('GUINCHO ELETRICO DE COLUNA') || desc.includes('GUINCHO ELÉTRICO DE COLUNA')) return 'GUINCHO ELÉTRICO DE COLUNA 400 KG';
    if (desc.includes('MARTELO DEMOLIDOR') || desc.includes('MARTELETE')) return 'MARTELO DEMOLIDOR / MARTELETE';
    if (desc.includes('BETONEIRA')) return 'BETONEIRA 400 L';
    if (desc.includes('TALHA MANUAL')) return 'TALHA MANUAL DE CORRENTE';
    if (desc.includes('ANDAIME METALICO') || desc.includes('ANDAIME METÁLICO')) return 'ANDAIME METÁLICO TUBULAR';

    desc = desc
        .replace(/\s*-\s*CHP\b.*$/i, '')
        .replace(/\s*-\s*CHI\b.*$/i, '')
        .replace(/\s*-\s*DEPRECIA[ÇC][ÃA]O.*$/i, '')
        .replace(/\s*-\s*JUROS.*$/i, '')
        .replace(/\s*-\s*MANUTEN[ÇC][ÃA]O.*$/i, '')
        .replace(/\s*-\s*MATERIAIS NA OPERA[ÇC][ÃA]O.*$/i, '')
        .replace(/\.\s*AF_\d{2}\/\d{4}.*$/i, '')
        .trim();

    return desc || String(codigoFallback || '').trim();
};

// Verifica se um item de composição é realmente um trabalhador humano (Mão de Obra)
// e NÃO uma parcela horária de equipamento (Depreciação, Juros, Manutenção, Energia) ou encargo (Exames, EPI, Curso)
window.ehRecursoMaoDeObraHumana = function(cod, desc, und, grupo) {
    const c = String(cod || '').toUpperCase().trim();
    const d = String(desc || '').toUpperCase().trim();
    const u = String(und || '').toUpperCase().trim();
    const g = String(grupo || '').toUpperCase().trim();

    // Códigos de parcelas horárias de equipamentos do SINAPI (ex: 93277 Depreciação, 93278 Juros, 93279 Manutenção, 93280 Materiais/Energia)
    const codigosNaoHumanos = new Set(['93277', '93278', '93279', '93280', '93281', '93282', '102274', '102275', '88830', '88831', '95140']);
    if (codigosNaoHumanos.has(c)) return false;

    // Prefixos de materiais, equipamentos e taxas SCO
    if (c.startsWith('EQ ') || c.startsWith('IEQ') || c.startsWith('REQ') || c.startsWith('MAT') || c.startsWith('EVE') || c.startsWith('RSE') || c.startsWith('TRI')) {
        return false;
    }

    // Unidades exclusivas de equipamentos ou taxas
    if (u === 'CHP' || u === 'CHI' || u === '%' || u === 'KWH' || u === 'KW/H') return false;

    // Palavras-chave que indicam equipamentos, parcelas de custo horário ou insumos de encargos complementares
    const termosExclusao = [
        '- DEPRECIAÇÃO', '- DEPRECIACAO', '- JUROS', '- MANUTENÇÃO', '- MANUTENCAO',
        '- MATERIAIS NA OPERAÇÃO', '- MATERIAIS NA OPERACAO', '- IMPOSTOS',
        '- CHP', '- CHI', 'ENERGIA ELETRICA', 'ENERGIA ELÉTRICA',
        'GUINCHO', 'BETONEIRA', 'COMPRESSOR', 'MARTELETE', 'MARTELO DEMOLIDOR',
        'TALHA MANUAL', 'ANDAIME', 'CAÇAMBA', 'CACAMBA', 'CONTAINER',
        'EPI - FAMILIA', 'FERRAMENTAS - FAMILIA', 'SEGURO - HORISTA', 'EXAMES - HORISTA',
        'TRANSPORTE - HORISTA', 'ALIMENTACAO - HORISTA', 'INCIDENTE SOBRE MAO DE OBRA'
    ];
    for (const termo of termosExclusao) {
        if (d.includes(termo)) return false;
    }

    // Critérios positivos para Mão de Obra Humana
    if (c.startsWith('MOD') || c.startsWith('MOI')) return true;
    if (d.includes('COM ENCARGOS COMPLEMENTARES') || d.includes('ENCARGOS SOCIAIS E ENCARGOS COMPLEMENTARES')) return true;
    if (g.includes('MÃO DE OBRA') || g.includes('MAO DE OBRA')) return true;

    const cargosConhecidos = [
        'PEDREIRO', 'SERVENTE', 'TELHADISTA', 'CARPINTEIRO', 'AJUDANTE', 'AUXILIAR',
        'IMPERMEABILIZADOR', 'OPERADOR', 'ENCARREGADO', 'ENGENHEIRO', 'ARQUITETO',
        'MESTRE DE OBRAS', 'TECNICO DE SEGURANCA', 'TÉCNICO DE SEGURANÇA',
        'ELETRICISTA', 'BOMBEIRO', 'ENCANADOR', 'PINTOR', 'ARMADOR', 'SOLDADOR',
        'SERRALHEIRO', 'GESSEIRO', 'VIDRACEIRO', 'MONTADOR', 'CALCETEIRO', 'MARCENEIRO'
    ];
    if (u === 'H' || u === 'HH' || u === 'MES' || u === 'MÊS' || u === 'UN') {
        for (const cargo of cargosConhecidos) {
            if (d.includes(cargo)) return true;
        }
    }

    return false;
};

// Verifica se um item de composição é um Equipamento de Apoio / Pesado relevante para mobilização
window.ehRecursoEquipamentoMobilizacao = function(cod, desc, und, grupo) {
    const c = String(cod || '').toUpperCase().trim();
    const d = String(desc || '').toUpperCase().trim();
    const u = String(und || '').toUpperCase().trim();
    const g = String(grupo || '').toUpperCase().trim();

    if (window.ehRecursoMaoDeObraHumana(cod, desc, und, grupo)) return false;

    // Ignora subparcelas internas de depreciação/juros/manutenção/energia para não duplicar o equipamento pai
    if (['93277', '93278', '93279', '93280'].includes(c)) return false;
    if (d.includes('- DEPRECIA') || d.includes('- JUROS') || d.includes('- MANUTEN') || d.includes('- MATERIAIS NA OPERA')) return false;

    if (u === 'CHP' || u === 'CHI') return true;
    if (c.startsWith('IEQ') || c.startsWith('EQ ') || c.startsWith('REQ')) return true;
    if (g.includes('EQUIPAMENTO')) return true;

    const maquinasConhecidas = [
        'GUINCHO', 'BETONEIRA', 'MARTELO DEMOLIDOR', 'MARTELETE', 'COMPRESSOR',
        'TALHA MANUAL', 'ANDAIME', 'CAÇAMBA', 'CACAMBA', 'CONTAINER'
    ];
    for (const maq of maquinasConhecidas) {
        if (d.includes(maq)) return true;
    }

    return false;
};

// Auxiliar para descobrir o nome legível de um código de mão de obra/equipamento
window.obterNomeRecursoPorCodigo = function(codigo) {
    const codLimpo = String(codigo || '').trim();
    if (!codLimpo) return codigo;

    const dbs = window.appState.databases || {};

    // 1. Procura primeiro nas tabelas sintéticas de Composições e Insumos (onde 'Código' é o próprio recurso)
    const listasSinteticas = [
        dbs.sinapi_csd, dbs.sinapi_ccd, dbs.sinapi_isd, dbs.sinapi_icd,
        dbs.sinapi_csd_sp, dbs.sinapi_isd_sp,
        dbs.sco_csd, dbs.sco_ccd, dbs.sco_isd, dbs.sco_icd
    ];

    for (const lista of listasSinteticas) {
        if (!Array.isArray(lista)) continue;
        const achado = lista.find(i => String(i['Código'] || '').trim() === codLimpo);
        if (achado && achado['Descrição']) {
            return window.limparNomeCargoMO(achado['Descrição'], codLimpo);
        }
    }

    // 2. Procura nas bases analíticas APENAS pelo 'Código do Item' (filho), NUNCA pelo 'Código' (mãe)!
    const listasAnaliticas = [dbs.sinapi_analitico, dbs.sco_analitico];
    for (const lista of listasAnaliticas) {
        if (!Array.isArray(lista)) continue;
        const achado = lista.find(i => String(i['Código do Item'] || i['Código Item'] || '').trim() === codLimpo);
        if (achado && achado['Descrição']) {
            return window.limparNomeCargoMO(achado['Descrição'], codLimpo);
        }
    }

    return codLimpo;
};

// Extrai gargalo, equipe humana e equipamentos diretamente da base analítica
window.extrairEquipaDaBaseAnalitica = function(item) {
    const dbs = window.appState.databases || {};
    const codMaeOriginal = String(item.codigo || '').trim();
    const codMaeNorm = window.normalizarCodigoComposicao(codMaeOriginal);
    if (!codMaeNorm || codMaeNorm === '-') return null;

    let ingredientes = [];
    if (item.tipo === 'base_propria') {
        const comp = (dbs.base_propria || []).find(c => window.normalizarCodigoComposicao(c['Código']) === codMaeNorm);
        if (comp && Array.isArray(comp.ingredientes)) ingredientes = comp.ingredientes;
    } else {
        const analitico = (dbs.sinapi_analitico || []).concat(dbs.sco_analitico || []);
        ingredientes = analitico.filter(i => {
            const cMae = window.normalizarCodigoComposicao(i['Código'] || i['Código Mãe'] || '');
            return cMae === codMaeNorm;
        });
    }

    const moList = [];
    const eqpMap = new Map();

    // Verifica se o próprio item do orçamento já é um equipamento (ex: Container, Guincho CHP/CHI)
    if (window.ehRecursoEquipamentoMobilizacao(codMaeNorm, item.descricao, item.unidade, item.grupo)) {
        const nomeEqpProprio = window.limparNomeEquipamento(item.descricao, codMaeNorm);
        eqpMap.set(nomeEqpProprio, { equipamento: nomeEqpProprio, quantidade: 1 });
    }

    ingredientes.forEach(ing => {
        const cod = String(ing['Código do Item'] || ing['Código Item'] || ing['Código'] || ing.codigoItem || '').trim();
        if (!cod || window.normalizarCodigoComposicao(cod) === codMaeNorm) return;

        const und = String(ing['Unidade'] || ing.unidade || '').toUpperCase().trim();
        const desc = String(ing['Descrição'] || ing.descricao || '').toUpperCase().trim();
        const grupo = String(ing['Tipo Item'] || ing['Grupo'] || ing.grupo || '').toUpperCase().trim();
        const coef = parseFloat(ing['Coeficiente'] || ing.coeficiente) || 0;

        if (coef <= 0) return;

        if (window.ehRecursoMaoDeObraHumana(cod, desc, und, grupo)) {
            const nomeLimpo = window.limparNomeCargoMO(desc || window.obterNomeRecursoPorCodigo(cod), cod);
            const ehAuxiliar = nomeLimpo.includes('SERVENTE') || nomeLimpo.includes('AJUDANTE') || nomeLimpo.includes('AUXILIAR');
            moList.push({ cod, desc: nomeLimpo, coef, ehAuxiliar });
        } else if (window.ehRecursoEquipamentoMobilizacao(cod, desc, und, grupo)) {
            const nomeEqp = window.limparNomeEquipamento(desc, cod);
            if (nomeEqp && !eqpMap.has(nomeEqp)) {
                eqpMap.set(nomeEqp, { equipamento: nomeEqp, quantidade: 1 });
            }
        }
    });

    const equipamentosExtraidos = Array.from(eqpMap.values());

    if (moList.length === 0) {
        return equipamentosExtraidos.length > 0 ? {
            chave: null,
            horas_chave: 0,
            equipa: {},
            nomes: {},
            equipamentos: equipamentosExtraidos
        } : null;
    }

    // Prioriza oficial (não-auxiliar) com maior coeficiente; se só houver servente/ajudante, usa o maior coeficiente
    const oficiais = moList.filter(m => !m.ehAuxiliar);
    const candidatosChave = oficiais.length > 0 ? oficiais : moList;
    candidatosChave.sort((a, b) => b.coef - a.coef);
    const chaveObj = candidatosChave[0];

    const equipaRacio = {};
    const nomes = {};
    const ehAdmLocal = String(item.descricao || '').toUpperCase().includes('ADMINISTRA');

    moList.forEach(m => {
        // Na Administração Local (Engenheiro, Encarregado, Técnico de Segurança), cada profissional representa 1 pessoa na equipe
        equipaRacio[m.cod] = ehAdmLocal ? 1 : (m.coef / chaveObj.coef);
        nomes[m.cod] = m.desc;
    });

    return {
        chave: chaveObj.cod,
        horas_chave: chaveObj.coef,
        equipa: equipaRacio,
        nomes: nomes,
        equipamentos: equipamentosExtraidos
    };
};

// 1. FUNÇÃO PARA CARREGAR O CATÁLOGO DE GARGALOS (DINÂMICO)
window.carregarBancoEquipes = async function() {
    if (window.appState && window.appState.databases && window.appState.databases.equipes_default && Object.keys(window.appState.databases.equipes_default).length > 0) {
        return window.appState.databases.equipes_default;
    }
    
    const selectDataBase = document.getElementById('select-data-base');
    const dataBase = selectDataBase ? selectDataBase.value : "2026_09";
    const githubUrlRaiz = `https://raw.githubusercontent.com/thiagouffcivil-rgb/orcamento/main/${dataBase}/`;
    const urlEquipesDefault = `${githubUrlRaiz}equipes_default_${dataBase}.json`;
    
    try {
        const response = await fetch(urlEquipesDefault); 
        if (!response.ok) return {};
        const data = await response.json();
        window.appState.databases.equipes_default = data;
        return data;
    } catch (error) {
        console.warn(`Catálogo equipes_default não disponível para ${dataBase}, usando extração analítica direta.`);
        return {};
    }
};

// 2. MOTOR DE INJEÇÃO DO PROFISSIONAL CHAVE
window.calcularHHDosIngredientes = async function() {
    if (!window.appState.orcamento || window.appState.orcamento.length === 0) {
        return alert("O orçamento está vazio.");
    }

    const banco = await window.carregarBancoEquipes() || {};
    let itensAtualizados = 0;

    window.appState.orcamento.forEach(item => {
        if (item.tipo === 'etapa' || item.tipo === 'item_avulso') return;

        // Prioriza a extração analítica direta das bases SINAPI/SCO/Própria (que separa Mão de Obra e Equipamentos com precisão)
        const codNorm = window.normalizarCodigoComposicao(item.codigo);
        let dadosEquipa = window.extrairEquipaDaBaseAnalitica(item) || banco[item.codigo] || banco[codNorm];

        if (!item.cronograma) {
            item.cronograma = { hh: 0, equipe: 1, ritmo: 100, predecessora: '', terminoJunto: '', espera: 0 };
        }

        if (dadosEquipa) {
            if (Array.isArray(dadosEquipa.equipamentos) && dadosEquipa.equipamentos.length > 0) {
                item.cronograma.equipamentosDetalhe = dadosEquipa.equipamentos;
            }

            if (parseFloat(dadosEquipa.horas_chave) > 0 && dadosEquipa.equipa && Object.keys(dadosEquipa.equipa).length > 0) {
                const qtdItem = parseFloat(item.qtd) || 0;
                const hhGargaloBase = parseFloat(dadosEquipa.horas_chave) || 0;
                const hhGargaloTotal = parseFloat((hhGargaloBase * qtdItem).toFixed(2));

                item.cronograma.hh = hhGargaloTotal;
                item.cronograma.cargoChave = dadosEquipa.chave;

                const nomesMap = {};
                const equipaLimpa = {};
                const equipeDetalhadaAuto = [];

                for (const cod in dadosEquipa.equipa) {
                    const nomeCargo = (dadosEquipa.nomes && dadosEquipa.nomes[cod])
                        ? window.limparNomeCargoMO(dadosEquipa.nomes[cod], cod)
                        : window.obterNomeRecursoPorCodigo(cod);

                    // Filtra códigos que não sejam mão de obra humana (ex: 93277..93280 vindos de equipes_default antigo)
                    if (!window.ehRecursoMaoDeObraHumana(cod, nomeCargo, 'H', 'MÃO DE OBRA')) continue;

                    const racioVal = parseFloat(dadosEquipa.equipa[cod]) || 1;
                    nomesMap[cod] = nomeCargo;
                    equipaLimpa[cod] = racioVal;
                    equipeDetalhadaAuto.push({
                        codigo: cod,
                        cargo: nomeCargo,
                        racio: racioVal
                    });
                }

                item.cronograma.equipeDefault = equipaLimpa;
                item.cronograma.nomesRecursos = nomesMap;
                item.cronograma.equipeDetalhada = equipeDetalhadaAuto;
                itensAtualizados++;
            }
        }
    });

    if (itensAtualizados > 0) {
        window.carregarTabelaCronograma();
        if (typeof window.gerarGraficoGantt === 'function') window.gerarGraficoGantt();
        if (typeof window.gerarMatrizMaoDeObra === 'function' && document.getElementById('matriz-mao-de-obra-container')) {
            window.gerarMatrizMaoDeObra();
        }
        if (typeof window.salvarEstadoLocal === 'function') window.salvarEstadoLocal();
        alert(`✅ Sucesso! O HH do Profissional Chave (Gargalo), as equipes de Mão de Obra e os Equipamentos foram calculados para ${itensAtualizados} serviço(s) a partir das composições analíticas SINAPI/SCO.`);
    } else {
        alert("⚠️ Nenhum insumo de Mão de Obra (em horas) foi encontrado nas composições dos itens atuais do orçamento.");
    }
};
