import Phaser from "phaser";
import {registerFontAutoRefresh} from "@/utils/fontSync";
import {scaleUnit} from "@/utils/CanvasSize";
import CoinBar from "@/ui/CoinBar";
import UiButton from "@/ui/UiButton";
import ViewPager, {type ViewPagerPage} from "@/ui/ViewPager";
import {getAppFontFamily} from "@/utils/fonts";
import {fetchProfileIfStale, getProfile, upgradeBuddyLevel, fetchProfile} from "@/services/globalApi";
import {type LevelPreviewItem} from "@/scence/LevelPreviewScene";
import {Scence} from "@/utils/Constants";

type PopupOptions = {
    items?: LevelPreviewItem[];
    startIndex?: number;
    onClose?: () => void;
};

/**
 * LevelPreviewPopup replicates LevelPreviewScene UI/logic but renders as an overlay within the current scene.
 */
export default class LevelPreviewPopup {
    private readonly scene: Phaser.Scene;
    private readonly depthBase = 2000;

    private overlay!: Phaser.GameObjects.Rectangle;
    private bg!: Phaser.GameObjects.Image;
    private coinBarUi!: CoinBar;
    private backBtn!: Phaser.GameObjects.Image;
    private titleImage?: Phaser.GameObjects.Image;
    private titleText?: Phaser.GameObjects.Text;
    private requirementText!: Phaser.GameObjects.Text;
    private levelButton!: UiButton;
    private viewPager!: ViewPager;
    private upgradeBtn!: UiButton;
    private closeBtn!: UiButton;
    private loadingSpinner?: Phaser.GameObjects.Arc | Phaser.GameObjects.Graphics;
    private loadingText?: Phaser.GameObjects.Text;

    private readonly items: LevelPreviewItem[] = [];
    private currentIndex = 0;
    private readonly onClose?: () => void;

    constructor(scene: Phaser.Scene, opts?: PopupOptions) {
        this.scene = scene;
        registerFontAutoRefresh(scene);

        const providedItems = opts?.items ?? [];
        this.items = providedItems.length > 0 ? [...providedItems] : [];
        this.currentIndex = Math.min(
            Math.max(0, opts?.startIndex ?? 0),
            Math.max(0, this.items.length - 1)
        );
        this.onClose = opts?.onClose;

        // Fallback item from profile if none provided
        if (this.items.length === 0) {
            const p = getProfile();
            const cur = p?.buddy ?? {};
            this.items.push({
                level: cur.level ?? 1,
                model_name: cur.model_name,
                img_url: cur.img_url,
            });
        }

        this.build();
        this.updateCoinBar();
        this.updatePageInfo();
        this.loadAllBikeImages().then(() => this.updatePageInfo());
    }

