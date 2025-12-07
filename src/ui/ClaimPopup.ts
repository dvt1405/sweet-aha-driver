import Phaser from "phaser";
import UiButton from "@/ui/UiButton";
import {getAppFontFamily} from "@/utils/fonts";
import {scaleUnit} from "@/utils/CanvasSize";

/**
 * ClaimPopup
 *
 * Reusable overlay popup to display a claim/bonus amount.
 * Built from existing UI elements instead of a precomposed image.
 * - Dim background
 * - Rotating burst rays behind
 * - Game header image at top (reused from main screen)
 * - Congratulation text block with themed background
 * - Yellow reward bar with amount text and coin icon
 * - Close button using UiButton
 */
export default class ClaimPopup {
    private dim!: Phaser.GameObjects.Rectangle;
    private container!: Phaser.GameObjects.Container;
    private burst!: Phaser.GameObjects.Image;
    private header?: Phaser.GameObjects.Image;
    private congratsBg?: Phaser.GameObjects.Image;
    private congratsText?: Phaser.GameObjects.Text;
    private bar!: Phaser.GameObjects.Image;
    private amountText!: Phaser.GameObjects.Text;
    private coinIcon!: Phaser.GameObjects.Image;
    private closeBtn!: UiButton;
    private tween?: Phaser.Tweens.Tween;

    constructor(private scene: Phaser.Scene, private amount: number, private onClose?: () => void) {
        const {width: w, height: h} = scene.scale;
        const su = scaleUnit();

        // Ensure required textures are available (they should be preloaded by scene)
        // keys: "burst", "main_header", "coin_bar", "coin_icon", "congrats_text_bg"

        // Dim background
        this.dim = scene.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.65)
            .setInteractive({useHandCursor: false});

        // Root container centered in screen
        this.container = scene.add.container(w / 2, h / 2);

        // Rotating burst rays
        this.burst = scene.add.image(0, -h * 0.08, "burst").setOrigin(0.5);
        const burstTarget = Math.min(w * 0.95, h * 0.95);
        const burstScale = burstTarget / Math.max(this.burst.width, this.burst.height);
        this.burst.setScale(burstScale);
        this.container.add(this.burst);

        // Gentle continuous rotation
        this.tween = scene.tweens.add({
            targets: this.burst,
            angle: 360,
            duration: 12000,
            repeat: -1,
        });

        // Header image reused from main screen with exact size and top margin per spec
        const topRef = -h / 2; // top of screen in container coordinates
        const headerWidth = 274 * su;
        const headerHeight = 183 * su;
        let headerBottom = topRef + 56 * su; // default when header texture missing
        if (scene.textures.exists("main_header")) {
            this.header = scene.add.image(0, 0, "main_header").setOrigin(0.5);
            // Size: 274*su x 183*su
            this.header.setDisplaySize(headerWidth, headerHeight);
            // Position: margin 56*su from top
            this.header.y = topRef + 56 * su + headerHeight / 2;
            headerBottom = topRef + 56 * su + headerHeight;
            this.container.add(this.header);
        }

        // Congratulation text background and text (between header and reward bar)
        const congratsMarginTop = 24 * su; // distance from header bottom to congrats block top
        const congratsTop = headerBottom + congratsMarginTop;
        const congratsTargetW = Math.max(0, w - 32 * su); // full width with 16*su horizontal margins
        let congratsHeight = 0;

        if (scene.textures.exists("congrats_text_bg")) {
            this.congratsBg = scene.add.image(0, 0, "congrats_text_bg").setOrigin(0.5);
            // Scale BG to full width minus horizontal margins
            const bgScale = congratsTargetW / this.congratsBg.width;
            this.congratsBg.setScale(bgScale);
            const bgDisplayH = this.congratsBg.height * bgScale;
            // Position background so its top is congratsTop
            this.congratsBg.y = congratsTop + bgDisplayH / 2;
            this.container.add(this.congratsBg);
            congratsHeight = bgDisplayH;
        }

        const wrapWidth = Math.round(congratsTargetW - 24 * su);
        const congratsTextStyle: Phaser.Types.GameObjects.Text.TextStyle = {
            fontFamily: getAppFontFamily(),
            fontStyle: "800",
            fontSize: 24 * su,
            color: "#FFFFFF",
            align: "center",
            stroke: "#FFFFFF",
            wordWrap: {width: wrapWidth},
            lineSpacing: 8 * su,
        };
        this.congratsText = scene.add.text(0, 0, "Điểm danh mỗi ngày\nchúc mừng tài xế\nđã nhận được", congratsTextStyle).setOrigin(0.5);
        // Position text so its TOP is 24*su below header bottom
        this.congratsText.y = congratsTop + this.congratsText.height / 2;
        this.container.add(this.congratsText);

        const textBottom = this.congratsText.y + this.congratsText.height / 2;
        const bgBottom = this.congratsBg ? (this.congratsBg.y + this.congratsBg.displayHeight / 2) : textBottom;
        const congratsSectionBottom = Math.max(textBottom, bgBottom);

        // Yellow bar for reward amount (reusing coin bar texture)
        const barW = w / 2 - 48 * su;
        const barH = barW / 156 * 32;
        this.bar = scene.add.image(0, 0, "coin_bar").setOrigin(0.5);
        this.bar.setDisplaySize(barW, barH);
        // Position: 2*su below congratsText bottom (per spec)
        this.bar.y = textBottom + 10 * su + 2 * su + barH / 2;
        this.container.add(this.bar);

        // Amount text centered in the bar, sized to fit bar height
        const amountFontSize = 18 * su;
        this.amountText = scene.add.text(0, this.bar.y, `${amount} XU`, {
            fontFamily: getAppFontFamily(),
            fontStyle: "800",
            fontSize: amountFontSize,
            color: "#9B6F00",
            align: "center",
            stroke: "#FFFFFF",
            lineSpacing: 8 * su,
            strokeThickness: 3 * su,
        }).setOrigin(0.5);
        this.container.add(this.amountText);

        // Coin icon on the right side inside the bar: height = 1.2 * bar height
        const desiredCoinH = 1.2 * barH;
        this.coinIcon = scene.add.image(0, this.bar.y, "coin_icon").setOrigin(0.5);
        this.coinIcon.setDisplaySize(desiredCoinH, desiredCoinH)
        this.coinIcon.setPosition(this.bar.x + this.bar.width / 2, this.bar.y);
        this.container.add(this.coinIcon);

        // Close button reused component
        this.closeBtn = new UiButton(scene, w / 2, h - 96 * su, "ĐÓNG", w * 0.4);
        scene.add.existing(this.closeBtn);
        this.closeBtn.onClick(() => this.close());

        // Close when tapping outside central area
        this.dim.on("pointerdown", () => this.close());

        // Bring to top
        scene.children.bringToTop(this.dim);
        scene.children.bringToTop(this.container);
        scene.children.bringToTop(this.closeBtn);
    }

    private close() {
        if (this.tween) this.tween.stop();
        try {
            this.dim.destroy();
        } catch {
        }
        try {
            this.container.destroy(true);
        } catch {
        }
        try {
            this.closeBtn.destroy();
        } catch {
        }
        if (this.onClose) this.onClose();
    }
}
