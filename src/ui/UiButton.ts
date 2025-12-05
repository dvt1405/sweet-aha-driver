import Phaser from "phaser";
import {getAppFontFamily, loadAppFont} from "@/utils/fonts";
import {scaleUnit} from "@/utils/CanvasSize";

/**
 * UiButton - Reusable Phaser button component with an image background and styled text.
 *
 * Default texture keys: "bg_button_active" (enabled) and "bg_button_disable" (disabled).
 * Ensure both textures are preloaded in your Scene.
 *
 * Usage:
 *   const btn = new UiButton(this, x, y, "Play", 280);
 *   this.add.existing(btn);
 *   btn.onClick(() => console.log('clicked'));
 *   btn.setEnabled(false); // switch to disabled visuals and block interactions
 */
export default class UiButton extends Phaser.GameObjects.Container {
    private bg: Phaser.GameObjects.Image;
    private label: Phaser.GameObjects.Text;

    private _enabled = true;
    private _targetWidth?: number;
    private _activeKey = "bg_button_active";
    private _disabledKey = "bg_button_disable";
    private _progressKey = "bg_progress_active"
    private _onClick: () => void = () => {
    };

    constructor(
        scene: Phaser.Scene,
        x: number,
        y: number,
        text: string,
        targetWidth?: number,
        enable?: boolean,
        isProgress?: boolean
    ) {
        super(scene, x, y);


        // Background image (must be preloaded)
        this._enabled = enable ?? true;

        const bgKey = isProgress ?
            (this._enabled ? this._progressKey : this._disabledKey)
            : (this._enabled ? this._activeKey : this._disabledKey);

        this.bg = scene.add.image(0, 0, bgKey)
            .setInteractive({useHandCursor: true})
            .on("pointerdown", () => {
                if (this._enabled) this._onClick();
            })
            .setOrigin(0.5);

        // Create the text label with the requested styling (enabled by default)
        const fontFamily = getAppFontFamily();
        this.label = scene.add.text(0, 0, (text ?? "").toUpperCase(), {
            fontFamily,
            fontStyle: "700", // 400 regular
            fontSize: 24 * scaleUnit(),
            color: "#6B7C0E",
            align: "center",
            lineSpacing: 8 * scaleUnit(),
            stroke: "#FFFFFF", // emulate -webkit-text-stroke: 2px #FFF
            strokeThickness: 3 * scaleUnit(),
            padding: {top: 2 * scaleUnit(), bottom: scaleUnit()},
        }).setOrigin(0.5);

        // Shadow: 0 2px 4px rgba(0, 0, 0, 0.10)
        this.label.setShadow(0, 2, "rgba(0,0,0,0.10)", 4, true, true);
        // Letter spacing (if supported by current Phaser version)
        // @ts-ignore - setLetterSpacing may not exist in some Phaser versions
        this.label.setLetterSpacing?.(-0.32);

        // Add children to container
        this.add([this.bg, this.label]);

        // Apply width and interactive hit area
        if (targetWidth) this._targetWidth = targetWidth;
        if (this._targetWidth && this.bg.width > 0) {
            const scale = this._targetWidth / this.bg.width;
            this.bg.setScale(scale);
        }
        this.updateHitArea();
        this.updateInteractive();

        // Hover / press feedback
        this.on("pointerover", () => this._enabled && this.tweenScale(1.03));
        this.on("pointerout", () => this._enabled && this.tweenScale(1));
        this.on("pointerdown", () => this._enabled && this.tweenScale(0.97));
        this.on("pointerup", () => this._enabled && this.tweenScale(1));

        // Ensure app font is applied once the font loads (no-op on SSR)
        loadAppFont(20, '800')
            .then(() => {
                this.label.setFontFamily(getAppFontFamily());
            })
            .catch(() => {
            });
    }

    /** Set or get enabled state */
    public setEnabled(enabled: boolean) {
        if (this._enabled === enabled) return this;
        this._enabled = enabled;

        // Swap texture
        const key = enabled ? this._activeKey : this._disabledKey;
        this.bg.setTexture(key);

        // Re-apply target width scaling after texture swap
        if (this._targetWidth && this.bg.width > 0) {
            const scale = this._targetWidth / this.bg.width;
            this.bg.setScale(scale);
        }
        this.updateHitArea();

        // Update label color per state
        if (enabled) {
            this.label.setColor("#6B7C0E");
        } else {
            this.label.setColor(this.getDisabledColor());
        }

        // Toggle interactivity
        this.updateInteractive();
        return this;
    }

    public setDisabled(disabled: boolean) {
        return this.setEnabled(!disabled);
    }

    public isEnabled() {
        return this._enabled;
    }

    /** Optional: override texture keys for states */
    public setTextures(activeKey: string, disabledKey?: string) {
        this._activeKey = activeKey || this._activeKey;
        if (disabledKey) this._disabledKey = disabledKey;
        // Refresh current texture according to state
        return this.setEnabled(this._enabled);
    }

    public setText(text: string) {
        this.label.setText((text ?? "").toUpperCase());
        return this;
    }

    public onClick(cb: () => void) {
        this._onClick = cb;
        if (this.input) {
            this.input.cursor = 'pointer';
        }
        return this;
    }

    public setTargetWidth(width: number) {
        if (!width || this.bg.width === 0) {
            this._targetWidth = width;
            return this;
        }
        this._targetWidth = width;
        const scale = width / this.bg.width;
        this.bg.setScale(scale);
        this.updateHitArea();
        this.updateInteractive();
        return this;
    }

    private updateHitArea() {
        const w = this.bg.displayWidth;
        const h = this.bg.displayHeight;
        this.setSize(w, h);
        this.removeInteractive();
        if (this._enabled) {
            // For Containers positioned by center with children at (0,0),
            // the local hit area must be centered as well
            this.setInteractive(
                new Phaser.Geom.Rectangle(0, 0, w, h),
                Phaser.Geom.Rectangle.Contains
            );
        }
    }

    private updateInteractive() {
        // Ensure input enabled/disabled matches state
        if (!this._enabled) {
            this.removeInteractive();
        } else {
            const w = this.width, h = this.height;
            // Center the hit area on the container's position
            this.setInteractive(
                new Phaser.Geom.Rectangle(0, 0, w, h),
                Phaser.Geom.Rectangle.Contains
            );
        }
    }

    private getDisabledColor() {
        try {
            const v = getComputedStyle(document.documentElement).getPropertyValue('--Base-Gray-Gray-40').trim();
            return v || '#99A0AA';
        } catch {
            return '#99A0AA';
        }
    }

    private tweenScale(to: number) {
        this.scene.tweens.add({
            targets: this,
            scale: to,
            duration: 100,
            ease: "Quad.easeOut",
        });
    }

    setFontSize(number: number) {
        this.label.setFontSize(number);
    }
}
