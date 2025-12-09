import Phaser from 'phaser';
import {scaleUnit} from '@/utils/CanvasSize';

export type ViewPagerOptions = {
    pageWidth?: number;
    pageHeight?: number;
    dotRadius?: number;
    dotGap?: number;
    dotActiveColor?: number;
    dotInactiveColor?: number;
    showDots?: boolean;
    dotsOffsetY?: number; // offset from bottom of pager area
    backgroundColor?: number;
    backgroundAlpha?: number;
};

export type ViewPagerPage = {
    key: string; // texture key
    data?: any; // optional data associated with this page
};

/**
 * ViewPager component: A horizontal swipeable pager with dot indicators
 * - Displays one page at a time (image)
 * - Supports swipe left/right to navigate
 * - Shows dot indicators below the content
 * - Fires callback on page change
 */
export default class ViewPager extends Phaser.GameObjects.Container {
    private pages: ViewPagerPage[] = [];
    private currentIndex = 0;
    private pageWidth: number;
    private pageHeight: number;
    private backgroundRect!: Phaser.GameObjects.Rectangle;
    private pageImage!: Phaser.GameObjects.Image;
    private hitZone!: Phaser.GameObjects.Zone;
    private dots: Phaser.GameObjects.Graphics[] = [];
    private dotsContainer!: Phaser.GameObjects.Container;
    private opts: Required<ViewPagerOptions>;
    private onPageChangeCallback?: (index: number, page: ViewPagerPage) => void;

    // Swipe tracking
    private startX = 0;
    private startY = 0;
    private dragging = false;
    private isDraggingHorizontal = false;
    private pageImageStartX = 0;
    private isAnimating = false;

    constructor(scene: Phaser.Scene, x: number, y: number, pages: ViewPagerPage[], opts: ViewPagerOptions = {}) {
        super(scene, x, y);

        const su = scaleUnit();

        // Build defaults
        const defaults: Required<ViewPagerOptions> = {
            pageWidth: 300 * su,
            pageHeight: 200 * su,
            dotRadius: 4 * su,
            dotGap: 16 * su,
            dotActiveColor: 0xFFFFFFFF,
            dotInactiveColor: 0xFF99A0AA,
            showDots: true,
            dotsOffsetY: 20 * su,
            backgroundColor: 0x000000,
            backgroundAlpha: 0,
        };

        this.opts = {...defaults, ...opts} as Required<ViewPagerOptions>;
        this.pageWidth = this.opts.pageWidth;
        this.pageHeight = this.opts.pageHeight;
        this.pages = pages || [];

        // Background behind page content
        this.backgroundRect = scene.add.rectangle(0, 0, this.pageWidth, this.pageHeight, this.opts.backgroundColor, this.opts.backgroundAlpha)
            .setOrigin(0.5, 0);
        this.add(this.backgroundRect);

        // Create page image container
        this.pageImage = scene.add.image(0, 0, '__DEFAULT').setOrigin(0.5, 0);
        this.pageImage.setSize(this.pageWidth, this.pageHeight)
        this.add(this.pageImage);

        // Create an invisible hit zone covering the whole pager area for gestures
        this.hitZone = scene.add.zone(0, 0, this.pageWidth, this.pageHeight)
            .setOrigin(0.5, 0)
            .setInteractive({useHandCursor: true});
        this.add(this.hitZone);

        // Create dots container
        this.dotsContainer = scene.add.container(0, 0);
        this.add(this.dotsContainer);

        // Setup swipe gestures
        this.setupSwipeGestures();

        // Set container size
        this.setSize(this.pageWidth, this.pageHeight);

        // Initial render
        if (this.pages.length > 0) {
            this.renderCurrentPage();
            this.buildDots();
        }
    }

