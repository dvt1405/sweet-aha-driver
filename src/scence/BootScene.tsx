import Phaser from "phaser";
import { Scence } from "@/utils/Constants";

export default class BootScene extends Phaser.Scene {
    constructor() {
        super(Scence.Boot);
    }

    create() {
        // Decide which scene to start based on localStorage flag set when user closes WelcomeScene
        let showWelcome = true;
        try {
            const val = typeof window !== "undefined" ? window.localStorage.getItem("welcomeSeen") : null;
            showWelcome = val !== "true"; // show welcome if not seen yet
        } catch (e) {
            // If localStorage unavailable, fall back to showing Welcome
            showWelcome = true;
        }

        if (showWelcome) {
            this.scene.start(Scence.Welcome);
        } else {
            this.scene.start(Scence.Home);
        }
    }
}