import Phaser from "phaser";
import {scaleUnit} from "@/utils/CanvasSize";

/**
 * BasePopup - reusable rounded popup with dimmed background.
 * - Rounded radius: 24
 * - Content background color: #F1F3F4
 * - Provides `root` container centered, `content` container positioned inside with padding
 * - Emits `close` when background (dim) clicked.
 */
export default class BasePopup {
  public readonly dim: Phaser.GameObjects.Rectangle;
  public readonly root: Phaser.GameObjects.Container;
  public readonly content: Phaser.GameObjects.Container;
  public readonly width: number;
  public readonly height: number;

  constructor(private scene: Phaser.Scene, opts?: { width?: number; height?: number; headerImageKey?: string; titleText?: string; }) {
    const {width: w, height: h} = scene.scale;
    const su = scaleUnit();
    const panelW = Math.min(opts?.width ?? 620 * su, w * 0.9);
    const panelH = Math.min(opts?.height ?? 980 * su, h * 0.8);
    const radius = 24 * su;

    // Dim layer
    this.dim = scene.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.55)
      .setInteractive({useHandCursor: false});

    // Root container centered
    this.root = scene.add.container(w / 2, h / 2);

    // Background with light gray
    const bg = scene.add.graphics();
    // subtle shadow
    bg.fillStyle(0x000000, 0.15);
    bg.fillRoundedRect(-panelW / 2 + 4, -panelH / 2 + 6, panelW, panelH, radius);
    // main body
    bg.lineStyle(2, 0xD7D9DD, 1);
    bg.fillStyle(0xF1F3F4, 1);
    bg.fillRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, radius);
    bg.strokeRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, radius);
    this.root.add(bg);

    // Content container with padding
    const pad = 24 * su;
    this.content = scene.add.container(-panelW / 2 + pad, -panelH / 2 + pad);
    this.root.add(this.content);

    this.width = panelW;
    this.height = panelH;

    // Close when clicking dim
    this.dim.on('pointerdown', () => this.destroy());
  }

  destroy() {
    try {
      this.dim.destroy();
    } catch {}
    try {
      this.root.destroy();
    } catch {}
  }
}