    private setupSwipeGestures() {
        // Use pointerdown on the zone to start dragging
        this.hitZone.on('pointerdown', (p: Phaser.Input.Pointer) => {
            if (this.isAnimating) return;
            this.startX = p.x;
            this.startY = p.y;
            this.pageImageStartX = this.pageImage.x;
            this.dragging = true;
            this.isDraggingHorizontal = false;
        });

        // Use scene-level pointermove to track drag even when pointer leaves the image
        this.scene.input.on('pointermove', (p: Phaser.Input.Pointer) => {
            if (!this.dragging || this.isAnimating) return;

            const dx = p.x - this.startX;
            const dy = p.y - this.startY;

            // Determine if this is a horizontal swipe (only once per drag)
            if (!this.isDraggingHorizontal && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
                this.isDraggingHorizontal = Math.abs(dx) > Math.abs(dy);
            }

            // If horizontal swipe, prevent default scroll and move the image
            if (this.isDraggingHorizontal) {
                // Prevent default browser scroll behavior
                if (p.event) {
                    p.event.preventDefault();
                }

                // Apply resistance at edges
                let offsetX = dx;
                const isAtStart = this.currentIndex === 0 && dx > 0;
                const isAtEnd = this.currentIndex === this.pages.length - 1 && dx < 0;
                
                if (isAtStart || isAtEnd) {
                    // Apply rubber band effect at edges
                    offsetX = dx * 0.3;
                }

                // Move the page image to follow the finger
                this.pageImage.x = this.pageImageStartX + offsetX;
            }
        });

        // Use scene-level pointerup to handle release anywhere on screen
        this.scene.input.on('pointerup', (p: Phaser.Input.Pointer) => {
            if (!this.dragging || this.isAnimating) return;
            
            const dx = p.x - this.startX;
            this.dragging = false;

            if (this.isDraggingHorizontal) {
                const threshold = Math.max(30, 40 * scaleUnit());
                
                if (Math.abs(dx) > threshold) {
                    if (dx < 0 && this.currentIndex < this.pages.length - 1) {
                        // Swipe left - go to next page with animation
                        this.animateToPage(this.currentIndex + 1, -1);
                    } else if (dx > 0 && this.currentIndex > 0) {
                        // Swipe right - go to previous page with animation
                        this.animateToPage(this.currentIndex - 1, 1);
                    } else {
                        // At edge, snap back
                        this.snapBack();
                    }
                } else {
                    // Didn't swipe far enough, snap back
                    this.snapBack();
                }
            }

            this.isDraggingHorizontal = false;
        });

        // Also handle pointerupoutside for when pointer is released outside canvas
        this.scene.input.on('pointerupoutside', (p: Phaser.Input.Pointer) => {
            if (!this.dragging || this.isAnimating) return;
            
            const dx = p.x - this.startX;
            this.dragging = false;

            if (this.isDraggingHorizontal) {
                const threshold = Math.max(30, 40 * scaleUnit());
                
                if (Math.abs(dx) > threshold) {
                    if (dx < 0 && this.currentIndex < this.pages.length - 1) {
                        this.animateToPage(this.currentIndex + 1, -1);
                    } else if (dx > 0 && this.currentIndex > 0) {
                        this.animateToPage(this.currentIndex - 1, 1);
                    } else {
                        this.snapBack();
                    }
                } else {
                    this.snapBack();
                }
            }

            this.isDraggingHorizontal = false;
        });
    }

    private snapBack() {
        this.isAnimating = true;
        this.scene.tweens.add({
            targets: this.pageImage,
            x: this.pageImageStartX,
            duration: 200,
            ease: 'Power2',
            onComplete: () => {
                this.isAnimating = false;
            }
        });
    }

    private animateToPage(newIndex: number, direction: number) {
        if (newIndex < 0 || newIndex >= this.pages.length) {
            this.snapBack();
            return;
        }

        this.isAnimating = true;
        const slideOutX = this.pageImageStartX + (direction * this.pageWidth);

        // Slide out current page
        this.scene.tweens.add({
            targets: this.pageImage,
            x: slideOutX,
            duration: 200,
            ease: 'Power2',
            onComplete: () => {
                // Update to new page
                this.currentIndex = newIndex;
                this.renderCurrentPage();
                this.highlightDot();
                this.firePageChange();

                // Position new page on opposite side
                this.pageImage.x = this.pageImageStartX - (direction * this.pageWidth);

                // Slide in new page
                this.scene.tweens.add({
                    targets: this.pageImage,
                    x: this.pageImageStartX,
                    duration: 200,
                    ease: 'Power2',
                    onComplete: () => {
                        this.isAnimating = false;
                    }
                });
            }
        });
    }