    private build() {
        const {width, height} = this.scene.scale;
        const su = scaleUnit();

        // Overlay to block input
        this.overlay = this.scene.add
            .rectangle(width / 2, height / 2, width, height, 0x000000, 0.65)
            .setInteractive({useHandCursor: false})
            .setDepth(this.depthBase);

        // Background image with slight dim
        this.bg = this.scene.add.image(width / 2, height / 2, "bg_garage")
            .setOrigin(0.5)
            .setDepth(this.depthBase + 1);
        this.coverTo(this.bg, width, height);
        this.bg.setAlpha(0.55);

        // Back button
        this.backBtn = this.scene.add.image(50 * su, height * 0.078, "back_arrow")
            .setOrigin(0.5)
            .setDepth(this.depthBase + 2);
        this.fitHeight(this.backBtn, height * 0.04);
        this.backBtn.setInteractive({useHandCursor: true});
        this.backBtn.on('pointerup', () => this.close());

        // Coin bar
        this.coinBarUi = new CoinBar(this.scene, width / 2, height * 0.078, {});
        this.coinBarUi.setDepth(this.depthBase + 2);
        this.scene.add.existing(this.coinBarUi);
        this.coinBarUi.setBarHeight(height * 0.055);

        // Title image or text
        const coinBarBottom = this.coinBarUi.getBottomCenter().y;
        const titleMarginTop = 16 * su;
        if (this.scene.textures.exists("main_header")) {
            this.titleImage = this.scene.add.image(width / 2, 0, "main_header")
                .setOrigin(0.5, 0)
                .setDepth(this.depthBase + 2);
            this.fitWidth(this.titleImage, width * 0.7);
            this.titleImage.setY(coinBarBottom + titleMarginTop);
        } else {
            this.titleText = this.scene.add.text(width / 2, coinBarBottom + titleMarginTop, "XẾ CƯNG\nAHA", {
                fontFamily: getAppFontFamily(),
                fontSize: '56px',
                color: "#ff8b43",
                align: "center",
                stroke: "#0e4370",
                strokeThickness: Math.max(6, Math.floor(width * 0.01)),
            }).setOrigin(0.5, 0).setDepth(this.depthBase + 2);
        }

        // Level badge
        this.levelButton = new UiButton(this.scene, width / 2, height / 2, "CẤP ĐỘ 1", 156 * su, true, true);
        this.levelButton.setDepth(this.depthBase + 2);
        this.scene.add.existing(this.levelButton);
        this.levelButton.setFontSize(Math.round(16 * su));

        // Requirement text above badge
        const requirementTextY = height / 2 - this.levelButton.height / 2 - 8 * su;
        this.requirementText = this.scene.add.text(width / 2, requirementTextY, "", {
            fontFamily: getAppFontFamily(),
            fontStyle: '600',
            fontSize: Math.round(24 * su) + 'px',
            color: "#ffffff",
            align: "center",
            wordWrap: {width: width - 32 * su},
        }).setOrigin(0.5, 1).setDepth(this.depthBase + 2);

        // Bottom buttons
        const btnY = height - 80 * su;
        const btnWidth = width * 0.42;
        const gap = 16 * su;
        const totalWidth = btnWidth * 2 + gap;
        const leftX = width / 2 - totalWidth / 2 + btnWidth / 2;
        const rightX = width / 2 + totalWidth / 2 - btnWidth / 2;

        this.upgradeBtn = new UiButton(this.scene, leftX, btnY, "NÂNG CẤP", btnWidth, true, false);
        this.upgradeBtn.setDepth(this.depthBase + 2);
        this.scene.add.existing(this.upgradeBtn);
        this.upgradeBtn.setFontSize(Math.round(20 * su));
        this.upgradeBtn.onClick(async () => {
            try {
                // Prevent double click
                this.upgradeBtn.setEnabled(false);
                // Call upgrade API
                await upgradeBuddyLevel();
                // Refresh profile to pick up new level, balance, and buddy image
                await fetchProfile(true).catch(() => {});
                // Close popup and show WelcomeScene (same as HomeScene)
                this.close();
                try {
                    this.scene.scene.start(Scence.Welcome);
                } catch {
                }
            } catch (e: any) {
                // Re-enable based on latest profile permission
                try {
                    const p = getProfile();
                    this.upgradeBtn.setEnabled(!!p?.can_upgrade);
                } catch {
                    this.upgradeBtn.setEnabled(false);
                }
            }
        });

        this.closeBtn = new UiButton(this.scene, rightX, btnY, "ĐÓNG", btnWidth, true, false);
        this.closeBtn.setDepth(this.depthBase + 2);
        this.scene.add.existing(this.closeBtn);
        this.closeBtn.setFontSize(Math.round(20 * su));
        this.closeBtn.onClick(() => this.close());

        // Pager sizing
        const levelButtonBottom = this.levelButton.y + this.levelButton.height / 2;
        const topPadding = 16 * su;
        const bottomPadding = 16 * su;
        const pagerTop = levelButtonBottom + topPadding;
        const closeBtnTop = btnY - this.closeBtn.height / 2;
        const pagerBottom = closeBtnTop - bottomPadding;

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

        const pagerY = pagerTop;
        const pagerWidth = width - 28 * su;

        const pages: ViewPagerPage[] = this.items.map((item, index) => ({
            key: `level_preview_bike_${index}`,
            data: item,
        }));

        this.viewPager = new ViewPager(this.scene, width / 2, pagerY, pages, {
            pageWidth: pagerWidth,
            pageHeight: pagerHeight,
            showDots: true,
            dotRadius,
            dotGap: 16 * su,
            dotsOffsetY,
        });
        this.viewPager.setDepth(this.depthBase + 2);
        this.scene.add.existing(this.viewPager);
        this.viewPager.onPageChange((index) => {
            this.currentIndex = index;
            this.updatePageInfo();
        });
    }

    private async updateCoinBar() {
        try {
            const profile = await fetchProfileIfStale();
            if (profile && typeof profile.balance === 'number') {
                this.coinBarUi.setValue(`${profile.balance} XU`);
            }
        } catch {
            const cached = getProfile();
            if (cached && typeof cached.balance === 'number') {
                this.coinBarUi.setValue(`${cached.balance} XU`);
            }
        }
    }

