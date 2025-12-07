// Welcome scene that composes the mock with burst + bike animations
import Phaser from "phaser";
import {Scence} from "@/utils/Constants";
import UiButton from "@/ui/UiButton";
import {getAppFontFamily, loadAppFont} from "@/utils/fonts";
import {registerFontAutoRefresh} from "@/utils/fontSync";
import {scaleUnit} from "@/utils/CanvasSize";
import CoinBar from "@/ui/CoinBar";
import {initFromUrlOrStorage, fetchProfile, getProfile, subscribe, type DriverBuddyProfile} from "@/services/globalApi";

export class WelcomeScene extends Phaser.Scene {
    private bg!: Phaser.GameObjects.Image;
    private coinBarUi!: CoinBar;
    private shareIcon!: Phaser.GameObjects.Image;
    private titleImage!: Phaser.GameObjects.Image;
    private titleText?: Phaser.GameObjects.Text;
    private congratsText!: Phaser.GameObjects.Text;
    private levelButton!: UiButton;
    private burst!: Phaser.GameObjects.Image;
    private bike!: Phaser.GameObjects.Image;
    private closeBtn!: UiButton;
    private unsubscribeProfile?: () => void;

    // Animation icon shapes
    private iconStarOrange!: Phaser.GameObjects.Image;
    private iconStarYellow!: Phaser.GameObjects.Image;
    private iconCrescentYellow!: Phaser.GameObjects.Image;
    private iconCrescentGreen!: Phaser.GameObjects.Image;
    private iconWaveOrange!: Phaser.GameObjects.Image;
    private iconWavePeach!: Phaser.GameObjects.Image;
    private iconCirclePink!: Phaser.GameObjects.Image;
    private iconDiamondBlue!: Phaser.GameObjects.Image;
    private iconRectGray!: Phaser.GameObjects.Image;

    // Bike 360 interaction state
    private bikeFrames: string[] = [];
    private currentBikeFrame: number = 0;
    private bikeZoom: number = 1.0;
    private isDraggingBike: boolean = false;
    private dragStartX: number = 0;
    private dragStartFrame: number = 0;
    private readonly TOTAL_BIKE_FRAMES: number = 36;
    private readonly MIN_ZOOM: number = 0.5;
    private readonly MAX_ZOOM: number = 2.5;

    constructor() {
        super("WelcomeScene");
    }

    preload() {
        this.load.image("bg_garage", "/main_background.png");
        this.load.image("coin_bar", "/background_aha_xua.png");
        this.load.image("coin_icon", "/aha_xu.png");
        this.load.image("share", "/ic_share.png");
        this.load.image("button", "/bg_progress_active.png");
        this.load.image("bg_button_active", "/bg_button_active.png");
        this.load.image("bg_button_disable", "/bg_button_disable.png");
        this.load.image("bg_progress_active", "/bg_progress_active.png");
        this.load.image("burst", "/burst.png");

        // Load all 36 bike frames for 360° rotation
        // for (let i = 0; i < this.TOTAL_BIKE_FRAMES; i++) {
        //     const frameKey = `bike_${i.toString().padStart(3, '0')}`;
        //     const framePath = `/ic_bike_${i.toString().padStart(3, '0')}.png`;
        //     this.bikeFrames.push(frameKey);
        //     this.load.image(frameKey, framePath);
        // }

        this.load.image("bike", "/ic_bike.png");

        this.load.image("main_header", "/main_header.png");

        // Animation icon shapes
        this.load.svg("icon_star_yellow", "/Vector-1.svg");
        this.load.svg("icon_star_orange", "/Vector.svg");
        this.load.svg("icon_crescent_yellow", "/Path 31 Copy.svg");
        this.load.svg("icon_crescent_green", "/Path 31.svg");
        this.load.svg("icon_wave_orange", "/Path 2.svg");
        this.load.svg("icon_wave_peach", "/Path 4.svg");
        this.load.svg("icon_circle_pink", "/Oval 4.svg");
        this.load.svg("icon_diamond_blue", "/Rectangle Copy 6.svg");
        this.load.svg("icon_rect_gray", "/Rectangle Copy 7.svg");
    }

