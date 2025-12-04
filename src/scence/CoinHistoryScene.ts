import Phaser from "phaser";
import BasePopup from "@/ui/BasePopup";
import {getAppFontFamily} from "@/utils/fonts";
import {scaleUnit} from "@/utils/CanvasSize";

export type CoinHistoryItem = {
    title: string;
    date: string; // dd/MM/yyyy
    amount: number; // positive or negative
};

export type PopupState = 'loading' | 'empty' | 'list' | 'error';

export type PopupContentData = {
    state: PopupState;
    items?: CoinHistoryItem[];
    errorMessage?: string;
};

/**
 * showCoinHistoryPopup - displays coin transaction history in a BasePopup
 * Shows loading, list, empty state, or error based on contentData
 * Returns object with popup instance and update function for dynamic content changes
 * Popup shows immediately; images load asynchronously if not cached
 */
export function showCoinHistoryPopup(
    scene: Phaser.Scene,
    contentData: PopupContentData
): { popup: BasePopup; updateContent: (newData: PopupContentData) => void } {
    const {width: w, height: h} = scene.scale;
    const su = scaleUnit();

    // Create popup immediately (no blocking)
    // BasePopup will handle async loading of header image if needed
    const popup = new BasePopup(scene, {
        width: w,
        height: h,
        headerImageKey: "popup_header",
        titleText: "LỊCH SỬ XU",
        closeButtonText: "ĐÓNG",
    });

    const listW = popup.content.width * 0.9 - 24 * su; // Account for BasePopup's internal padding
    const listH = popup.contentHeight;

    // Content container for list/empty/loading/error state
    const content = scene.add.container((w - listW)/2, 0);
    popup.content.add(content);

    // Build initial content based on state
    buildContent(scene, content, popup, contentData, listW, listH, su);

    // Function to update popup content dynamically
    const updateContent = (newData: PopupContentData) => {
        // Clear existing content
        content.removeAll(true);
        // Rebuild with new data
        buildContent(scene, content, popup, newData, listW, listH, su);
    };

    return {popup, updateContent};
}

/**
 * Build content based on current state
 */
function buildContent(
    scene: Phaser.Scene,
    content: Phaser.GameObjects.Container,
    popup: BasePopup,
    data: PopupContentData,
    w: number,
    h: number,
    su: number
) {
    switch (data.state) {
        case 'loading':
            createLoadingState(scene, content, w, h, su);
            break;
        case 'empty':
            createEmptyState(scene, content, w, h, su);
            break;
        case 'list':
            if (data.items && data.items.length > 0) {
                createList(scene, content, popup, data.items, w, h, su);
            } else {
                createEmptyState(scene, content, w, h, su);
            }
            break;
        case 'error':
            createErrorState(scene, content, w, h, su, data.errorMessage);
            break;
    }
}

/**
 * Create loading state with spinner animation
 */
function createLoadingState(
    scene: Phaser.Scene,
    content: Phaser.GameObjects.Container,
    w: number,
    h: number,
    su: number
) {
    const centerX = w / 2;
    const centerY = h * 0.4;

    // Loading spinner (animated circle thumb)
    // Draw arc centered at (0, 0) in graphics local coordinates
    const spinner = scene.add.graphics();
    spinner.lineStyle(4 * su, 0xF0A400, 1);
    const radius = 30 * su;
    spinner.beginPath();
    spinner.arc(0, 0, radius, 0, Math.PI * 1.5, false); // Arc centered at origin
    spinner.strokePath();

    // Position the graphics object at screen center
    spinner.setPosition(centerX, centerY);
    content.add(spinner);

    // Animate spinner rotation around its center (only thumb rotates)
    scene.tweens.add({
        targets: spinner,
        angle: 360,
        duration: 1000,
        repeat: -1,
        ease: 'Linear'
    });

    // Loading text
    const loadingText = scene.add.text(centerX, centerY + radius + 32 * su, "Đang tải...", {
        fontFamily: getAppFontFamily(),
        fontStyle: '600',
        fontSize: Math.round(18 * su),
        color: '#7B7B7B',
        align: 'center'
    }).setOrigin(0.5);
    content.add(loadingText);

    // Setup mask
    const maskGfx = scene.add.graphics({x: content.x, y: content.y});
    maskGfx.fillStyle(0xFFFFFF, 1);
    maskGfx.fillRect(0, 0, w, h);
    const mask = maskGfx.createGeometryMask();
    content.setMask(mask);
    maskGfx.setVisible(false);
}

