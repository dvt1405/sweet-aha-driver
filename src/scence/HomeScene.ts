import Phaser from "phaser";
import {Scence} from "@/utils/Constants";
import UiButton from "@/ui/UiButton";
import ClaimPopup from "@/ui/ClaimPopup";
import {getAppFontFamily} from "@/utils/fonts";
import {registerFontAutoRefresh} from "@/utils/fontSync";
import {scaleUnit} from "@/utils/CanvasSize";
import CoinBar from "@/ui/CoinBar";
import {
    initFromUrlOrStorage,
    fetchProfile,
    getProfile,
    getCachedProfile,
    subscribe,
    claimDailyCheckin,
    fetchCoinHistoryItems,
    upgradeBuddyLevel,
    type DriverBuddyProfile, getToken
} from "@/services/globalApi";
import {showCoinHistoryPopup, type CoinHistoryItem} from "@/scence/CoinHistoryScene";
import {is} from "@babel/types";
import {ApiError} from "next/dist/server/api-utils";
import {type LevelPreviewItem} from "@/scence/LevelPreviewScene";
import LevelPreviewPopup from "@/ui/LevelPreviewPopup";

/**
 * Generate test coin history data for performance testing
 * Used when Shift key is held while clicking History button
 */
function generateTestCoinHistory(count: number): CoinHistoryItem[] {
    const items: CoinHistoryItem[] = [];
    const types = [
        'Điểm danh mỗi ngày',
        'Hoàn thành đơn hàng giao tại địa chỉ số 123 đường Nguyễn Văn Linh, Quận 7',
        'Nâng cấp xe',
        'Chia sẻ mạng xã hội',
        'Thưởng hoàn thành 10 đơn',
        'Bonus cuối tuần',
        'Giao dịch đặc biệt với mô tả rất dài để test word wrap trong title text',
    ];

    const now = Date.now();
    for (let i = 0; i < count; i++) {
        const date = new Date(now - i * 3600000); // 1 hour apart
        const dd = String(date.getDate()).padStart(2, '0');
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const yyyy = date.getFullYear();

        const typeIdx = i % types.length;
        const amount = typeIdx === 2 ? -100 - (i % 500) : 10 + (i % 990); // Mix positive and negative

        items.push({
            title: types[typeIdx],
            date: `${dd}/${mm}/${yyyy}`,
            amount: amount,
        });
    }

    return items;
}

export class HomeScene extends Phaser.Scene {
    private claiming = false;
    private static CHECKIN_KEY = 'aha_daily_checkin_date';
    private bg!: Phaser.GameObjects.Image;
    private coinBarUi!: CoinBar;
    private shareIcon!: Phaser.GameObjects.Image;
    private titleImage?: Phaser.GameObjects.Image;
    private titleText?: Phaser.GameObjects.Text;

    private btnCheckIn!: UiButton;
    private btnUpgrade!: UiButton;
    private btnHistory!: UiButton;
    private btnGuide!: UiButton;

    private bike!: Phaser.GameObjects.Image;
    private levelButton!: UiButton;
    private unsubscribeProfile?: () => void;
    private levelPreviewPopup?: LevelPreviewPopup;
    private loadingContainer?: Phaser.GameObjects.Container;
    private loadingSpinner?: Phaser.GameObjects.Graphics;
    private fadeTweens: Phaser.Tweens.Tween[] = [];

    constructor() {
        super(Scence.Home);
    }

    preload() {
        // Reuse textures already in /public
        this.load.image("bg_garage", "/main_background.png");
        this.load.image("coin_bar", "/background_aha_xua.png");
        this.load.image("coin_icon", "/aha_xu.png");
        this.load.image("share", "/ic_share.png");
        this.load.image("bg_button_active", "/bg_button_active.png");
        this.load.image("bg_button_disable", "/bg_button_disable.png");
        this.load.image("bg_progress_active", "/bg_progress_active.png");
        this.load.image("main_header", "/main_header.png");
        this.load.image("bike", "/ic_bike.png");
        this.load.image("back_arrow", "/ic_arrow_left.png");
        // Effects and popup resources
        this.load.image("burst", "/burst.png");
        this.load.image("congrats_text_bg", "/bg_main_congartulation_text.png");
        // Legacy overlay (kept for compatibility, not used now)
        this.load.image("overlay_popup", "/overlay_popup.png");
        // Popup warning background for already-claimed case (HTTP 404)
        this.load.image("bg_popup_warning", "/bg_popup_warning.png");
        this.load.image("popup_header", "/bg_btn_header_popup.png")
        // Default level images for fallback when external image fails to load
        for (let i = 1; i <= 10; i++) {
            this.load.image(`lv${i}`, `/lv${i}.png`);
        }
    }

