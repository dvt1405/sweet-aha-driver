import Phaser from "phaser";
import UiButton from "@/ui/UiButton";
import BasePopup from "@/ui/BasePopup";
import {getAppFontFamily} from "@/utils/fonts";
import {scaleUnit} from "@/utils/CanvasSize";
import {Scence} from "@/utils/Constants";

export type CoinHistoryItem = {
  title: string;
  date: string; // dd/MM/yyyy
  amount: number; // positive or negative
};

/**
 * CoinHistoryScene - displays coin transaction history in a popup
 * Shows list of transactions or empty state based on data
 */
export default class CoinHistoryScene extends Phaser.Scene {
  private popup!: BasePopup;
  private content!: Phaser.GameObjects.Container;
  private maskGfx!: Phaser.GameObjects.Graphics;
  private scrollTrack!: Phaser.GameObjects.Graphics;
  private scrollThumb!: Phaser.GameObjects.Graphics;
  private closeBtn!: UiButton;

  private viewH = 0;
  private contentH = 0;
  private scrollY = 0;

  constructor() {
    super(Scence.CoinHistory);
  }

  preload() {
    if (!this.textures.exists("popup_header")) {
      this.load.image("popup_header", "/bg_btn_header_popup.png");
    }
    if (!this.textures.exists("coin_history_empty")) {
      this.load.image("coin_history_empty", "/histoty_empty_content.png");
    }
  }

  create(data: {items?: CoinHistoryItem[]}) {
    const items: CoinHistoryItem[] = data?.items ?? [];
    const {width: w, height: h} = this.scale;
    const su = scaleUnit();

    // Create base popup with #F1F3F4 background
    this.popup = new BasePopup(this);
    const panelW = this.popup.width;
    const panelH = this.popup.height;

    // Header badge above popup
    const titleImg = this.add.image(
      this.popup.root.x, 
      this.popup.root.y - panelH / 2 - 28 * su, 
      "popup_header"
    ).setOrigin(0.5);
    const titleTargetW = Math.min(300 * su, w * 0.65);
    titleImg.setScale(titleTargetW / titleImg.width);

    const titleText = this.add.text(
      this.popup.root.x, 
      titleImg.y, 
      "LỊCH SỬ XU", 
      {
        fontFamily: getAppFontFamily(),
        fontStyle: "800",
        fontSize: Math.round(28 * su),
        color: "#6B7C0E",
        stroke: "#FFFFFF",
        strokeThickness: Math.max(2, Math.round(3 * su)),
      }
    ).setOrigin(0.5);

    // Content area dimensions
    const padX = 20 * su;
    const padY = 24 * su;
    const listW = panelW - padX * 2;
    const listH = panelH - padY * 2 - 80 * su; // reserve space for close button

    // Content container inside popup
    this.content = this.add.container(0, 0);
    this.popup.content.add(this.content);

    // Build list or empty state
    if (!items || items.length === 0) {
      this.createEmptyState(listW, listH, su);
    } else {
      this.createList(items, listW, listH, su);
    }

    // Close button at bottom
    this.closeBtn = new UiButton(
      this, 
      w / 2, 
      this.popup.root.y + panelH / 2 - 50 * su, 
      "ĐÓNG", 
      panelW * 0.5, 
      true, 
      true
    );
    this.add.existing(this.closeBtn);
    this.closeBtn.setFontSize(Math.round(20 * su));
    this.closeBtn.onClick(() => this.stop());

    // Ensure proper z-ordering: dim at back, popup in middle, title/button on top
    this.children.bringToTop(this.popup.dim);
    this.children.bringToTop(this.popup.root);
    this.children.bringToTop(titleImg);
    this.children.bringToTop(titleText);
    this.children.bringToTop(this.closeBtn);

    // Handle resize
    this.scale.on('resize', () => this.scene.restart({items}));
  }

  private createEmptyState(w: number, h: number, su: number) {
    // Illustration
    const illu = this.add.image(0, 0, "coin_history_empty").setOrigin(0.5);
    const targetSize = Math.min(w * 0.35, h * 0.25);
    const scale = targetSize / Math.max(illu.width, illu.height);
    illu.setScale(scale);

    // Position illustration in upper-middle area
    const illuY = h * 0.32;
    illu.setPosition(w / 2, illuY);

    // Title
    const title = this.add.text(w / 2, illu.y + illu.displayHeight / 2 + 24 * su, "Chưa có lịch sử xu", {
      fontFamily: getAppFontFamily(),
      fontStyle: '800',
      fontSize: Math.round(24 * su),
      color: '#2D2D2D',
      align: 'center'
    }).setOrigin(0.5);

    // Hint text
    const hint = this.add.text(
      w / 2, 
      title.y + title.height / 2 + 16 * su, 
      "Hãy hoàn thành đơn hoặc điểm danh mỗi ngày để\nnhận xu nhé", 
      {
        fontFamily: getAppFontFamily(),
        fontStyle: '600',
        fontSize: Math.round(16 * su),
        color: '#7B7B7B',
        align: 'center',
        lineSpacing: 4
      }
    ).setOrigin(0.5);

    this.content.add([illu, title, hint]);

    // Setup mask (for consistency)
    this.viewH = h;
    this.contentH = 0;
    this.maskGfx = this.add.graphics({x: this.popup.content.x, y: this.popup.content.y});
    this.maskGfx.fillStyle(0xFFFFFF, 1);
    this.maskGfx.fillRect(0, 0, w, h);
    const mask = this.maskGfx.createGeometryMask();
    this.content.setMask(mask);
    this.maskGfx.setVisible(false);
  }