/**
 * Create error state with error message
 */
function createErrorState(
    scene: Phaser.Scene,
    content: Phaser.GameObjects.Container,
    w: number,
    h: number,
    su: number,
    errorMessage?: string
) {
    const centerY = h * 0.4;
    const centerX = w / 2;

    // Error icon (red circle with X)
    const errorIcon = scene.add.graphics();
    errorIcon.lineStyle(4 * su, 0xFF4444, 1);
    const radius = 30 * su;
    errorIcon.strokeCircle(w / 2, centerY, radius);
    // Draw X
    const offset = radius * 0.5;
    errorIcon.beginPath();
    errorIcon.moveTo(w / 2 - offset, centerY - offset);
    errorIcon.lineTo(w / 2 + offset, centerY + offset);
    errorIcon.moveTo(w / 2 + offset, centerY - offset);
    errorIcon.lineTo(w / 2 - offset, centerY + offset);
    errorIcon.strokePath();
    content.add(errorIcon);

    // Error title
    const errorTitle = scene.add.text(w / 2, centerY + radius + 32 * su, "Không thể tải dữ liệu", {
        fontFamily: getAppFontFamily(),
        fontStyle: '800',
        fontSize: Math.round(20 * su),
        color: '#FF4444',
        align: 'center'
    }).setOrigin(0.5);
    content.add(errorTitle);

    // Error message (if provided)
    if (errorMessage) {
        const errorDesc = scene.add.text(
            w / 2,
            errorTitle.y + errorTitle.height / 2 + 16 * su,
            errorMessage,
            {
                fontFamily: getAppFontFamily(),
                fontStyle: '600',
                fontSize: Math.round(16 * su),
                color: '#7B7B7B',
                align: 'center',
                wordWrap: {width: w * 0.8, useAdvancedWrap: true}
            }
        ).setOrigin(0.5);
        content.add(errorDesc);
    }

    // Setup mask
    const maskGfx = scene.add.graphics({x: content.x, y: content.y});
    maskGfx.fillStyle(0xFFFFFF, 1);
    maskGfx.fillRect(0, 0, w, h);
    const mask = maskGfx.createGeometryMask();
    content.setMask(mask);
    maskGfx.setVisible(false);
    errorTitle.setX(centerX);
}

function createEmptyState(
    scene: Phaser.Scene,
    content: Phaser.GameObjects.Container,
    w: number,
    h: number,
    su: number
) {
    const illuY = h * 0.32;

    // Title (show immediately)
    const title = scene.add.text(w / 2, illuY + 100 * su, "Chưa có lịch sử xu", {
        fontFamily: getAppFontFamily(),
        fontStyle: '800',
        fontSize: Math.round(24 * su),
        color: '#2D2D2D',
        align: 'center'
    }).setOrigin(0.5);

    // Hint text (show immediately)
    const hint = scene.add.text(
        w / 2,
        title.y + title.height / 2 + 16 * su,
        "Hãy hoàn thành đơn hoặc điểm danh mỗi ngày để\nnhận xu nhé",
        {
            fontFamily: getAppFontFamily(),
            fontStyle: '600',
            fontSize: Math.round(16 * su),
            color: '#7B7B7B',
            align: 'center',
            lineSpacing: 4
        }
    ).setOrigin(0.5);

    content.add([title, hint]);

    // Load and display illustration asynchronously
    const imageKey = "coin_history_empty";
    if (scene.textures.exists(imageKey)) {
        // Already loaded - show immediately
        const illu = scene.add.image(w / 2, illuY, imageKey).setOrigin(0.5);
        const targetSize = Math.min(w * 0.35, h * 0.25);
        const scale = targetSize / Math.max(illu.width, illu.height);
        illu.setScale(scale);
        content.add(illu);

        // Adjust title position
        title.setY(illu.y + illu.displayHeight / 2 + 24 * su);
        hint.setY(title.y + title.height / 2 + 16 * su);
    } else {
        // Load asynchronously
        scene.load.image(imageKey, "/histoty_empty_content.png");
        scene.load.once('complete', () => {
            if (scene.textures.exists(imageKey)) {
                const illu = scene.add.image(w / 2, illuY, imageKey).setOrigin(0.5);
                const targetSize = Math.min(w * 0.35, h * 0.25);
                const scale = targetSize / Math.max(illu.width, illu.height);
                illu.setScale(scale);
                content.add(illu);

                // Adjust title position
                title.setY(illu.y + illu.displayHeight / 2 + 24 * su);
                hint.setY(title.y + title.height / 2 + 16 * su);
            }
        });
        scene.load.start();
    }

    // Setup mask
    const maskGfx = scene.add.graphics({x: content.x, y: content.y});
    maskGfx.fillStyle(0xFFFFFF, 1);
    maskGfx.fillRect(0, 0, w, h);
    const mask = maskGfx.createGeometryMask();
    content.setMask(mask);
    maskGfx.setVisible(false);
}

