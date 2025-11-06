import Phaser from "phaser";

export default class BikeScene extends Phaser.Scene {
    private bike!: Phaser.GameObjects.Image;
    private direction = 1;
    private activeBg: "garage" | "scroll" = "garage";

    constructor() {
        super("BikeScene");
    }

    preload() {
        this.load.image("bike", "/ic_bike.png");
    }

    create() {
        const {width, height} = this.scale;
        this.bike = this.add.image(width * 0.1, height * 0.65, "bike");
        // scale the bike relative to screen height for mobile friendliness
        const desiredHeight = height * 0.18;
        const tex = this.textures.get("bike").getSourceImage() as HTMLImageElement;
        const scale = desiredHeight / tex.height;
        this.bike.setScale(scale);
        this.bike.setOrigin(0.5);

        // Animate: move across and back with gentle rocking
        this.tweens.add({
            targets: this.bike,
            x: {from: width * 0.1, to: width * 0.9},
            angle: {from: -8, to: 8},
            duration: 2500,
            ease: "Sine.easeInOut",
            yoyo: true,
            repeat: -1,
            onYoyo: () => this.flipDirection(false),
            onRepeat: () => this.flipDirection(true),
        });

        // Tap/click to toggle background scenes while keeping this scene
        this.input.on("pointerdown", () => this.toggleBackground());

        // Ensure this scene renders above background
        this.scene.bringToTop();

        this.scale.on("resize", this.onResize, this);
    }

    private onResize() {
        const {width, height} = this.scale;
        const desiredHeight = height * 0.18;
        const tex = this.textures.get("bike").getSourceImage() as HTMLImageElement;
        const scale = desiredHeight / tex.height;
        this.bike.setScale(scale);
        this.bike.setY(height * 0.65);
    }

    private flipDirection(_repeated: boolean) {
        this.direction *= -1;
        this.bike.setFlipX(this.direction < 0);
    }

    private toggleBackground() {
        if (this.activeBg === "garage") {
            // switch to scrolling bg
            if (!this.scene.isActive("BackgroundScrollScene")) {
                this.scene.launch("BackgroundScrollScene");
            }
            if (this.scene.isActive("BackgroundGarageScene")) {
                this.scene.stop("BackgroundGarageScene");
            }
            this.scene.sendToBack("BackgroundScrollScene");
            this.scene.bringToTop();
            this.activeBg = "scroll";
        } else {
            if (!this.scene.isActive("BackgroundGarageScene")) {
                this.scene.launch("BackgroundGarageScene");
            }
            if (this.scene.isActive("BackgroundScrollScene")) {
                this.scene.stop("BackgroundScrollScene");
            }
            this.scene.sendToBack("BackgroundGarageScene");
            this.scene.bringToTop();
            this.activeBg = "garage";
        }
    }
}
