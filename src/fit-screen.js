import './fit-screen.css';

const view = {
  scale: 1,
  x: 0,
  y: 0,
  dragging: false,
  startX: 0,
  startY: 0,
  originX: 0,
  originY: 0,
  initializedCanvas: null
};

let refitTimer = null;
let autoExpanded = false;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getElements() {
  return {
    canvas: document.querySelector('.tree-canvas'),
    tree: document.querySelector('.org-tree'),
    expandButton: document.querySelector('#expandAll')
  };
}

function updateZoomLabel() {
  const label = document.querySelector('#fitZoomValue');
  if (label) label.textContent = `${Math.round(view.scale * 100)}%`;
}

function applyTransform(animate = false) {
  const { tree } = getElements();
  if (!tree) return;

  tree.classList.toggle('fit-tree--animated', animate);
  tree.style.transform =
    `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.scale})`;

  updateZoomLabel();

  if (animate) {
    window.setTimeout(() => {
      tree.classList.remove('fit-tree--animated');
    }, 360);
  }
}

function fitTree(animate = true) {
  const { canvas, tree } = getElements();
  if (!canvas || !tree) return;

  tree.style.transform = 'none';

  const canvasWidth = canvas.clientWidth;
  const canvasHeight = canvas.clientHeight;
  const treeWidth = tree.scrollWidth;
  const treeHeight = tree.scrollHeight;

  if (!canvasWidth || !canvasHeight || !treeWidth || !treeHeight) return;

  const paddingX = 34;
  const paddingY = 30;

  view.scale = clamp(
    Math.min(
      (canvasWidth - paddingX * 2) / treeWidth,
      (canvasHeight - paddingY * 2) / treeHeight,
      1
    ),
    0.18,
    1
  );

  view.x = Math.max((canvasWidth - treeWidth * view.scale) / 2, 12);
  view.y = Math.max((canvasHeight - treeHeight * view.scale) / 2, 12);

  applyTransform(animate);
}

function zoomAt(factor, pointX, pointY) {
  const previousScale = view.scale;
  const nextScale = clamp(previousScale * factor, 0.18, 1.8);

  const worldX = (pointX - view.x) / previousScale;
  const worldY = (pointY - view.y) / previousScale;

  view.scale = nextScale;
  view.x = pointX - worldX * nextScale;
  view.y = pointY - worldY * nextScale;

  applyTransform(true);
}

function createControls(canvas) {
  if (canvas.querySelector('.fit-controls')) return;

  const controls = document.createElement('div');
  controls.className = 'fit-controls';
  controls.innerHTML = `
    <button type="button" data-fit-action="fit">Ajustar à tela</button>
    <button type="button" data-fit-action="out" aria-label="Diminuir zoom">−</button>
    <span id="fitZoomValue">100%</span>
    <button type="button" data-fit-action="in" aria-label="Aumentar zoom">+</button>
  `;

  controls.addEventListener('click', event => {
    const button = event.target.closest('[data-fit-action]');
    if (!button) return;

    const action = button.dataset.fitAction;

    if (action === 'fit') fitTree(true);

    if (action === 'in') {
      zoomAt(1.14, canvas.clientWidth / 2, canvas.clientHeight / 2);
    }

    if (action === 'out') {
      zoomAt(0.86, canvas.clientWidth / 2, canvas.clientHeight / 2);
    }
  });

  canvas.appendChild(controls);

  const help = document.createElement('div');
  help.className = 'fit-help';
  help.textContent = 'Arraste para mover • Scroll para zoom';
  canvas.appendChild(help);
}

function bindCanvas(canvas) {
  if (view.initializedCanvas === canvas) return;

  view.initializedCanvas = canvas;
  createControls(canvas);

  canvas.addEventListener('wheel', event => {
    event.preventDefault();

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    zoomAt(event.deltaY < 0 ? 1.09 : 0.91, x, y);
  }, { passive: false });

  canvas.addEventListener('pointerdown', event => {
    if (
      event.button !== 0 ||
      event.target.closest('.person-card') ||
      event.target.closest('button')
    ) {
      return;
    }

    view.dragging = true;
    view.startX = event.clientX;
    view.startY = event.clientY;
    view.originX = view.x;
    view.originY = view.y;

    canvas.setPointerCapture(event.pointerId);
    canvas.classList.add('tree-canvas--dragging');
  });

  canvas.addEventListener('pointermove', event => {
    if (!view.dragging) return;

    view.x = view.originX + (event.clientX - view.startX);
    view.y = view.originY + (event.clientY - view.startY);

    applyTransform(false);
  });

  const stopDragging = event => {
    if (!view.dragging) return;

    view.dragging = false;
    canvas.classList.remove('tree-canvas--dragging');

    try {
      canvas.releasePointerCapture(event.pointerId);
    } catch (_) {}
  };

  canvas.addEventListener('pointerup', stopDragging);
  canvas.addEventListener('pointercancel', stopDragging);
  canvas.addEventListener('dblclick', () => fitTree(true));
}

function scheduleFit(delay = 100) {
  window.clearTimeout(refitTimer);
  refitTimer = window.setTimeout(() => fitTree(true), delay);
}

function initialize() {
  const { canvas, tree, expandButton } = getElements();
  if (!canvas || !tree) return;

  bindCanvas(canvas);

  if (!autoExpanded && expandButton) {
    autoExpanded = true;
    expandButton.click();
  }

  scheduleFit(180);
}

const observer = new MutationObserver(() => {
  initialize();
  scheduleFit(120);
});

observer.observe(document.documentElement, {
  childList: true,
  subtree: true
});

window.addEventListener('load', () => {
  initialize();
  scheduleFit(250);
});

window.addEventListener('resize', () => {
  scheduleFit(120);
});
