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

    const scrollbarSpace = 24 * su; // Reserve space for scrollbar
    const listW = popup.content.width * 0.9 - 24 * su - scrollbarSpace; // Account for BasePopup's internal padding and scrollbar
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
    const titleMaxWidth = w - amountReservedSpace - 12 * su; // Reserve space for amount column
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

        // Calculate total row height with proper bottom padding
        // 12*su top padding + title + 4*su spacing + date + 12*su bottom padding + 8*su item spacing
        const rowHeight = 12 * su + titleH + 4 * su + dateH + 12 * su + itemSpacing;

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
    const amountRightPadding = 8 * su; // Add right padding to prevent clipping
    const titleMaxWidth = w - amountReservedSpace - 12 * su; // Reserve space for amount column

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

        const amountText = scene.add.text(w - amountRightPadding, 0, '', {
            fontFamily: getAppFontFamily(),
            fontStyle: '800',
            fontSize: Math.round(20 * su),
            color: '#F0A400',
            align: 'right',
        }).setOrigin(1, 0);
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
    const amountStr = `${item.amount >= 0 ? '+' : '-'}${formatNumber(item.amount)} xu`;
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
    const maxVisibleItems = Math.ceil(viewH / (40 * su)) + bufferSize * 2; // estimate ~60*su per item
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

    // Setup mask (in world coordinates matching the popup content viewport)
    const viewRect = {
        x: popup.root.x + popup.content.x + content.x,
        y: popup.root.y + popup.content.y + content.y,
        w: w,
        h: viewH,
    };
    const maskGfx = scene.add.graphics({x: viewRect.x, y: viewRect.y});
    maskGfx.fillStyle(0xFFFFFF, 1);
    maskGfx.fillRect(0, 0, viewRect.w, viewRect.h);
    const mask = maskGfx.createGeometryMask();
    content.setMask(mask);
    maskGfx.setVisible(false);

    // Initial render
    renderVisibleItems(0);

    // Enable scrolling if content is taller than view
    if (contentH > viewH) {
        enableScrollLazy(scene, content, popup, contentH, viewH, w, h, su, renderVisibleItems);
        createScrollbar(scene, popup, content, contentH, viewH, su);
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
    let scrollY = 0; // logical clamped scroll
    let displayY = 0; // actual content.y with possible overscroll
    let wheelSnapTimer: Phaser.Time.TimerEvent | undefined;
    let snapTween: Phaser.Tweens.Tween | undefined;

    const scrollTrack = scene.add.graphics();
    const scrollThumb = scene.add.graphics();

    // Add to popup root so they get destroyed when popup is dismissed
    popup.root.add(scrollTrack);
    popup.root.add(scrollThumb);

    const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));
    const minYBound = -(contentH - viewH);
    const overscrollMax = Math.round(100 * su);
    const rubberBand = (d: number, max: number, c = 0.55) => {
        if (d <= 0) return 0;
        return (1 - 1 / (d * c / max + 1)) * max;
    };

    const clearWheelTimer = () => {
        if (wheelSnapTimer) {
            try { wheelSnapTimer.remove(false); } catch {}
            wheelSnapTimer = undefined;
        }
    };
    const stopSnapTween = () => {
        if (snapTween) {
            try { snapTween.stop(); } catch {}
            snapTween = undefined;
        }
    };

    const updateScrollbar = () => {
        if (contentH <= viewH) return;
        const trackX = popup.root.x + popup.width / 2 - 18 * su;
        const trackTop = popup.root.y + popup.content.y + content.y;
        const trackH = viewH;
        scrollThumb.clear();
        const ratio = viewH / contentH;
        const thumbH = Math.max(30 * su, trackH * ratio);
        const maxScroll = contentH - viewH;
        const progress = maxScroll > 0 ? -scrollY / maxScroll : 0;
        const thumbY = trackTop + (trackH - thumbH) * progress;
        scrollThumb.fillStyle(0xB0B6BE, 0.8);
        scrollThumb.fillRoundedRect(trackX, thumbY, 4 * su, thumbH, 2 * su);
    };

    const setDisplay = (y: number) => {
        displayY = y;
        content.y = displayY;
        const prevLogical = scrollY;
        scrollY = clamp(displayY, minYBound, 0);
        if (scrollY !== prevLogical) {
            onScroll(scrollY);
        }
        updateScrollbar();
    };

    const setScroll = (y: number) => {
        const clamped = clamp(y, minYBound, 0);
        setDisplay(clamped);
    };

    const snapBack = (toY: number) => {
        stopSnapTween();
        snapTween = scene.tweens.add({
            targets: content,
            y: toY,
            duration: 260,
            ease: 'Cubic.Out',
            onUpdate: () => {
                displayY = (content.y as number) || 0;
                scrollY = clamp(displayY, minYBound, 0);
                onScroll(scrollY);
                updateScrollbar();
            },
            onComplete: () => {
                displayY = toY;
                scrollY = clamp(displayY, minYBound, 0);
                onScroll(scrollY);
                updateScrollbar();
                snapTween = undefined;
            }
        });
    };

    const scheduleWheelSnap = (toY: number) => {
        clearWheelTimer();
        wheelSnapTimer = scene.time.addEvent({
            delay: 160,
            callback: () => snapBack(toY)
        });
    };

    // Mouse wheel (allow small overscroll + delayed snap)
    scene.input.on('wheel', (_p: any, _go: any, _dx: number, dy: number) => {
        stopSnapTween();
        clearWheelTimer();
        const wheelOverscrollMax = Math.round(overscrollMax * 0.35);
        const desired = displayY - dy * 1.2; // Increased from 0.5 for smoother/faster scrolling
        let disp = desired;
        if (desired > 0) {
            disp = 0 + rubberBand(desired - 0, wheelOverscrollMax);
        } else if (desired < minYBound) {
            const d = (minYBound - desired);
            disp = minYBound - rubberBand(d, wheelOverscrollMax);
        }
        setDisplay(disp);
        if (disp > 0) scheduleWheelSnap(0);
        else if (disp < minYBound) scheduleWheelSnap(minYBound);
    });

    // Touch drag with momentum and overscroll
    let dragging = false;
    let startY = 0;
    let startScroll = 0;
    let lastY = 0;
    let lastT = 0;
    let velocity = 0; // px per ms
    let momentum: Phaser.Time.TimerEvent | null = null;

    const cancelMomentum = () => {
        if (momentum) {
            try { momentum.remove(false); } catch {}
            momentum = null;
        }
    };

    const zone = scene.add.zone(
        w / 2,
        viewH / 2,
        w,
        viewH
    ).setInteractive();
    popup.content.add(zone);

    zone.on('pointerdown', (p: Phaser.Input.Pointer) => {
        cancelMomentum();
        stopSnapTween();
        clearWheelTimer();
        dragging = true;
        startY = p.y;
        startScroll = scrollY;
        lastY = p.y;
        lastT = scene.time.now;
        velocity = 0;
    });

    scene.input.on('pointerup', () => {
        if (!dragging) return;
        dragging = false;

        if (displayY > 0) { snapBack(0); return; }
        if (displayY < minYBound) { snapBack(minYBound); return; }

        // Start kinetic momentum if velocity significant
        let v = Phaser.Math.Clamp(velocity, -4.0, 4.0); // Increased from 2.5 for better momentum
        if (Math.abs(v) < 0.01) return;
        const friction = 0.92; // Reduced from 0.95 for more natural deceleration
        const stepMs = 16;

        momentum = scene.time.addEvent({
            delay: stepMs,
            loop: true,
            callback: () => {
                const next = displayY + v * stepMs;
                if (next > 0) {
                    const d = next - 0;
                    const disp = 0 + rubberBand(d, overscrollMax * 0.6);
                    setDisplay(disp);
                    cancelMomentum();
                    snapBack(0);
                    return;
                } else if (next < minYBound) {
                    const d = (minYBound - next);
                    const disp = minYBound - rubberBand(d, overscrollMax * 0.6);
                    setDisplay(disp);
                    cancelMomentum();
                    snapBack(minYBound);
                    return;
                } else {
                    setDisplay(next);
                }
                v *= friction;
                if (Math.abs(v) < 0.01) {
                    cancelMomentum();
                }
            }
        });
    });

    scene.input.on('pointermove', (p: Phaser.Input.Pointer) => {
        if (!dragging) return;
        const now = scene.time.now;
        const delta = p.y - startY;
        const desired = startScroll + delta;
        let disp = desired;
        if (desired > 0) {
            disp = 0 + rubberBand(desired - 0, overscrollMax);
        } else if (desired < minYBound) {
            const d = (minYBound - desired);
            disp = minYBound - rubberBand(d, overscrollMax);
        }
        setDisplay(disp);
        // velocity estimate
        const dy = p.y - lastY;
        const dt = Math.max(1, now - lastT);
        const inst = dy / dt;
        velocity = Phaser.Math.Linear(velocity, inst, 0.5); // Increased from 0.35 for more responsive tracking
        lastY = p.y;
        lastT = now;
    });
}

function formatNumber(n: number): string {
    return Math.abs(n).toLocaleString('vi-VN');
}

function createScrollbar(
    scene: Phaser.Scene,
    popup: BasePopup,
    content: Phaser.GameObjects.Container,
    contentH: number,
    viewH: number,
    su: number
) {
    const scrollTrack = scene.add.graphics();

    const trackX = popup.root.x + popup.width / 2 - 18 * su;
    const trackTop = popup.root.y + popup.content.y + content.y;
    const trackH = viewH;

    // Track
    scrollTrack.fillStyle(0xD9DDE3, 0.5);
    scrollTrack.fillRoundedRect(trackX, trackTop, 4 * su, trackH, 2 * su);

    // Add to popup root so it gets destroyed when popup is dismissed
    popup.root.add(scrollTrack);
}
