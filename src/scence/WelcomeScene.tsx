// Welcome scene that composes the mock with burst + bike animations
import Phaser from "phaser";

export class WelcomeScene extends Phaser.Scene {
    private bg!: Phaser.GameObjects.Image;
    private coinBar!: Phaser.GameObjects.Image;
    private coinIcon!: Phaser.GameObjects.Image;
    private shareIcon!: Phaser.GameObjects.Image;
    private titleImage?: Phaser.GameObjects.Image;
    private titleText?: Phaser.GameObjects.Text;
    private congratsText!: Phaser.GameObjects.Text;
    private levelButton!: Phaser.GameObjects.Image;
    private levelButtonLabel!: Phaser.GameObjects.Text;
    private burst!: Phaser.GameObjects.Image;
    private bike!: Phaser.GameObjects.Image;
    private closeBtn!: Phaser.GameObjects.Image;

    constructor() {
        super("WelcomeScene");
    }

    preload() {
        this.load.image("bg_garage", "/main_background.png");
        this.load.image("coin_bar", "/background_aha_xua.png");
        this.load.image("coin_icon", "/aha_xu.png");
        this.load.image("share", "/ic_share.png");
        this.load.image("button", "/button.png");
        this.load.image("btn_close", "/btn_close.png");
        this.load.image("burst", "/burst.png");
        this.load.image("bike", "/ic_bike.png");
        // Optional header image (may not exist in repo). Load but fall back to text.
        this.load.image("main_header", "/main_header.png");
    }

