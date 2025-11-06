import Phaser from "phaser";

export default class BootScene extends Phaser.Scene {
    constructor() {
        super("BootScene");
    }

    create() {
        this.scene.setVisible(true, "WelcomeScene");
        // this.scene.launch("WelcomeScene");
        this.scene.stop();
    }
}