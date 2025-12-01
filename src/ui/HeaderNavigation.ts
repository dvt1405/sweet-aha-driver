import Phaser from "phaser";
import {scaleUnit} from "@/utils/CanvasSize";

export default class HeaderNavigation extends Phaser.GameObjects.Container {
    coinBar!: Phaser.GameObjects.Image;
    coinIcon!: Phaser.GameObjects.Image;
    shareIcon!: Phaser.GameObjects.Image;
    backIcon!: Phaser.GameObjects.Image;

    constructor(scene: Phaser.Scene, x?: number, y?: number,
                width?: number, height?: number,) {
        super(scene, x, y);
    }

    preload() {
        // this.load.image("bg_garage", "/main_background.png");
        // this.load.image("coin_bar", "/background_aha_xua.png");
        // this.load.image("coin_icon", "/aha_xu.png");
        // this.load.image("share", "/ic_share.png");
        // this.load.image("button", "/bg_progress_active.png");
        // this.load.image("bg_button_active", "/bg_button_active.png");
        // this.load.image("bg_button_disable", "/bg_button_disable.png");
        // this.load.image("bg_progress_active", "/bg_progress_active.png");
        // this.load.image("burst", "/burst.png");
    }

    // coin_bar need preloaded
    create() {
        this.coinBar = this.scene.add.image(this.width / 2, this.y, "coin_bar")
            .setOrigin(0.5);
        this.coinIcon = this.scene.add.image(this.width * 0.05, this.y, "coin_icon")
            .setOrigin(0.5);
        this.shareIcon = this.scene.add.image(this.x + this.width - 16 * scaleUnit(), this.y, "share")
            .setOrigin(0.5);
        this.shareIcon.setPosition(

        )
        this.backIcon = this.scene.add.image(16 * scaleUnit(), this.height * 0.078, "back")
            .setOrigin(0.5);
    }

    update(...args: any[]) {
        super.update(...args);
    }
}