/**
 * ItemLayout stores pre-calculated position and height for each item
 */
type ItemLayout = {
    index: number;
    y: number;
    height: number;
};

/**
 * PooledItemView represents a reusable container with its game objects
 */
type PooledItemView = {
    container: Phaser.GameObjects.Container;
    separator: Phaser.GameObjects.Rectangle;
    titleText: Phaser.GameObjects.Text;
    dateText: Phaser.GameObjects.Text;
    amountText: Phaser.GameObjects.Text;
    currentIndex: number; // which data item is currently displayed
};

/**
 * Pre-calculate all item positions and heights for virtual scrolling
 */
function calculateItemLayouts(
    scene: Phaser.Scene,
    items: CoinHistoryItem[],
    w: number,
    su: number
): ItemLayout[] {
    const itemSpacing = 8 * su;
    const amountReservedSpace = 150 * su;
    const titleMaxWidth = w;
    const layouts: ItemLayout[] = [];
    let y = 0;

    // Create temporary text object for height measurement
    const tempTitle = scene.add.text(0, 0, '', {
        fontFamily: getAppFontFamily(),
        fontStyle: '800',
        fontSize: Math.round(18 * su),
        color: '#2D2D2D',
        wordWrap: {width: titleMaxWidth, useAdvancedWrap: true},
        maxLines: 2,
    });
    const tempDate = scene.add.text(0, 0, '', {
        fontFamily: getAppFontFamily(),
        fontStyle: '600',
        fontSize: Math.round(14 * su),
        color: '#8B8B8B',
    });

    for (let i = 0; i < items.length; i++) {
        const item = items[i];

        // Add separator height (skip first item)
        if (i > 0) {
            y += 1;
        }

        const rowStartY = y;

        // Measure title height
        tempTitle.setText(item.title);
        const titleH = tempTitle.height;

        // Measure date height
        tempDate.setText(item.date);
        const dateH = tempDate.height;

        // Calculate total row height
        const rowHeight = 12 * su + titleH + 4 * su + dateH + itemSpacing;

        layouts.push({
            index: i,
            y: rowStartY,
            height: rowHeight,
        });

        y += rowHeight;
    }

    // Cleanup temp objects
    tempTitle.destroy();
    tempDate.destroy();

    return layouts;
}

/**
 * Create a pool of reusable item views
 */
function createItemPool(
    scene: Phaser.Scene,
    poolSize: number,
    w: number,
    su: number
): PooledItemView[] {
    const pool: PooledItemView[] = [];
    const amountReservedSpace = 150 * su;
    const titleMaxWidth = w - 12 * su;
    const amountRightPadding = 0; // Add right padding to prevent clipping

    for (let i = 0; i < poolSize; i++) {
        const container = scene.add.container(0, 0);
        container.width = w;
        const separator = scene.add.rectangle(0, 0, w, su, 0xE0E3E6, 1).setOrigin(0, 0);

        const titleText = scene.add.text(0, 0, '', {
            fontFamily: getAppFontFamily(),
            fontStyle: '800',
            fontSize: Math.round(18 * su),
            color: '#2D2D2D',
            wordWrap: {width: titleMaxWidth, useAdvancedWrap: true},
            maxLines: 2,
        }).setOrigin(0, 0);

        const dateText = scene.add.text(0, 0, '', {
            fontFamily: getAppFontFamily(),
            fontStyle: '600',
            fontSize: Math.round(14 * su),
            color: '#8B8B8B',
        }).setOrigin(0, 0);

        const amountText = scene.add.text(w, 0, '', {
            fontFamily: getAppFontFamily(),
            fontStyle: '800',
            fontSize: Math.round(20 * su),
            color: '#F0A400',
            align: 'right',
        }).setOrigin(1, 0);
        amountText.setPosition()
        container.add([separator, titleText, dateText, amountText]);
        container.setVisible(false);

        pool.push({
            container,
            separator,
            titleText,
            dateText,
            amountText,
            currentIndex: -1,
        });
    }

    return pool;
}