    create() {
        const {width, height} = this.scale;

        // Background cover
        this.bg = this.add.image(width / 2, height / 2, "bg_garage").setOrigin(0.5);
        this.coverTo(this.bg, width, height);

        // Top coin bar
        this.coinBar = this.add.image(width / 2, height * 0.09, "coin_bar").setOrigin(0.5);
        this.fitHeight(this.coinBar, height * 0.055); // bar height relative

        // Coin icon overlapping right edge
        this.coinIcon = this.add.image(0, 0, "coin_icon").setOrigin(0.5);
        this.fitHeight(this.coinIcon, this.coinBar.displayHeight * 1.2);

        // Share icon top-right
        this.shareIcon = this.add.image(width - 40, height * 0.09, "share").setOrigin(0.5);
        this.fitHeight(this.shareIcon, height * 0.055);
        this.shareIcon.setInteractive({useHandCursor: true});

        // Title: prefer image, else text
        if (this.textures.exists("main_header")) {
            this.titleImage = this.add.image(width / 2, height * 0.26, "main_header").setOrigin(0.5);
            this.fitWidth(this.titleImage, width * 0.8);
        } else {
            this.titleText = this.add.text(width / 2, height * 0.26, "XẾ CÙNG\nAHA", {
                fontFamily: '"Baloo 2", Baloo, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial',
                fontSize: `${Math.round(height * 0.06)}px`,
                color: "#ff8b43",
                align: "center",
                stroke: "#0e4370",
                strokeThickness: Math.max(6, Math.floor(width * 0.01)),
            }).setOrigin(0.5);
        }

        // Congrats text block
        const congrats = "CHÚC MỪNG TÀI XẾ\nĐÃ ĐẠT ĐƯỢC".toUpperCase();
        this.congratsText = this.add.text(width / 2, height * 0.48, congrats, {
                fontFamily: '"Baloo 2", Baloo, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial',
                fontStyle: 'normal', // 400 regular
                fontSize: '24px',
                color: "#ffffff",
                align: "center",
                wordWrap: {width: width * 0.8},
            }
        ).setOrigin(0.5);
        // Target line-height of 32px with 24px font-size => ~8px extra spacing between lines
        this.congratsText.setLineSpacing(8);
        // Ensure Baloo 2 is applied once it finishes loading so metrics (wrap/position) are correct
        try {
            // @ts-ignore - document.fonts may not exist in some environments
            document?.fonts?.load?.('400 24px "Baloo 2"').then(() => {
                    this.congratsText.setFontFamily('"Baloo 2", Baloo, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial');
                }
            );
        } catch {
        }

        // Level button with label
        this.levelButton = this.add.image(width / 2, height * 0.55, "button").setOrigin(0.5);
        this.fitWidth(this.levelButton, width * 0.5);
        this.levelButton.setInteractive({useHandCursor: true});
        this.levelButtonLabel = this.add.text(this.levelButton.x, this.levelButton.y, "CẤP ĐỘ 1", {
            fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial',
            fontStyle: '900',
            fontSize: `${Math.round(height * 0.035)}px`,
            color: "#ffffff",
            align: "center",
            stroke: "#2a7a2a",
            strokeThickness: Math.max(2, Math.floor(width * 0.005)),
        }).setOrigin(0.5);

        // Burst behind the bike
        this.burst = this.add.image(width / 2, height * 0.78, "burst").setOrigin(0.5).setAlpha(0.9);
        this.fitWidth(this.burst, width * 0.95);
        this.tweens.add({targets: this.burst, angle: 360, duration: 12000, repeat: -1, ease: 'Linear'});
        this.tweens.add({
            targets: this.burst,
            scale: {from: this.burst.scale * 0.96, to: this.burst.scale * 1.04},
            duration: 2000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Bike in front of burst
        this.bike = this.add.image(width / 2, height * 0.86, "bike").setOrigin(0.5);
        this.fitWidth(this.bike, width * 0.85);
        this.tweens.add({
            targets: this.bike,
            angle: {from: -3, to: 3},
            duration: 1600,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Close button at bottom
        this.closeBtn = this.add.image(width / 2, height * 0.94, "btn_close").setOrigin(0.5);
        this.fitWidth(this.closeBtn, width * 0.5);
        this.closeBtn.setInteractive({useHandCursor: true}).on('pointerdown', () => {
            this.tweens.add({
                targets: this.children.getChildren(),
                alpha: 0,
                duration: 300,
                onComplete: () => this.scene.restart()
            });
        });

        // Make the coin text on bar
        const coinText = this.add.text(0, 0, "0 XU".toUpperCase(), {
            fontFamily: 'Baloo, "Baloo 2", system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial',
            fontStyle: 'normal',
            fontSize: '18px',
            color: '#3f3a15',
            align: 'center',
            stroke: '#FFFFFF',
            strokeThickness: 2,
        }).setOrigin(0.5);

        // Position coin icon and coin text relative to bar
        const layout = () => {
            const {width: w, height: h} = this.scale;
            this.coverTo(this.bg, w, h);
            this.coinBar.setPosition(w / 2, h * 0.09);
            this.fitHeight(this.coinBar, h * 0.055);
            this.fitHeight(this.coinIcon, this.coinBar.displayHeight * 1.2);
            this.coinIcon.setPosition(this.coinBar.x + this.coinBar.displayWidth / 2 - this.coinIcon.displayWidth * 0.6, this.coinBar.y);
            this.shareIcon.setPosition(w - this.shareIcon.displayWidth, h * 0.09);
            this.fitHeight(this.shareIcon, h * 0.055);

            if (this.titleImage) {
                this.titleImage.setPosition(w / 2, h * 0.26);
                this.fitWidth(this.titleImage, w * 0.8);
            }
            if (this.titleText) {
                this.titleText.setPosition(w / 2, h * 0.26);
                this.titleText.setFontSize(Math.round(h * 0.06));
                this.titleText.setStroke('#0e4370', Math.max(6, Math.floor(w * 0.01)));
            }

            this.congratsText.setPosition(w / 2, h * 0.48);
            this.congratsText.setWordWrapWidth(w * 0.8);

            this.levelButton.setPosition(w / 2, h * 0.55);
            this.fitWidth(this.levelButton, w * 0.5);
            this.levelButtonLabel.setPosition(this.levelButton.x, this.levelButton.y);
            this.levelButtonLabel.setFontSize(Math.round(h * 0.035));

            this.burst.setPosition(w / 2, h * 0.78);
            this.fitWidth(this.burst, w * 0.95);
            this.bike.setPosition(w / 2, h * 0.86);
            this.fitWidth(this.bike, w * 0.85);

            this.closeBtn.setPosition(w / 2, h * 0.94);
            this.fitWidth(this.closeBtn, w * 0.5);
            this.closeBtn.width = w * 0.3;

            coinText.setFontSize(Math.round(h * 0.034));
            coinText.setPosition(this.coinBar.x, this.coinBar.y);
        };

        layout();
        this.scale.on('resize', layout);
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
}
