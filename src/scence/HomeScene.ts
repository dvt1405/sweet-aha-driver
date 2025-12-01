import Phaser from "phaser";
import {Scence} from "@/utils/Constants";
import UiButton from "@/ui/UiButton";
import {getAppFontFamily} from "@/utils/fonts";
import {scaleUnit} from "@/utils/CanvasSize";

export class HomeScene extends Phaser.Scene {
    private bg!: Phaser.GameObjects.Image;
    private coinBar!: Phaser.GameObjects.Image;
    private coinIcon!: Phaser.GameObjects.Image;
    private shareIcon!: Phaser.GameObjects.Image;
    private titleImage?: Phaser.GameObjects.Image;
    private titleText?: Phaser.GameObjects.Text;

    private btnCheckIn!: UiButton;
    private btnUpgrade!: UiButton;
    private btnHistory!: UiButton;
    private btnGuide!: UiButton;

    private bike!: Phaser.GameObjects.Image;
    private levelButton!: UiButton;

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

        this.btnUpgrade = new UiButton(this, w * 0.7, h * 0.40, "NÂNG CẤP XE", w * 0.42, false);
        this.add.existing(this.btnUpgrade);

        this.btnHistory = new UiButton(this, w * 0.3, h * 0.48, "LỊCH SỬ XU", w * 0.42);
        this.add.existing(this.btnHistory);

        this.btnGuide = new UiButton(this, w * 0.7, h * 0.48, "HƯỚNG DẪN", w * 0.42);
        this.add.existing(this.btnGuide);
        this.btnGuide.onClick(() => {
            // Launch guide as overlay
            this.scene.launch(Scence.Guide);
            this.scene.bringToTop(Scence.Guide);
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
        const coinText = this.add.text(0, 0, "0 XU".toUpperCase(), {
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
            coinText.setPosition(this.coinBar.x, this.coinBar.y);

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
    }

    update() {}

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