    private renderCurrentPage() {
        if (this.pages.length === 0) return;

        const page = this.pages[this.currentIndex];
        if (!page) return;

        // Set texture
        if (this.scene.textures.exists(page.key)) {
            this.pageImage.setTexture(page.key);
        } else {
            // Keep current or use placeholder
            this.pageImage.setTexture('__DEFAULT');
        }

        // Scale to fit within pageWidth/pageHeight while maintaining aspect ratio
        this.fitPageImage();

        // Update hit area after scaling
        this.updateHitArea();
    }

    private fitPageImage() {
        const img = this.pageImage;
        // If no valid texture, size to pager bounds and exit
        if (!img.texture || img.texture.key === '__DEFAULT') {
            img.setDisplaySize(this.pageWidth, this.pageHeight);
            img.setPosition(0, 0);
            return;
        }

        const pad = 16 * scaleUnit();
        const maxW = Math.max(1, this.pageWidth * 0.85);
        const maxH = Math.max(1, this.pageHeight);

        const naturalW = Math.max(1, img.width);
        const naturalH = Math.max(1, img.height);

        // Contain: ensure the rendered image never exceeds the viewport bounds
        const scale = maxH / naturalH
        const displayW = naturalW * scale;
        const displayH = naturalH * scale;

        img.setDisplaySize(displayW, displayH);

        // Center vertically within the page area (origin 0.5, 0)
        const offsetY = (this.pageHeight - displayH) / 2;
        img.setPosition(0, offsetY);
    }

    private updateHitArea() {
        // Ensure the hit zone matches pager bounds
        this.hitZone.setSize(this.pageWidth, this.pageHeight);
        this.hitZone.setDisplaySize(this.pageWidth, this.pageHeight);
    }

    private buildDots() {
        // Clear existing dots
        this.dotsContainer.removeAll(true);
        this.dots = [];

        if (!this.opts.showDots || this.pages.length <= 1) return;

        const {dotRadius, dotGap, dotInactiveColor} = this.opts;
        const dotWidth = dotRadius * 2; // 8*su
        const dotHeight = dotRadius;    // 4*su
        const cornerRadius = dotRadius; // 4*su
        const totalW = (this.pages.length - 1) * dotGap;
        const startX = -totalW / 2;

        // Position dots below the page image
        const dotsY = this.pageImage.y + this.pageImage.displayHeight + this.opts.dotsOffsetY;
        this.dotsContainer.setY(dotsY);

        for (let i = 0; i < this.pages.length; i++) {
            const g = this.scene.add.graphics({x: startX + i * dotGap, y: 0});
            g.fillStyle(dotInactiveColor, 1);
            g.fillRoundedRect(-dotWidth / 2, -dotHeight / 2, dotWidth, dotHeight, cornerRadius);
            this.dotsContainer.add(g);
            this.dots.push(g);
        }

        this.highlightDot();
    }

    private highlightDot() {
        if (this.dots.length === 0) return;

        const {dotActiveColor, dotInactiveColor} = this.opts;
        const dotWidth = this.opts.dotRadius * 2;
        const dotHeight = this.opts.dotRadius;
        const cornerRadius = this.opts.dotRadius;
        for (let i = 0; i < this.dots.length; i++) {
            const active = i === this.currentIndex;
            const g = this.dots[i];
            g.clear();
            g.fillStyle(active ? dotActiveColor : dotInactiveColor, 1);
            g.fillRoundedRect(-dotWidth / 2, -dotHeight / 2, dotWidth, dotHeight, cornerRadius);
        }
    }