  private createList(items: CoinHistoryItem[], w: number, h: number, su: number) {
    const itemSpacing = 20 * su;
    let y = 0;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const row = this.add.container(0, y);

      // Separator line (very subtle, skip first item)
      if (i > 0) {
        const sep = this.add.rectangle(0, 0, w, 1, 0xE0E3E6, 0.6).setOrigin(0, 0);
        row.add(sep);
        y += 1;
      }

      const rowStartY = y;

      // Title (left side)
      const titleText = this.add.text(0, rowStartY + 12 * su, item.title, {
        fontFamily: getAppFontFamily(),
        fontStyle: '800',
        fontSize: Math.round(18 * su),
        color: '#2D2D2D',
      }).setOrigin(0, 0);

      // Date (below title)
      const dateText = this.add.text(0, titleText.y + titleText.height + 4 * su, item.date, {
        fontFamily: getAppFontFamily(),
        fontStyle: '600',
        fontSize: Math.round(14 * su),
        color: '#8B8B8B',
      }).setOrigin(0, 0);

      // Amount (right side)
      const amountStr = `${item.amount >= 0 ? '+' : ''}${this.formatNumber(item.amount)} xu`;
      const amountColor = item.amount >= 0 ? '#F0A400' : '#3D5061';
      const amountText = this.add.text(w, titleText.y, amountStr, {
        fontFamily: getAppFontFamily(),
        fontStyle: '800',
        fontSize: Math.round(20 * su),
        color: amountColor,
        align: 'right',
      }).setOrigin(1, 0);

      row.add([titleText, dateText, amountText]);
      this.content.add(row);

      // Update y for next row
      const rowHeight = dateText.y + dateText.height - rowStartY + itemSpacing;
      y = rowStartY + rowHeight;
    }

    this.contentH = y;
    this.viewH = h;

    // Setup mask
    this.maskGfx = this.add.graphics({x: this.popup.content.x, y: this.popup.content.y});
    this.maskGfx.fillStyle(0xFFFFFF, 1);
    this.maskGfx.fillRect(0, 0, w, h);
    const mask = this.maskGfx.createGeometryMask();
    this.content.setMask(mask);
    this.maskGfx.setVisible(false);

    // Enable scrolling if content is taller than view
    if (this.contentH > this.viewH) {
      this.enableScroll();
      this.createScrollbar(w, h, su);
    }
  }

  private formatNumber(n: number): string {
    return Math.abs(n).toLocaleString('vi-VN');
  }

  private enableScroll() {
    const setScroll = (y: number) => {
      if (this.contentH <= this.viewH) return;
      const minY = -(this.contentH - this.viewH);
      this.scrollY = Phaser.Math.Clamp(y, minY, 0);
      this.content.y = this.scrollY;
      this.updateScrollbar();
    };

    // Mouse wheel
    this.input.on('wheel', (_p: any, _go: any, _dx: number, dy: number) => {
      setScroll(this.scrollY - dy * 0.5);
    });

    // Touch drag
    let dragging = false;
    let startY = 0;
    let startScroll = 0;

    const zone = this.add.zone(
      this.scale.width / 2, 
      this.scale.height / 2, 
      this.scale.width, 
      this.scale.height
    ).setInteractive();

    zone.on('pointerdown', (p: Phaser.Input.Pointer) => {
      dragging = true;
      startY = p.y;
      startScroll = this.scrollY;
    });

    this.input.on('pointerup', () => dragging = false);
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (dragging) {
        setScroll(startScroll + (p.y - startY));
      }
    });
  }

  private createScrollbar(w: number, h: number, su: number) {
    this.scrollTrack = this.add.graphics();
    this.scrollThumb = this.add.graphics();

    const trackX = this.popup.root.x + this.popup.width / 2 - 18 * su;
    const trackTop = this.popup.root.y - this.popup.height / 2 + 24 * su;
    const trackH = this.viewH - 16 * su;

    // Track
    this.scrollTrack.fillStyle(0xD9DDE3, 0.5);
    this.scrollTrack.fillRoundedRect(trackX, trackTop, 4 * su, trackH, 2 * su);

    this.updateScrollbar();
  }

  private updateScrollbar() {
    if (!this.scrollThumb || this.contentH <= this.viewH) return;

    const su = scaleUnit();
    const trackX = this.popup.root.x + this.popup.width / 2 - 18 * su;
    const trackTop = this.popup.root.y - this.popup.height / 2 + 24 * su;
    const trackH = this.viewH - 16 * su;

    this.scrollThumb.clear();

    const ratio = this.viewH / this.contentH;
    const thumbH = Math.max(30 * su, trackH * ratio);
    const maxScroll = this.contentH - this.viewH;
    const progress = maxScroll > 0 ? -this.scrollY / maxScroll : 0;
    const thumbY = trackTop + (trackH - thumbH) * progress;

    this.scrollThumb.fillStyle(0xB0B6BE, 0.8);
    this.scrollThumb.fillRoundedRect(trackX, thumbY, 4 * su, thumbH, 2 * su);
  }

  private stop() {
    this.input.removeAllListeners();
    this.scene.stop();
  }
}
