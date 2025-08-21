// ============================
// CONFIGURAÇÕES
// ============================
const CONFIG = {
    whatsappNumber: '5511912109424',
    whatsappBaseUrl: 'https://wa.me/'
};

let pedidosCount = 0;

// ============================
// PDF.js - CONFIG
// ============================
let pdfDoc = null,
    pageNum = 1,
    pageRendering = false,
    pageNumPending = null,
    scale = 1.2,
    canvas = null,
    ctx = null;

document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    loadPDF('/RBS-2025.pdf');
});

// ============================
// APP
// ============================
function initializeApp() {
    updatePedidosCount();
    setupEventListeners();
}

// Eventos
function setupEventListeners() {
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') closePedidosBox();
    });

    const textarea = document.getElementById('pedidosText');
    if (textarea) {
        textarea.addEventListener('input', autoResizeTextarea);
        textarea.addEventListener('input', updatePedidosCount);
    }
}

// ============================
// PDF.js - FUNÇÕES
// ============================
function loadPDF(pdfPath) {
    const viewer = document.getElementById('pdfViewer');
    viewer.innerHTML = `<canvas id="pdfCanvas"></canvas>`;
    canvas = document.getElementById('pdfCanvas');
    ctx = canvas.getContext('2d');

    pdfjsLib.getDocument(pdfPath).promise.then(pdfDoc_ => {
        pdfDoc = pdfDoc_;
        document.getElementById('pageInfo').textContent = `Página ${pageNum} / ${pdfDoc.numPages}`;
        renderPage(pageNum);
    }).catch(err => {
        console.error('Erro ao carregar PDF:', err);
        viewer.innerHTML = `<p class="text-danger">❌ Não foi possível carregar o PDF.</p>`;
    });
}

function renderPage(num) {
    pageRendering = true;

    pdfDoc.getPage(num).then(page => {
        // Calcula viewport original
        const unscaledViewport = page.getViewport({ scale: 1 });

        // Escala proporcional à tela (95% da largura disponível)
        const responsiveScale = (window.innerWidth * 0.95) / unscaledViewport.width;
        const viewport = page.getViewport({ scale: responsiveScale });

        // Ajusta o canvas para o novo tamanho
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = { canvasContext: ctx, viewport };
        const renderTask = page.render(renderContext);


        renderTask.promise.then(() => {
            pageRendering = false;
            document.getElementById('pageInfo').textContent = `Página ${num} / ${pdfDoc.numPages}`;

            if (pageNumPending !== null) {
                renderPage(pageNumPending);
                pageNumPending = null;
            }
        });
    });
}

function queueRenderPage(num) {
    if (pageRendering) {
        pageNumPending = num;
    } else {
        renderPage(num);
    }
}

function prevPage() {
    if (pageNum <= 1) return;
    pageNum--;
    queueRenderPage(pageNum);
}

function nextPage() {
    if (pageNum >= pdfDoc.numPages) return;
    pageNum++;
    queueRenderPage(pageNum);
}

// ============================
// WHATSAPP + PEDIDOS
// ============================
function openWhatsApp(customMessage = '') {
    const message = customMessage || 'Olá! Vim através do catálogo digital e gostaria de mais informações.';
    window.open(`${CONFIG.whatsappBaseUrl}${CONFIG.whatsappNumber}?text=${encodeURIComponent(message)}`, '_blank');
}

function togglePedidosBox() {
    const popup = document.getElementById('pedidosPopup');
    popup.classList.toggle('active');
    document.body.style.overflow = popup.classList.contains('active') ? 'hidden' : 'auto';
}

function closePedidosBox() {
    document.getElementById('pedidosPopup').classList.remove('active');
    document.body.style.overflow = 'auto';
}

function clearPedidos() {
    const textarea = document.getElementById('pedidosText');
    if (textarea.value.trim() === '') {
        showModal('Não há pedidos para limpar.', 'info');
        return;
    }

    showConfirmModal(
        'Tem certeza que deseja limpar todos os pedidos?',
        'Confirmação',
        () => {
            textarea.value = '';
            updatePedidosCount();
            textarea.focus();
            showModal('Pedidos limpos com sucesso!', 'success');
        }
    );
}

function enviarPedidos() {
    const textarea = document.getElementById('pedidosText');
    const pedidosText = textarea.value.trim();

    // Se não houver pedidos, exibe modal e foca no textarea
    if (pedidosText === '') {
        showModal('Por favor, digite seus pedidos antes de enviar.', 'warning');
        textarea.focus();
        return;
    }

    const mensagemFormatada = formatarMensagemPedido(pedidosText);

    // Fecha popup e envia mensagem
    closePedidosBox();
    openWhatsApp(mensagemFormatada);

    // Feedback via modal
    showModal('Pedido enviado para o WhatsApp! Você será redirecionado automaticamente.', 'success');

    // Opcional: pergunta se deseja limpar os pedidos após envio
    setTimeout(() => {
        showConfirmModal(
            'Pedido enviado! Deseja limpar a lista de pedidos?',
            'Limpeza Opcional',
            () => {
                textarea.value = '';
                updatePedidosCount();
            }
        );
    }, 1000);
}


