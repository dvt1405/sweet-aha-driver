import Phaser from "phaser";
import {Scence} from "@/utils/Constants";
import UiButton from "@/ui/UiButton";
import {getAppFontFamily} from "@/utils/fonts";
import {registerFontAutoRefresh} from "@/utils/fontSync";
import {scaleUnit} from "@/utils/CanvasSize";
import CoinBar from "@/ui/CoinBar";
import ViewPager, {ViewPagerPage} from "@/ui/ViewPager";
import {fetchProfileIfStale, getProfile} from "@/services/globalApi";

export type LevelPreviewItem = {
    level?: number;
    model_name?: string;
    upgrade_cost?: number;
    img_url?: string;
};

/**
 * LevelPreviewScene
 * - A full scene (like WelcomeScene) that displays level preview with swipeable bike images
 * - Shows: back button, coin bar, title, upgrade requirement text, level badge, bike, dots, two bottom buttons
 */
export default class LevelPreviewScene extends Phaser.Scene {
    private bg!: Phaser.GameObjects.Image;
    private coinBarUi!: CoinBar;
    private backBtn!: Phaser.GameObjects.Image;
    private shareIcon!: Phaser.GameObjects.Image;
    private titleImage?: Phaser.GameObjects.Image;
    private titleText?: Phaser.GameObjects.Text;
    private requirementText!: Phaser.GameObjects.Text;
    private levelButton!: UiButton;
    private viewPager!: ViewPager;
    private upgradeBtn!: UiButton;
    private closeBtn!: UiButton;

    private items: LevelPreviewItem[] = [];
    private currentIndex = 0;
    private previousScene: string = Scence.Home;
    private loadingSpinner?: Phaser.GameObjects.Arc;
    private loadingText?: Phaser.GameObjects.Text;

    constructor() {
        super({key: Scence.LEVEL_PREVIEW});
    }

    init(data?: { items?: LevelPreviewItem[]; startIndex?: number; previousScene?: string }) {
        this.items = data?.items && data.items.length > 0 ? data.items : [];
        this.currentIndex = Math.min(Math.max(0, data?.startIndex ?? 0), Math.max(0, this.items.length - 1));
        this.previousScene = data?.previousScene ?? Scence.Home;

        // If no items provided, fallback to current buddy level
        if (this.items.length === 0) {
            const p = getProfile();
            const cur = p?.buddy ?? {};
            this.items.push({
                level: cur.level ?? 1,
                model_name: cur.model_name,
                img_url: cur.img_url,
            });
        }
    }

    preload() {
        // Load background if not already loaded
        if (!this.textures.exists("bg_garage")) {
            this.load.image("bg_garage", "/bg_garage.jpg");
        }
        if (!this.textures.exists("main_header")) {
            this.load.image("main_header", "/logo_main.png");
        }
        if (!this.textures.exists("share")) {
            this.load.svg("share", "/share.svg");
        }
        if (!this.textures.exists("coin_icon")) {
            this.load.image("coin_icon", "/coin.png");
        }
        // Back arrow icon
        if (!this.textures.exists("back_arrow")) {
            this.load.image("back_arrow", "/ic_arrow_left.png");
        }
    }

