import Phaser from "phaser";
import {scaleUnit} from "@/utils/CanvasSize";
import {getAppFontFamily} from "@/utils/fonts";
import UiButton from "@/ui/UiButton";

/**
 * BasePopup - reusable rounded popup with dimmed background.
 * - Rounded radius: 24
 * - Content background color: #F1F3F4
 * - Includes optional header badge image and title text (rendered above popup)
 * - Includes close button at bottom
 * - Provides `root` container centered, `content` container positioned inside with padding
 */
export default class BasePopup {
    public readonly dim: Phaser.GameObjects.Rectangle;
    public readonly root: Phaser.GameObjects.Container;
    public readonly content: Phaser.GameObjects.Container;
    public readonly width: number;
    public readonly height: number;
    public readonly contentHeight: number;

    private headerImg?: Phaser.GameObjects.Image;
    private headerText?: Phaser.GameObjects.Text;
    private closeBtn?: UiButton;

    constructor(private scene: Phaser.Scene, opts?: {
        width?: number;
        height?: number;
        headerImageKey?: string;
        titleText?: string;
        closeButtonText?: string;
        onClose?: () => void;
    }) {
        const {width: w, height: h} = scene.scale;
        const su = scaleUnit();
        const panelW = Math.min(opts?.width ?? 620 * su, w);
        const panelH = Math.min(opts?.height ?? 980 * su, h * 0.8);
        const radius = 24 * su;
        const topContentPadding = 48 * su;
        const contentHeight = panelH - topContentPadding;

        // Dim layer
        this.dim = scene.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.55)
            .setInteractive({useHandCursor: false});

        // Root container centered
        this.root = scene.add.container(w / 2, h / 2);

        // Background with light gray
        const bg = scene.add.graphics();
        bg.y = topContentPadding;
        // subtle shadow
        bg.fillStyle(0x000000, 0.15);
        bg.fillRoundedRect(-(panelW * 0.9) / 2, -panelH / 2 + 6, panelW * 0.9, contentHeight, radius);
        // main body
        bg.lineStyle(2, 0xD7D9DD, 1);
        bg.fillStyle(0xF1F3F4, 1);
        bg.fillRoundedRect(-(panelW * 0.9) / 2, -panelH / 2, panelW * 0.9, contentHeight, radius);
        bg.strokeRoundedRect(-(panelW * 0.9) / 2, -panelH / 2, panelW * 0.9, contentHeight, radius);
        this.root.add(bg);

        // Header badge image above popup (if provided)
        if (opts?.headerImageKey) {
            if (scene.textures.exists(opts.headerImageKey)) {
                // Image already loaded - show immediately
                this.createHeaderImage(opts.headerImageKey, opts.titleText, w, h, panelH, su);
            } else {
                // Image not loaded - load asynchronously and show when ready
                const imageKey = opts.headerImageKey;
                const imagePath = this.getImagePath(imageKey);
                if (imagePath) {
                    scene.load.image(imageKey, imagePath);
                    scene.load.once('complete', () => {
                        if (scene.textures.exists(imageKey)) {
                            this.createHeaderImage(imageKey, opts.titleText, w, h, panelH, su);
                        }
                    });
                    scene.load.start();
                }
            }
        }

        // Content container with padding (reserve space for close button at bottom)
        const pad = 24 * su;
        const closeBtnSpace = 80 * su;
        this.content = scene.add.container(-panelW / 2, -panelH / 2 + pad + topContentPadding);
        this.content.width = panelW;
        this.content.height = contentHeight - pad * 2 ;
        this.root.add(this.content);

        // Close button at bottom of popup
        const closeBtnText = opts?.closeButtonText ?? "ĐÓNG";
        this.closeBtn = new UiButton(
            scene,
            w / 2,
            h / 2 + panelH / 2,
            closeBtnText,
            panelW * 0.5,
            true,
            false
        );
        scene.add.existing(this.closeBtn);
        this.closeBtn.setFontSize(Math.round(20 * su));
        this.closeBtn.onClick(() => {
            if (opts?.onClose) opts.onClose();
            this.destroy();
        });

        this.content.on("pointerdown", () => {
        })

        // Dim click: close only when clicking OUTSIDE the content area
        this.dim.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            const contentWorldX = this.root.x + this.content.x;
            const contentWorldY = this.root.y + this.content.y;
            const contentRect = new Phaser.Geom.Rectangle(
                contentWorldX,
                contentWorldY,
                this.content.width ?? 0,
                this.content.height ?? 0
            );
            const clickedInsideContent = Phaser.Geom.Rectangle.Contains(contentRect, pointer.x, pointer.y);

            if (!clickedInsideContent) {
                if (opts?.onClose) opts.onClose();
                this.destroy();
            }
        });

        this.width = panelW;
        this.height = panelH;
        this.contentHeight = panelH - 2 * pad - closeBtnSpace;

        // Ensure proper z-ordering
        scene.children.bringToTop(this.dim);
        scene.children.bringToTop(this.root);
        if (this.content) scene.children.bringToTop(this.content);
        if (this.headerImg) scene.children.bringToTop(this.headerImg);
        if (this.headerText) scene.children.bringToTop(this.headerText);
        if (this.closeBtn) scene.children.bringToTop(this.closeBtn);
    }

    private createHeaderImage(imageKey: string, titleText: string | undefined, w: number, h: number, panelH: number, su: number) {
        // Create header badge image positioned relative to popup center
        // Position at top edge of popup (coordinates relative to root container at w/2, h/2)
        this.headerImg = this.scene.add.image(
            0,
            -panelH / 2,
            imageKey
        ).setOrigin(0.5);
        const titleTargetW = Math.min(300 * su, w * 0.65);
        this.headerImg.setScale(titleTargetW / this.headerImg.width);

        // Add header image to root container so it's destroyed with popup
        this.root.add(this.headerImg);
        // Title text on header badge (if provided)
        if (titleText) {
            this.headerText = this.scene.add.text(
                0,
                this.headerImg.y,
                titleText,
                {
                    fontFamily: getAppFontFamily(),
                    fontStyle: "800",
                    fontSize: Math.round(28 * su),
                    color: "#9B6F00",
                    stroke: "#FFFFFF",
                    strokeThickness: Math.max(2, Math.round(3 * su)),
                }
            ).setOrigin(0.5);

            // Add header text to root container so it's destroyed with popup
            this.root.add(this.headerText);
        }

        // Ensure proper z-ordering within root container
        if (this.headerImg) this.root.bringToTop(this.headerImg);
        if (this.headerText) this.root.bringToTop(this.headerText);
    }

    private getImagePath(imageKey: string): string | null {
        // Map known image keys to their file paths
        const imageMap: Record<string, string> = {
            'popup_header': '/bg_btn_header_popup.png',
            'coin_history_empty': '/histoty_empty_content.png',
        };
        return imageMap[imageKey] ?? null;
    }

    destroy() {
        try {
            this.dim.destroy();
        } catch {
        }
        try {
            this.root.destroy();
        } catch {
        }
        try {
            this.headerImg?.destroy();
        } catch {
        }
        try {
            this.headerText?.destroy();
        } catch {
        }
        try {
            this.closeBtn?.destroy();
        } catch {
        }
    }
}