function formatarMensagemPedido(pedidos) {
    const dataHora = new Date().toLocaleString('pt-BR');

    // Detecta se é mobile
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    if (isMobile) {
        // Mensagem com emojis para mobile
        return `🛒 NOVO PEDIDO - ${dataHora}\n\n📦 Detalhes do Pedido:\n${pedidos}\n\n✅ Enviado através do catálogo digital\n🚚 Aguardo confirmação e informações sobre entrega/retirada.`;
    } else {
        // Mensagem limpa para desktop / WhatsApp Web
        return `NOVO PEDIDO - ${dataHora}\n\nDetalhes do Pedido:\n${pedidos}\n\nEnviado através do catálogo digital\nAguardo confirmação e informações sobre entrega/retirada.`;
    }
}


function updatePedidosCount() {
    const textarea = document.getElementById('pedidosText');
    const countElement = document.getElementById('pedidosCount');
    if (!textarea || !countElement) return;

    const lines = textarea.value.trim().split('\n').filter(l => l.trim() !== '').length;
    pedidosCount = lines;
    countElement.textContent = pedidosCount;
}

function autoResizeTextarea(e) {
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.max(200, textarea.scrollHeight) + 'px';
}

// ============================
// MODAL UNIFICADO
// ============================
// Sobrescreve o alert nativo do navegador
window.alert = function (message) {
    showModal(message, 'info');
};

// Sobrescreve o confirm nativo do navegador
window.confirm = function (message) {
    // Como o confirm precisa retornar boolean sincronamente, 
    // vamos usar o modal mas sempre retornar false para evitar comportamento default
    showModal(message, 'warning');
    return false;
};

// Sua função customizada de modal
function showModal(message, type = 'info') {
    const modal = new bootstrap.Modal(document.getElementById('feedbackModal'));
    const modalBody = document.getElementById('feedbackModalBody');
    const modalTitle = document.getElementById('feedbackModalLabel');

    let icon, titleText, alertClass;
    switch (type) {
        case 'success':
            icon = 'fas fa-check-circle';
            titleText = 'Sucesso';
            alertClass = 'alert-success';
            break;
        case 'warning':
            icon = 'fas fa-exclamation-triangle';
            titleText = 'Atenção';
            alertClass = 'alert-warning';
            break;
        case 'error':
            icon = 'fas fa-times-circle';
            titleText = 'Erro';
            alertClass = 'alert-danger';
            break;
        default:
            icon = 'fas fa-info-circle';
            titleText = 'Informação';
            alertClass = 'alert-info';
    }

    modalTitle.innerHTML = `<i class="${icon}"></i> ${titleText}`;
    modalBody.innerHTML = `<div class="alert ${alertClass} mb-0">${message}</div>`;
    modal.show();
}

// Modal de confirmação com callback
function showConfirmModal(message, title = 'Confirmação', onConfirm = null) {
    const modalElement = document.getElementById('feedbackModal');
    const modal = new bootstrap.Modal(modalElement);
    const modalBody = document.getElementById('feedbackModalBody');
    const modalTitle = document.getElementById('feedbackModalLabel');
    const modalFooter = document.getElementById('feedbackModalFooter');

    modalTitle.innerHTML = `<i class="fas fa-question-circle"></i> ${title}`;
    modalBody.innerHTML = `<div class="alert alert-warning mb-0">${message}</div>`;

    // Customizar footer com botões de confirmação
    modalFooter.innerHTML = `
        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
        <button type="button" class="btn btn-danger" id="confirmButton">Confirmar</button>
    `;

    // Adicionar evento ao botão confirmar
    const confirmButton = modalFooter.querySelector('#confirmButton');
    confirmButton.addEventListener('click', function () {
        if (onConfirm) onConfirm();
        modal.hide();

        // Forçar remoção do backdrop após fechar
        setTimeout(() => {
            const backdrop = document.querySelector('.modal-backdrop');
            if (backdrop) {
                backdrop.remove();
            }
            document.body.classList.remove('modal-open');
            document.body.style.overflow = '';
            document.body.style.paddingRight = '';
        }, 300);
    });

    // Adicionar evento para quando o modal for fechado
    modalElement.addEventListener('hidden.bs.modal', function () {
        // Restaurar footer original
        modalFooter.innerHTML = '<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Fechar</button>';

        // Forçar limpeza do backdrop se ainda existir
        setTimeout(() => {
            const backdrop = document.querySelector('.modal-backdrop');
            if (backdrop) {
                backdrop.remove();
            }
            document.body.classList.remove('modal-open');
            document.body.style.overflow = '';
            document.body.style.paddingRight = '';
        }, 100);
    }, { once: true });

    modal.show();
}