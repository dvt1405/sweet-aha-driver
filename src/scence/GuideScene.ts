import Phaser from "phaser";
import BasePopup from "@/ui/BasePopup";
import {getAppFontFamily} from "@/utils/fonts";
import {scaleUnit} from "@/utils/CanvasSize";

/**
 * GuideScene: Overlay modal with scrollable instructions content.
 * Reuses existing textures & UiButton for styling.
 */
export default class GuideScene extends Phaser.Scene {
  private popup!: BasePopup;
  private contentContainer!: Phaser.GameObjects.Container;
  private scrollTrack!: Phaser.GameObjects.Graphics;
  private scrollThumb!: Phaser.GameObjects.Graphics;

  private contentHeight = 0;
  private viewHeight = 0;
  private scrollY = 0;

  constructor() {
    super("GuideScene");
  }

  create() {
    const {width: w, height: h} = this.scale;
    const su = scaleUnit();

    // BasePopup with header and close button
    this.popup = new BasePopup(this, {
      width: w,
      height: h,
      headerImageKey: "popup_header",
      titleText: "HƯỚNG DẪN",
      closeButtonText: "ĐÓNG",
      onClose: () => this.stop(),
    });

    // Scrollable content area inside popup
    const listW = this.popup.content.width * 0.9 - 24 * su;
    const listH = this.popup.contentHeight;
    this.viewHeight = listH;

    this.contentContainer = this.add.container((w - listW) / 2, 0);
    this.popup.content.add(this.contentContainer);

    // Build content text
    const contentStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: getAppFontFamily(),
      fontStyle: "700",
      fontSize: Math.round(24 * su),
      color: "#3D3D3D",
      wordWrap: {width: listW - 12 * su},
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

    // Mask for scroll area (in world coordinates matching the popup content viewport)
    const viewRect = {
      x: this.popup.root.x + this.popup.content.x + this.contentContainer.x,
      y: this.popup.root.y + this.popup.content.y + this.contentContainer.y,
      w: listW,
      h: listH,
    };
    const maskGfx = this.add.graphics({ x: viewRect.x, y: viewRect.y });
    maskGfx.fillStyle(0x000000, 1);
    maskGfx.fillRect(0, 0, viewRect.w, viewRect.h);
    const mask = maskGfx.createGeometryMask();
    this.contentContainer.setMask(mask);
    maskGfx.setVisible(false);

    // Scrollbar visuals (track + thumb) aligned to BasePopup
    this.scrollTrack = this.add.graphics();
    this.scrollThumb = this.add.graphics();

    const drawTrack = () => {
      this.scrollTrack.clear();
      const trackX = this.popup.root.x + this.popup.width / 2 - 18 * su; // right edge of popup
      const trackTop = viewRect.y; // align to top of content viewport
      const trackH = listH;        // span exactly the content viewport height
      this.scrollTrack.fillStyle(0xD9DDE3, 0.5);
      this.scrollTrack.fillRoundedRect(trackX, trackTop, 4 * su, trackH, 2 * su);
    };
    drawTrack();

    const updateScrollbar = () => {
      this.scrollThumb.clear();
      if (this.contentHeight <= this.viewHeight) return;
      const trackX = this.popup.root.x + this.popup.width / 2 - 18 * su; // right edge of popup
      const trackTop = viewRect.y; // align to top of content viewport
      const trackH = listH;        // span exactly the content viewport height
      const ratio = this.viewHeight / this.contentHeight;
      const thumbH = Math.max(30 * su, trackH * ratio);
      const maxScroll = this.contentHeight - this.viewHeight;
      const progress = maxScroll > 0 ? -this.scrollY / maxScroll : 0;
      const thumbY = trackTop + (trackH - thumbH) * progress;
      this.scrollThumb.fillStyle(0xB0B6BE, 0.8);
      this.scrollThumb.fillRoundedRect(trackX, thumbY, 4 * su, thumbH, 2 * su);
    };

    const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));
    const setScroll = (y: number) => {
      if (this.contentHeight <= this.viewHeight) return;
      const minY = -(this.contentHeight - this.viewHeight);
      this.scrollY = clamp(y, minY, 0);
      this.contentContainer.y = this.scrollY;
      updateScrollbar();
    };

    // Initial scrollbar state
    setScroll(0);

    // Restrict wheel and drag to the content viewport only
    let isOverContent = false;
    const scrollZone = this.add.zone(
      viewRect.x + listW / 2,
      viewRect.y + listH / 2,
      listW,
      listH
    ).setInteractive();
    scrollZone.on("pointerover", () => { isOverContent = true; });
    scrollZone.on("pointerout", () => { isOverContent = false; });

    // Wheel scroll only when the mouse pointer is within the content viewport
    this.input.on("wheel", (_p: any, _go: any, _dx: number, dy: number) => {
      const px = this.input.activePointer.x;
      const py = this.input.activePointer.y;
      const inside = (px >= viewRect.x && px <= viewRect.x + listW && py >= viewRect.y && py <= viewRect.y + listH);
      if (!inside) return;
      setScroll(this.scrollY - dy * 0.5);
    });

    // Drag to scroll with kinetic momentum (mobile-friendly)
    let dragging = false;
    let startY = 0;
    let startScroll = 0;
    let lastY = 0;
    let lastT = 0;
    let velocity = 0; // px per ms
    let momentum: Phaser.Time.TimerEvent | null = null;

    const cancelMomentum = () => {
      if (momentum) {
        try { momentum.remove(false); } catch {}
        momentum = null;
      }
    };

    scrollZone.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      cancelMomentum();
      dragging = true;
      startY = pointer.y;
      startScroll = this.scrollY;
      lastY = pointer.y;
      lastT = this.time.now;
      velocity = 0;
    });

    this.input.on("pointerup", () => {
      if (!dragging) return;
      dragging = false;

      // Start kinetic momentum if velocity is significant
      let v = Phaser.Math.Clamp(velocity, -2.5, 2.5); // px/ms cap
      if (Math.abs(v) < 0.01) return;
      const friction = 0.95; // decay per frame (~60fps)
      const stepMs = 16; // ms per step
      const minYBound = -(this.contentHeight - this.viewHeight);

      momentum = this.time.addEvent({
        delay: stepMs,
        loop: true,
        callback: () => {
          this.scrollY = this.scrollY + v * stepMs;
          setScroll(this.scrollY);

          // Stop at bounds
          if ((this.scrollY >= 0 && v > 0) || (this.scrollY <= minYBound && v < 0)) {
            setScroll(Phaser.Math.Clamp(this.scrollY, minYBound, 0));
            cancelMomentum();
            return;
          }

          // Apply friction
          v *= friction;
          if (Math.abs(v) < 0.01) {
            cancelMomentum();
          }
        }
      });
    });

    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (!dragging) return;
      const now = this.time.now;
      const delta = pointer.y - startY;
      setScroll(startScroll + delta);

      // Update smoothed velocity
      const dy = pointer.y - lastY;
      const dt = Math.max(1, now - lastT);
      const inst = dy / dt; // px per ms
      // Exponential smoothing to reduce jitter
      velocity = Phaser.Math.Linear(velocity, inst, 0.35);

      lastY = pointer.y;
      lastT = now;
    });

    // Layout on resize
    this.scale.on("resize", () => this.scene.restart());
  }

  private stop() {
    // Remove listeners and stop scene
    this.input.removeAllListeners();
    try { this.popup?.destroy(); } catch {}
    this.scene.stop();
  }
}
