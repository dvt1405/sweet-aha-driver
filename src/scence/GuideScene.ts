import Phaser from "phaser";
import UiButton from "@/ui/UiButton";
import {getAppFontFamily} from "@/utils/fonts";
import {scaleUnit} from "@/utils/CanvasSize";

/**
 * GuideScene: Overlay modal with scrollable instructions content.
 * Reuses existing textures & UiButton for styling.
 */
export default class GuideScene extends Phaser.Scene {
  private dim!: Phaser.GameObjects.Rectangle;
  private panel!: Phaser.GameObjects.Container;
  private contentContainer!: Phaser.GameObjects.Container;
  private maskGraphics!: Phaser.GameObjects.Graphics;
  private maskGeom!: Phaser.GameObjects.Rectangle;
  private closeBtn!: UiButton;

  // scrollbar
  private scrollTrack!: Phaser.GameObjects.Graphics;
  private scrollThumb!: Phaser.GameObjects.Graphics;

  private scrollAreaHeight = 0;
  private contentHeight = 0;
  private scrollY = 0; // negative number when scrolled up

  constructor() {
    super("GuideScene");
  }

  create() {
    const {width: w, height: h} = this.scale;
    const su = scaleUnit();

    // Dim background
    this.dim = this.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.55)
      .setInteractive({useHandCursor: false});
    this.dim.on("pointerup", () => this.stop());

    // Panel container
    this.panel = this.add.container(w / 2, h / 2);

    // White rounded panel with subtle border & shadow
    const panelW = Math.min(620 * su, w * 0.9);
    const panelH = Math.min(980 * su, h * 0.8);
    const radius = 24 * su;

