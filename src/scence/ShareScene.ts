// Share scene that displays driver info and captures for sharing
import Phaser from "phaser";
import {Scence} from "@/utils/Constants";
import {getAppFontFamily} from "@/utils/fonts";
import {registerFontAutoRefresh} from "@/utils/fontSync";
import {
    getProfile,
    getSupplierProfile,
} from "@/services/globalApi";
import {JSFunction, WebInAppEvent} from "@/utils/js-function";

export class ShareScene extends Phaser.Scene {
    private bg!: Phaser.GameObjects.Image;
    private titleImage!: Phaser.GameObjects.Image;
    private avatarImage!: Phaser.GameObjects.Image;
    private avatarMask!: Phaser.GameObjects.Graphics;
    private congratsText!: Phaser.GameObjects.Text;
    private driverNameText!: Phaser.GameObjects.Text;
    private levelBadge!: Phaser.GameObjects.Image;
    private levelText!: Phaser.GameObjects.Text;
    private bikeImage!: Phaser.GameObjects.Image;
    private avatarLoadingComplete: boolean = false;
    private avatarLoadingPromise: Promise<void> | null = null;

    constructor() {
        super(Scence.Share);
    }

    preload() {
        this.load.image("bg_garage", "/main_background.png");
        this.load.image("main_header", "/main_header.png");
        this.load.image("bg_button_active", "/bg_button_active.png");
        // Load level bike images
        for (let i = 1; i <= 10; i++) {
            this.load.image(`lv${i}`, `/lv${i}.png`);
        }
    }

    create() {
        registerFontAutoRefresh(this);
        const {width, height} = this.scale;

        // Get profile data
        const profile = getProfile();
        const supplierProfile = getSupplierProfile();
        const level = profile?.buddy?.level ?? 1;
        const driverName = supplierProfile?.name ?? "Tài Xế";
        const avatarUrl = supplierProfile?.avatar;

        // Background - garage scene
        this.bg = this.add.image(width / 2, height / 2, "bg_garage").setOrigin(0.5);
        this.coverTo(this.bg, width, height);

        // Title image at top
        if (this.textures.exists("main_header")) {
            this.titleImage = this.add.image(width / 2, height * 0.14, "main_header").setOrigin(0.5);
            this.fitWidth(this.titleImage, width * 0.7);
        }

        // Avatar position (center of screen, based on design)
        const avatarY = height * 0.36;
        const avatarRadius = width * 0.14;

        // Create circular avatar
        this.createCircularAvatar(width / 2, avatarY, avatarRadius, avatarUrl);

        // "CHÚC MỪNG TÀI XẾ" congratulations text - positioned below avatar
        this.congratsText = this.add.text(width / 2, height * 0.50, "CHÚC MỪNG TÀI XẾ", {
            fontFamily: getAppFontFamily(),
            fontSize: `${Math.floor(width * 0.065)}px`,
            fontStyle: "bold",
            color: "#ff8b43",
            align: "center",
        }).setOrigin(0.5);

        // Driver name text - positioned below congrats text
        this.driverNameText = this.add.text(width / 2, height * 0.555, driverName.toUpperCase(), {
            fontFamily: getAppFontFamily(),
            fontSize: `${Math.floor(width * 0.06)}px`,
            fontStyle: "bold",
            color: "#1a5fb4",
            align: "center",
        }).setOrigin(0.5);

        // Level badge - positioned below driver name
        this.createLevelBadge(width / 2, height * 0.615, level, width * 0.35);

        // Bike image at bottom
        this.createBikeImage(width / 2, height * 0.82, level, width * 0.75);

        // Wait for avatar to load, then capture and share
        this.waitForRenderAndCapture().then(r => {
            console.log("Capture and share complete:", r);
        });
    }

    private async waitForRenderAndCapture() {
        try {
            // Wait for avatar loading to complete
            if (this.avatarLoadingPromise) {
                await this.avatarLoadingPromise;
            }

            // Wait for next frame to ensure everything is rendered
            await new Promise<void>((resolve) => {
                this.time.delayedCall(100, () => {
                    resolve();
                });
            });

            // Capture and share
            this.captureAndShare();
        } catch (error) {
            console.error("Error waiting for render:", error);
            this.captureAndShare();
        }
    }

