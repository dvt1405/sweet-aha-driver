export const canvasBaseSizeWidth = 375;
export const canvasBaseSizeHeight = 812;

export const gameConfigWidth = 1080;
export const gameConfigHeight = 1920;
let scale: number | null = null;

export const scaleUnit = (width: number = gameConfigWidth, height: number = gameConfigHeight) => {
    if (scale) return scale;
    scale = Math.min(width / canvasBaseSizeWidth, height / canvasBaseSizeHeight);
    return scale;
}
