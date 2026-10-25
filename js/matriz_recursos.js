// ==========================================
// MÓDULO: MATRIZ DE ALOCAÇÃO DE RECURSOS (HISTOGRAMA)
// Arquivo: matriz_recursos.js
// ==========================================

window.gerarMatrizMaoDeObra = function() {
    // Garante que as datas do Gantt estão calculadas antes de gerar a matriz
    if (typeof window.gerarGraficoGantt === 'function') {
        window.gerarGraficoGantt();
    }

    const tarefas = window.appState.orcamento.filter(i => i.tipo !== 'etapa' && i.cronograma && i.cronograma.dataInicio && i.cronograma.dataFim);
    
    if (tarefas.length === 0) {
        alert("Não há tarefas no cronograma com datas válidas. Carregue os serviços e desenhe o Gantt primeiro.");
        return;
    }

    let minDate = new Date(Math.min(...tarefas.map(t => new Date(t.cronograma.dataInicio).getTime())));
    let maxDate = new Date(Math.max(...tarefas.map(t => new Date(t.cronograma.dataFim).getTime())));

    let diasProjeto = [];
    let curDate = new Date(minDate.getTime());
    while (curDate <= maxDate) {
        if (curDate.getDay() !== 0 && curDate.getDay() !== 6) diasProjeto.push(new Date(curDate.getTime()));
        curDate.setDate(curDate.getDate() + 1);
    }

    let matrizMODiaria = {};
    let matrizEqpDiaria = {};

    const limparCodBusca = (cod) => cod ? String(cod).replace(/[^a-zA-Z0-9]/g, '').toUpperCase() : '';

    function buscarDetalhesNoBanco(codigoItem) {
        let codLimpo = limparCodBusca(codigoItem);
        if (window.appState.baseComposicoesPrazos && window.appState.baseComposicoesPrazos[codLimpo]) {
            return window.appState.baseComposicoesPrazos[codLimpo];
        }
        for (let key in window.appState.databases) {
            let banco = window.appState.databases[key];
            if (Array.isArray(banco)) {
                let comp = banco.find(c => limparCodBusca(c.codigo || c['Código']) === codLimpo);
                if (comp && (comp.equipeFiscalizacao || comp.equipamentosFiscalizacao)) {
                    return comp;
                }
            }
        }
        return null;
    }

    // Antes de iterar os dias, sincroniza/higieniza os dados analíticos de cada tarefa (remove lixos de cache antigo como "CURSO DE CAPACITAÇÃO" ou códigos 93277..93280)
    tarefas.forEach(t => {
        if (typeof window.extrairEquipaDaBaseAnalitica === 'function') {
            const extraido = window.extrairEquipaDaBaseAnalitica(t);
            if (extraido) {
                if (Object.keys(extraido.equipa || {}).length > 0) {
                    t.cronograma.equipeDefault = extraido.equipa;
                    t.cronograma.nomesRecursos = extraido.nomes;
                    if (!t.cronograma.cargoChave) t.cronograma.cargoChave = extraido.chave;
                }
                if (Array.isArray(extraido.equipamentos) && extraido.equipamentos.length > 0) {
                    t.cronograma.equipamentosDetalhe = extraido.equipamentos;
                }
            }
        }
    });

    // Passo A: Calcular o efetivo diário
    diasProjeto.forEach(dia => {
        let keyDia = dia.toISOString().split('T')[0];
        let timeDia = dia.getTime();
        
        tarefas.forEach(t => {
            let startT = new Date(t.cronograma.dataInicio).getTime();
            let endT = new Date(t.cronograma.dataFim).getTime();
            
            if (timeDia >= startT && timeDia <= endT) {
                const descTarefaUpper = String(t.descricao || '').toUpperCase();
                // Evita duplicar operador/máquina quando o orçamento lança separado o CHI (Custo Horário Improdutivo) do mesmo equipamento CHP
                const ehItemCHI = /\bCHI\s+(DIURNO|NOTURNO)\b/i.test(descTarefaUpper);

                let compBanco = buscarDetalhesNoBanco(t.codigo);
                let multiplicadorEquipe = parseFloat(t.cronograma.equipe) || 1;
                const ehAdmLocal = descTarefaUpper.includes('ADMINISTRA');

                // 1. Se tiver equipeDefault (extraída das composições SINAPI/SCO)
                if (!ehItemCHI && t.cronograma.equipeDefault && Object.keys(t.cronograma.equipeDefault).length > 0) {
                    const nomes = t.cronograma.nomesRecursos || {};
                    for (let cod in t.cronograma.equipeDefault) {
                        const nomeBruto = nomes[cod] || (typeof window.obterNomeRecursoPorCodigo === 'function' ? window.obterNomeRecursoPorCodigo(cod) : cod);
                        const nomeLegivel = typeof window.limparNomeCargoMO === 'function'
                            ? window.limparNomeCargoMO(nomeBruto, cod)
                            : nomeBruto;

                        if (typeof window.ehRecursoMaoDeObraHumana === 'function' && !window.ehRecursoMaoDeObraHumana(cod, nomeLegivel, 'H', 'MÃO DE OBRA')) {
                            continue;
                        }

                        const racio = ehAdmLocal ? 1 : (parseFloat(t.cronograma.equipeDefault[cod]) || 1);
                        const chaveCargo = nomeLegivel;
                        // O efetivo físico mobilizado na frente de serviço depende da Equipe alocada (não reduz quando o ritmo é esticado por terminoJunto)
                        const qtdReal = Math.max(0.1, racio * multiplicadorEquipe);

                        if (!matrizMODiaria[chaveCargo]) matrizMODiaria[chaveCargo] = {};
                        if (!matrizMODiaria[chaveCargo][keyDia]) matrizMODiaria[chaveCargo][keyDia] = 0;
                        matrizMODiaria[chaveCargo][keyDia] += qtdReal;
                    }
                } else if (!ehItemCHI) {
                    // 2. Fallback para equipeDetalhada (vinda da IA)
                    let equipe = (t.cronograma.equipeDetalhada) ? t.cronograma.equipeDetalhada : (compBanco && compBanco.equipeFiscalizacao ? compBanco.equipeFiscalizacao : []);
                    equipe.forEach(prof => {
                        let codProf = prof.codigo || '';
                        let nomeBruto = String(prof.cargo || 'OPERÁRIO').replace(/\s*\([^)]*\)\s*$/, '').trim();
                        let nomeCargo = typeof window.limparNomeCargoMO === 'function'
                            ? window.limparNomeCargoMO(nomeBruto, codProf)
                            : nomeBruto.toUpperCase();

                        if (typeof window.ehRecursoMaoDeObraHumana === 'function' && !window.ehRecursoMaoDeObraHumana(codProf, nomeCargo, 'H', 'MÃO DE OBRA')) {
                            return;
                        }

                        let baseEquipe = prof.quantidade !== undefined ? parseFloat(prof.quantidade) : ((parseFloat(prof.racio) || 1) * multiplicadorEquipe);
                        let qtdReal = ehAdmLocal ? Math.max(1, baseEquipe) : Math.max(0.1, baseEquipe);
                        
                        if (!matrizMODiaria[nomeCargo]) matrizMODiaria[nomeCargo] = {};
                        if (!matrizMODiaria[nomeCargo][keyDia]) matrizMODiaria[nomeCargo][keyDia] = 0;
                        matrizMODiaria[nomeCargo][keyDia] += qtdReal; 
                    });
                }
                
                // 3. Equipamentos de Apoio / Pesados
                let maquinas = (t.cronograma.equipamentosDetalhe && t.cronograma.equipamentosDetalhe.length > 0)
                    ? t.cronograma.equipamentosDetalhe
                    : (compBanco && compBanco.equipamentosFiscalizacao ? compBanco.equipamentosFiscalizacao : []);

                maquinas.forEach(maq => {
                    let nomeMaqBruto = String(maq.equipamento || 'EQUIPAMENTO').toUpperCase();
                    let nomeMaq = typeof window.limparNomeEquipamento === 'function'
                        ? window.limparNomeEquipamento(nomeMaqBruto)
                        : nomeMaqBruto;
                    let qtdMReal = parseFloat(maq.quantidade) || 1;
                    
                    if (!matrizEqpDiaria[nomeMaq]) matrizEqpDiaria[nomeMaq] = {};
                    if (!matrizEqpDiaria[nomeMaq][keyDia]) matrizEqpDiaria[nomeMaq][keyDia] = 0;
                    // Para equipamentos compartilhados no canteiro (ex: Guincho, Betoneira, Container), considera o pico exigido no dia
                    if (qtdMReal > matrizEqpDiaria[nomeMaq][keyDia]) {
                        matrizEqpDiaria[nomeMaq][keyDia] = qtdMReal;
                    }
                });
            }
        });
    });

    // Passo B: Encontrar o Pico Semanal
    let semanas = [];
    let currSemana = { titulo: "Sem. 1", mo: {}, eqp: {} };
    let countDias = 0; let numSemana = 1;

    diasProjeto.forEach((dia, index) => {
        let keyDia = dia.toISOString().split('T')[0];
        
        for (let c in matrizMODiaria) {
            if (!currSemana.mo[c]) currSemana.mo[c] = 0;
            if (matrizMODiaria[c][keyDia] && matrizMODiaria[c][keyDia] > currSemana.mo[c]) {
                currSemana.mo[c] = matrizMODiaria[c][keyDia];
            }
        }
        for (let e in matrizEqpDiaria) {
            if (!currSemana.eqp[e]) currSemana.eqp[e] = 0;
            if (matrizEqpDiaria[e][keyDia] && matrizEqpDiaria[e][keyDia] > currSemana.eqp[e]) {
                currSemana.eqp[e] = matrizEqpDiaria[e][keyDia];
            }
        }

        countDias++;
        if (countDias === 5 || index === diasProjeto.length - 1) { 
            semanas.push(currSemana);
            numSemana++;
            currSemana = { titulo: `Sem. ${numSemana}`, mo: {}, eqp: {} };
            countDias = 0;
        }
    });

    // Passo C: Renderizar as Tabelas HTML
    function desenharTabela(matrizBase, dicionarioSemana, tituloColuna, corHeader) {
        // Filtra apenas recursos que tenham atuação (> 0) em pelo menos uma semana
        let chaves = Object.keys(matrizBase).filter(chave => semanas.some(s => (s[dicionarioSemana][chave] || 0) >= 0.05)).sort();
        if (chaves.length === 0) return '';

        let html = `<table class="table-bordered" style="width: 100%; border-collapse: collapse; text-align: center; margin-bottom: 20px;">
        <thead><tr style="background: ${corHeader}; color: white;">
        <th style="padding: 10px; text-align: left; width: 35%;">${tituloColuna}</th>`;
        
        semanas.forEach(s => { html += `<th style="padding: 10px;">${s.titulo}</th>`; });
        html += `</tr></thead><tbody>`;

        chaves.forEach(chave => {
            html += `<tr><td style="padding: 8px; text-align: left; font-weight: bold; background: #f8fafc;">${chave}</td>`;
            semanas.forEach(s => {
                let picoNaSemana = s[dicionarioSemana][chave] || 0;
                let ativo = picoNaSemana >= 0.05;
                let corTexto = ativo ? "var(--primary)" : "#cbd5e1";
                let valorArred = Math.round(picoNaSemana * 10) / 10;
                let exibicao = Number.isInteger(valorArred) ? valorArred : valorArred.toFixed(1);
                html += `<td style="padding: 8px; color: ${corTexto}; font-weight: ${ativo ? 'bold' : 'normal'};">${ativo ? exibicao + ' un.' : '-'}</td>`;
            });
            html += `</tr>`;
        });
        html += `</tbody></table>`;
        return html;
    }

    let htmlFinal = desenharTabela(matrizMODiaria, 'mo', '👷 Cargos / Funções (Mão de Obra)', '#1e293b');
    let htmlMaquinas = desenharTabela(matrizEqpDiaria, 'eqp', '🏗️ Equipamentos de Apoio / Pesados', '#b45309');

    let container = document.getElementById('matriz-mao-de-obra-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'matriz-mao-de-obra-container';
        container.style.cssText = 'margin-top: 25px; overflow-x: auto; border: 1px solid var(--border-color); border-radius: 6px; background: white;';
        document.getElementById('gantt_chart_div').parentNode.appendChild(container);
    }
    
    container.innerHTML = `
        <h3 style="padding: 10px 15px; margin: 0; background: #f1f5f9; border-bottom: 1px solid var(--border-color); color: #334155; font-size: 1rem;">
            👥 Plano de Mobilização da Obra (Histograma Semanal de Picos)
        </h3>
        <div style="padding: 15px;">
            ${htmlFinal || '<p style="color: #dc3545; font-size: 0.9rem;">⚠️ Nenhuma equipe foi associada às tarefas ainda. Clique primeiro no botão <strong>"⚙️ 2. Puxar HH das Composições"</strong> no topo da aba!</p>'}
            ${htmlMaquinas ? htmlMaquinas : '<p style="color: #64748b; font-size: 0.9rem; font-style: italic;">Nenhum equipamento pesado registrado para mobilização.</p>'}
            <div style="margin-top: 8px; font-size: 0.8rem; color: #64748b;">
                * Os valores representam o pico máximo (simultâneo) de profissionais e equipamentos exigidos dentro de cada semana útil de trabalho.
            </div>
        </div>`;
    
    container.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

