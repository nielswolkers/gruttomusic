// Extract dominant colors from an image URL
export async function extractColors(imageUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";

    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve('linear-gradient(135deg, rgba(62, 139, 104, 0.4) 0%, rgba(42, 95, 74, 0.6) 100%)');
        return;
      }

      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const colorCounts: { [key: string]: number } = {};

      // Sample colors
      for (let i = 0; i < imageData.length; i += 4 * 10) {
        const r = imageData[i];
        const g = imageData[i + 1];
        const b = imageData[i + 2];
        const a = imageData[i + 3];

        if (a < 125) continue;
        if (r > 250 && g > 250 && b > 250) continue;
        if (r < 10 && g < 10 && b < 10) continue;

        const key = `${Math.floor(r / 10)},${Math.floor(g / 10)},${Math.floor(b / 10)}`;
        colorCounts[key] = (colorCounts[key] || 0) + 1;
      }

      const sortedColors = Object.entries(colorCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);

      if (sortedColors.length > 0) {
        const [r, g, b] = sortedColors[0][0].split(',').map(n => parseInt(n) * 10);
        const [r2, g2, b2] = sortedColors[1]?.[0].split(',').map(n => parseInt(n) * 10) || [r, g, b];

        // Darken colors to ensure white text is readable (multiply by 0.4 for dark enough backgrounds)
        const darkR = Math.floor(r * 0.4);
        const darkG = Math.floor(g * 0.4);
        const darkB = Math.floor(b * 0.4);
        const darkR2 = Math.floor(r2 * 0.4);
        const darkG2 = Math.floor(g2 * 0.4);
        const darkB2 = Math.floor(b2 * 0.4);

        const gradient = `linear-gradient(135deg, rgba(${darkR}, ${darkG}, ${darkB}, 0.95) 0%, rgba(${darkR2}, ${darkG2}, ${darkB2}, 1) 100%)`;
        resolve(gradient);
      } else {
        resolve('linear-gradient(135deg, rgba(25, 55, 42, 0.95) 0%, rgba(17, 38, 30, 1) 100%)');
      }
    };

    img.onerror = () => {
      resolve('linear-gradient(135deg, rgba(62, 139, 104, 0.4) 0%, rgba(42, 95, 74, 0.6) 100%)');
    };

    img.src = imageUrl;
  });
}