/**
 * Update a pooled view with data from a specific item
 */
function updatePooledView(
    view: PooledItemView,
    item: CoinHistoryItem,
    layout: ItemLayout,
    w: number,
    su: number,
    isFirstItem: boolean
) {
    view.currentIndex = layout.index;
    view.container.setPosition(0, layout.y);
    view.container.setVisible(true);

    // Show/hide separator based on position
    view.separator.setVisible(!isFirstItem);

    const rowStartY = isFirstItem ? 0 : 1;
    const titleY = rowStartY + 12 * su;
    const amountRightPadding = 8 * su; // Match padding from createItemPool

    // Update title
    view.titleText.setText(item.title);
    view.titleText.setPosition(0, titleY);

    // Update date
    view.dateText.setText(item.date);
    view.dateText.setPosition(0, titleY + view.titleText.height + 4 * su);

    // Update amount
    const amountStr = `${item.amount >= 0 ? '+' : ''}${formatNumber(item.amount)} xu`;
    const amountColor = item.amount >= 0 ? '#F0A400' : '#3D5061';
    console.log(amountStr, amountColor);
    view.amountText.setText(amountStr);
    view.amountText.setColor(amountColor);
    view.amountText.setPosition(w - amountRightPadding, titleY);
}

/**
 * Lazy scroll list implementation with virtual rendering
 */
function createList(
    scene: Phaser.Scene,
    content: Phaser.GameObjects.Container,
    popup: BasePopup,
    items: CoinHistoryItem[],
    w: number,
    h: number,
    su: number
) {
    if (items.length === 0) return;

    // Pre-calculate all item layouts
    const layouts = calculateItemLayouts(scene, items, w, su);
    const contentH = layouts.length > 0 ? layouts[layouts.length - 1].y + layouts[layouts.length - 1].height : 0;
    const viewH = h;

    // Create item pool (visible items + buffer)
    const bufferSize = 5; // render 5 extra items above and below viewport
    const maxVisibleItems = Math.ceil(viewH / (60 * su)) + bufferSize * 2; // estimate ~60*su per item
    const poolSize = Math.min(maxVisibleItems, items.length);
    const pool = createItemPool(scene, poolSize, w, su);

    // Add pool containers to content
    pool.forEach(view => {
        content.add(view.container);
    });

    // Track current scroll position and rendered range
    let currentScrollY = 0;
    let renderedStartIndex = -1;
    let renderedEndIndex = -1;

    /**
     * Render items visible in current viewport
     */
    const renderVisibleItems = (scrollY: number) => {
        currentScrollY = scrollY;
        const viewTop = -scrollY;
        const viewBottom = viewTop + viewH;

        // Find visible range with buffer
        let startIndex = -1;
        let endIndex = -1;

        for (let i = 0; i < layouts.length; i++) {
            const layout = layouts[i];
            const itemTop = layout.y;
            const itemBottom = layout.y + layout.height;

            // Item is visible or in buffer zone
            if (itemBottom >= viewTop - bufferSize * 100 * su && itemTop <= viewBottom + bufferSize * 100 * su) {
                if (startIndex === -1) startIndex = i;
                endIndex = i;
            }
        }

        // No change in visible range, skip update
        if (startIndex === renderedStartIndex && endIndex === renderedEndIndex) {
            return;
        }

        renderedStartIndex = startIndex;
        renderedEndIndex = endIndex;

        // Hide all pooled views first
        pool.forEach(view => {
            view.container.setVisible(false);
            view.currentIndex = -1;
        });

        // Render visible items using pool
        if (startIndex !== -1 && endIndex !== -1) {
            let poolIndex = 0;
            for (let i = startIndex; i <= endIndex && poolIndex < pool.length; i++) {
                const view = pool[poolIndex];
                const item = items[i];
                const layout = layouts[i];
                updatePooledView(view, item, layout, w, su, i === 0);
                poolIndex++;
            }
        }
    };

    // Setup mask
    const maskGfx = scene.add.graphics({x: content.x, y: content.y});
    maskGfx.fillStyle(0xFFFFFF, 1);
    maskGfx.fillRect(0, 0, w, h);
    const mask = maskGfx.createGeometryMask();
    content.setMask(mask);
    maskGfx.setVisible(false);

    // Initial render
    renderVisibleItems(0);

    // Enable scrolling if content is taller than view
    if (contentH > viewH) {
        enableScrollLazy(scene, content, popup, contentH, viewH, w, h, su, renderVisibleItems);
        createScrollbar(scene, popup, contentH, viewH, su);
    }
}

