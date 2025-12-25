import Phaser from "phaser";
import UiButton from "@/ui/UiButton";
import {scaleUnit} from "@/utils/CanvasSize";
import {getAppFontFamily} from "@/utils/fonts";
import {JSFunction} from "@/utils/js-function";
import {
    getProfile,
    getSupplierProfile,
} from "@/services/globalApi";

/**
 * SharePopup
 *
 * Popup to display a share preview with the same UI as ShareScene.
 * - Dim background
 * - Preview container with ShareScene-style UI (avatar, driver name, level, bike)
 * - Share button to capture and share the image
 * - Close button to dismiss
 */
export default class SharePopup {
    private dim!: Phaser.GameObjects.Rectangle;
    private previewContainer!: Phaser.GameObjects.Container;
    private shareBtn!: UiButton;
    private closeBtn!: UiButton;
    
    // Preview UI elements
    private previewBg!: Phaser.GameObjects.Image;
    private titleImage?: Phaser.GameObjects.Image;
    private avatarImage?: Phaser.GameObjects.Image;
    private avatarMask?: Phaser.GameObjects.Graphics;
    private previewMask?: Phaser.GameObjects.Graphics;
    private congratsText!: Phaser.GameObjects.Text;
    private driverNameText!: Phaser.GameObjects.Text;
    private levelBadge?: Phaser.GameObjects.Image;
    private levelText!: Phaser.GameObjects.Text;
    private bikeImage?: Phaser.GameObjects.Image;
    private avatarLoadingPromise: Promise<void> | null = null;

    constructor(private scene: Phaser.Scene, private onClose?: () => void) {
        const {width: w, height: h} = scene.scale;
        const su = scaleUnit();

        // Get profile data
        const profile = getProfile();
        const supplierProfile = getSupplierProfile();
        const level = profile?.buddy?.level ?? 1;
        const driverName = supplierProfile?.name ?? "Tài Xế";
        const avatarUrl = supplierProfile?.avatar;

        // Dim background
        this.dim = scene.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.85)
            .setInteractive({useHandCursor: false});

        // Preview container - scaled down to fit as a preview
        const previewScale = 0.65;
        const previewWidth = w * previewScale;
        const previewHeight = h * previewScale;
        
        this.previewContainer = scene.add.container(w / 2, h * 0.42);

        // Create mask to clip content within the border bounds
        this.previewMask = scene.make.graphics({});
        this.previewMask.fillStyle(0xffffff);
        // Mask position is absolute (container position + local offset)
        this.previewMask.fillRect(
            w / 2 - previewWidth / 2,
            h * 0.42 - previewHeight / 2,
            previewWidth,
            previewHeight
        );
        this.previewContainer.setMask(this.previewMask.createGeometryMask());

        // Background - garage scene (scaled)
        this.previewBg = scene.add.image(0, 0, "bg_garage").setOrigin(0.5);
        this.coverTo(this.previewBg, previewWidth, previewHeight);
        this.previewContainer.add(this.previewBg);

        // Title image at top
        if (scene.textures.exists("main_header")) {
            this.titleImage = scene.add.image(0, -previewHeight * 0.36, "main_header").setOrigin(0.5);
            this.fitWidth(this.titleImage, previewWidth * 0.7);
            this.previewContainer.add(this.titleImage);
        }

        // Avatar position (center of preview, based on design)
        const avatarY = -previewHeight * 0.14;
        const avatarRadius = previewWidth * 0.14;

        // Create circular avatar
        this.createCircularAvatar(0, avatarY, avatarRadius, avatarUrl, previewWidth);

        // "CHÚC MỪNG TÀI XẾ" congratulations text - positioned below avatar
        this.congratsText = scene.add.text(0, previewHeight * 0.0, "CHÚC MỪNG TÀI XẾ", {
            fontFamily: getAppFontFamily(),
            fontSize: `${Math.floor(previewWidth * 0.065)}px`,
            fontStyle: "bold",
            color: "#ff8b43",
            align: "center",
        }).setOrigin(0.5);
        this.previewContainer.add(this.congratsText);

        // Driver name text - positioned below congrats text
        this.driverNameText = scene.add.text(0, previewHeight * 0.055, driverName.toUpperCase(), {
            fontFamily: getAppFontFamily(),
            fontSize: `${Math.floor(previewWidth * 0.06)}px`,
            fontStyle: "bold",
            color: "#1a5fb4",
            align: "center",
        }).setOrigin(0.5);
        this.previewContainer.add(this.driverNameText);