    create() {
        registerFontAutoRefresh(this);
        const {width, height} = this.scale;
        const su = scaleUnit();

        // Background cover
        this.bg = this.add.image(width / 2, height / 2, "bg_garage").setOrigin(0.5);
        this.coverTo(this.bg, width, height);
        this.bg.alpha = 0.5;

        // Back button (top-left)
        this.backBtn = this.add.image(50 * su, height * 0.078, "back_arrow").setOrigin(0.5);
        this.fitHeight(this.backBtn, height * 0.04);
        this.backBtn.setInteractive({useHandCursor: true});
        this.backBtn.on('pointerup', () => {
            // Clean up event listeners before navigating
            this.scale.off('resize', this.layout, this);
            this.scene.start(this.previousScene);
        });

        // Top coin bar (use shared CoinBar component like WelcomeScene)
        this.coinBarUi = new CoinBar(this, width / 2, height * 0.078, {});
        this.add.existing(this.coinBarUi);
        this.coinBarUi.setBarHeight(height * 0.055);

        // Share icon top-right
        this.shareIcon = this.add.image(width - 50 * su, height * 0.078, "share").setOrigin(0.5);
        this.fitHeight(this.shareIcon, height * 0.055);
        this.shareIcon.setInteractive({useHandCursor: true});

        // Title: prefer image, else text - constrained to bottom of coinbar
        const coinBarBottom = this.coinBarUi.getBottomCenter().y;
        const titleMarginTop = 16 * su;
        if (this.textures.exists("main_header")) {
            this.titleImage = this.add.image(width / 2, 0, "main_header").setOrigin(0.5, 0);
            this.fitWidth(this.titleImage, width * 0.7);
            this.titleImage.setY(coinBarBottom + titleMarginTop);
        } else {
            this.titleText = this.add.text(width / 2, coinBarBottom + titleMarginTop, "XẾ CƯNG\nAHA", {
                fontFamily: getAppFontFamily(),
                fontSize: '56px',
                color: "#ff8b43",
                align: "center",
                stroke: "#0e4370",
                strokeThickness: Math.max(6, Math.floor(width * 0.01)),
            }).setOrigin(0.5, 0);
        }

        // Level button (non-interactive, just displays current preview level) - centered vertically
        this.levelButton = new UiButton(this, width / 2, height / 2, "CẤP ĐỘ 1", 156 * su, true, true);
        this.add.existing(this.levelButton);
        this.levelButton.setFontSize(Math.round(16 * su));

        // Upgrade requirement text - full width with horizontal padding 16*su, above level button with margin bottom 8*su
        const requirementTextY = height / 2 - this.levelButton.height / 2 - 8 * su;
        this.requirementText = this.add.text(width / 2, requirementTextY, "", {
            fontFamily: getAppFontFamily(),
            fontStyle: '600',
            fontSize: Math.round(24 * su) + 'px',
            color: "#ffffff",
            align: "center",
            wordWrap: {width: width - 32 * su},
        }).setOrigin(0.5, 1);

        // Two bottom buttons: NÂNG CẤP and ĐÓNG
        const btnY = height - 80 * su;
        const btnWidth = width * 0.42;
        const gap = 16 * su;
        const totalWidth = btnWidth * 2 + gap;
        const leftX = width / 2 - totalWidth / 2 + btnWidth / 2;
        const rightX = width / 2 + totalWidth / 2 - btnWidth / 2;

        this.upgradeBtn = new UiButton(this, leftX, btnY, "NÂNG CẤP", btnWidth, true, false);
        this.add.existing(this.upgradeBtn);
        this.upgradeBtn.setFontSize(Math.round(20 * su));
        this.upgradeBtn.onClick(() => {
            // TODO: Implement upgrade logic
            console.log("Upgrade clicked");
        });

        this.closeBtn = new UiButton(this, rightX, btnY, "ĐÓNG", btnWidth, true, false);
        this.add.existing(this.closeBtn);
        this.closeBtn.setFontSize(Math.round(20 * su));
        this.closeBtn.onClick(() => {
            // Clean up event listeners before navigating
            this.scale.off('resize', this.layout, this);
            this.scene.start(this.previousScene);
        });

        // ViewPager spans space between level button bottom and close button top with padding
        const levelButtonBottom = this.levelButton.y + this.levelButton.height / 2;
        const topPadding = 16 * su;
        const bottomPadding = 16 * su;
        const pagerTop = levelButtonBottom + topPadding;
        const closeBtnTop = btnY - this.closeBtn.height / 2;
        const pagerBottom = closeBtnTop - bottomPadding;

        // Reserve space for dots at the bottom of pager content (8*su × 4*su rounded rect => radius 4*su)
        const dotRadius = 4 * su;
        const dotsOffsetY = 8 * su;

        const availableHeight = Math.max(0, pagerBottom - pagerTop);
        const maxPagerHeight = Math.max(0, availableHeight - (dotsOffsetY + dotRadius * 2));
        const targetPagerHeight = Math.min(height * 0.35, maxPagerHeight);
        const minPagerHeight = 120 * su;
        let pagerHeight = targetPagerHeight;
        if (pagerHeight < minPagerHeight) {
            pagerHeight = Math.min(minPagerHeight, maxPagerHeight);
        }

        // Center pager within the available vertical slice
        const pagerY = pagerTop;
        const pagerWidth = width - 28 * su;

        // Create initial pages array (empty keys, will be loaded)
        const pages: ViewPagerPage[] = this.items.map((item, index) => ({
            key: `level_preview_bike_${index}`,
            data: item,
        }));

        // Create ViewPager with dots
        this.viewPager = new ViewPager(this, width / 2, pagerY, pages, {
            pageWidth: pagerWidth,
            pageHeight: pagerHeight,
            showDots: true,
            dotRadius,
            dotGap: 16 * su,
            dotsOffsetY,
        });
        this.add.existing(this.viewPager);
        // Handle page changes
        this.viewPager.onPageChange((index, page) => {
            this.currentIndex = index;
            this.updatePageInfo();
        });

        // Layout handler for responsive sizing
        this.scale.on('resize', this.layout, this);

        // Fetch profile if stale (over 5 mins) and update coin bar
        this.updateCoinBar();

        // Initial render - load all bike images and update page info
        this.loadAllBikeImages().then(() => {
            this.updatePageInfo();
        });
    }

