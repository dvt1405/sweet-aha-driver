import Phaser from "phaser";
import {Scence} from "@/utils/Constants";
import {JSFunction} from "@/utils/js-function";
import {fetchProfile, initFromUrlOrStorage} from "@/services/globalApi";

export default class BootScene extends Phaser.Scene {
    constructor() {
        super(Scence.Boot);
    }

    create() {
        JSFunction.call({name: 'hide_toolbar'})
            .then(r => {
                console.log(r);
            }).catch(e => {
        });

        // Initialize token and debug mode
        initFromUrlOrStorage();

        this.doInit()
            .then(value => {

            })
            .catch((err) => {});
    }

    private async doInit() {
        let showWelcome = true;
        try {
            // Always getProfile user when first visit web
            const profile = await fetchProfile(true);

            const level = profile?.buddy?.level ?? 1;
            const balance = profile?.balance ?? 0;

            // If user is not first visit, in level > 1 or have coin > 0 never show WelcomeScene, navigate to HomeScene.
            if (level > 1 || balance > 0) {
                showWelcome = false;
            } else {
                // Also check localStorage for manual skip
                const val = typeof window !== "undefined" ? window.localStorage.getItem("welcomeSeen") : null;
                if (val === "true") {
                    showWelcome = false;
                }
            }
        } catch (e) {
            console.error("Failed to fetch profile in BootScene", e);
            // Fallback to localStorage if API fails
            try {
                const val = typeof window !== "undefined" ? window.localStorage.getItem("welcomeSeen") : null;
                showWelcome = val !== "true";
            } catch (err) {
                showWelcome = true;
            }
        }

        // Check if the scene is still active and valid before transitioning
        if (this.scene && this.scene.key === Scence.Boot) {
            if (showWelcome) {
                this.scene.start(Scence.Welcome);
            } else {
                this.scene.start(Scence.Home);
            }
        }
    }
}