    create() {
        // Ensure all text in this scene switches to the app font when it finishes loading
        registerFontAutoRefresh(this);
        const {width: w, height: h} = this.scale;

        // Background
        this.bg = this.add.image(w / 2, h / 2, "bg_garage").setOrigin(0.5);
        this.coverTo(this.bg, w, h);

        // Top coin bar and icons
        this.coinBarUi = new CoinBar(this, w / 2, h * 0.078, {});
        this.add.existing(this.coinBarUi);
        this.coinBarUi.setBarHeight(h * 0.055);

        this.shareIcon = this.add.image(w - 50, h * 0.078, "share").setOrigin(0.5);
        this.fitHeight(this.shareIcon, h * 0.055);
        this.shareIcon.setInteractive({useHandCursor: true});

        // Title (image or text fallback)
        if (this.textures.exists("main_header")) {
            this.titleImage = this.add.image(w / 2, h * 0.19, "main_header").setOrigin(0.5);
            this.fitWidth(this.titleImage, w * 0.7);
        } else {
            this.titleText = this.add.text(w / 2, h * 0.19, "XẾ CƯNG\nAHA", {
                fontFamily: getAppFontFamily(),
                fontSize: "56px",
                color: "#ff8b43",
                align: "center",
                stroke: "#0e4370",
                strokeThickness: Math.max(6, Math.floor(w * 0.01)),
            }).setOrigin(0.5);
        }

        // Feature buttons (2x2 grid)
        this.btnCheckIn = new UiButton(this, w * 0.3, h * 0.40, "ĐIỂM DANH", w * 0.42);
        this.add.existing(this.btnCheckIn);
        // Daily check-in handler
        this.btnCheckIn.onClick(() => this.handleDailyCheckin());

        this.btnUpgrade = new UiButton(this, w * 0.7, h * 0.40, "NÂNG CẤP XE", w * 0.42, false);
        this.add.existing(this.btnUpgrade);
        this.btnUpgrade.setEnabled(false);
        // Upgrade handler: call API, refresh profile, then show WelcomeScene
        this.btnUpgrade.onClick(async () => {
            try {
                // Prevent double click
                this.btnUpgrade.setEnabled(false);
                // Call upgrade API
                await upgradeBuddyLevel();
                // Refresh profile to pick up new level, balance, and buddy image
                await fetchProfile(true).catch(() => {
                });
                // Show welcome scene with the updated data
                try {
                    this.scene.start(Scence.Welcome);
                } catch {
                }
            } catch (e: any) {
                let msg = 'Nâng cấp thất bại. Vui lòng thử lại sau';
                try {
                    if (e instanceof ApiError) {
                        if (e.statusCode === 400) msg = 'Không thể nâng cấp: số dư không đủ hoặc đã đạt tối đa';
                        else msg = `Lỗi (${e.statusCode}). Vui lòng thử lại`;
                    } else if (typeof e?.message === 'string') {
                        msg = e.message;
                    }
                } catch {
                }
                this.showWarningPopup(msg);
            } finally {
                // Re-enable based on latest profile permission
                try {
                    const p = getProfile();
                    console.log(`Profile permission: ${p?.can_upgrade}`);
                    console.log(`Profile permission: ${!!p?.can_upgrade}`);
                    this.btnUpgrade.setEnabled(!!p?.can_upgrade);
                } catch {
                    this.btnUpgrade.setEnabled(false);
                }
            }
        });

        this.btnHistory = new UiButton(this, w * 0.3, h * 0.48, "LỊCH SỬ XU", w * 0.42);
        this.add.existing(this.btnHistory);

        this.btnGuide = new UiButton(this, w * 0.7, h * 0.48, "HƯỚNG DẪN", w * 0.42);
        this.add.existing(this.btnGuide);
        this.btnGuide.onClick(() => {
            // Launch guide as overlay
            this.scene.launch(Scence.Guide);
            this.scene.bringToTop(Scence.Guide);
        });

        // History click - hold Shift key to test with 1000 items
        this.btnHistory.onClick(() => {
            // Test mode: Shift key held = generate 1000 test items for performance testing
            const isTestMode = this.input.keyboard && this.input.keyboard.checkDown(this.input.keyboard.addKey('SHIFT'));

            if (isTestMode) {
                console.log('[Test Mode] Generating 1000 test coin history items...');
                const testItems = generateTestCoinHistory(1000);
                showCoinHistoryPopup(this, {state: 'list', items: testItems});
            } else {
                // Show popup immediately with loading state
                const {popup, updateContent} = showCoinHistoryPopup(this, {state: 'loading'});

                // Fetch items asynchronously and update popup when ready
                fetchCoinHistoryItems()
                    .then(items => {
                        if (items && items.length > 0) {
                            // Update to list state with items
                            updateContent({state: 'list', items});
                        } else {
                            // Update to empty state
                            updateContent({state: 'empty'});
                        }
                    })
                    .catch((error) => {
                        // Update to error state with error message
                        const errorMsg = error?.message || 'Vui lòng thử lại sau';
                        updateContent({state: 'error', errorMessage: errorMsg});
                    });
            }
        });

        // Bike image
        this.bike = this.add.image(w / 2, h * 0.78, "bike").setOrigin(0.5);
        this.fitWidth(this.bike, w * 0.85);

        // Loading indicator (spinner and text, matching LevelPreviewPopup)
        this.loadingContainer = this.add.container(w / 2, h * 0.78);
        this.loadingContainer.setVisible(false);

        const spinner = this.add.graphics();
        const su = scaleUnit();
        const radius = 20 * su;
        spinner.lineStyle(4 * su, 0xffffff, 1);
        spinner.beginPath();
        spinner.arc(0, 0, radius, 0, Math.PI * 1.5, false);
        spinner.strokePath();
        this.loadingContainer.add(spinner);
        this.loadingSpinner = spinner;

        this.tweens.add({
            targets: this.bike,
            angle: {from: -3, to: 3},
            duration: 1600,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut",
        });

        // Tap bike to show level preview slider (current + next level)
        this.bike.setInteractive({useHandCursor: true})
            .on('pointerdown', () => {
                this.showLevelPreviewPopup();
            });

        // Bottom progress button
        this.levelButton = new UiButton(this, w / 2, h - 96 * scaleUnit(), "CẤP ĐỘ 1", w * 0.5, true, true);
        this.add.existing(this.levelButton);

        // Coin text is part of CoinBar component; initial value is set by default

        const layout = () => {
            const {width: w2, height: h2} = this.scale;
            const su = scaleUnit();

            this.coverTo(this.bg, w2, h2);

            // Top bar
            this.coinBarUi.setPosition(w2 / 2, h2 * 0.078);
            this.coinBarUi.setBarHeight(h2 * 0.055);
            this.shareIcon.setPosition(w2 - 46 * su, h2 * 0.078);
            this.fitHeight(this.shareIcon, h2 * 0.055);

            // Title
            if (this.titleImage) {
                const y = this.coinBarUi.getBottomCenter().y + 2 * su + this.titleImage.displayHeight / 2;
                this.titleImage.setPosition(w2 / 2, y);
            }
            if (this.titleText) {
                this.titleText.setFontSize(Math.round(h2 * 0.06));
                this.titleText.setStroke('#0e4370', Math.max(6, Math.floor(w2 * 0.01)));
                const y = this.coinBarUi.getBottomCenter().y + 2 * su + this.titleText.height / 2;
                this.titleText.setPosition(w2 / 2, y);
            }

            // Buttons grid anchored under title image/text with spacing requirements
            const targetW = w2 * 0.42;
            const spacing = 4 * su; // item spacing (both horizontal and vertical)

            // Determine the bottom of the title (image preferred, else text)
            let titleBottom = h2 * 0.19;
            if (this.titleImage) {
                titleBottom = this.titleImage.getBottomCenter().y;
            } else if (this.titleText) {
                titleBottom = this.titleText.getBottomCenter().y;
            }

            // Grid top is 16 * su below the title bottom
            const gridTop = titleBottom + 8 * su;

            // Apply target width first so height is correct for vertical calculations
            this.btnCheckIn.setTargetWidth(targetW);
            this.btnUpgrade.setTargetWidth(targetW);
            this.btnHistory.setTargetWidth(targetW);
            this.btnGuide.setTargetWidth(targetW);

            // Compute button height after scaling (fallback if not ready)
            let btnHeight = this.btnCheckIn.height;
            if (!btnHeight || btnHeight <= 0) btnHeight = 80 * su;

            // Two columns centered horizontally, with spacing between items
            const totalGridWidth = 2 * targetW + spacing;
            const col1X = (w2 - totalGridWidth) / 2 + targetW / 2;
            const col2X = col1X + targetW + spacing;

            // Two rows with vertical spacing
            const row1Y = gridTop + btnHeight / 2;
            const row2Y = row1Y + btnHeight + spacing;

            // Position buttons
            this.btnCheckIn.setPosition(col1X, row1Y);
            this.btnUpgrade.setPosition(col2X, row1Y);
            this.btnHistory.setPosition(col1X, row2Y);
            this.btnGuide.setPosition(col2X, row2Y);

            // Bike and bottom button
            this.fitWidth(this.bike, w2 * 0.85);
            const levelBtnHeight = 156.0 / 32 * su;
            const bottomY = h2 - 56 * su;
            this.levelButton.setPosition(w2 / 2, bottomY);
            this.levelButton.setTargetWidth(w2 * 0.3);
            this.levelButton.height = levelBtnHeight;
            this.levelButton.setFontSize(16 * su);

            const bikeY = bottomY - this.levelButton.height / 2 - this.bike.height / 2 - 56 * su;
            this.bike.setPosition(w2 / 2, bikeY);

            // Update loading container position to match bike
            if (this.loadingContainer) {
                this.loadingContainer.setPosition(w2 / 2, bikeY);
            }
        };

        layout();
        this.scale.on("resize", layout);

        // Initial check-in button state from local storage
        this.updateCheckinButtonState();

        // After initial layout, try to load token and profile via globalApi
        const token = initFromUrlOrStorage();
        // Subscribe to global profile changes
        this.unsubscribeProfile = subscribe((p) => {
            if (p) {
                this.applyProfile(p).catch(() => {
                });
            }
        });
        // Apply cached profile immediately if available (from localStorage)
        const cached = getCachedProfile();
        if (cached) {
            this.applyProfile(cached).catch(() => {
            });
        }
        // Ensure we cleanup subscription when scene ends
        this.events.on(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.unsubscribeProfile?.();
            this.unsubscribeProfile = undefined;
            this.levelPreviewPopup?.close();
            this.levelPreviewPopup = undefined;
            this.stopFadeTweens();
        });
        this.events.on(Phaser.Scenes.Events.DESTROY, () => {
            this.unsubscribeProfile?.();
            this.unsubscribeProfile = undefined;
            this.levelPreviewPopup?.close();
            this.levelPreviewPopup = undefined;
            this.stopFadeTweens();
        });
        if (token) {
            // Show loading while fetching profile and bike image
            this.showLoading();
            (async () => {
                try {
                    const p = await fetchProfile();
                    await this.applyProfile(p);
                } catch {
                    // On API error, fall back to cached profile
                    const fallback = getCachedProfile();
                    if (fallback) {
                        await this.applyProfile(fallback);
                    }
                } finally {
                    this.hideLoading();
                }
            })();
        } else {
            // keep defaults if no token
        }
    }

    update() {
    }

    private async applyProfile(data: DriverBuddyProfile) {
        if (!data) return;
        try {
            // Update level text
            const level = data?.buddy?.level ?? 1;
            this.levelButton?.setText(`CẤP ĐỘ ${level}`);

            // Update coin text "$balance XU"
            const balance = Math.max(0, Math.floor(data?.balance ?? 0));
            this.coinBarUi?.setValue(`${balance} XU`);

            // Enable/disable upgrade per can_upgrade
            const canUpgrade = !!data?.can_upgrade;
            this.btnUpgrade?.setEnabled(canUpgrade);
            this.btnHistory?.setEnabled(true);
            this.btnGuide?.setEnabled(true);
            this.updateCheckinButtonState()

            // Update bike image to buddy.img_url if available
            const imgUrl: string | undefined = data?.buddy?.img_url;
            if (imgUrl && typeof imgUrl === 'string') {
                await this.loadExternalImageAndApply('buddy_bike', imgUrl, this.bike, level);
            }
        } catch {
        }
    }

    private async handleDailyCheckin() {
        if (!getToken() || getToken()?.length == 0) {
            this.showWarningPopup('Missing Auth Token!');
            return;
        }
        if (this.claiming) return;
        this.claiming = true;
        try {
            // Call claim API
            const res = await claimDailyCheckin();
            // Disable button for the rest of the day
            this.markCheckedInToday();
            this.updateCheckinButtonState();
            // Show success popup with dynamic amount
            this.showClaimPopup(res?.bonus_amount ?? 0);
            // Refresh profile to update balance
            await fetchProfile(true).catch(() => {
            });
        } catch (e: any) {
            // If already claimed or any error, disable for safety this day
            try {
                if (e instanceof ApiError && (e.statusCode === 400 || e.statusCode === 404)) {
                    this.showWarningPopup('Mỗi ngày chỉ có thể điểm danh 1 lần');
                }
            } catch {
            }
            this.markCheckedInToday();
            this.updateCheckinButtonState();
        } finally {
            this.claiming = false;
        }
    }

    private markCheckedInToday() {
        try {
            const today = new Date();
            const key = HomeScene.CHECKIN_KEY;
            const value = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
            if (typeof window !== 'undefined') {
                window.localStorage.setItem(key, value);
            }
        } catch {
        }
    }

    private hasCheckedInToday(): boolean {
        try {
            if (typeof window === 'undefined') return false;
            const value = window.localStorage.getItem(HomeScene.CHECKIN_KEY);
            if (!value) return false;
            const today = new Date();
            const todayStr = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
            return value === todayStr;
        } catch {
            return false;
        }
    }

    private updateCheckinButtonState() {
        try {
            const disabled = this.hasCheckedInToday();
            this.btnCheckIn?.setEnabled(!disabled);
        } catch {
        }
    }

    private showClaimPopup(amount: number) {
        // Use reusable ClaimPopup built from existing UI elements
        new ClaimPopup(this, amount);
    }

    private showWarningPopup(message: string) {
        const {width: w, height: h} = this.scale;
        const backdrop = this.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.85)
            .setInteractive({useHandCursor: false});

        const popup = this.add.image(w / 2, h / 2, 'bg_popup_warning').setOrigin(0.5);
        const targetW = Math.min(w * 0.86, w - 32 * scaleUnit());
        this.fitWidth(popup as any, targetW);

        // Centered message text in the yellow area
        const textStyle: Phaser.Types.GameObjects.Text.TextStyle = {
            fontFamily: getAppFontFamily(),
            fontStyle: '700',
            fontSize: 16 * scaleUnit(),
            color: '#FFFFFF',
            align: 'center',
            wordWrap: {width: targetW * 0.76},
        };
        const msg = this.add.text(w / 2, popup.y + popup.displayHeight * 0.12, message, textStyle)
            .setOrigin(0.5);

        const closeBtn = new UiButton(this, w / 2, popup.y + popup.displayHeight / 2, 'ĐÓNG', w * 0.33);
        this.add.existing(closeBtn);
        closeBtn.setPosition(w / 2, popup.y + popup.displayHeight / 2 - 16 * scaleUnit());
        closeBtn.onClick(() => close());

        backdrop.on('pointerdown', () => close());

        this.children.bringToTop(backdrop);
        this.children.bringToTop(popup);
        this.children.bringToTop(msg);
        this.children.bringToTop(closeBtn);

        const close = () => {
            backdrop.destroy();
            popup.destroy();
            msg.destroy();
            closeBtn.destroy();
        };
    }

    private loadExternalImageAndApply(key: string, url: string, target: Phaser.GameObjects.Image, level: number = 1): Promise<void> {
        return new Promise((resolve) => {
            const defaultKey = `lv${level}`;

            // If already loaded with same key, just swap
            if (this.textures.exists(key)) {
                try {
                    target.setTexture(key);
                    this.fitWidth(target, this.scale.width * 0.85);
                } catch {
                }
                resolve();
                return;
            }
            // Use a unique key per URL to avoid cache collisions
            const uniqueKey = `${key}_${Date.now()}`;
            this.load.image(uniqueKey, url);
            this.load.once(Phaser.Loader.Events.COMPLETE, () => {
                try {
                    if (this.textures.exists(uniqueKey)) {
                        target.setTexture(uniqueKey);
                    } else if (this.textures.exists(defaultKey)) {
                        // Fallback to default level image if external load failed
                        target.setTexture(defaultKey);
                    }
                    this.fitWidth(target, this.scale.width * 0.85);
                } catch {
                    // Final safeguard: try to use default level texture
                    try {
                        if (this.textures.exists(defaultKey)) {
                            target.setTexture(defaultKey);
                            this.fitWidth(target, this.scale.width * 0.85);
                        }
                    } catch {
                    }
                } finally {
                    resolve();
                }
            });
            this.load.start();
        });
    }

    private showLoading() {
        if (!this.loadingContainer) return;
        this.loadingContainer.setVisible(true);
        
        // Spin the arc continuously
        if (this.loadingSpinner) {
            this.tweens.add({
                targets: this.loadingSpinner,
                angle: 360,
                duration: 1000,
                repeat: -1,
                ease: 'Linear'
            });
        }
    }

    private hideLoading() {
        if (!this.loadingContainer) return;
        this.loadingContainer.setVisible(false);

        // Stop spinner tween
        if (this.loadingSpinner) {
            this.tweens.killTweensOf(this.loadingSpinner);
            this.loadingSpinner.angle = 0;
        }
    }

    private showLevelPreviewPopup() {
        try {
            // Close existing popup if any to avoid duplicates
            this.levelPreviewPopup?.close();

            const p = getProfile();
            const items: LevelPreviewItem[] = [];
            const cur = p?.buddy ?? {};
            items.push({
                level: cur.level ?? 1,
                model_name: cur.model_name,
                img_url: cur.img_url,
            });
            const next = p?.next_level_buddy ?? undefined;
            if (next) {
                items.push({
                    level: next.level,
                    model_name: next.model_name,
                    upgrade_cost: next.upgrade_cost,
                    img_url: next.img_url,
                });
            }

            const finalItems = items.length > 0 ? items : [{level: 1}];

            // Fade out underlying HomeScene elements while popup is visible
            this.fadeHomeElements(0, 200);

            this.levelPreviewPopup = new LevelPreviewPopup(this, {
                items: finalItems,
                startIndex: 0,
                onClose: () => {
                    this.levelPreviewPopup = undefined;
                    // Restore HomeScene elements when popup closes
                    this.fadeHomeElements(1, 200);
                }
            });
        } catch {
            // Ensure UI returns to visible state if popup creation fails
            this.fadeHomeElements(1, 0);
        }
    }

    private getFadeTargets(): (Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.AlphaSingle)[] {
        const targets: (Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.AlphaSingle)[] = [];
        if (this.bg) targets.push(this.bg);
        if (this.coinBarUi) targets.push(this.coinBarUi);
        if (this.shareIcon) targets.push(this.shareIcon);
        if (this.titleImage) targets.push(this.titleImage);
        else if (this.titleText) targets.push(this.titleText);
        if (this.btnCheckIn) targets.push(this.btnCheckIn);
        if (this.btnUpgrade) targets.push(this.btnUpgrade);
        if (this.btnHistory) targets.push(this.btnHistory);
        if (this.btnGuide) targets.push(this.btnGuide);
        if (this.bike) targets.push(this.bike);
        if (this.levelButton) targets.push(this.levelButton);
        if (this.loadingContainer) targets.push(this.loadingContainer);
        return targets;
    }

    private stopFadeTweens() {
        this.fadeTweens.forEach(t => t.stop());
        this.fadeTweens = [];
    }

    private fadeHomeElements(targetAlpha: number, duration: number) {
        const targets = this.getFadeTargets();
        if (targets.length === 0) return;

        this.stopFadeTweens();

        targets.forEach(obj => {
            // Skip destroyed objects
            if (!obj || !obj.scene) return;

            if (duration <= 0) {
                obj.setAlpha(targetAlpha);
                return;
            }

            const tween = this.tweens.add({
                targets: obj,
                alpha: targetAlpha,
                duration,
                ease: 'Linear',
            });
            this.fadeTweens.push(tween);
        });
    }

    // Helpers
    private coverTo(img: Phaser.GameObjects.Image, width: number, height: number) {
        const tex = img.texture.getSourceImage() as HTMLImageElement;
        const s = Math.max(width / tex.width, height / tex.height);
        img.setDisplaySize(tex.width * s, tex.height * s);
        img.setPosition(width / 2, height / 2);
    }

    private fitWidth(img: Phaser.GameObjects.Image, targetWidth: number) {
        const tex = img.texture.getSourceImage() as HTMLImageElement;
        const s = targetWidth / tex.width;
        img.setDisplaySize(targetWidth, tex.height * s);
    }

    private fitHeight(img: Phaser.GameObjects.Image, targetHeight: number) {
        const tex = img.texture.getSourceImage() as HTMLImageElement;
        const s = targetHeight / tex.height;
        img.setDisplaySize(tex.width * s, targetHeight);
    }
}