    const gfx = this.add.graphics();
    // shadow
    gfx.fillStyle(0x000000, 0.15);
    gfx.fillRoundedRect(-panelW / 2 + 4, -panelH / 2 + 6, panelW, panelH, radius);
    // body
    gfx.lineStyle(2, 0xD7D9DD, 1);
    gfx.fillStyle(0xffffff, 1);
    gfx.fillRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, radius);
    gfx.strokeRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, radius);
    this.panel.add(gfx);

    // Title badge using existing yellow button texture
    const titleImg = this.add.image(0, -panelH / 2 - 28 * su, "bg_button_active").setOrigin(0.5);
    // scale to a small pill width
    const titleTargetW = Math.min(300 * su, w * 0.6);
    const scale = titleTargetW / titleImg.width;
    titleImg.setScale(scale);

    const titleText = this.add.text(0, titleImg.y, "HƯỚNG DẪN", {
      fontFamily: getAppFontFamily(),
      fontStyle: "800",
      fontSize: Math.round(32 * su),
      color: "#6B7C0E",
      stroke: "#FFFFFF",
      strokeThickness: Math.max(3, Math.round(4 * su)),
    }).setOrigin(0.5);

    this.panel.add([titleImg, titleText]);

    // Scrollable content region (inside padding)
    const padX = 24 * su;
    const padY = 20 * su;
    const scrollW = panelW - padX * 2;
    const scrollH = panelH - padY * 2 - 90 * su; // leave room for bottom button

    this.contentContainer = this.add.container(-panelW / 2 + padX, -panelH / 2 + padY);

    // Build content text
    const contentStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: getAppFontFamily(),
      fontStyle: "700",
      fontSize: Math.round(24 * su),
      color: "#3D3D3D",
      wordWrap: {width: scrollW - 12 * su},
      lineSpacing: 8 * su,
    };

    const headingStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      ...contentStyle,
      color: "#F0A400",
    };

    const bullet = (t: string) => `• ${t}`;

    const paragraphs: {type: "h"|"p"; text: string}[] = [
      {type: "h", text: "1) Bắt đầu"},
      {type: "p", text: "Lần đầu tham gia, hệ thống tặng xe Level 1 (xe cơ bản)."},
      {type: "p", text: "Game gồm 10 Level tương ứng 10 mẫu xe. Nâng cấp sẽ đổi sang mẫu xe mới."},

      {type: "h", text: "2) Cách kiếm Xu"},
      {type: "p", text: bullet("Điểm danh mỗi ngày: +10 xu")},
      {type: "p", text: bullet("Vào mục Điểm danh và bấm xác nhận. Mỗi ngày tính từ 00:00–23:59.")},
      {type: "p", text: bullet("Hoàn thành 1 đơn: +50 xu")},
      {type: "p", text: "Xu sẽ được cộng theo dữ liệu đơn hoàn thành. Nếu chưa thấy cập nhật, vui lòng kiểm tra lại Lịch sử sau ít phút."},

      {type: "h", text: "3) Nâng cấp xe (Tăng Level)"},
      {type: "p", text: bullet("Mỗi lần nâng cấp: –3.000 xu.")},
      {type: "p", text: bullet("Khi đủ xu, bấm nút Nâng cấp → hệ thống tự động tăng Level và đổi sang xe mới.")},

      {type: "h", text: "4) Quy tắc chung"},
      {type: "p", text: "Xu chỉ dùng trong game để nâng cấp xe; không quy đổi tiền mặt và không ảnh hưởng đến thu nhập, chính sách hoạt động."},
    ];

    let cursorY = 0;
    for (const p of paragraphs) {
      const style = p.type === "h" ? headingStyle : contentStyle;
      const txt = this.add.text(0, cursorY, p.text, style).setOrigin(0, 0);
      this.contentContainer.add(txt);
      cursorY += txt.height + (p.type === "h" ? 6 * su : 10 * su);
    }
    this.contentHeight = cursorY;

    // Create mask for scroll area
    this.maskGraphics = this.add.graphics({x: -panelW / 2 + padX, y: -panelH / 2 + padY});
    this.maskGraphics.fillStyle(0x000000, 1);
    this.maskGraphics.fillRect(0, 0, scrollW, scrollH);
    const mask = this.maskGraphics.createGeometryMask();
    this.contentContainer.setMask(mask);

    // Scrollbar visuals
    this.scrollTrack = this.add.graphics();
    this.scrollThumb = this.add.graphics();
    this.panel.add([this.scrollTrack, this.scrollThumb]);

    this.scrollAreaHeight = scrollH;
    this.drawScrollbar(panelW, padX, padY, scrollH);

    // Close button
    this.closeBtn = new UiButton(this, w / 2, h / 2 + panelH / 2 - 56 * su, "ĐÓNG", panelW * 0.42, true, true);
    this.add.existing(this.closeBtn);
    this.closeBtn.setFontSize(Math.round(18 * su));
    this.closeBtn.onClick(() => this.stop());

    // Input scrolling
    const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));

    const setScroll = (y: number) => {
      if (this.contentHeight <= this.scrollAreaHeight) return; // no scroll
      const minY = -(this.contentHeight - this.scrollAreaHeight);
      this.scrollY = clamp(y, minY, 0);
      this.contentContainer.y = this.scrollY;
      this.updateScrollbar();
    };

    this.input.on("wheel", (_p: any, _go: any, _dx: number, dy: number) => {
      setScroll(this.scrollY - dy * 0.6);
    });

    // drag to scroll
    let dragging = false;
    let startY = 0;
    let startScroll = 0;
    const dragZone = this.add.zone(w / 2, h / 2, panelW, panelH).setOrigin(0.5).setInteractive();
    dragZone.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      dragging = true; startY = pointer.y; startScroll = this.scrollY;
    });
    this.input.on("pointerup", () => dragging = false);
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (!dragging) return;
      const delta = pointer.y - startY;
      setScroll(startScroll + delta);
    });

    // Layout on resize
    this.scale.on("resize", () => this.scene.restart());
  }

  private drawScrollbar(panelW: number, padX: number, padY: number, scrollH: number) {
    // Draw track on the right inside the panel
    const x = this.panel.x + panelW / 2 - padX / 2;
    const y = this.panel.y - (panelH(this.panel) / 2) + padY; // helper below
    this.scrollTrack.clear();
    this.scrollTrack.fillStyle(0xDADDE2, 1);
    this.scrollTrack.fillRoundedRect(x - 2, y, 4, scrollH, 2);
    this.updateScrollbar();
  }

  private updateScrollbar() {
    const panel = this.panel;
    if (!panel) return;
    const su = scaleUnit();

    const panelW = widthOf(panel);
    const panelH = panelH(panel);
    const padX = 24 * su;
    const padY = 20 * su;
    const trackX = panel.x + panelW / 2 - padX / 2;
    const trackY = panel.y - panelH / 2 + padY;
    const trackH = this.scrollAreaHeight;

    this.scrollThumb.clear();

    if (this.contentHeight <= this.scrollAreaHeight) {
      return; // no thumb when not scrollable
    }

    const visibleRatio = this.scrollAreaHeight / this.contentHeight;
    const thumbH = Math.max(24 * su, trackH * visibleRatio);
    const maxThumbY = trackY + trackH - thumbH;
    const minContentY = -(this.contentHeight - this.scrollAreaHeight);
    const t = (this.scrollY - 0) / (minContentY - 0); // 0 at top, 1 at bottom
    const thumbY = Phaser.Math.Linear(trackY, maxThumbY, t);

    this.scrollThumb.fillStyle(0xAEB5C0, 1);
    this.scrollThumb.fillRoundedRect(trackX - 2, thumbY, 4, thumbH, 2);
  }

  private stop() {
    // Remove listeners and stop scene
    this.input.removeAllListeners();
    this.scene.stop();
  }
}

// Helpers to get size of container drawing (based on first graphics bounds)
function widthOf(c: Phaser.GameObjects.Container): number { return boundsOf(c).width; }
function panelH(c: Phaser.GameObjects.Container): number { return boundsOf(c).height; }
function boundsOf(c: Phaser.GameObjects.Container): Phaser.Geom.Rectangle {
  const list = c.list as Phaser.GameObjects.GameObject[];
  for (const go of list) {
    if (go instanceof Phaser.GameObjects.Graphics) {
      // graphics bounds need manual rectangle used when drawing; approximate by last command
      const b = go.getBounds();
      if (b.width && b.height) return b;
    }
  }
  // fallback
  return new Phaser.Geom.Rectangle(0, 0, 600, 800);
}
