import Phaser from "phaser";

export default class BackgroundScrollScene extends Phaser.Scene {
    private tile!: Phaser.GameObjects.TileSprite;
    private speed = 20; // pixels per second
    private static readonly DISPLAY_HEIGHT = 655; // required fixed height in px
    private static readonly MARGIN_TOP = 274; // required top margin in px

    constructor() {
        super("BackgroundScrollScene");
    }

    preload() {
        this.load.image("bg_full", "/bg_full_width.png");
    }

    create() {
        // Create a tile sprite and size/position it using resize() to meet layout requirements
        this.tile = this.add.tileSprite(0, 0, 10, 10, "bg_full");
        this.tile.setOrigin(0.5);
        this.resize();
        this.scale.on("resize", this.resize, this);
    }

    private resize() {
        const {width} = this.scale;
        if (!this.tile) return;

        // Keep the image centered horizontally with a fixed display height and top margin
        const tex = this.textures.get("bg_full").getSourceImage() as HTMLImageElement;
        const aspect = tex.width / tex.height;
        const displayHeight = BackgroundScrollScene.DISPLAY_HEIGHT;
        const displayWidth = displayHeight * aspect;

        this.tile.setDisplaySize(displayWidth, displayHeight);

        const y = BackgroundScrollScene.MARGIN_TOP + displayHeight / 2;
        this.tile.setPosition(width / 2, y);
    }

    update(_time: number, delta: number) {
        if (this.tile) {
            this.tile.tilePositionX += (this.speed * delta) / 1000;
        }
    }
}