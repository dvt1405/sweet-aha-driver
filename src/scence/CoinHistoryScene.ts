import Phaser from "phaser";
import UiButton from "@/ui/UiButton";
import {getAppFontFamily} from "@/utils/fonts";
import {scaleUnit} from "@/utils/CanvasSize";
import {Scence} from "@/utils/Constants";

export type CoinHistoryItem = {
  title: string;
  date: string; // dd/MM/yyyy
  amount: number; // positive or negative
};

/**
 * CoinHistoryScene
 * - Modal overlay displaying coin transactions history
 * - Shows an empty state when there is no data
 * - Reuses UiButton and existing font styles
 */
export default class CoinHistoryScene extends Phaser.Scene {
  private dim!: Phaser.GameObjects.Rectangle;
  private panel!: Phaser.GameObjects.Container;
  private content!: Phaser.GameObjects.Container;
  private maskGfx!: Phaser.GameObjects.Graphics;
  private scrollTrack!: Phaser.GameObjects.Graphics;
  private scrollThumb!: Phaser.GameObjects.Graphics;
  private closeBtn!: UiButton;

  private viewH = 0;
  private contentH = 0;
  private scrollY = 0;
  private panelW = 0;
  private panelH = 0;

  constructor() {
    super(Scence.CoinHistory);
  }

  preload() {
    // Optional illustration for empty state (already present in /public)
    if (!this.textures.exists("coin_history_empty")) {
      this.load.image("coin_history_empty", "/xu history-empty.png");
    }
  }

  create(data: {items?: CoinHistoryItem[]}) {
    const items: CoinHistoryItem[] = data?.items ?? (this.registry.get('coinHistory') as CoinHistoryItem[] ?? []);
    const {width: w, height: h} = this.scale;
    const su = scaleUnit();

    // Dim background
    this.dim = this.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.55)
      .setInteractive({useHandCursor: false});
    this.dim.on("pointerdown", () => this.stop());

    // Panel container
    this.panel = this.add.container(w / 2, h / 2);

    const panelW = Math.min(620 * su, w * 0.9);
    const panelH = Math.min(980 * su, h * 0.8);
    const radius = 24 * su;