// ==========================================
// MÓDULO: MATRIZ DINÂMICA DE RECURSOS (GARGALOS POR TAREFA)
// ==========================================

window.abrirMatrizEquipa = function(id) {
    const item = window.appState.orcamento.find(i => i.id === id);
    
    if (!item || !item.cronograma || !item.cronograma.equipeDefault) {
        return alert('A matriz de equipe padrão ainda não foi calculada para este serviço.\n\nClique primeiro no botão "⚙️ 2. Puxar HH das Composições" no topo da aba!');
    }

    const multiplicador = parseFloat(item.cronograma.equipe) || 1;
    const cargoChave = item.cronograma.cargoChave;
    const equipa = item.cronograma.equipeDefault;
    const nomes = item.cronograma.nomesRecursos || {};
    const nomeChaveBruto = nomes[cargoChave] || (typeof window.obterNomeRecursoPorCodigo === 'function' ? window.obterNomeRecursoPorCodigo(cargoChave) : cargoChave);
    const nomeChaveLegivel = typeof window.limparNomeCargoMO === 'function' ? window.limparNomeCargoMO(nomeChaveBruto, cargoChave) : nomeChaveBruto;

    let htmlTabela = `
        <div style="background: #f8fafc; padding: 10px; border-radius: 6px; margin-bottom: 15px; border-left: 4px solid #3b82f6;">
            <strong>Serviço:</strong> ${item.itemEap} - ${item.descricao}<br>
            <strong>Frente Alocada:</strong> ${multiplicador}x Profissional Chave (<strong>${nomeChaveLegivel}</strong>)
        </div>
        <table style="width: 100%; border-collapse: collapse; text-align: left; margin-bottom: 15px;">
            <thead>
                <tr style="background: #e2e8f0; border-bottom: 2px solid #cbd5e1;">
                    <th style="padding: 8px;">Função / Cargo (Código)</th>
                    <th style="padding: 8px; text-align: center;">Proporção na Composição</th>
                    <th style="padding: 8px; text-align: center;">Efetivo Físico na Tarefa</th>
                </tr>
            </thead>
            <tbody>
    `;

    for (let cod in equipa) {
        let isChave = (cod === cargoChave);
        let racio = equipa[cod];
        let qtdReal = racio * multiplicador;
        let nomeBruto = nomes[cod] || (typeof window.obterNomeRecursoPorCodigo === 'function' ? window.obterNomeRecursoPorCodigo(cod) : cod);
        let nomeRecurso = typeof window.limparNomeCargoMO === 'function' ? window.limparNomeCargoMO(nomeBruto, cod) : nomeBruto;
        
        let destaqueLinha = isChave ? 'background: #eff6ff; font-weight: bold; border-bottom: 1px solid #cbd5e1;' : 'border-bottom: 1px solid #cbd5e1;';
        let seloGargalo = isChave ? '<span style="background: #ef4444; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; margin-left: 5px;">GARGALO (CHAVE)</span>' : '';

        htmlTabela += `
            <tr style="${destaqueLinha}">
                <td style="padding: 8px;">${nomeRecurso} <span style="color:#64748b; font-size:0.8rem;">(${cod})</span> ${seloGargalo}</td>
                <td style="padding: 8px; text-align: center; color: #64748b;">${racio.toFixed(2)}x</td>
                <td style="padding: 8px; text-align: center; color: #0f172a; font-size: 1.05rem;"><strong>${qtdReal.toFixed(2)}</strong></td>
            </tr>
        `;
    }

    const duracaoTexto = document.getElementById(`duracao-${id}`) ? document.getElementById(`duracao-${id}`).innerText : '1';
    htmlTabela += `</tbody></table>`;
    htmlTabela += `<p style="font-size: 0.85rem; color: #64748b; line-height: 1.4;">
    * A duração de <strong>${duracaoTexto} dia(s) útil(eis)</strong> no cronograma é determinada pelo tempo do Profissional Chave (<strong>${nomeChaveLegivel}</strong>). 
    Para cumprir esse prazo sem ociosidade, a frente de serviço deve contar simultaneamente com os demais profissionais na proporção acima.</p>`;

    const modalId = 'modal-matriz-equipa-flutuante';
    let oldModal = document.getElementById(modalId);
    if (oldModal) oldModal.remove();

    const overlay = document.createElement('div');
    overlay.id = modalId;
    overlay.style.position = 'fixed';
    overlay.style.top = '0'; overlay.style.left = '0';
    overlay.style.width = '100vw'; overlay.style.height = '100vh';
    overlay.style.backgroundColor = 'rgba(0,0,0,0.5)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center'; overlay.style.justifyContent = 'center';
    overlay.style.zIndex = '9999';

    const modalBox = document.createElement('div');
    modalBox.style.background = '#fff';
    modalBox.style.padding = '25px';
    modalBox.style.borderRadius = '8px';
    modalBox.style.width = '640px';
    modalBox.style.maxWidth = '95%';
    modalBox.style.boxShadow = '0 10px 25px rgba(0,0,0,0.2)';
    modalBox.style.fontFamily = 'system-ui, sans-serif';

    const titulo = document.createElement('h3');
    titulo.style.marginTop = '0';
    titulo.style.color = '#1e293b';
    titulo.innerHTML = '👥 Composição da Equipe da Tarefa';

    const fecharBtn = document.createElement('button');
    fecharBtn.innerText = 'Fechar';
    fecharBtn.style.marginTop = '15px';
    fecharBtn.style.padding = '8px 16px';
    fecharBtn.style.background = '#3b82f6';
    fecharBtn.style.color = 'white';
    fecharBtn.style.border = 'none';
    fecharBtn.style.borderRadius = '4px';
    fecharBtn.style.cursor = 'pointer';
    fecharBtn.style.float = 'right';
    fecharBtn.onclick = () => overlay.remove();

    const conteudo = document.createElement('div');
    conteudo.innerHTML = htmlTabela;

    modalBox.appendChild(titulo);
    modalBox.appendChild(conteudo);
    modalBox.appendChild(fecharBtn);
    overlay.appendChild(modalBox);
    document.body.appendChild(overlay);
};