    private async updateCoinBar() {
        try {
            const profile = await fetchProfileIfStale();
            if (profile && typeof profile.balance === 'number') {
                this.coinBarUi.setValue(`${profile.balance} XU`);
            }
        } catch (e) {
            // If fetch fails, use cached profile
            const cached = getProfile();
            if (cached && typeof cached.balance === 'number') {
                this.coinBarUi.setValue(`${cached.balance} XU`);
            }
        }
    }

    private showLoading() {
        const {width, height} = this.scale;
        const su = scaleUnit();

        // Create loading spinner if it doesn't exist
        if (!this.loadingSpinner) {
            this.loadingSpinner = this.add.circle(width / 2, height * 0.62, 20 * su, 0x0e4370, 0);
            this.loadingSpinner.setStrokeStyle(4 * su, 0x0e4370, 1);
            this.loadingSpinner.setDepth(1000);
        }

        // Create loading text if it doesn't exist
        if (!this.loadingText) {
            this.loadingText = this.add.text(width / 2, height * 0.62 + 35 * su, "Đang tải...", {
                fontFamily: getAppFontFamily(),
                fontSize: Math.round(18 * su) + 'px',
                color: "#0e4370",
                align: "center",
            }).setOrigin(0.5).setDepth(1000);
        }

        // Show and animate spinner
        this.loadingSpinner.setVisible(true);
        this.loadingText.setVisible(true);

        // Rotate animation
        this.tweens.add({
            targets: this.loadingSpinner,
            angle: 360,
            duration: 1000,
            repeat: -1,
            ease: 'Linear'
        });
    }

    private hideLoading() {
        if (this.loadingSpinner) {
            this.loadingSpinner.setVisible(false);
            this.tweens.killTweensOf(this.loadingSpinner);
        }
        if (this.loadingText) {
            this.loadingText.setVisible(false);
        }
    }