        // Level badge - positioned below driver name
        this.createLevelBadge(0, previewHeight * 0.115, level, previewWidth * 0.35);

        // Bike image at bottom
        this.createBikeImage(0, previewHeight * 0.32, level, previewWidth * 0.75);

        // Add border/frame effect around preview
        const border = scene.add.graphics();
        border.lineStyle(4, 0xffffff, 1);
        border.strokeRect(
            -previewWidth / 2 - 2,
            -previewHeight / 2 - 2,
            previewWidth + 4,
            previewHeight + 4
        );
        this.previewContainer.add(border);

        // Create buttons
        this.createButtons(w, h, su);

        // Close when tapping outside central area
        this.dim.on("pointerdown", () => this.close());

        // Bring to top
        scene.children.bringToTop(this.dim);
        scene.children.bringToTop(this.previewContainer);
        scene.children.bringToTop(this.shareBtn);
        scene.children.bringToTop(this.closeBtn);
    }

    private createCircularAvatar(x: number, y: number, radius: number, avatarUrl?: string, previewWidth?: number) {
        // Create circular mask using graphics
        this.avatarMask = this.scene.make.graphics({});
        this.avatarMask.fillStyle(0xffffff);
        // Calculate absolute position for mask
        const {width: w, height: h} = this.scene.scale;
        const maskX = w / 2 + x;
        const maskY = h * 0.42 + y;
        this.avatarMask.fillCircle(maskX, maskY, radius);

        // Load avatar image
        if (avatarUrl && avatarUrl.length > 0) {
            this.avatarLoadingPromise = new Promise<void>((resolve) => {
                this.loadExternalAvatar(avatarUrl, x, y, radius, maskX, maskY, resolve);
            });
        } else {
            // Create default gray circle avatar
            this.createDefaultAvatar(x, y, radius);
            this.avatarLoadingPromise = Promise.resolve();
        }
    }

    private loadExternalAvatar(url: string, x: number, y: number, radius: number, maskX: number, maskY: number, onComplete?: () => void) {
        const key = `popup_avatar_${Date.now()}`;

        this.scene.load.image(key, url);
        this.scene.load.once('complete', () => {
            if (this.scene.textures.exists(key)) {
                this.avatarImage = this.scene.add.image(x, y, key).setOrigin(0.5);
                // Scale to fit the circle
                const texture = this.scene.textures.get(key);
                const frame = texture.getSourceImage();
                const scale = (radius * 2) / Math.min(frame.width, frame.height);
                this.avatarImage.setScale(scale);
                this.avatarImage.setMask(this.avatarMask!.createGeometryMask());
                this.previewContainer.add(this.avatarImage);
                // Move avatar behind text elements
                this.previewContainer.sendToBack(this.avatarImage);
                this.previewContainer.sendToBack(this.previewBg);
            } else {
                this.createDefaultAvatar(x, y, radius);
            }
            onComplete?.();
        });
        this.scene.load.once('loaderror', () => {
            this.createDefaultAvatar(x, y, radius);
            onComplete?.();
        });
        this.scene.load.start();
    }

    private createDefaultAvatar(x: number, y: number, radius: number) {
        // Create a gray circle as default avatar
        const graphics = this.scene.add.graphics();
        graphics.fillStyle(0xcccccc);
        graphics.fillCircle(x, y, radius);
        this.previewContainer.add(graphics);
        // Move behind text elements
        this.previewContainer.sendToBack(graphics);
        this.previewContainer.sendToBack(this.previewBg);
    }

    private createLevelBadge(x: number, y: number, level: number, badgeWidth: number) {
        const badgeHeight = badgeWidth * 0.32;

        // Create badge background
        if (this.scene.textures.exists("bg_button_active")) {
            this.levelBadge = this.scene.add.image(x, y, "bg_button_active").setOrigin(0.5);
            this.levelBadge.setDisplaySize(badgeWidth, badgeHeight);
            this.previewContainer.add(this.levelBadge);
        } else {
            // Fallback: draw rounded rectangle
            const graphics = this.scene.add.graphics();
            graphics.fillStyle(0x7cb342);
            graphics.fillRoundedRect(x - badgeWidth / 2, y - badgeHeight / 2, badgeWidth, badgeHeight, badgeHeight / 2);
            this.previewContainer.add(graphics);
        }

        // Level text
        this.levelText = this.scene.add.text(x, y, `CẤP ĐỘ ${level}`, {
            fontFamily: getAppFontFamily(),
            fontSize: `${Math.floor(badgeWidth * 0.18)}px`,
            fontStyle: "bold",
            color: "#ffffff",
            align: "center",
        }).setOrigin(0.5);
        this.previewContainer.add(this.levelText);
    }

    private createBikeImage(x: number, y: number, level: number, targetWidth: number) {
        const bikeKey = `lv${level}`;
        if (this.scene.textures.exists(bikeKey)) {
            this.bikeImage = this.scene.add.image(x, y, bikeKey).setOrigin(0.5);
            this.fitWidth(this.bikeImage, targetWidth);
            this.previewContainer.add(this.bikeImage);
        }
    }

    private createButtons(w: number, h: number, su: number) {
        const buttonWidth = w * 0.35;
        const buttonY = h - 80 * su;
        const buttonSpacing = w * 0.2;

        // Share button
        this.shareBtn = new UiButton(this.scene, w / 2 - buttonSpacing, buttonY, "CHIA SẺ", buttonWidth);
        this.scene.add.existing(this.shareBtn);
        this.shareBtn.onClick(() => this.handleShare());

        // Close button
        this.closeBtn = new UiButton(this.scene, w / 2 + buttonSpacing, buttonY, "ĐÓNG", buttonWidth);
        this.scene.add.existing(this.closeBtn);
        this.closeBtn.onClick(() => this.close());
    }

    private async handleShare() {
        try {
            // Wait for avatar to load if still loading
            if (this.avatarLoadingPromise) {
                await this.avatarLoadingPromise;
            }
            
            // Hide UI elements that shouldn't be in the shared image
            this.dim.setVisible(false);
            this.shareBtn.setVisible(false);
            this.closeBtn.setVisible(false);
            
            // Small delay to ensure rendering is complete
            await new Promise<void>((resolve) => {
                this.scene.time.delayedCall(100, () => resolve());
            });

            // Capture the canvas
            const canvas = this.scene.game.canvas;
            
            // Calculate crop area based on preview container position and size
            const {width: w, height: h} = this.scene.scale;
            const previewScale = 0.65;
            const previewWidth = w * previewScale;
            const previewHeight = h * previewScale;
            const previewCenterX = w / 2;
            const previewCenterY = h * 0.42;
            
            // Calculate crop bounds (in game coordinates)
            const cropX = previewCenterX - previewWidth / 2;
            const cropY = previewCenterY - previewHeight / 2;
            
            // Scale factor from game coordinates to canvas pixels
            const scaleX = canvas.width / w;
            const scaleY = canvas.height / h;
            
            // Create a temporary canvas to crop the image
            const tempCanvas = document.createElement('canvas');
            const cropWidthPx = Math.floor(previewWidth * scaleX);
            const cropHeightPx = Math.floor(previewHeight * scaleY);
            tempCanvas.width = cropWidthPx;
            tempCanvas.height = cropHeightPx;
            
            const ctx = tempCanvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(
                    canvas,
                    Math.floor(cropX * scaleX),
                    Math.floor(cropY * scaleY),
                    cropWidthPx,
                    cropHeightPx,
                    0,
                    0,
                    cropWidthPx,
                    cropHeightPx
                );
            }
            
            const base64 = tempCanvas.toDataURL("image/png");
            
            // Restore UI elements
            this.dim.setVisible(true);
            this.shareBtn.setVisible(true);
            this.closeBtn.setVisible(true);
            
            console.log("Sharing cropped image from popup");
            await JSFunction.call({
                name: "share",
                body: {
                    image: [base64.replace(/^data:image\/(png|jpg);base64,/, "")],
                    title: "Xế cưng Aha",
                }
            });
        } catch (error) {
            console.error("Error sharing:", error);
            // Restore UI elements in case of error
            this.dim.setVisible(true);
            this.shareBtn.setVisible(true);
            this.closeBtn.setVisible(true);
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

    private close() {
        try {
            this.dim.destroy();
        } catch {
        }
        try {
            this.previewContainer.destroy(true);
        } catch {
        }
        try {
            this.shareBtn?.destroy();
        } catch {
        }
        try {
            this.closeBtn?.destroy();
        } catch {
        }
        try {
            this.avatarMask?.destroy();
        } catch {
        }
        try {
            this.previewMask?.destroy();
        } catch {
        }
        if (this.onClose) this.onClose();
    }
}
