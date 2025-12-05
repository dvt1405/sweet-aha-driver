import Phaser from "phaser";
import {Scence} from "@/utils/Constants";
import UiButton from "@/ui/UiButton";
import {getAppFontFamily} from "@/utils/fonts";
import {scaleUnit} from "@/utils/CanvasSize";
import {
    initFromUrlOrStorage,
    fetchProfile,
    getProfile,
    subscribe,
    claimDailyCheckin,
    fetchCoinHistoryItems,
    upgradeBuddyLevel,
    type DriverBuddyProfile
} from "@/services/globalApi";
import {showCoinHistoryPopup, type CoinHistoryItem} from "@/scence/CoinHistoryScene";
import {is} from "@babel/types";
import {ApiError} from "next/dist/server/api-utils";

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
    private coinBar!: Phaser.GameObjects.Image;
    private coinIcon!: Phaser.GameObjects.Image;
    private shareIcon!: Phaser.GameObjects.Image;
    private titleImage?: Phaser.GameObjects.Image;
    private titleText?: Phaser.GameObjects.Text;
    private coinText!: Phaser.GameObjects.Text;

    private btnCheckIn!: UiButton;
    private btnUpgrade!: UiButton;
    private btnHistory!: UiButton;
    private btnGuide!: UiButton;

    private bike!: Phaser.GameObjects.Image;
    private levelButton!: UiButton;
    private unsubscribeProfile?: () => void;

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
        // Popup overlay image for claim success
        this.load.image("overlay_popup", "/overlay_popup.png");
        // Popup warning background for already-claimed case (HTTP 404)
        this.load.image("bg_popup_warning", "/bg_popup_warning.png");
        this.load.image("popup_header", "/bg_btn_header_popup.png")
    }

    create() {
        const {width: w, height: h} = this.scale;

        // Background
        this.bg = this.add.image(w / 2, h / 2, "bg_garage").setOrigin(0.5);
        this.coverTo(this.bg, w, h);
        this.bg.alpha = 0.5;

        // Top coin bar and icons
        this.coinBar = this.add.image(w / 2, h * 0.078, "coin_bar").setOrigin(0.5);
        this.fitHeight(this.coinBar, h * 0.055);

        this.coinIcon = this.add.image(0, 0, "coin_icon").setOrigin(0.5);
        this.fitHeight(this.coinIcon, this.coinBar.displayHeight * 1.2);

        this.shareIcon = this.add.image(w - 50, h * 0.078, "share").setOrigin(0.5);
        this.fitHeight(this.shareIcon, h * 0.055);
        this.shareIcon.setInteractive({useHandCursor: true});

        // Title (image or text fallback)
        if (this.textures.exists("main_header")) {
            this.titleImage = this.add.image(w / 2, h * 0.19, "main_header").setOrigin(0.5);
            this.fitWidth(this.titleImage, w * 0.8);
        } else {
            this.titleText = this.add.text(w / 2, h * 0.19, "XẾ CÙNG\nAHA", {
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
        // Upgrade handler: call API, refresh profile, then show WelcomeScene
        this.btnUpgrade.onClick(async () => {
            try {
                // Prevent double click
                this.btnUpgrade.setEnabled(false);
                // Call upgrade API
                await upgradeBuddyLevel();
                // Refresh profile to pick up new level, balance, and buddy image
                await fetchProfile(true).catch(() => {});
                // Show welcome scene with the updated data
                try {
                    this.scene.start(Scence.Welcome);
                } catch {}
            } catch (e: any) {
                let msg = 'Nâng cấp thất bại. Vui lòng thử lại sau';
                try {
                    if (e instanceof ApiError) {
                        if (e.statusCode === 400) msg = 'Không thể nâng cấp: số dư không đủ hoặc đã đạt tối đa';
                        else msg = `Lỗi (${e.statusCode}). Vui lòng thử lại`;
                    } else if (typeof e?.message === 'string') {
                        msg = e.message;
                    }
                } catch {}
                this.showWarningPopup(msg);
            } finally {
                // Re-enable based on latest profile permission
                try {
                    const p = getProfile();
                    this.btnUpgrade.setEnabled(!!p?.can_upgrade);
                } catch {
                    this.btnUpgrade.setEnabled(true);
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
                showCoinHistoryPopup(this, { state: 'list', items: testItems });
            } else {
                // Show popup immediately with loading state
                const { popup, updateContent } = showCoinHistoryPopup(this, { state: 'loading' });
                
                // Fetch items asynchronously and update popup when ready
                fetchCoinHistoryItems()
                    .then(items => {
                        if (items && items.length > 0) {
                            // Update to list state with items
                            updateContent({ state: 'list', items });
                        } else {
                            // Update to empty state
                            updateContent({ state: 'empty' });
                        }
                    })
                    .catch((error) => {
                        // Update to error state with error message
                        const errorMsg = error?.message || 'Vui lòng thử lại sau';
                        updateContent({ state: 'error', errorMessage: errorMsg });
                    });
            }
        });

        // Bike image
        this.bike = this.add.image(w / 2, h * 0.78, "bike").setOrigin(0.5);
        this.fitWidth(this.bike, w * 0.85);
        this.tweens.add({
            targets: this.bike,
            angle: {from: -3, to: 3},
            duration: 1600,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut",
        });

        // Bottom progress button
        this.levelButton = new UiButton(this, w / 2, h - 96 * scaleUnit(), "CẤP ĐỘ 1", w * 0.5, true, true);
        this.add.existing(this.levelButton);

        // Coin text on the bar
        this.coinText = this.add.text(0, 0, "0 XU".toUpperCase(), {
            fontFamily: getAppFontFamily(),
            fontStyle: "600",
            fontSize: 50,
            color: "#9B6F00",
            align: "center",
            stroke: "#FFFFFF",
            strokeThickness: 8,
        }).setOrigin(0.5);

        const layout = () => {
            const {width: w2, height: h2} = this.scale;
            const su = scaleUnit();

            this.coverTo(this.bg, w2, h2);

            // Top bar
            this.coinBar.setPosition(w2 / 2, h2 * 0.078);
            this.fitHeight(this.coinBar, h2 * 0.055);
            this.fitHeight(this.coinIcon, this.coinBar.displayHeight * 1.2);
            this.coinIcon.setPosition(this.coinBar.x + this.coinBar.width / 2, this.coinBar.y);
            this.shareIcon.setPosition(w2 - 50, h2 * 0.078);
            this.fitHeight(this.shareIcon, h2 * 0.055);
            this.coinText.setPosition(this.coinBar.x, this.coinBar.y);

            // Title
            if (this.titleImage) {
                this.titleImage.setPosition(w2 / 2, this.coinIcon.getBottomCenter().y + this.titleImage.height / 2);
                this.fitWidth(this.titleImage, w2 * 0.8);
            }
            if (this.titleText) {
                this.titleText.setPosition(w2 / 2, h2 * 0.19);
                this.titleText.setFontSize(Math.round(h2 * 0.06));
                this.titleText.setStroke('#0e4370', Math.max(6, Math.floor(w2 * 0.01)));
            }

            // Buttons grid
            const targetW = w2 * 0.42;
            const row1Y = h2 * 0.40;
            const row2Y = h2 * 0.48;
            const col1X = w2 * 0.30;
            const col2X = w2 * 0.70;

            this.btnCheckIn.setPosition(col1X, row1Y).setTargetWidth(targetW);
            this.btnUpgrade.setPosition(col2X, row1Y).setTargetWidth(targetW);
            this.btnHistory.setPosition(col1X, row2Y).setTargetWidth(targetW);
            this.btnGuide.setPosition(col2X, row2Y).setTargetWidth(targetW);

            // Bike and bottom button
            this.fitWidth(this.bike, w2 * 0.85);
            const bottomY = h2 - 72 * su;
            this.levelButton.setPosition(w2 / 2, bottomY);
            this.levelButton.setTargetWidth(w2 * 0.3);
            this.levelButton.height = 32 * su;
            this.levelButton.setFontSize(16 * su);

            const bikeY = bottomY - this.levelButton.height - this.bike.height / 2 - 12 * su;
            this.bike.setPosition(w2 / 2, bikeY);
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
        // Apply cached profile immediately if available
        const cached = getProfile();
        if (cached) {
            this.applyProfile(cached).catch(() => {
            });
        }
        // Ensure we cleanup subscription when scene ends
        this.events.on(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.unsubscribeProfile?.();
            this.unsubscribeProfile = undefined;
        });
        this.events.on(Phaser.Scenes.Events.DESTROY, () => {
            this.unsubscribeProfile?.();
            this.unsubscribeProfile = undefined;
        });
        if (token) {
            fetchProfile().then(p => this.applyProfile(p)).catch(() => {
            });
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
            if (this.coinText) {
                this.coinText.setText(`${balance} XU`.toUpperCase());
            }

            // Enable/disable upgrade per can_upgrade
            const canUpgrade = !!data?.can_upgrade;
            this.btnUpgrade?.setEnabled(canUpgrade);

            // Update bike image to buddy.img_url if available
            const imgUrl: string | undefined = data?.buddy?.img_url;
            if (imgUrl && typeof imgUrl === 'string') {
                await this.loadExternalImageAndApply('buddy_bike', imgUrl, this.bike);
            }
        } catch {
        }
    }

    private async handleDailyCheckin() {
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
        const {width: w, height: h} = this.scale;
        // Dark backdrop
        const backdrop = this.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.55)
            .setInteractive({useHandCursor: false});

        // Popup image centered
        const popup = this.add.image(w / 2, h / 2, 'overlay_popup').setOrigin(0.5);
        const targetW = Math.min(w * 0.8, 340);
        this.fitWidth(popup as any, targetW);

        // Amount text displayed roughly at the yellow bar center in image
        const amountText = this.add.text(w / 2, 0, `${amount} XU`, {
            fontFamily: getAppFontFamily(),
            fontStyle: '800',
            fontSize: 44,
            color: '#FFFFFF',
            align: 'center',
            stroke: '#3F5F00',
            strokeThickness: 10,
        }).setOrigin(0.5);

        // Position amount text at approximate bar Y (tuned for provided image)
        const popupBarOffsetY = popup.displayHeight * 0.04; // small tweak
        amountText.setPosition(w / 2, popup.y + popupBarOffsetY);

        // Close button at bottom
        const closeBtn = new UiButton(this, w / 2, h - 96 * scaleUnit(), 'ĐÓNG', w * 0.33);
        this.add.existing(closeBtn);
        closeBtn.onClick(() => close());

        // Auto close on backdrop click
        backdrop.on('pointerdown', () => close());

        // Bring to top layering
        this.children.bringToTop(backdrop);
        this.children.bringToTop(popup);
        this.children.bringToTop(amountText);
        this.children.bringToTop(closeBtn);

        const close = () => {
            backdrop.destroy();
            popup.destroy();
            amountText.destroy();
            closeBtn.destroy();
        };
    }

    private showWarningPopup(message: string) {
        const {width: w, height: h} = this.scale;
        const backdrop = this.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.55)
            .setInteractive({useHandCursor: false});

        const popup = this.add.image(w / 2, h / 2, 'bg_popup_warning').setOrigin(0.5);
        const targetW = Math.min(w * 0.86, 420);
        this.fitWidth(popup as any, targetW);

        // Centered message text in the yellow area
        const textStyle: Phaser.Types.GameObjects.Text.TextStyle = {
            fontFamily: getAppFontFamily(),
            fontStyle: '700',
            fontSize: 28,
            color: '#6B4B00',
            align: 'center',
            wordWrap: {width: targetW * 0.76},
        };
        const msg = this.add.text(w / 2, popup.y + popup.displayHeight * 0.12, message, textStyle)
            .setOrigin(0.5);

        const closeBtn = new UiButton(this, w / 2, h - 96 * scaleUnit(), 'ĐÓNG', w * 0.33);
        this.add.existing(closeBtn);
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

    private loadExternalImageAndApply(key: string, url: string, target: Phaser.GameObjects.Image): Promise<void> {
        return new Promise((resolve) => {
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
                    } else if (this.textures.exists('bike')) {
                        // Fallback to default bike image if external load failed
                        target.setTexture('bike');
                    }
                    this.fitWidth(target, this.scale.width * 0.85);
                } catch {
                    // Final safeguard: try to use default bike texture
                    try {
                        if (this.textures.exists('bike')) {
                            target.setTexture('bike');
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