    create() {
        // Ensure all text in this scene switches to the app font when it finishes loading
        registerFontAutoRefresh(this);
        const {width, height} = this.scale;

        // Background cover
        this.bg = this.add.image(width / 2, height / 2, "bg_garage").setOrigin(0.5);
        this.coverTo(this.bg, width, height);
        this.bg.alpha = 0.5;

        // Top coin bar (use shared CoinBar component like HomeScene)
        this.coinBarUi = new CoinBar(this, width / 2, height * 0.078, {});
        this.add.existing(this.coinBarUi);
        this.coinBarUi.setBarHeight(height * 0.055);

        // Share icon top-right
        this.shareIcon = this.add.image(width - 50, height * 0.078, "share").setOrigin(0.5);
        this.fitHeight(this.shareIcon, height * 0.055);
        this.shareIcon.setInteractive({useHandCursor: true});

        // Title: prefer image, else text (match HomeScene sizing/position policy)
        if (this.textures.exists("main_header")) {
            this.titleImage = this.add.image(width / 2, height * 0.19, "main_header").setOrigin(0.5);
            // Match HomeScene width ratio
            this.fitWidth(this.titleImage, width * 0.7);
        } else {
            this.titleText = this.add.text(width / 2, height * 0.19, "XẾ CÙNG\nAHA", {
                fontFamily: getAppFontFamily(),
                fontSize: '56px',
                color: "#ff8b43",
                align: "center",
                stroke: "#0e4370",
                strokeThickness: Math.max(6, Math.floor(width * 0.01)),
            }).setOrigin(0.5);
        }

        // Congrats text block
        const congrats = "CHÚC MỪNG TÀI XẾ\nĐÃ ĐẠT ĐƯỢC".toUpperCase();
        this.congratsText = this.add.text(width / 2, 0, congrats, {
                fontFamily: getAppFontFamily(),
                fontStyle: '600', // 400 regular
                fontSize: '56px',
                color: "#ffffff",
                align: "center",
                wordWrap: {width: width * 0.8},
            }
        ).setOrigin(0.5);
        // Target line-height of 32px with 24px font-size => ~8px extra spacing between lines
        this.congratsText.setLineSpacing(8);

        // Level button using reusable UiButton component
        this.levelButton = new UiButton(this, width / 3, height * 0.405, "CẤP ĐỘ 1", width * 0.5, true, true);
        this.add.existing(this.levelButton);
        this.levelButton.onClick(() => {
            // Placeholder click handler — keep or replace with your desired action
        });

        // Burst behind the bike
        this.burst = this.add.image(width / 2, height * 0.50, "burst").setOrigin(0.5).setAlpha(0.9);
        this.fitWidth(this.burst, width * 0.95);
        this.tweens.add({
            targets: this.burst,
            angle: 360,
            duration: 12000,
            repeat: -1,
            ease: 'Linear'
        });
        this.tweens.add({
            targets: this.burst,
            scale: {from: this.burst.scale * 0.96, to: this.burst.scale * 1.04},
            duration: 2000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Bike in front of burst - with 360° interaction
        // Check if 360 frames are available, otherwise use fallback
        const bikeKey = this.textures.exists(this.bikeFrames[0]) ? this.bikeFrames[0] : "bike";
        this.bike = this.add.image(width / 2, height * 0.86, bikeKey).setOrigin(0.5);
        this.fitWidth(this.bike, width * 0.85);

        // Only add wobble animation if using fallback single image
        if (bikeKey === "bike") {
            this.tweens.add({
                targets: this.bike,
                angle: {from: -3, to: 3},
                duration: 1600,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
        } else {
            // Enable interactive 360° rotation
            this.bike.setInteractive({useHandCursor: true, draggable: true});
            this.setupBikeInteraction();
        }

        // Close button at bottom using UiButton
        this.closeBtn = new UiButton(this, width / 3, height - 96 * scaleUnit(), "ĐÓNG", width * 0.5);
        this.add.existing(this.closeBtn);
        this.closeBtn.onClick(() => {
            // Mark welcome as seen so we don't show this scene again on next visits
            try {
                if (typeof window !== "undefined") {
                    window.localStorage.setItem("welcomeSeen", "true");
                }
            } catch (e) {
                // ignore storage errors
            }

            this.tweens.add({
                targets: this.children.getChildren(),
                alpha: 0,
                duration: 300,
                onComplete: () => this.scene.start(Scence.Home),
            });
        });

        // Calculate congratsText top position for icon alignment
        const congratsTop = this.congratsText.y - this.congratsText.height / 2;

        // Icon size based on 13px width at reference viewport 375x812
        const iconSize = width * (13 / 375);

        // Animation icons - Top Left (aligned with congratsText top)
        this.iconStarOrange = this.add.image(width * 0.08, congratsTop - height * 0.02, "icon_star_orange").setOrigin(0.5);
        this.fitWidth(this.iconStarOrange, iconSize);

        this.iconCrescentYellow = this.add.image(width * 0.19, congratsTop + height * 0.01, "icon_crescent_yellow").setOrigin(0.5);
        this.fitWidth(this.iconCrescentYellow, iconSize);

        this.iconWaveOrange = this.add.image(width * 0.09, congratsTop + height * 0.09, "icon_wave_orange").setOrigin(0.5);
        this.fitWidth(this.iconWaveOrange, iconSize);

        // Animation icons - Top Right (aligned with congratsText top)
        this.iconCrescentGreen = this.add.image(width * 0.87, congratsTop - height * 0.03, "icon_crescent_green").setOrigin(0.5);
        this.fitWidth(this.iconCrescentGreen, iconSize);

        this.iconCirclePink = this.add.image(width * 0.95, congratsTop - height * 0.06, "icon_circle_pink").setOrigin(0.5);
        this.fitWidth(this.iconCirclePink, iconSize);

        this.iconDiamondBlue = this.add.image(width * 0.96, congratsTop + height * 0.04, "icon_diamond_blue").setOrigin(0.5);
        this.fitWidth(this.iconDiamondBlue, iconSize);

        this.iconStarYellow = this.add.image(width * 0.88, congratsTop + height * 0.11, "icon_star_yellow").setOrigin(0.5);
        this.fitWidth(this.iconStarYellow, iconSize);

        // Animation icons - Bottom Left
        this.iconRectGray = this.add.image(width * 0.05, congratsTop + height * 0.20, "icon_rect_gray").setOrigin(0.5);
        this.fitWidth(this.iconRectGray, iconSize);

        this.iconWavePeach = this.add.image(width * 0.97, congratsTop + height * 0.15, "icon_wave_peach").setOrigin(0.5);
        this.fitWidth(this.iconWavePeach, iconSize);

        // Add animations to icons
        // Star rotations
        this.tweens.add({
            targets: this.iconStarOrange,
            angle: 360,
            duration: 8000,
            repeat: -1,
            ease: 'Linear'
        });
        this.tweens.add({
            targets: this.iconStarYellow,
            angle: -360,
            duration: 10000,
            repeat: -1,
            ease: 'Linear'
        });

        // Floating animations
        this.tweens.add({
            targets: this.iconCrescentYellow,
            y: this.iconCrescentYellow.y - 15,
            duration: 2500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
        this.tweens.add({
            targets: this.iconCrescentGreen,
            y: this.iconCrescentGreen.y - 12,
            duration: 3000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Wave animations
        this.tweens.add({
            targets: this.iconWaveOrange,
            x: this.iconWaveOrange.x - 10,
            y: this.iconWaveOrange.y - 10,
            duration: 2000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
        this.tweens.add({
            targets: this.iconWavePeach,
            x: this.iconWavePeach.x + 8,
            y: this.iconWavePeach.y - 8,
            duration: 2200,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Scale pulse animations
        this.tweens.add({
            targets: this.iconCirclePink,
            scale: {from: 1, to: 1.15},
            duration: 1800,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
        this.tweens.add({
            targets: this.iconDiamondBlue,
            scale: {from: 1, to: 1.2},
            duration: 2000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
        this.tweens.add({
            targets: this.iconRectGray,
            scale: {from: 1, to: 1.1},
            duration: 2400,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Layout function for positioning responsive elements
        const layout = () => {
            const {width: w, height: h} = this.scale;
            const _scaleUnit: number = scaleUnit();
            this.coverTo(this.bg, w, h);

            // Top bar elements (match HomeScene)
            this.coinBarUi.setPosition(w / 2, h * 0.078);
            this.coinBarUi.setBarHeight(h * 0.055);
            this.shareIcon.setPosition(w - 46 * _scaleUnit, h * 0.078);
            this.fitHeight(this.shareIcon, h * 0.055);

            // Title (match HomeScene: below CoinBar bar bottom with 2*su margin)
            const barBottom = this.coinBarUi.getBottomCenter().y;
            if (this.titleImage) {
                const y = barBottom + 2 * _scaleUnit + this.titleImage.displayHeight / 2;
                this.titleImage.setPosition(w / 2, y);
            }
            if (this.titleText) {
                this.titleText.setFontSize(Math.round(h * 0.06));
                this.titleText.setStroke('#0e4370', Math.max(6, Math.floor(w * 0.01)));
                const y = barBottom + 2 * _scaleUnit + this.titleText.height / 2;
                this.titleText.setPosition(w / 2, y);
            }

            // Congratulations text: 50*su margin below main_header bottom
            let titleBottom = barBottom;
            if (this.titleImage) titleBottom = this.titleImage.getBottomCenter().y;
            else if (this.titleText) titleBottom = this.titleText.getBottomCenter().y;
            const congratsY = titleBottom + 50 * _scaleUnit + this.congratsText.height / 2;
            this.congratsText.setPosition(w / 2, congratsY);
            this.congratsText.setWordWrapWidth(w * 0.8);

            // Level button: align with bottom of congratsText (top of button touches congrats bottom)
            const levelBtnWidth = w * 0.3;
            this.levelButton.setTargetWidth(levelBtnWidth);
            this.levelButton.height = 32 * _scaleUnit;
            this.levelButton.setFontSize(16 * _scaleUnit);
            const congratsBottom = this.congratsText.getBottomCenter().y;
            this.levelButton.setPosition(w / 2, congratsBottom + this.levelButton.height / 2)

            // Burst and bike
            this.fitWidth(this.burst, w * 0.95);
            const bikePositionY = h - 72 * _scaleUnit - this.closeBtn.height - this.bike.height / 2;
            this.burst.setPosition(w / 2, bikePositionY);
            this.bike.setPosition(w / 2, bikePositionY - 24 * _scaleUnit);

            // Use updateBikeZoom if in 360 mode to preserve zoom, otherwise use fitWidth
            if (this.textures.exists(this.bikeFrames[0])) {
                this.updateBikeZoom();
            } else {
                this.fitWidth(this.bike, w * 0.85);
            }

            // Close button
            this.closeBtn.setPosition(w / 2, h - 72 * _scaleUnit);
            this.closeBtn.setTargetWidth(w * 0.3);


            // Calculate congratsText top position for icon alignment
            const congratsTop = this.congratsText.y - this.congratsText.height / 2;

            // Icon size based on 13px width at reference viewport 375x812
            const iconSize = w * (13 / 375);

            // Reposition and resize animation icons (aligned with congratsText top)
            // Top Left
            this.iconStarOrange.setPosition(w * 0.08, congratsTop - h * 0.02);
            this.fitWidth(this.iconStarOrange, iconSize);

            this.iconCrescentYellow.setPosition(w * 0.19, congratsTop + h * 0.01);
            this.fitWidth(this.iconCrescentYellow, iconSize);

            this.iconWaveOrange.setPosition(w * 0.09, congratsTop + h * 0.09);
            this.fitWidth(this.iconWaveOrange, iconSize);

            // Top Right
            this.iconCrescentGreen.setPosition(w * 0.87, congratsTop - h * 0.03);
            this.fitWidth(this.iconCrescentGreen, iconSize);

            this.iconCirclePink.setPosition(w * 0.95, congratsTop - h * 0.06);
            this.fitWidth(this.iconCirclePink, iconSize);

            this.iconDiamondBlue.setPosition(w * 0.96, congratsTop + h * 0.04);
            this.fitWidth(this.iconDiamondBlue, iconSize);

            this.iconStarYellow.setPosition(w * 0.88, congratsTop + h * 0.11);
            this.fitWidth(this.iconStarYellow, iconSize);

            // Bottom
            this.iconRectGray.setPosition(w * 0.05, congratsTop + h * 0.20);
            this.fitWidth(this.iconRectGray, iconSize);

            this.iconWavePeach.setPosition(w * 0.97, congratsTop + h * 0.15);
            this.fitWidth(this.iconWavePeach, iconSize);
        };

        layout();
        this.scale.on('resize', layout);

        // Initialize token/debug from URL or storage and sync coin text with profile balance
        const token = initFromUrlOrStorage();
        const applyProfile = (p: DriverBuddyProfile | null) => {
            const balance = Math.max(0, Math.floor(p?.balance ?? 0));
            this.coinBarUi?.setValue(`${balance} XU`);
        };
        // Subscribe to global profile changes
        this.unsubscribeProfile = subscribe((p) => {
            if (p) applyProfile(p);
        });
        // Apply cached profile immediately if available
        const cached = getProfile();
        if (cached) applyProfile(cached);
        // Cleanup subscription on scene end
        this.events.on(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.unsubscribeProfile?.();
            this.unsubscribeProfile = undefined;
        });
        this.events.on(Phaser.Scenes.Events.DESTROY, () => {
            this.unsubscribeProfile?.();
            this.unsubscribeProfile = undefined;
        });
        // Fetch latest profile if token exists
        if (token) {
            fetchProfile().then(applyProfile).catch(() => {
            });
        }
    }

    // Utility: scale image to cover the game area
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

    // Setup bike 360° interaction (drag to rotate, wheel/pinch to zoom)
    private setupBikeInteraction() {
        // Drag to rotate
        this.bike.on('dragstart', (pointer: Phaser.Input.Pointer) => {
            this.isDraggingBike = true;
            this.dragStartX = pointer.x;
            this.dragStartFrame = this.currentBikeFrame;
        });

        this.bike.on('drag', (pointer: Phaser.Input.Pointer) => {
            if (!this.isDraggingBike) return;

            // Calculate drag distance and convert to frame change
            const dragDistance = pointer.x - this.dragStartX;
            const sensitivity = 2; // pixels per frame
            const frameChange = Math.floor(dragDistance / sensitivity);

            // Update frame with wrapping
            let newFrame = this.dragStartFrame + frameChange;
            while (newFrame < 0) newFrame += this.TOTAL_BIKE_FRAMES;
            newFrame = newFrame % this.TOTAL_BIKE_FRAMES;

            if (newFrame !== this.currentBikeFrame) {
                this.currentBikeFrame = newFrame;
                this.updateBikeFrame();
            }
        });

        this.bike.on('dragend', () => {
            this.isDraggingBike = false;
        });

        // Mouse wheel zoom
        this.input.on('wheel', (pointer: Phaser.Input.Pointer, gameObjects: any[], deltaX: number, deltaY: number) => {
            // Only zoom if pointer is over the bike
            if (!this.bike.getBounds().contains(pointer.x, pointer.y)) return;

            const zoomSpeed = 0.001;
            const zoomChange = -deltaY * zoomSpeed;
            this.bikeZoom = Phaser.Math.Clamp(this.bikeZoom + zoomChange, this.MIN_ZOOM, this.MAX_ZOOM);
            this.updateBikeZoom();
        });

        // Touch pinch zoom support
        if (this.input.pointer1 && this.input.pointer2) {
            let lastDistance = 0;

            this.input.on('pointermove', () => {
                if (this.input.pointer1.isDown && this.input.pointer2.isDown) {
                    const p1 = this.input.pointer1.position;
                    const p2 = this.input.pointer2.position;
                    const distance = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);

                    if (lastDistance > 0) {
                        const pinchScale = distance / lastDistance;
                        this.bikeZoom = Phaser.Math.Clamp(
                            this.bikeZoom * pinchScale,
                            this.MIN_ZOOM,
                            this.MAX_ZOOM
                        );
                        this.updateBikeZoom();
                    }

                    lastDistance = distance;
                } else {
                    lastDistance = 0;
                }
            });
        }

        // Hover effect
        this.bike.on('pointerover', () => {
            this.bike.setTint(0xdddddd);
        });

        this.bike.on('pointerout', () => {
            if (!this.isDraggingBike) {
                this.bike.clearTint();
            }
        });
    }

    // Update the displayed bike frame
    private updateBikeFrame() {
        const frameKey = this.bikeFrames[this.currentBikeFrame];
        if (this.textures.exists(frameKey)) {
            this.bike.setTexture(frameKey);
        }
    }

    // Update bike zoom scale
    private updateBikeZoom() {
        const {width} = this.scale;
        const baseWidth = width * 0.85;
        this.bike.setDisplaySize(baseWidth * this.bikeZoom, this.bike.height * this.bikeZoom);
    }
}
