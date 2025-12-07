import Phaser from 'phaser';
import {scaleUnit} from '@/utils/CanvasSize';
import {getAppFontFamily} from '@/utils/fonts';

export type CoinBarOptions = {
  // Preferred size controls (keep 156:32 aspect by default)
  width?: number;
  height?: number;
  // Text
  text?: string;
  fontSize?: number; // px
  textColor?: string; // css hex
  fontStyle?: string; // weight string like "700"
  stroke?: string;
  strokeThickness?: number;
  align?: CanvasTextAlign | 'left' | 'center' | 'right';
  // Textures
  barTextureKey?: string; // default: 'coin_bar'
  iconTextureKey?: string; // default: 'coin_icon'
};

/**
 * CoinBar component: a single reusable UI control that bundles
 *  - the yellow coin bar background (156:32 aspect)
 *  - the centered coin text
 *  - the right overlapping coin icon (size = 1.2 × bar height)
 *
 * All dimensions default to scaleUnit() based sizing:
 *  - Bar default: 156*su × 32*su
 *  - Text default style per spec
 *  - Icon default: 44*su × 44*su (i.e., 1.2 × 32*su)
 */
export default class CoinBar extends Phaser.GameObjects.Container {
  static readonly BAR_ASPECT = 156 / 32; // width / height

  private bar!: Phaser.GameObjects.Image;
  private text!: Phaser.GameObjects.Text;
  private icon!: Phaser.GameObjects.Image;

  private _width = 0; // desired bar display width
  private _height = 0; // desired bar display height

  private opts: Required<CoinBarOptions>;

  constructor(scene: Phaser.Scene, x: number, y: number, opts: CoinBarOptions = {}) {
    super(scene, x, y);

    const su = scaleUnit();

    // Build defaults from spec
    const defaults: Required<CoinBarOptions> = {
      width: 156 * su,
      height: 32 * su,
      text: '0 XU',
      fontSize: 18 * su,
      textColor: '#9B6F00',
      fontStyle: '700',
      stroke: '#FFFFFF',
      strokeThickness: 2 * su,
      align: 'center',
      barTextureKey: 'coin_bar',
      iconTextureKey: 'coin_icon',
    } as Required<CoinBarOptions>;

    this.opts = { ...defaults, ...opts } as Required<CoinBarOptions>;

    // Normalize width/height to keep aspect unless both provided
    if (this.opts.width && !this.opts.height) {
      this._width = this.opts.width;
      this._height = Math.round(this._width / CoinBar.BAR_ASPECT);
    } else if (this.opts.height && !this.opts.width) {
      this._height = this.opts.height;
      this._width = Math.round(this._height * CoinBar.BAR_ASPECT);
    } else {
      this._width = this.opts.width;
      this._height = this.opts.height;
    }

    // Create children
    this.bar = scene.add.image(0, 0, this.opts.barTextureKey).setOrigin(0.5);
    this.text = scene.add.text(0, 0, (this.opts.text || '').toUpperCase(), {
      fontFamily: getAppFontFamily(),
      fontStyle: this.opts.fontStyle,
      fontSize: this.opts.fontSize,
      color: this.opts.textColor,
      align: this.opts.align as any,
      stroke: this.opts.stroke,
      strokeThickness: this.opts.strokeThickness,
    }).setOrigin(0.5);
    this.icon = scene.add.image(0, 0, this.opts.iconTextureKey).setOrigin(0.5);

    this.add([this.bar, this.text, this.icon]);

    this.setSize(this._width, this._height);
    this.layout();
  }

  /** Update layout according to current width/height and options */
  layout() {
    const h = this._height > 0 ? this._height : 32 * scaleUnit();
    const w = this._width > 0 ? this._width : Math.round(h * CoinBar.BAR_ASPECT);

    // Scale bar to (w, h)
    this.bar.setDisplaySize(w, h);

    // Centered text
    this.text.setPosition(0, 0);

    // Icon: height = 1.2 * bar height (default ~44*su) and placed at the right edge center
    const iconH = h * 1.2;
    this.icon.setDisplaySize(iconH, iconH);
    this.icon.setPosition(w / 2 - iconH / 2, 0);

    // Update container size to the bar bounds
    this.setSize(w, h);
  }

  // Sizing helpers
  setBarHeight(height: number) {
    this._height = height;
    this._width = Math.round(height * CoinBar.BAR_ASPECT);
    this.layout();
    return this;
  }

  setBarWidth(width: number) {
    this._width = width;
    this._height = Math.round(width / CoinBar.BAR_ASPECT);
    this.layout();
    return this;
  }

  // Content helpers
  setValue(text: string) {
    this.text.setText((text || '').toUpperCase());
    return this;
  }

  setFontSize(px: number) {
    this.text.setFontSize(px);
    return this;
  }

  setTextColor(color: string) {
    this.text.setColor(color);
    return this;
  }


  /** Expose some measurements for layout code */
  getBarHeight() { return this._height; }
  getBarWidth() { return this._width; }

  getBottomCenter(): Phaser.Math.Vector2 {
    return new Phaser.Math.Vector2(this.x, this.y + this._height / 2);
  }

  /** Access to inner objects when needed */
  get barImage() { return this.bar; }
  get iconImage() { return this.icon; }
  get textObject() { return this.text; }
}