/**
 * Enhanced scroll handler that triggers lazy rendering
 */
function enableScrollLazy(
    scene: Phaser.Scene,
    content: Phaser.GameObjects.Container,
    popup: BasePopup,
    contentH: number,
    viewH: number,
    w: number,
    h: number,
    su: number,
    onScroll: (scrollY: number) => void
) {
    let scrollY = 0;
    const scrollTrack = scene.add.graphics();
    const scrollThumb = scene.add.graphics();

    const setScroll = (y: number) => {
        if (contentH <= viewH) return;
        const minY = -(contentH - viewH);
        scrollY = Phaser.Math.Clamp(y, minY, 0);
        content.y = scrollY;
        updateScrollbar();
        onScroll(scrollY); // Trigger lazy rendering
    };

    const updateScrollbar = () => {
        if (contentH <= viewH) return;

        const trackX = popup.root.x + popup.width / 2 - 18 * su;
        const trackTop = popup.root.y - popup.height / 2 + 24 * su;
        const trackH = viewH - 16 * su;

        scrollThumb.clear();

        const ratio = viewH / contentH;
        const thumbH = Math.max(30 * su, trackH * ratio);
        const maxScroll = contentH - viewH;
        const progress = maxScroll > 0 ? -scrollY / maxScroll : 0;
        const thumbY = trackTop + (trackH - thumbH) * progress;

        scrollThumb.fillStyle(0xB0B6BE, 0.8);
        scrollThumb.fillRoundedRect(trackX, thumbY, 4 * su, thumbH, 2 * su);
    };

    // Mouse wheel
    scene.input.on('wheel', (_p: any, _go: any, _dx: number, dy: number) => {
        setScroll(scrollY - dy * 0.5);
    });

    // Touch drag
    let dragging = false;
    let startY = 0;
    let startScroll = 0;

    const zone = scene.add.zone(
        scene.scale.width / 2,
        scene.scale.height / 2,
        scene.scale.width,
        scene.scale.height
    ).setInteractive();

    zone.on('pointerdown', (p: Phaser.Input.Pointer) => {
        dragging = true;
        startY = p.y;
        startScroll = scrollY;
    });

    scene.input.on('pointerup', () => dragging = false);
    scene.input.on('pointermove', (p: Phaser.Input.Pointer) => {
        if (dragging) {
            setScroll(startScroll + (p.y - startY));
        }
    });
}

function formatNumber(n: number): string {
    return Math.abs(n).toLocaleString('vi-VN');
}

function createScrollbar(
    scene: Phaser.Scene,
    popup: BasePopup,
    contentH: number,
    viewH: number,
    su: number
) {
    const scrollTrack = scene.add.graphics();

    const trackX = popup.root.x + popup.width / 2 - 18 * su;
    const trackTop = popup.root.y - popup.height / 2 + 24 * su;
    const trackH = viewH - 16 * su;

    // Track
    scrollTrack.fillStyle(0xD9DDE3, 0.5);
    scrollTrack.fillRoundedRect(trackX, trackTop, 4 * su, trackH, 2 * su);
}
