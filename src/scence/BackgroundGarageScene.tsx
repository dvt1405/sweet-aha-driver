import Phaser from "phaser";


// Background scene 1: static garage background that covers the screen
export default class BackgroundGarageScene extends Phaser.Scene {
    private bg!: Phaser.GameObjects.Image;

    constructor() {
        super("BackgroundGarageScene");
    }

    preload() {
        this.load.image("bg_garage", "/main_background.png");
    }

    create() {
        const {width, height} = this.scale;
        this.bg = this.add.image(width / 2, height / 2, "bg_garage").setOrigin(0.5);
        this.resize();

        // Subtle ambient animation: slow scale pulsing
        this.tweens.add({
            targets: this.bg,
            scale: {from: this.bg.scale, to: this.bg.scale * 1.02},
            duration: 4000,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut",
        });

        this.scale.on("resize", this.resize, this);
    }

    private resize() {
        if (!this.bg) return;
        const {width, height} = this.scale;
        const tex = this.textures.get("bg_garage").getSourceImage() as HTMLImageElement;
        const rw = tex.width;
        const rh = tex.height;
        // cover the area while preserving aspect
        const s = Math.max(width / rw, height / rh);
        this.bg.setDisplaySize(rw * s, rh * s);
        this.bg.setPosition(width / 2, height / 2);
    }
}

// Background scene 2: horizontally scrolling seamless background