    /** Navigate to next page */
    goNext(): boolean {
        if (this.pages.length <= 1) return false;
        if (this.currentIndex < this.pages.length - 1) {
            this.currentIndex++;
            this.renderCurrentPage();
            this.highlightDot();
            this.firePageChange();
            return true;
        }
        return false;
    }

    /** Navigate to previous page */
    goPrev(): boolean {
        if (this.pages.length <= 1) return false;
        if (this.currentIndex > 0) {
            this.currentIndex--;
            this.renderCurrentPage();
            this.highlightDot();
            this.firePageChange();
            return true;
        }
        return false;
    }

    /** Jump to specific page index */
    goToPage(index: number): boolean {
        if (index < 0 || index >= this.pages.length) return false;
        if (index === this.currentIndex) return false;

        this.currentIndex = index;
        this.renderCurrentPage();
        this.highlightDot();
        this.firePageChange();
        return true;
    }

    private firePageChange() {
        if (this.onPageChangeCallback) {
            const page = this.pages[this.currentIndex];
            this.onPageChangeCallback(this.currentIndex, page);
        }
    }

    /** Set callback for page change events */
    onPageChange(callback: (index: number, page: ViewPagerPage) => void) {
        this.onPageChangeCallback = callback;
        return this;
    }

    /** Get current page index */
    getCurrentIndex(): number {
        return this.currentIndex;
    }

    /** Get current page data */
    getCurrentPage(): ViewPagerPage | undefined {
        return this.pages[this.currentIndex];
    }

    /** Get all pages */
    getPages(): ViewPagerPage[] {
        return this.pages;
    }

    /** Update pages dynamically */
    setPages(pages: ViewPagerPage[], startIndex = 0) {
        this.pages = pages || [];
        this.currentIndex = Math.min(Math.max(0, startIndex), Math.max(0, this.pages.length - 1));
        this.renderCurrentPage();
        this.buildDots();
        return this;
    }

    /** Update page texture by index */
    setPageTexture(index: number, key: string) {
        if (index >= 0 && index < this.pages.length) {
            this.pages[index].key = key;
            if (index === this.currentIndex) {
                this.renderCurrentPage();
            }
        }
        return this;
    }

    /** Update current page texture */
    setCurrentPageTexture(key: string) {
        return this.setPageTexture(this.currentIndex, key);
    }

    /** Set page dimensions */
    setPageSize(width: number, height: number) {
        this.pageWidth = width;
        this.pageHeight = height;
        this.opts.pageWidth = width;
        this.opts.pageHeight = height;
        this.backgroundRect.setSize(width, height);
        this.backgroundRect.setDisplaySize(width, height);
        this.setSize(width, height);
        this.renderCurrentPage();
        this.buildDots();
        return this;
    }

    /** Get page dimensions */
    getPageWidth(): number {
        return this.pageWidth;
    }

    getPageHeight(): number {
        return this.pageHeight;
    }

    /** Get the page image for external manipulation */
    getPageImage(): Phaser.GameObjects.Image {
        return this.pageImage;
    }

    /** Get dots container for custom positioning */
    getDotsContainer(): Phaser.GameObjects.Container {
        return this.dotsContainer;
    }

    /** Set dots position relative to pager */
    setDotsPosition(x: number, y: number) {
        this.dotsContainer.setPosition(x, y);
        return this;
    }

    /** Show or hide dots */
    setShowDots(show: boolean) {
        this.opts.showDots = show;
        this.dotsContainer.setVisible(show);
        return this;
    }

    /** Get actual display height including dots */
    getTotalHeight(): number {
        if (this.opts.showDots && this.pages.length > 1) {
            // Dot height equals dotRadius (since we render 8*su × 4*su with radius 4*su)
            return this.pageHeight + this.opts.dotsOffsetY + this.opts.dotRadius;
        }
        return this.pageHeight;
    }

    /** Get the bottom Y position of the page image (for layout calculations) */
    getPageBottom(): number {
        return this.y + (this.pageImage.displayHeight || this.pageHeight);
    }
}