    const bg = this.add.graphics();
    // shadow
    bg.fillStyle(0x000000, 0.15);
    bg.fillRoundedRect(-panelW / 2 + 4, -panelH / 2 + 6, panelW, panelH, radius);
    // body
    bg.lineStyle(2, 0xD7D9DD, 1);
    bg.fillStyle(0xffffff, 1);
    bg.fillRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, radius);
    bg.strokeRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, radius);
    this.panel.add(bg);

    // Title badge
    const titleImg = this.add.image(0, -panelH / 2 - 28 * su, "bg_button_active").setOrigin(0.5);
    const titleTargetW = Math.min(320 * su, w * 0.7);
    const titleScale = titleTargetW / titleImg.width;
    titleImg.setScale(titleScale);
    const titleText = this.add.text(0, titleImg.y, "LỊCH SỬ XU", {
      fontFamily: getAppFontFamily(),
      fontStyle: "800",
      fontSize: Math.round(32 * su),
      color: "#6B7C0E",
      stroke: "#FFFFFF",
      strokeThickness: Math.max(3, Math.round(4 * su)),
    }).setOrigin(0.5);
    this.panel.add([titleImg, titleText]);

    // inner content container
    const padX = 24 * su;
    const padY = 20 * su;
    const listW = panelW - padX * 2;
    const listH = panelH - padY * 2 - 90 * su;

    this.content = this.add.container(-panelW / 2 + padX, -panelH / 2 + padY);

    // Decide view based on items
    if (!items || items.length === 0) {
      this.createEmpty(listW, listH);
    } else {
      this.createList(items, listW, listH, su);
    }

    // Close button
    this.closeBtn = new UiButton(this, w / 2, h / 2 + panelH / 2 - 56 * su, "ĐÓNG", panelW * 0.42, true, true);
    this.add.existing(this.closeBtn);
    this.closeBtn.setFontSize(Math.round(18 * su));
    this.closeBtn.onClick(() => this.stop());

    // Handle resize simply by restart
    this.scale.on('resize', () => this.scene.restart({items}));
  }

  private createEmpty(availW: number, availH: number) {
    const su = scaleUnit();
    const illu = this.textures.exists("coin_history_empty")
      ? this.add.image(0, 0, "coin_history_empty").setOrigin(0.5)
      : this.add.rectangle(0, 0, 160 * su, 90 * su, 0xE8F0C2).setOrigin(0.5) as any;

    // scale illustration
    if ((illu as any).texture) {
      const tex = (illu as any).texture.getSourceImage() as HTMLImageElement;
      const scale = Math.min((availW * 0.4) / tex.width, (availH * 0.25) / tex.height);
      (illu as Phaser.GameObjects.Image).setDisplaySize(tex.width * scale, tex.height * scale);
    }

    const title = this.add.text(0, 0, "Chưa có lịch sử xu", {
      fontFamily: getAppFontFamily(),
      fontStyle: '800',
      fontSize: Math.round(26 * su),
      color: '#292929',
      align: 'center'
    }).setOrigin(0.5);

    const hint = this.add.text(0, 0, "Hãy hoàn thành đơn hoặc điểm danh mỗi ngày để\nnhận xu nhé", {
      fontFamily: getAppFontFamily(),
      fontStyle: '700',
      fontSize: Math.round(18 * su),
      color: '#6B6B6B',
      align: 'center'
    }).setOrigin(0.5);

    illu.setPosition(availW / 2, Math.max(illusY(availH, su), 0));
    title.setPosition(availW / 2, illu.y + (illu as any).displayHeight / 2 + 22 * su);
    hint.setPosition(availW / 2, title.y + title.height / 2 + 14 * su);

    this.content.add([illu as any, title, hint]);

    // set up mask for consistent structure (even though no scroll)
    this.setupMask(availW, availH);

    function illusY(h: number, s: number) {
      return h * 0.35 - 30 * s;
    }
  }

  private createList(items: CoinHistoryItem[], availW: number, availH: number, su: number) {
    const rowPadY = 16 * su;
    const amountStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: getAppFontFamily(),
      fontStyle: '800',
      fontSize: Math.round(22 * su),
      color: '#F0A400',
      align: 'right',
      stroke: '#FFFFFF',
      strokeThickness: Math.max(2, Math.round(3 * su)),
    };
    const titleStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: getAppFontFamily(),
      fontStyle: '800',
      fontSize: Math.round(20 * su),
      color: '#2D2D2D',
    };
    const dateStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: getAppFontFamily(),
      fontStyle: '700',
      fontSize: Math.round(14 * su),
      color: '#7B7B7B',
    };

    let y = 0;
    const sepColor = 0xE9EDF2;

    // rows
    for (const it of items) {
      const row = this.add.container(0, y);

      // separator line top (skip first)
      if (y > 0) {
        const sep = this.add.rectangle(0, 0, availW, 2, sepColor).setOrigin(0, 0);
        row.add(sep);
        y += 2;
      }

      const rowYStart = y;
      const leftX = 0;
      const rightX = availW;

      const title = this.add.text(leftX, rowYStart + rowPadY * 0.3, it.title, titleStyle).setOrigin(0, 0);
      const date = this.add.text(leftX, 0, it.date, dateStyle).setOrigin(0, 0);
      date.y = title.y + title.height + 4 * su;

      const amtText = `${it.amount >= 0 ? '+' : ''}${formatNumber(it.amount)} xu`;
      const amt = this.add.text(rightX, title.y, amtText, {
        ...amountStyle,
        color: it.amount >= 0 ? '#F0A400' : '#3D5061',
        align: 'right',
      }).setOrigin(1, 0);

      const rowHeight = Math.max(date.y + date.height + rowPadY - rowYStart, amt.height + rowPadY);

      row.add([title, date, amt]);
      this.content.add(row);

      y = rowYStart + rowHeight;
    }

    this.contentH = y;
    this.setupMask(availW, availH);
    this.enableScroll();

    function formatNumber(n: number) {
      return Math.abs(n).toLocaleString('vi-VN');
    }
  }

  private setupMask(w: number, h: number) {
    this.viewH = h;
    this.maskGfx = this.add.graphics({x: this.content.x, y: this.content.y});
    this.maskGfx.fillStyle(0x000000, 1);
    this.maskGfx.fillRect(0, 0, w, h);
    const mask = this.maskGfx.createGeometryMask();
    this.content.setMask(mask);

    // simple scrollbar visuals
    this.scrollTrack = this.add.graphics();
    this.scrollThumb = this.add.graphics();
    this.panel.add([this.scrollTrack, this.scrollThumb]);
    this.drawScrollbar(w, h);
  }

  private enableScroll() {
    const setScroll = (y: number) => {
      if (this.contentH <= this.viewH) return; // no scroll
      const minY = -(this.contentH - this.viewH);
      this.scrollY = Phaser.Math.Clamp(y, minY, 0);
      this.content.y = this.scrollY;
      this.updateScrollbar();
    };

    this.input.on('wheel', (_p: any, _go: any, _dx: number, dy: number) => setScroll(this.scrollY - dy * 0.6));

    let dragging = false; let startY = 0; let startScroll = 0;
    const zone = this.add.zone(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height)
      .setScrollFactor(0)
      .setInteractive();
    zone.on('pointerdown', (p: Phaser.Input.Pointer) => { dragging = true; startY = p.y; startScroll = this.scrollY; });
    this.input.on('pointerup', () => dragging = false);
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => { if (dragging) setScroll(startScroll + (p.y - startY)); });
  }

  private drawScrollbar(w: number, h: number) {
    const su = scaleUnit();
    const x = w / 2 - 6 * su; // right inside panel content area (relative to content container origin)
    const y = -this.panel.height / 2 + 20 * su; // not used accurately, we'll place in panel coordinates next lines

    const trackX = this.panel.x + this.panel.width / 2 - 24 * su; // in screen space
    const trackTop = this.panel.y - (Math.min(980 * su, this.scale.height * 0.8) / 2) + 20 * su;
    const trackH = Math.min(980 * su, this.scale.height * 0.8) - 20 * su * 2 - 90 * su; // match content area

    this.scrollTrack.clear();
    this.scrollTrack.fillStyle(0xE6E9EE, 1);
    this.scrollTrack.fillRoundedRect(trackX, trackTop, 4 * su, trackH, 2 * su);

    this.updateScrollbar();
  }

  private updateScrollbar() {
    const su = scaleUnit();
    // compute thumb size and position
    const trackX = this.panel.x + this.panel.width / 2 - 24 * su;
    const trackTop = this.panel.y - (Math.min(980 * su, this.scale.height * 0.8) / 2) + 20 * su;
    const trackH = Math.min(980 * su, this.scale.height * 0.8) - 20 * su * 2 - 90 * su;

    this.scrollThumb.clear();

    if (this.contentH <= this.viewH + 1) return; // nothing to draw

    const ratio = this.viewH / this.contentH;
    const thumbH = Math.max(24 * su, trackH * ratio);
    const maxScroll = this.contentH - this.viewH;
    const progress = -this.scrollY / maxScroll; // 0..1
    const y = trackTop + (trackH - thumbH) * progress;

    this.scrollThumb.fillStyle(0xC5CED8, 1);
    this.scrollThumb.fillRoundedRect(trackX, y, 4 * su, thumbH, 2 * su);
  }

  private stop() {
    // remove listeners and stop
    this.input.removeAllListeners();
    this.scene.stop();
  }
}
