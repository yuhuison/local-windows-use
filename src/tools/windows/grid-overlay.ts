import sharp from 'sharp';

export interface GridOptions {
  /** Minor grid line spacing in pixels (default: 100) */
  gridSpacing?: number;
  /** Coordinate label spacing in pixels (default: 200) */
  labelSpacing?: number;
  /** X offset for coordinate labels (e.g. window x position on screen) */
  offsetX?: number;
  /** Y offset for coordinate labels (e.g. window y position on screen) */
  offsetY?: number;
}

export interface GridResult {
  /** The annotated image buffer (JPEG) */
  image: Buffer;
  /** Text coordinate reference table for LLM consumption */
  gridRef: string;
}

/**
 * Add a coordinate grid overlay with numbered reference markers to a JPEG image buffer.
 * Returns the annotated image AND a text coordinate table that maps marker numbers to (x,y) screen coordinates.
 */
export async function addCoordinateGrid(
  imageBuffer: Buffer,
  width: number,
  height: number,
  options: GridOptions = {},
): Promise<GridResult> {
  const gridSpacing = options.gridSpacing ?? 100;
  const labelSpacing = options.labelSpacing ?? 200;
  const majorSpacing = gridSpacing * 5; // 500px
  const offsetX = options.offsetX ?? 0;
  const offsetY = options.offsetY ?? 0;

  const svgParts: string[] = [];

  // --- Grid lines ---
  for (let x = gridSpacing; x < width; x += gridSpacing) {
    const isMajor = x % majorSpacing === 0;
    const opacity = isMajor ? 0.35 : 0.15;
    const sw = isMajor ? 1.5 : 0.5;
    svgParts.push(
      `<line x1="${x}" y1="0" x2="${x}" y2="${height}" stroke="rgba(255,50,50,${opacity})" stroke-width="${sw}"/>`,
    );
  }
  for (let y = gridSpacing; y < height; y += gridSpacing) {
    const isMajor = y % majorSpacing === 0;
    const opacity = isMajor ? 0.35 : 0.15;
    const sw = isMajor ? 1.5 : 0.5;
    svgParts.push(
      `<line x1="0" y1="${y}" x2="${width}" y2="${y}" stroke="rgba(255,50,50,${opacity})" stroke-width="${sw}"/>`,
    );
  }

  // --- Numbered reference markers at grid intersections ---
  interface Marker { id: number; screenX: number; screenY: number }
  const markers: Marker[] = [];
  let markerId = 1;

  for (let y = labelSpacing; y < height; y += labelSpacing) {
    for (let x = labelSpacing; x < width; x += labelSpacing) {
      const screenX = x + offsetX;
      const screenY = y + offsetY;
      markers.push({ id: markerId, screenX, screenY });

      const label = String(markerId);
      const r = label.length > 1 ? 12 : 10;

      svgParts.push(
        `<circle cx="${x}" cy="${y}" r="${r}" fill="rgba(0,110,255,0.85)" stroke="white" stroke-width="1"/>`,
        `<text x="${x}" y="${y + 4}" text-anchor="middle" fill="white" font-size="${label.length > 1 ? 9 : 10}" font-family="Consolas,monospace" font-weight="bold">${label}</text>`,
      );

      markerId++;
    }
  }

  // --- Coordinate labels along top edge ---
  for (let x = labelSpacing; x < width; x += labelSpacing) {
    const text = String(x + offsetX);
    const tw = text.length * 7.5 + 6;
    svgParts.push(
      `<rect x="${x - tw / 2}" y="2" width="${tw}" height="16" fill="rgba(0,0,0,0.65)" rx="3"/>`,
      `<text x="${x}" y="14" text-anchor="middle" fill="#ff6666" font-size="11" font-family="Consolas,monospace" font-weight="bold">${text}</text>`,
    );
  }

  // --- Coordinate labels along left edge ---
  for (let y = labelSpacing; y < height; y += labelSpacing) {
    const text = String(y + offsetY);
    const tw = text.length * 7.5 + 6;
    svgParts.push(
      `<rect x="2" y="${y - 8}" width="${tw}" height="16" fill="rgba(0,0,0,0.65)" rx="3"/>`,
      `<text x="5" y="${y + 4}" fill="#ff6666" font-size="11" font-family="Consolas,monospace" font-weight="bold">${text}</text>`,
    );
  }

  // --- Origin label ---
  const originText = `${offsetX},${offsetY}`;
  const originTw = originText.length * 7.5 + 6;
  svgParts.push(
    `<rect x="2" y="2" width="${originTw}" height="16" fill="rgba(0,0,0,0.65)" rx="3"/>`,
    `<text x="5" y="14" fill="#ff6666" font-size="11" font-family="Consolas,monospace" font-weight="bold">${originText}</text>`,
  );

  // --- Dimension label at bottom-right ---
  const dimText = `${width}x${height}`;
  const dimTw = dimText.length * 7.5 + 6;
  svgParts.push(
    `<rect x="${width - dimTw - 2}" y="${height - 18}" width="${dimTw}" height="16" fill="rgba(0,0,0,0.65)" rx="3"/>`,
    `<text x="${width - dimTw / 2 - 2}" y="${height - 6}" text-anchor="middle" fill="#ff6666" font-size="11" font-family="Consolas,monospace" font-weight="bold">${dimText}</text>`,
  );

  const svg = Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${svgParts.join('')}</svg>`,
  );

  const image = await sharp(imageBuffer)
    .composite([{ input: svg, top: 0, left: 0 }])
    .jpeg({ quality: 70 })
    .toBuffer();

  // Build text coordinate reference table
  const cols = Math.floor((width - 1) / labelSpacing); // markers per row
  const rows: string[] = [];
  for (let i = 0; i < markers.length; i += cols) {
    const row = markers.slice(i, i + cols)
      .map(m => `[${m.id}](${m.screenX},${m.screenY})`)
      .join(' ');
    rows.push(row);
  }
  const gridRef = `Grid reference points (marker → screen coordinates for mouse_click):\n${rows.join('\n')}`;

  return { image, gridRef };
}