    private createCircularAvatar(x: number, y: number, radius: number, avatarUrl?: string) {
        // Create circular mask using graphics
        this.avatarMask = this.make.graphics({});
        this.avatarMask.fillStyle(0xffffff);
        this.avatarMask.fillCircle(x, y, radius);

        // Load avatar image
        if (avatarUrl && avatarUrl.length > 0) {
            this.avatarLoadingPromise = new Promise<void>((resolve) => {
                this.loadExternalAvatar(avatarUrl, x, y, radius, resolve);
            });
        } else {
            // Create default gray circle avatar
            this.createDefaultAvatar(x, y, radius);
            this.avatarLoadingComplete = true;
            this.avatarLoadingPromise = Promise.resolve();
        }
    }

    private loadExternalAvatar(url: string, x: number, y: number, radius: number, onComplete?: () => void) {
        const key = `avatar_${Date.now()}`;

        this.load.image(key, url);
        this.load.once('complete', () => {
            if (this.textures.exists(key)) {
                this.avatarImage = this.add.image(x, y, key).setOrigin(0.5);
                // Scale to fit the circle
                const texture = this.textures.get(key);
                const frame = texture.getSourceImage();
                const scale = (radius * 2) / Math.min(frame.width, frame.height);
                this.avatarImage.setScale(scale);
                this.avatarImage.setMask(this.avatarMask.createGeometryMask());
            } else {
                this.createDefaultAvatar(x, y, radius);
            }
            this.avatarLoadingComplete = true;
            onComplete?.();
        });
        this.load.once('loaderror', () => {
            this.createDefaultAvatar(x, y, radius);
            this.avatarLoadingComplete = true;
            onComplete?.();
        });
        this.load.start();
    }

    private createDefaultAvatar(x: number, y: number, radius: number) {
        // Create a gray circle as default avatar
        const graphics = this.add.graphics();
        graphics.fillStyle(0xcccccc);
        graphics.fillCircle(x, y, radius);
    }

    private createLevelBadge(x: number, y: number, level: number, badgeWidth: number) {
        const badgeHeight = badgeWidth * 0.32;

        // Create badge background
        if (this.textures.exists("bg_button_active")) {
            this.levelBadge = this.add.image(x, y, "bg_button_active").setOrigin(0.5);
            this.levelBadge.setDisplaySize(badgeWidth, badgeHeight);
        } else {
            // Fallback: draw rounded rectangle
            const graphics = this.add.graphics();
            graphics.fillStyle(0x7cb342);
            graphics.fillRoundedRect(x - badgeWidth / 2, y - badgeHeight / 2, badgeWidth, badgeHeight, badgeHeight / 2);
        }

        // Level text
        this.levelText = this.add.text(x, y, `CẤP ĐỘ ${level}`, {
            fontFamily: getAppFontFamily(),
            fontSize: `${Math.floor(badgeWidth * 0.18)}px`,
            fontStyle: "bold",
            color: "#ffffff",
            align: "center",
        }).setOrigin(0.5);
    }

    private createBikeImage(x: number, y: number, level: number, targetWidth: number) {
        const bikeKey = `lv${level}`;
        if (this.textures.exists(bikeKey)) {
            this.bikeImage = this.add.image(x, y, bikeKey).setOrigin(0.5);
            this.fitWidth(this.bikeImage, targetWidth);
        }
    }

    private async captureAndShare() {
        try {
            // Capture the Phaser canvas directly
            // (requires preserveDrawingBuffer: true in Phaser config)
            const canvas = this.game.canvas;
            const base64 = canvas.toDataURL("image/png");
            // Call JS share function with the captured image
            await this.shareImage(base64);
        } catch (error) {
            console.log("Error capturing screenshot:", error);
            this.scene.start(Scence.Home);
        }
    }

    private async shareImage(base64Image: string) {
        try {
            console.log("Sharing image:", base64Image);
            await JSFunction.call({
                name: "share",
                body: {
                    image: [base64Image],
                    title: "Xế cưng Aha",
                }
            });
        } catch (error) {
            console.error("Error sharing:", error);
        } finally {
            // Return to home scene after sharing
            // this.scene.start(Scence.Home);
        }
    }

    private coverTo(img: Phaser.GameObjects.Image, width: number, height: number) {
        const scaleX = width / img.width;
        const scaleY = height / img.height;
        const scale = Math.max(scaleX, scaleY);
        img.setScale(scale);
    }

    private fitWidth(img: Phaser.GameObjects.Image, targetWidth: number) {
        const scale = targetWidth / img.width;
        img.setScale(scale);
    }
}

export default ShareScene;