    private updatePageInfo() {
        const item = this.items[this.currentIndex];
        if (!item) return;

        // Update level button text
        const levelStr = (item.level ?? 0) > 0 ? `CẤP ĐỘ ${item.level}` : 'CẤP ĐỘ';
        this.levelButton.setText(levelStr);

        // Update requirement text
        if (typeof item.upgrade_cost === 'number' && item.upgrade_cost > 0) {
            const costStr = `CẦN ${Math.floor(item.upgrade_cost)} XU ĐỂ NÂNG CẤP`;
            this.requirementText.setText(costStr.toUpperCase());
            this.requirementText.setVisible(true);
        } else {
            // Current level (no upgrade cost)
            this.requirementText.setVisible(false);
        }

        // Enable/disable upgrade button based on coin comparison
        const profile = getProfile();
        const userCoins = profile?.balance ?? 0;
        const upgradeCost = item.upgrade_cost ?? 0;

        // Enable button only if:
        // 1. There is an upgrade cost (not viewing current level)
        // 2. User has enough coins
        const canUpgrade = upgradeCost > 0 && userCoins >= upgradeCost;
        this.upgradeBtn.setEnabled(canUpgrade);
    }

    private async loadAllBikeImages() {
        this.showLoading();
        try {
            // Load all bike images for all items
            for (let i = 0; i < this.items.length; i++) {
                const item = this.items[i];
                const key = `level_preview_bike_${i}`;
                const actualKey = await this.loadBikeImageForIndex(i, item, key);
                // Update ViewPager page texture after loading with the actual texture key
                this.viewPager.setPageTexture(i, actualKey);
            }
        } finally {
            this.hideLoading();
        }
    }

    /**
     * Load bike image for a specific index.
     * Returns the actual texture key that was loaded (may be fallback).
     */
    private async loadBikeImageForIndex(index: number, item: LevelPreviewItem, key: string): Promise<string> {
        // Try to load from remote URL first
        if (item.img_url && typeof item.img_url === 'string') {
            try {
                await this.loadExternalImage(key, item.img_url);
                return key;
            } catch {
                // Continue to fallback
            }
        }

        // Fallback to level-based image: lv1.png, lv2.png, lv3.png, etc.
        const level = item.level ?? 1;
        const fallbackKey = `lv${level}`;
        const fallbackPath = `/lv${level}.png`;

        // If fallback already exists, use it directly
        if (this.textures.exists(fallbackKey)) {
            return fallbackKey;
        }

        // Try to load the fallback image
        try {
            this.load.image(fallbackKey, fallbackPath);
            await new Promise<void>((resolve, reject) => {
                this.load.once('complete', () => resolve());
                this.load.once('loaderror', () => reject(new Error('loaderror')));
                this.load.start();
            });
            if (this.textures.exists(fallbackKey)) {
                return fallbackKey;
            }
        } catch {
            // Fallback load failed
        }

        // Last resort: default bike if present
        if (this.textures.exists('bike')) {
            return 'bike';
        }

        // Return original key even if texture doesn't exist (will show placeholder)
        return key;
    }

    private loadExternalImage(key: string, url: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            try {
                if (this.textures.exists(key)) {
                    resolve();
                    return;
                }
                this.textures.remove(key);
            } catch {
            }
            try {
                this.load.image(key, url);
                this.load.once('complete', () => {
                    if (this.textures.exists(key)) resolve();
                    else reject(new Error('failed'));
                });
                this.load.once('loaderror', () => reject(new Error('loaderror')));
                this.load.start();
            } catch (e) {
                reject(e as any);
            }
        });
    }

    private layout() {
        // Handle resize if needed
        // For now, recreate scene on resize is acceptable
    }

    private coverTo(img: Phaser.GameObjects.Image, width: number, height: number) {
        const scale = Math.max(width / img.width, height / img.height);
        img.setScale(scale);
    }

    private fitWidth(img: Phaser.GameObjects.Image, targetWidth: number) {
        const scale = targetWidth / img.width;
        img.setScale(scale);
    }

    private fitHeight(img: Phaser.GameObjects.Image, targetHeight: number) {
        const scale = targetHeight / img.height;
        img.setScale(scale);
    }
}