    private showLoading() {
        const {width, height} = this.scene.scale;
        const su = scaleUnit();

        if (!this.loadingSpinner) {
            const spinner = this.scene.add.graphics();
            const radius = 20 * su;
            spinner.lineStyle(4 * su, 0xffffff, 1);
            spinner.beginPath();
            spinner.arc(0, 0, radius, 0, Math.PI * 1.5, false);
            spinner.strokePath();
            spinner.setPosition(width / 2, height * 0.62);
            spinner.setDepth(this.depthBase + 3);
            this.loadingSpinner = spinner;
        }

        if (!this.loadingText) {
            this.loadingText = this.scene.add.text(width / 2, height * 0.62 + 35 * su, "Đang tải...", {
                fontFamily: getAppFontFamily(),
                fontSize: Math.round(18 * su) + 'px',
                color: "#ffffff",
                align: "center",
            }).setOrigin(0.5).setDepth(this.depthBase + 3);
        }

        this.loadingSpinner.setVisible(true);
        this.loadingText.setVisible(true);

        this.scene.tweens.add({
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
            this.scene.tweens.killTweensOf(this.loadingSpinner);
        }
        if (this.loadingText) {
            this.loadingText.setVisible(false);
        }
    }

    private updatePageInfo() {
        const item = this.items[this.currentIndex];
        if (!item) return;

        const levelStr = (item.level ?? 0) > 0 ? `CẤP ĐỘ ${item.level}` : 'CẤP ĐỘ';
        this.levelButton.setText(levelStr);

        if (typeof item.upgrade_cost === 'number' && item.upgrade_cost > 0) {
            const costStr = `CẦN ${Math.floor(item.upgrade_cost)} XU ĐỂ NÂNG CẤP`;
            this.requirementText.setText(costStr.toUpperCase());
            this.requirementText.setVisible(true);
        } else {
            this.requirementText.setVisible(false);
        }

        const profile = getProfile();
        const userCoins = profile?.balance ?? 0;
        const upgradeCost = item.upgrade_cost ?? 0;
        const canUpgrade = upgradeCost > 0 && userCoins >= upgradeCost;
        this.upgradeBtn.setEnabled(canUpgrade);
    }

    private async loadAllBikeImages() {
        this.showLoading();
        let firstImageLoaded = false;
        try {
            for (let i = 0; i < this.items.length; i++) {
                const item = this.items[i];
                const key = `level_preview_bike_${i}`;
                const actualKey = await this.loadBikeImageForIndex(i, item, key);
                this.viewPager.setPageTexture(i, actualKey);
                if (!firstImageLoaded) {
                    firstImageLoaded = true;
                    this.hideLoading();
                }
            }
        } finally {
            if (!firstImageLoaded) {
                this.hideLoading();
            }
        }
    }

    private async loadBikeImageForIndex(index: number, item: LevelPreviewItem, key: string): Promise<string> {
        if (item.img_url && typeof item.img_url === 'string') {
            try {
                await this.loadExternalImage(key, item.img_url);
                return key;
            } catch {
                // Continue to fallback
            }
        }

        const level = item.level ?? 1;
        const fallbackKey = `lv${level}`;
        const fallbackPath = `/lv${level}.png`;

        if (this.scene.textures.exists(fallbackKey)) {
            return fallbackKey;
        }

        try {
            this.scene.load.image(fallbackKey, fallbackPath);
            await new Promise<void>((resolve, reject) => {
                this.scene.load.once('complete', () => resolve());
                this.scene.load.once('loaderror', () => reject(new Error('loaderror')));
                this.scene.load.start();
            });
            if (this.scene.textures.exists(fallbackKey)) {
                return fallbackKey;
            }
        } catch {
        }

        if (this.scene.textures.exists('bike')) {
            return 'bike';
        }

        return key;
    }

    private loadExternalImage(key: string, url: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            try {
                if (this.scene.textures.exists(key)) {
                    resolve();
                    return;
                }
                this.scene.textures.remove(key);
            } catch {
            }
            try {
                this.scene.load.image(key, url);
                this.scene.load.once('complete', () => {
                    if (this.scene.textures.exists(key)) resolve();
                    else reject(new Error('failed'));
                });
                this.scene.load.once('loaderror', () => reject(new Error('loaderror')));
                this.scene.load.start();
            } catch (e) {
                reject(e as any);
            }
        });
    }

    close() {
        this.overlay?.destroy();
        this.bg?.destroy();
        this.backBtn?.destroy();
        this.titleImage?.destroy();
        this.titleText?.destroy();
        this.requirementText?.destroy();
        this.levelButton?.destroy();
        this.coinBarUi?.destroy();
        this.upgradeBtn?.destroy();
        this.closeBtn?.destroy();
        this.viewPager?.destroy();
        this.loadingSpinner?.destroy();
        this.loadingText?.destroy();

        if (this.onClose) {
            this.onClose();
        }
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
